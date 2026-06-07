import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// /api/score is the SERVER-AUTHORITATIVE scoring route. We mock the layers it
// leans on so we test ROUTE behavior in isolation:
//   - @/lib/adminAuth#requireUser : the verified-user verdict a test installs
//     (real JWT logic is covered in test/adminAuth.test.js).
//   - @/lib/supabaseAdmin#getSupabaseAdmin : a fake service-role client recording
//     every rpc/from call so we can assert what the route wrote (and for WHOM).
//   - @/lib/abuseDetection : no-ops (covered in test/abuseDetection.test.js).
// Groq's HTTP call is stubbed via global fetch (the model's JSON output).
// The scoring math (blend/diagnosticSubjectScore/…) is the REAL lib/scoring.
// ---------------------------------------------------------------------------
const auth = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/adminAuth", () => ({ requireUser: (...a) => auth.requireUser(...a) }));

const storage = vi.hoisted(() => ({ getAdmin: vi.fn(() => null) }));
vi.mock("@/lib/supabaseAdmin", () => ({ getSupabaseAdmin: () => storage.getAdmin() }));

vi.mock("@/lib/abuseDetection", () => ({ reportInjection: vi.fn(), reportRateLimit: vi.fn() }));

import { POST } from "@/app/api/score/route";
import { _resetRateLimits } from "@/lib/rateLimit";
import { blend } from "@/lib/scoring";

// Build a POST Request the route handler can consume. `auth:true` attaches a bearer
// token (the route only checks for the header's presence; requireUser is mocked).
function req(body, { authHeader = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (authHeader) headers.Authorization = "Bearer test-token";
  return new Request("http://test.local/api/score", { method: "POST", headers, body: JSON.stringify(body) });
}

// Stub Groq to return the SAME JSON payload for every call. `failFirstN` makes the
// first N calls fail with the given HTTP status (for retry / allSettled tests).
function mockGroq(payload, { failFirstN = 0, failStatus = 500 } = {}) {
  let n = 0;
  const fetchMock = vi.fn(async () => {
    n += 1;
    if (n <= failFirstN) {
      return { ok: false, status: failStatus, text: async () => "upstream error", json: async () => ({}) };
    }
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }], usage: {} }),
      text: async () => "",
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// Fake service-role client: from("scores").select().eq() resolves to {data,error};
// rpc(fn,args) records the call and resolves to {error}. All calls captured.
function fakeAdmin({ scoresRows = [], scoresError = null, rpcError = null } = {}) {
  const calls = { rpc: [], from: [], eq: [] };
  const sb = {
    rpc: vi.fn(async (fn, args) => {
      calls.rpc.push({ fn, args });
      return { error: rpcError };
    }),
    from: (table) => {
      calls.from.push(table);
      const chain = {
        select: () => chain,
        eq: (col, val) => {
          calls.eq.push([col, val]); // capture RLS-scoping filters for assertions
          return chain;
        },
        then: (resolve, reject) => Promise.resolve({ data: scoresRows, error: scoresError }).then(resolve, reject),
      };
      return chain;
    },
  };
  return { sb, calls };
}

const PRACTICE_GRADE = {
  reasoningScore: 80,
  rubric: { conceptual_understanding: 3, logical_structure: 3, strategy: 3, execution_accuracy: 2, communication: 4 },
  correctnessNote: "Close, recheck the last step.",
  socraticHint: "What happens at the boundary?",
  microLesson: "The chain rule composes rates of change.",
  weakConcepts: ["chain rule"],
  newScoreSuggestion: 60,
};
const DIAG_GRADE = {
  subject: "math",
  score: 70,
  rubric: { conceptual_understanding: 3, logical_structure: 3, strategy: 3, execution_accuracy: 3, communication: 3 },
  weakConcepts: ["vectors"],
  comment: "Solid attempt.",
};

beforeEach(() => {
  process.env.GROQ_API_KEY = "test-key";
  _resetRateLimits();
  auth.requireUser.mockReset();
  storage.getAdmin.mockReset();
  storage.getAdmin.mockReturnValue(null);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---- request guard ---------------------------------------------------------
describe("POST /api/score — request guard", () => {
  it("blocks a forced cross-site request with 403 (no Groq, no auth)", async () => {
    const failFetch = vi.fn(() => { throw new Error("must not call Groq"); });
    vi.stubGlobal("fetch", failFetch);
    const r = new Request("http://test.local/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" },
      body: JSON.stringify({ kind: "practice", subject: "math", question: "Q", reasoning: "x" }),
    });
    const res = await POST(r);
    expect(res.status).toBe(403);
    expect(auth.requireUser).not.toHaveBeenCalled();
    expect(failFetch).not.toHaveBeenCalled();
  });

  it("rejects a non-JSON content-type with 415", async () => {
    const r = new Request("http://test.local/api/score", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "kind=practice",
    });
    expect((await POST(r)).status).toBe(415);
  });

  it("rejects an unknown kind with 400", async () => {
    expect((await POST(req({ kind: "nope" }))).status).toBe(400);
  });
});

