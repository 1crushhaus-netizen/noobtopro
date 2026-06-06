import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock only getSupabaseAdmin so we can drive cache hits/misses; keep the REAL
// conceptKey normalizer (via importActual) so the route's cache-key derivation —
// quote-stripping, whitespace collapse, lowercasing — is genuinely exercised
// rather than shadowed by a re-implementation that could drift from production.
const mocks = vi.hoisted(() => ({ getAdmin: vi.fn(() => null) }));
vi.mock("@/lib/supabaseAdmin", async (importActual) => {
  const actual = await importActual();
  return { getSupabaseAdmin: () => mocks.getAdmin(), conceptKey: actual.conceptKey };
});

// Build a fake admin client matching the route's from().select().eq().eq()
// .maybeSingle() reads and its rpc("promote_or_insert_guide", ...) write. Captures
// the table + filters so a column/value regression on the cache-read path is
// catchable, and the last rpc call so the write payload can be asserted.
function fakeAdmin({ hitContent = null, onRpc, rpcThrows, expectSubject = null, expectKey = null } = {}) {
  const filters = {};
  const calls = { rpc: null };
  const client = {
    filters,
    calls,
    from: (table) => {
      filters.table = table;
      return {
        select: () => ({
          eq: (c1, v1) => {
            filters[c1] = v1;
            return {
              eq: (c2, v2) => {
                filters[c2] = v2;
                return {
                  maybeSingle: async () => {
                    // Honor the filter VALUES: a hit is returned only when the
                    // queried subject/key match what the caller expects. This makes
                    // a wrong-column / wrong-value regression on the read path fail
                    // the test, instead of returning a hit regardless of filters.
                    const subjectOk = expectSubject == null || filters.subject === expectSubject;
                    const keyOk = expectKey == null || filters.concept_key === expectKey;
                    const hit = hitContent && subjectOk && keyOk;
                    return { data: hit ? { content: hitContent } : null };
                  },
                };
              },
            };
          },
        }),
      };
    },
    rpc: async (fn, args) => {
      calls.rpc = { fn, args };
      if (rpcThrows) throw new Error("write blew up");
      onRpc?.(fn, args);
      return { error: null };
    },
  };
  return client;
}

import { POST } from "@/app/api/learn/route";
import { _resetRateLimits } from "@/lib/rateLimit";

