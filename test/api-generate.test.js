import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the admin client so we can drive the diagnostic_pool read-through/self-fill.
// Default returns null (no service-role key) → the route always generates fresh,
// which keeps every existing test exercising the original behavior. The generate
// route imports only getSupabaseAdmin (not conceptKey), so that is all we stub.
const adminMock = vi.hoisted(() => ({ getAdmin: vi.fn(() => null) }));
vi.mock("@/lib/supabaseAdmin", () => ({
  getSupabaseAdmin: () => adminMock.getAdmin(),
}));

import { POST } from "@/app/api/generate/route";
import { _resetRateLimits } from "@/lib/rateLimit";

// Fake admin matching the route's diagnostic_pool access: a count head-query, a
// random-row select(order/range/maybeSingle), and the atomic try_add_diagnostic
// RPC for self-fill (captured).
function fakeAdmin({ count = 0, row = null } = {}) {
  const calls = { rpcs: [], order: null, range: null };
  return {
    calls,
    from: () => ({
      select: (cols, opts) => {
        if (opts && opts.head) return Promise.resolve({ count, error: null });
        return {
          order: (col, o) => {
            calls.order = { col, o };
            return {
              range: (from, to) => {
                calls.range = { from, to };
                return { maybeSingle: async () => ({ data: row, error: null }) };
              },
            };
          },
        };
      },
    }),
    rpc: async (fn, args) => {
      calls.rpcs.push({ fn, args });
      return { error: null };
    },
  };
}

// A VALID diagnostic is now 9 questions: for EVERY subject (math/physics/
// chemistry) one question at EACH difficulty tier (foundational/intermediate/
// advanced). Build it from ORDER × DIAGNOSTIC_DIFFICULTIES so it stays in lock-
// step with isValidDiagnostic in app/api/generate/route.js.
const DIAG_SUBJECTS = ["math", "physics", "chemistry"];
const DIAG_DIFFICULTIES = ["foundational", "intermediate", "advanced"];
function validDiagnostic() {
  const questions = [];
  for (const subject of DIAG_SUBJECTS) {
    for (const difficulty of DIAG_DIFFICULTIES) {
      questions.push({ subject, topic: "t", difficulty, question: `${subject} ${difficulty} q` });
    }
  }
  return { questions }; // 9 questions, 3 per subject
}
const VALID_DIAG = validDiagnostic();