// ---- practice: auth + server-authoritative scoring -------------------------
describe("POST /api/score practice — authentication", () => {
  it("requires a verified user: a 401 verdict short-circuits before any Groq call", async () => {
    auth.requireUser.mockResolvedValue({ error: "Authentication required.", status: 401 });
    const failFetch = vi.fn(() => { throw new Error("must not call Groq"); });
    vi.stubGlobal("fetch", failFetch);
    const res = await POST(req({ kind: "practice", subject: "math", question: "Q", reasoning: "x" }, { authHeader: true }));
    expect(res.status).toBe(401);
    expect(failFetch).not.toHaveBeenCalled();
  });

  it("returns 503 when the service-role client is unavailable (cannot persist)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    storage.getAdmin.mockReturnValue(null);
    const res = await POST(req({ kind: "practice", subject: "math", question: "Q", reasoning: "x" }, { authHeader: true }));
    expect(res.status).toBe(503);
  });
});

describe("POST /api/score practice — server-authoritative score", () => {
  it("computes the new score from the STORED level + grader suggestion and persists it for the verified uid", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb, calls } = fakeAdmin({ scoresRows: [{ subject: "math", score: 40, weak_concepts: ["old"], comment: "c", rubric: null }] });
    storage.getAdmin.mockReturnValue(sb);
    mockGroq(PRACTICE_GRADE);

    const res = await POST(req(
      { kind: "practice", subject: "math", question: "Q", targetConcept: "chain rule", difficulty: "intermediate", reasoning: "I differentiated step by step." },
      { authHeader: true }
    ));
    expect(res.status).toBe(200);
    const j = await res.json();

    const expected = blend(40, 60, { difficulty: "intermediate", reasoningScore: 80 });
    expect(j.newScore).toBe(expected);
    expect(j.delta).toBe(expected - 40);
    expect(j.subjectScore.score).toBe(expected);
    expect(j.reasoningScore).toBe(80);
    expect(j.socraticHint).toBe(PRACTICE_GRADE.socraticHint);
    expect(j.attempt).toMatchObject({ type: "attempt", subject: "math", newScore: expected });

    const save = calls.rpc.find((c) => c.fn === "save_progress_for");
    expect(save).toBeTruthy();
    expect(save.args.p_user).toBe("u1"); // bound to the VERIFIED uid
    expect(save.args.p_scores[0].score).toBe(expected);
    expect(save.args.p_scores[0].subject).toBe("math");
    // The stored-prev read MUST be scoped to the verified uid (defense-in-depth
    // alongside RLS) — otherwise a cross-user prev could leak into the blend.
    expect(calls.eq).toContainEqual(["user_id", "u1"]);
  });

  it("IGNORES a client-supplied score / newScore — the trust gap is closed", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb, calls } = fakeAdmin({ scoresRows: [{ subject: "math", score: 40, weak_concepts: [], comment: "", rubric: null }] });
    storage.getAdmin.mockReturnValue(sb);
    mockGroq(PRACTICE_GRADE);

    const res = await POST(req(
      { kind: "practice", subject: "math", question: "Q", difficulty: "intermediate", reasoning: "x", score: 999, newScore: 999, reasoningScore: 999 },
      { authHeader: true }
    ));
    const j = await res.json();
    const expected = blend(40, 60, { difficulty: "intermediate", reasoningScore: 80 });
    expect(j.newScore).toBe(expected);
    expect(j.newScore).not.toBe(999);
    const save = calls.rpc.find((c) => c.fn === "save_progress_for");
    expect(save.args.p_scores[0].score).toBe(expected);
    expect(save.args.p_scores[0].score).not.toBe(999);
  });

  it("rejects an unknown subject with 400", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    storage.getAdmin.mockReturnValue(fakeAdmin().sb);
    const res = await POST(req({ kind: "practice", subject: "__proto__", question: "Q", reasoning: "x" }, { authHeader: true }));
    expect(res.status).toBe(400);
  });

  it("returns a generic 500 (no upstream leak) when persistence fails", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb } = fakeAdmin({ scoresRows: [{ subject: "math", score: 40 }], rpcError: { message: "db boom" } });
    storage.getAdmin.mockReturnValue(sb);
    mockGroq(PRACTICE_GRADE);
    const res = await POST(req({ kind: "practice", subject: "math", question: "Q", difficulty: "intermediate", reasoning: "x" }, { authHeader: true }));
    expect(res.status).toBe(500);
    const j = await res.json();
    expect(j.error).not.toMatch(/db boom/);
  });

  it("retries ONCE on a 429 from Groq (transient rate cap) and then succeeds", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    storage.getAdmin.mockReturnValue(fakeAdmin({ scoresRows: [{ subject: "math", score: 40 }] }).sb);
    const fetchMock = mockGroq(PRACTICE_GRADE, { failFirstN: 1, failStatus: 429 });
    const res = await POST(req({ kind: "practice", subject: "math", question: "Q", difficulty: "intermediate", reasoning: "x" }, { authHeader: true }));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2); // first 429, retried once -> ok
  });
});