function req(bodyObjOrString) {
  const body = typeof bodyObjOrString === "string" ? bodyObjOrString : JSON.stringify(bodyObjOrString);
  return new Request("http://test.local/api/learn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

function mockGroqReturning(payload) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
    text: async () => "",
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  process.env.GROQ_API_KEY = "test-key";
  _resetRateLimits();
  mocks.getAdmin.mockReturnValue(null); // default: no cache (Groq path)
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/learn — request guard (CSRF / content-type)", () => {
  const raw = (headers) =>
    new Request("http://test.local/api/learn", {
      method: "POST",
      headers,
      body: JSON.stringify({ subject: "math", concept: "limits" }),
    });

  it("blocks a forced cross-site request with 403 (no Groq call)", async () => {
    const failFetch = vi.fn(() => { throw new Error("must not call Groq on a blocked request"); });
    vi.stubGlobal("fetch", failFetch);
    const admin = fakeAdmin({ hitContent: null });
    mocks.getAdmin.mockReturnValue(admin);
    const res = await POST(raw({ "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" }));
    expect(res.status).toBe(403);
    expect(failFetch).not.toHaveBeenCalled();
    expect(admin.calls.rpc).toBe(null); // no RPC issued
  });

  it("rejects a non-JSON content-type with 415 (no Groq call)", async () => {
    const failFetch = vi.fn(() => { throw new Error("must not call Groq on a blocked request"); });
    vi.stubGlobal("fetch", failFetch);
    const res = await POST(raw({ "Content-Type": "text/plain" }));
    expect(res.status).toBe(415);
    expect(failFetch).not.toHaveBeenCalled();
  });

  it("allows a same-origin JSON request through to normal handling", async () => {
    mockGroqReturning({ overview: "guarded but allowed", keyIdeas: [], socraticQuestions: [], pitfalls: [], tryThis: "" });
    const res = await POST(raw({ "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.overview).toBe("guarded but allowed");
  });
});

describe("POST /api/learn — validation", () => {
  it("rejects an unknown/prototype subject with 400", async () => {
    for (const subject of ["astrology", "constructor", "__proto__"]) {
      const res = await POST(req({ subject, concept: "limits" }));
      expect(res.status).toBe(400);
    }
  });

  it("rejects a missing concept with 400", async () => {
    const res = await POST(req({ subject: "math" }));
    expect(res.status).toBe(400);
  });

  it("rejects a non-JSON body with 400", async () => {
    const res = await POST(req("nope"));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/learn — guidance", () => {
  it("returns normalized, capped guidance for a concept", async () => {
    mockGroqReturning({
      overview: "Limits describe behavior near a point.",
      keyIdeas: ["approach, not arrival", 42, "  ", "epsilon-delta"],
      socraticQuestions: ["What happens as x nears a?"],
      pitfalls: ["confusing value with limit"],
      tryThis: "Sketch f near the point and watch both sides.",
    });
    const res = await POST(req({ subject: "math", concept: "limits", score: 30 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.subject).toBe("math");
    expect(json.concept).toBe("limits");
    expect(json.overview).toMatch(/Limits/);
    // non-strings/blanks filtered out of arrays
    expect(json.keyIdeas).toEqual(["approach, not arrival", "epsilon-delta"]);
    expect(json.socraticQuestions.length).toBe(1);
    expect(json.tryThis).toMatch(/Sketch/);
  });

  it("normalizes the cached tryThisQuestion into a practice-ready {question,targetConcept,difficulty}", async () => {
    mockGroqReturning({
      overview: "x",
      keyIdeas: [],
      socraticQuestions: [],
      pitfalls: [],
      tryThis: "approach",
      tryThisQuestion: { question: "A 2kg block slides down a frictionless ramp — trace the energy.", difficulty: "Advanced " },
    });
    const res = await POST(req({ subject: "physics", concept: "energy transformation" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tryThisQuestion).toMatchObject({
      question: expect.stringMatching(/2kg block/),
      targetConcept: "energy transformation", // concept threaded in so it slots into the practice UI
      difficulty: "advanced", // case/space-normalized
    });
  });

  it("defaults an unknown tryThisQuestion difficulty to intermediate", async () => {
    mockGroqReturning({ overview: "x", tryThisQuestion: { question: "Q?", difficulty: "impossible" } });
    const res = await POST(req({ subject: "math", concept: "limits" }));
    const json = await res.json();
    expect(json.tryThisQuestion.difficulty).toBe("intermediate");
  });

  it("nulls tryThisQuestion when the guide has no usable question (older rows degrade gracefully)", async () => {
    mockGroqReturning({ overview: "x", tryThisQuestion: { difficulty: "phd" } });
    const res = await POST(req({ subject: "math", concept: "limits" }));
    const json = await res.json();
    expect(json.tryThisQuestion).toBe(null);
  });

  it("tolerates malformed model output (arrays default to [])", async () => {
    mockGroqReturning({ overview: "x", keyIdeas: "not-an-array" });
    const res = await POST(req({ subject: "physics", concept: "work-energy" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.keyIdeas).toEqual([]);
    expect(Array.isArray(json.socraticQuestions)).toBe(true);
  });

  it("returns a generic 500 that does not leak upstream detail", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, text: async () => "Invalid API Key sk-x" })));
    const res = await POST(req({ subject: "chemistry", concept: "equilibrium" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).not.toMatch(/401|Invalid API Key|sk-x/);
    expect(json.error).toMatch(/temporarily unavailable/i);
  });
});

describe("POST /api/learn — shared cache", () => {
  it("returns a cached guide WITHOUT calling Groq on a hit", async () => {
    const stored = { subject: "math", concept: "limits", overview: "cached overview", keyIdeas: ["a"], socraticQuestions: [], pitfalls: [], tryThis: "" };
    const admin = fakeAdmin({ hitContent: stored });
    mocks.getAdmin.mockReturnValue(admin);
    const failFetch = vi.fn(() => { throw new Error("Groq should not be called on a cache hit"); });
    vi.stubGlobal("fetch", failFetch);

    const res = await POST(req({ subject: "math", concept: "Limits ", score: 30 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cached).toBe(true);
    expect(json.overview).toBe("cached overview");
    expect(failFetch).not.toHaveBeenCalled();
    // queried the right table + normalized key
    expect(admin.filters.table).toBe("concept_guides");
    expect(admin.filters.subject).toBe("math");
    expect(admin.filters.concept_key).toBe("limits"); // "Limits " normalized
  });

  it("keys the cache by the normalized concept (no score in the key)", async () => {
    const stored = { subject: "math", concept: "Le Chatelier", overview: "ok", keyIdeas: [], socraticQuestions: [], pitfalls: [], tryThis: "" };
    const admin = fakeAdmin({ hitContent: stored, expectSubject: "math", expectKey: "le chatelier" });
    mocks.getAdmin.mockReturnValue(admin);
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("no Groq on a hit"); }));
    // Different score, messy casing/spacing → same standardized guide.
    const res = await POST(req({ subject: "math", concept: "  LE   Chatelier ", score: 95 }));
    expect(res.status).toBe(200);
    expect(admin.filters.concept_key).toBe("le chatelier");
  });

  it("strips surrounding quotes when keying the cache (real conceptKey normalizer)", async () => {
    // Exercises the real normalizer's quote-stripping: a model/UI that wraps the
    // concept in quotes must hit the SAME shared guide as the unquoted concept.
    const stored = { subject: "math", concept: "limits", overview: "ok", keyIdeas: [], socraticQuestions: [], pitfalls: [], tryThis: "" };
    const admin = fakeAdmin({ hitContent: stored, expectSubject: "math", expectKey: "limits" });
    mocks.getAdmin.mockReturnValue(admin);
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("no Groq on a hit"); }));
    const res = await POST(req({ subject: "math", concept: '"Limits"' }));
    expect(res.status).toBe(200);
    expect(admin.filters.concept_key).toBe("limits"); // quotes stripped by real conceptKey
  });

  it("on a miss, generates with Groq and writes via promote_or_insert_guide", async () => {
    const admin = fakeAdmin({ hitContent: null });
    mocks.getAdmin.mockReturnValue(admin);
    mockGroqReturning({ topic: "energy_momentum", overview: "fresh", keyIdeas: ["x"], socraticQuestions: ["q"], pitfalls: [], tryThis: "t" });

    const res = await POST(req({ subject: "physics", concept: "energy", score: 10 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cached).toBe(false);
    expect(json.overview).toBe("fresh");
    // wrote to the shared cache via the promotion RPC
    expect(admin.calls.rpc).toBeTruthy();
    expect(admin.calls.rpc.fn).toBe("promote_or_insert_guide");
    expect(admin.calls.rpc.args.p_subject).toBe("physics");
    expect(admin.calls.rpc.args.p_concept).toBe("energy");
    expect(admin.calls.rpc.args.p_content.overview).toBe("fresh");
    expect(admin.calls.rpc.args.p_topic).toBe("energy_momentum"); // valid LLM topic kept
    // p_safe is sent for backward-compat, but promote_or_insert_guide always stores
    // the guide visibility='hidden' (curation-only) — only manually-curated rows are
    // ever public. See db/schema.sql promote_or_insert_guide.
    expect(admin.calls.rpc.args.p_safe).toBe(true);
  });

  it("coerces an out-of-taxonomy LLM topic to general_<subject>", async () => {
    const admin = fakeAdmin({ hitContent: null });
    mocks.getAdmin.mockReturnValue(admin);
    mockGroqReturning({ topic: "not_a_real_topic", overview: "x", keyIdeas: [], socraticQuestions: [], pitfalls: [], tryThis: "" });
    const res = await POST(req({ subject: "math", concept: "some new concept" }));
    const json = await res.json();
    expect(json.topic).toBe("general_math");
    expect(admin.calls.rpc.args.p_topic).toBe("general_math");
  });

  it("does NOT persist an unsafe concept to the shared cache, but still returns the guide to the opener", async () => {
    const admin = fakeAdmin({ hitContent: null });
    mocks.getAdmin.mockReturnValue(admin);
    mockGroqReturning({ topic: "algebra", overview: "x", keyIdeas: [], socraticQuestions: [], pitfalls: [], tryThis: "" });
    const res = await POST(req({ subject: "math", concept: "buy cheap stuff at evil.com" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.overview).toBe("x"); // opener still gets the guide (ephemeral)
    expect(admin.calls.rpc).toBe(null); // never written -> can't be served to anyone else
  });

  it("re-normalizes a malformed cached row before serving it", async () => {
    // A row whose array fields aren't arrays must not reach the client raw.
    const bad = { subject: "math", concept: "limits", overview: "ok", keyIdeas: "not-an-array", socraticQuestions: null, pitfalls: 5, tryThis: 42 };
    mocks.getAdmin.mockReturnValue(fakeAdmin({ hitContent: bad, expectSubject: "math", expectKey: "limits" }));
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("no Groq on a hit"); }));
    const res = await POST(req({ subject: "math", concept: "limits" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cached).toBe(true);
    expect(Array.isArray(json.keyIdeas)).toBe(true);
    expect(json.keyIdeas).toEqual([]);
    expect(Array.isArray(json.socraticQuestions)).toBe(true);
    expect(Array.isArray(json.pitfalls)).toBe(true);
    expect(typeof json.tryThis).toBe("string");
  });

  it("still returns the guide if the cache write fails", async () => {
    mocks.getAdmin.mockReturnValue(fakeAdmin({ hitContent: null, rpcThrows: true }));
    mockGroqReturning({ overview: "fresh2", keyIdeas: [], socraticQuestions: [], pitfalls: [], tryThis: "" });
    const res = await POST(req({ subject: "math", concept: "derivatives" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.overview).toBe("fresh2");
  });
});