function req(bodyObjOrString) {
  const body =
    typeof bodyObjOrString === "string" ? bodyObjOrString : JSON.stringify(bodyObjOrString);
  return new Request("http://test.local/api/generate", {
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
  adminMock.getAdmin.mockReturnValue(null); // default: no pool (generate fresh)
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/generate — request guard (CSRF / content-type)", () => {
  const raw = (headers) =>
    new Request("http://test.local/api/generate", {
      method: "POST",
      headers,
      body: JSON.stringify({ kind: "diagnostic" }),
    });

  it("blocks a forced cross-site request with 403 (no Groq call)", async () => {
    const failFetch = vi.fn(() => { throw new Error("must not call Groq on a blocked request"); });
    vi.stubGlobal("fetch", failFetch);
    const res = await POST(raw({ "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" }));
    expect(res.status).toBe(403);
    expect(failFetch).not.toHaveBeenCalled();
  });

  it("rejects a non-JSON content-type with 415", async () => {
    const res = await POST(raw({ "Content-Type": "text/plain" }));
    expect(res.status).toBe(415);
  });

  it("allows a same-origin JSON request", async () => {
    mockGroqReturning(validDiagnostic());
    const res = await POST(raw({ "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin" }));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/generate — validation", () => {
  it("rejects a non-JSON body with 400", async () => {
    const res = await POST(req("nope"));
    expect(res.status).toBe(400);
  });

  it("rejects an unknown kind with 400", async () => {
    const res = await POST(req({ kind: "foo" }));
    expect(res.status).toBe(400);
  });

  it("rejects practice with an unknown subject with 400", async () => {
    const res = await POST(req({ kind: "practice", subject: "astrology", score: 40 }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Unknown subject/);
  });

  it("rejects an inherited/prototype subject key with 400", async () => {
    for (const subject of ["constructor", "__proto__", "toString"]) {
      const res = await POST(req({ kind: "practice", subject, score: 40 }));
      expect(res.status).toBe(400);
    }
  });

  it("returns a generic 500 that does not leak upstream Groq detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 429, text: async () => "rate limited: project xyz" }))
    );
    const res = await POST(req({ kind: "diagnostic" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).not.toMatch(/429|rate limited|project xyz/);
    expect(json.error).toMatch(/temporarily unavailable/i);
  });
});

describe("POST /api/generate — happy paths", () => {
  it("returns a full 9-question diagnostic (3 subjects × 3 tiers)", async () => {
    mockGroqReturning(validDiagnostic());
    const res = await POST(req({ kind: "diagnostic" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.questions).toHaveLength(9);
  });

  it("rejects a freshly-generated INVALID (partial) diagnostic with 500 instead of returning it", async () => {
    // The route now gates the generated response with isValidDiagnostic (not just the
    // pool write), so a truncated/partial set surfaces a retryable error.
    mockGroqReturning({ questions: validDiagnostic().questions.filter((q) => q.subject !== "chemistry") });
    const res = await POST(req({ kind: "diagnostic" }));
    expect(res.status).toBe(500);
  });

  it("generates a practice question for a known subject", async () => {
    mockGroqReturning({
      subject: "chemistry",
      topic: "stoichiometry",
      targetConcept: "limiting reagents",
      difficulty: "intermediate",
      question: "q",
    });
    const res = await POST(
      req({ kind: "practice", subject: "chemistry", score: 55, weakConcepts: ["limiting reagents"] })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.subject).toBe("chemistry");
  });

  it("caps weakConcepts (count + length) before sending them upstream", async () => {
    const fetchMock = mockGroqReturning({ subject: "math", topic: "t", targetConcept: "c", difficulty: "intermediate", question: "q" });
    const many = Array.from({ length: 500 }, (_, i) => `concept-${i}-${"x".repeat(500)}`);
    const res = await POST(req({ kind: "practice", subject: "math", score: 50, weakConcepts: many }));
    expect(res.status).toBe(200);
    // 10 concepts × 200 chars max + small prompt overhead — far below the raw input.
    const sentBody = fetchMock.mock.calls[0][1].body;
    expect(sentBody.length).toBeLessThan(5000);
  });
});

describe("POST /api/generate — diagnostic pool", () => {
  it("serves a diagnostic from the warm pool WITHOUT calling Groq", async () => {
    const failFetch = vi.fn(() => { throw new Error("Groq must not be called on a pool hit"); });
    vi.stubGlobal("fetch", failFetch);
    adminMock.getAdmin.mockReturnValue(fakeAdmin({ count: 12, row: { content: VALID_DIAG } }));
    const res = await POST(req({ kind: "diagnostic" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.pooled).toBe(true);
    expect(json.questions).toHaveLength(9); // full 3-subject × 3-tier set
    expect(failFetch).not.toHaveBeenCalled(); // zero generation tokens
  });

  it("serves at the threshold (count === DIAG_POOL_TARGET) but generates one below it", async () => {
    // count === target (12): pool is warm, must serve without Groq.
    const failFetch = vi.fn(() => { throw new Error("Groq must not be called at the threshold"); });
    vi.stubGlobal("fetch", failFetch);
    adminMock.getAdmin.mockReturnValue(fakeAdmin({ count: 12, row: { content: VALID_DIAG } }));
    let res = await POST(req({ kind: "diagnostic" }));
    expect((await res.json()).pooled).toBe(true);
    expect(failFetch).not.toHaveBeenCalled();

    // count === target - 1 (11): still BELOW target, must generate (pins the
    // `>= DIAG_POOL_TARGET` boundary — a loosened `>= 11`/off-by-one would fail).
    vi.unstubAllGlobals();
    const fetchMock = mockGroqReturning(VALID_DIAG);
    const admin = fakeAdmin({ count: 11, row: { content: VALID_DIAG } });
    adminMock.getAdmin.mockReturnValue(admin);
    res = await POST(req({ kind: "diagnostic" }));
    const json = await res.json();
    expect(json.pooled).toBeUndefined(); // below target → not served
    expect(fetchMock).toHaveBeenCalled(); // generated fresh
    expect(admin.calls.range).toBe(null); // never even drew a row from the pool
  });

  it("draws exactly one pool row at a random in-range offset, ordered by id", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5); // offset = floor(0.5 * 12) = 6
    const failFetch = vi.fn(() => { throw new Error("Groq must not be called on a pool hit"); });
    vi.stubGlobal("fetch", failFetch);
    const admin = fakeAdmin({ count: 12, row: { content: VALID_DIAG } });
    adminMock.getAdmin.mockReturnValue(admin);
    const res = await POST(req({ kind: "diagnostic" }));
    expect((await res.json()).pooled).toBe(true);
    // range(offset, offset) selects exactly ONE row (an off-by-one like
    // range(offset, offset+1) would return two rows and break maybeSingle()).
    expect(admin.calls.range).toEqual({ from: 6, to: 6 });
    // ordered by id so the random offset maps to a stable row.
    expect(admin.calls.order).toEqual({ col: "id", o: { ascending: true } });
  });

  it("generates fresh and self-fills the pool when below target", async () => {
    const fetchMock = mockGroqReturning(VALID_DIAG);
    const admin = fakeAdmin({ count: 0 });
    adminMock.getAdmin.mockReturnValue(admin);
    const res = await POST(req({ kind: "diagnostic" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.questions).toHaveLength(9);
    expect(fetchMock).toHaveBeenCalled(); // generated on a cold pool
    expect(admin.calls.rpcs).toHaveLength(1); // and stored it via the atomic pool-fill RPC
    expect(admin.calls.rpcs[0].fn).toBe("try_add_diagnostic");
    const stored = admin.calls.rpcs[0].args.p_content.questions;
    expect(stored).toHaveLength(9); // 3 per subject
    for (const subject of DIAG_SUBJECTS) {
      expect(stored.filter((q) => q.subject === subject)).toHaveLength(3);
    }
  });

  // A drawn row that isn't a complete 3-subject × 3-tier set must never be served.
  // Cover BOTH incomplete shapes: a whole subject missing, and a single tier
  // missing for one subject (the 9-question contract isn't just "≥1 per subject").
  const incompletePooled = {
    "missing a whole subject (no chemistry)": {
      questions: validDiagnostic().questions.filter((q) => q.subject !== "chemistry"), // 6 questions
    },
    "missing a difficulty for one subject (math has only foundational+intermediate)": {
      questions: validDiagnostic().questions.filter(
        (q) => !(q.subject === "math" && q.difficulty === "advanced")
      ), // 8 questions
    },
  };
  for (const [label, badContent] of Object.entries(incompletePooled)) {
    it(`does NOT serve an invalid pooled diagnostic — ${label} → falls back to generation`, async () => {
      const fetchMock = mockGroqReturning(VALID_DIAG);
      adminMock.getAdmin.mockReturnValue(fakeAdmin({ count: 12, row: { content: badContent } }));
      const res = await POST(req({ kind: "diagnostic" }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.pooled).toBeUndefined(); // fell through to a fresh generation
      expect(fetchMock).toHaveBeenCalled();
    });
  }

  // A GENERATED set that isn't a complete 3-subject × 3-tier set must never be
  // written to the shared pool. Cover a missing subject AND a missing tier.
  const incompleteGenerated = {
    "a 2-subject set (no chemistry)": {
      questions: validDiagnostic().questions.filter((q) => q.subject !== "chemistry"),
    },
    "a set missing math's advanced tier": {
      questions: validDiagnostic().questions.filter(
        (q) => !(q.subject === "math" && q.difficulty === "advanced")
      ),
    },
  };
  for (const [label, badContent] of Object.entries(incompleteGenerated)) {
    it(`rejects an invalid GENERATED set (500) and never writes it to the shared pool — ${label}`, async () => {
      const fetchMock = mockGroqReturning(badContent);
      const admin = fakeAdmin({ count: 0 });
      adminMock.getAdmin.mockReturnValue(admin);
      const res = await POST(req({ kind: "diagnostic" }));
      expect(res.status).toBe(500); // invalid set is gated, not returned
      expect(fetchMock).toHaveBeenCalled();
      expect(admin.calls.rpcs).toHaveLength(0); // invalid set never written to the pool
    });
  }

  it("falls through to generation (200, not 500) when the pool read throws", async () => {
    const fetchMock = mockGroqReturning(VALID_DIAG);
    adminMock.getAdmin.mockReturnValue({
      from: () => ({ select: () => { throw new Error("pool unreachable"); } }),
      rpc: async () => ({ error: null }),
    });
    const res = await POST(req({ kind: "diagnostic" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.questions).toHaveLength(9);
    expect(json.pooled).toBeUndefined(); // read failed → generated fresh
    expect(fetchMock).toHaveBeenCalled();
  });
});