// ---- diagnostic: auth-optional batch baseline ------------------------------
describe("POST /api/score diagnostic", () => {
  const answers = [
    { subject: "math", question: "Qm-easy", difficulty: "foundational", reasoning: "a" },
    { subject: "math", question: "Qm-mid", difficulty: "intermediate", reasoning: "b" },
    { subject: "math", question: "Qm-hard", difficulty: "advanced", reasoning: "c" },
  ];

  it("GUEST (no token): grades + aggregates server-side, returns scores WITHOUT persisting", async () => {
    const fetchMock = mockGroq(DIAG_GRADE);
    const res = await POST(req({ kind: "diagnostic", answers })); // no auth header
    expect(res.status).toBe(200);
    expect(auth.requireUser).not.toHaveBeenCalled();
    const j = await res.json();
    expect(j.persisted).toBe(false);
    expect(j.attempt).toBe(null);
    expect(j.scores.math.score).toBeGreaterThan(0);
    expect(Object.keys(j.scores.math.rubric)).toHaveLength(5); // per-subject rubric profile
    expect(fetchMock).toHaveBeenCalledTimes(3); // one grade per answer
  });

  it("SIGNED-IN: persists the baseline for the verified uid and returns the baseline attempt", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb, calls } = fakeAdmin();
    storage.getAdmin.mockReturnValue(sb);
    mockGroq(DIAG_GRADE);
    const res = await POST(req({ kind: "diagnostic", answers }, { authHeader: true }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.persisted).toBe(true);
    expect(j.attempt).toMatchObject({ type: "baseline", subject: null });
    const save = calls.rpc.find((c) => c.fn === "save_progress_for");
    expect(save.args.p_user).toBe("u1");
    expect(save.args.p_attempt.type).toBe("baseline");
    expect(save.args.p_scores[0].rubric).toBeTruthy();
  });

  it("rejects an INVALID token rather than silently downgrading to guest", async () => {
    auth.requireUser.mockResolvedValue({ error: "Invalid or expired session.", status: 401 });
    const failFetch = vi.fn(() => { throw new Error("must not grade with a bad token"); });
    vi.stubGlobal("fetch", failFetch);
    const res = await POST(req({ kind: "diagnostic", answers }, { authHeader: true }));
    expect(res.status).toBe(401);
    expect(failFetch).not.toHaveBeenCalled();
  });

  it("DEDUPES repeated subject:difficulty slots so the Groq fan-out can't be multiplied", async () => {
    const dupe = [answers[0], answers[0], answers[0], answers[1]];
    const fetchMock = mockGroq(DIAG_GRADE);
    const res = await POST(req({ kind: "diagnostic", answers: dupe }));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2); // 2 distinct slots, not 4
  });

  it("rejects more answers than the diagnostic size (>9) with 400", async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ subject: "math", question: `Q${i}`, difficulty: "foundational", reasoning: "x" }));
    expect((await POST(req({ kind: "diagnostic", answers: many }))).status).toBe(400);
  });

  it("rejects an empty / non-array answers with 400", async () => {
    expect((await POST(req({ kind: "diagnostic", answers: [] }))).status).toBe(400);
    expect((await POST(req({ kind: "diagnostic" }))).status).toBe(400);
  });

  it("is resilient (allSettled): one failed grade doesn't sink the set", async () => {
    // First grade hard-fails (500, not retryable); the other two succeed → still 200.
    const fetchMock = mockGroq(DIAG_GRADE, { failFirstN: 1, failStatus: 500 });
    const res = await POST(req({ kind: "diagnostic", answers }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.scores.math.score).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("returns a retryable 503 when EVERY grade fails (no all-zero baseline persisted)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb, calls } = fakeAdmin();
    storage.getAdmin.mockReturnValue(sb);
    mockGroq(DIAG_GRADE, { failFirstN: 99, failStatus: 500 });
    const res = await POST(req({ kind: "diagnostic", answers }, { authHeader: true }));
    expect(res.status).toBe(503);
    expect(calls.rpc.find((c) => c.fn === "save_progress_for")).toBeFalsy(); // nothing persisted
  });

  it("CHARGES the :img budget for diagnostic vision grades — they can't bypass the image cap", async () => {
    // base64 of the PNG magic signature (89 50 4E 47 ...), a valid image to normalizeImage.
    const PNG = { mime: "image/png", data: "iVBORw0KGgo=" };
    const nineImages = [];
    for (const s of ["math", "physics", "chemistry"]) {
      for (const d of ["foundational", "intermediate", "advanced"]) {
        nineImages.push({ subject: s, question: `Q-${s}-${d}`, difficulty: d, reasoning: "x", image: PNG });
      }
    }
    mockGroq(DIAG_GRADE);
    // First diagnostic: 9 image grades consume 9 of the 10-token :img budget → ok.
    expect((await POST(req({ kind: "diagnostic", answers: nineImages }))).status).toBe(200);
    // Second diagnostic: only 1 :img token remains, so the 9-image fan-out is rejected
    // (before this fix the diagnostic never touched :img and this returned 200).
    expect((await POST(req({ kind: "diagnostic", answers: nineImages }))).status).toBe(429);
  });
});
