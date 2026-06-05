import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the admin Supabase client so we can drive cache hits/misses. conceptKey
// stays a real, simple normalizer.
const mocks = vi.hoisted(() => ({ getAdmin: vi.fn(() => null) }));
vi.mock("@/lib/supabaseAdmin", () => ({
  getSupabaseAdmin: () => mocks.getAdmin(),
  conceptKey: (c) => String(c || "").trim().toLowerCase().replace(/\s+/g, " "),
}));

// Build a fake admin client matching the route's from().select().eq().eq()
// .maybeSingle() reads and from().upsert() writes. Captures the table + filters
// so a column/value regression on the cache-read path is catchable.
function fakeAdmin({ hitContent = null, onUpsert, upsertThrows } = {}) {
  const filters = {};
  const client = {
    filters,
    from: (table) => {
      filters.table = table;
      return {
        select: () => ({
          eq: (c1, v1) => {
            filters[c1] = v1;
            return {
              eq: (c2, v2) => {
                filters[c2] = v2;
                return { maybeSingle: async () => ({ data: hitContent ? { content: hitContent } : null }) };
              },
            };
          },
        }),
        upsert: async (row) => {
          if (upsertThrows) throw new Error("write blew up");
          onUpsert?.(row);
          return { error: null };
        },
      };
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
    const admin = fakeAdmin({ hitContent: stored });
    mocks.getAdmin.mockReturnValue(admin);
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("no Groq on a hit"); }));
    // Different score, messy casing/spacing → same standardized guide.
    const res = await POST(req({ subject: "math", concept: "  LE   Chatelier ", score: 95 }));
    expect(res.status).toBe(200);
    expect(admin.filters.concept_key).toBe("le chatelier");
  });

  it("on a miss, generates with Groq and writes the guide to the cache", async () => {
    let written = null;
    mocks.getAdmin.mockReturnValue(fakeAdmin({ hitContent: null, onUpsert: (row) => { written = row; } }));
    mockGroqReturning({ overview: "fresh", keyIdeas: ["x"], socraticQuestions: ["q"], pitfalls: [], tryThis: "t" });

    const res = await POST(req({ subject: "physics", concept: "energy", score: 10 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cached).toBe(false);
    expect(json.overview).toBe("fresh");
    // wrote to the shared cache
    expect(written).toBeTruthy();
    expect(written.subject).toBe("physics");
    expect(written.concept_key).toBe("energy");
    expect(written.content.overview).toBe("fresh");
  });

  it("re-normalizes a malformed cached row before serving it", async () => {
    // A row whose array fields aren't arrays must not reach the client raw.
    const bad = { subject: "math", concept: "limits", overview: "ok", keyIdeas: "not-an-array", socraticQuestions: null, pitfalls: 5, tryThis: 42 };
    mocks.getAdmin.mockReturnValue(fakeAdmin({ hitContent: bad }));
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
    mocks.getAdmin.mockReturnValue(fakeAdmin({ hitContent: null, upsertThrows: true }));
    mockGroqReturning({ overview: "fresh2", keyIdeas: [], socraticQuestions: [], pitfalls: [], tryThis: "" });
    const res = await POST(req({ subject: "math", concept: "derivatives" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.overview).toBe("fresh2");
  });
});
