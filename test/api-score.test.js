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
// The scoring math (eloUpdate/diagnosticSubjectScore/reconcile/…) is the REAL
// lib/scoring, so the expected values are computed with the same functions the
// route uses (robust to constant tuning).
// ---------------------------------------------------------------------------
const auth = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/adminAuth", () => ({ requireUser: (...a) => auth.requireUser(...a) }));

const storage = vi.hoisted(() => ({ getAdmin: vi.fn(() => null) }));
vi.mock("@/lib/supabaseAdmin", () => ({ getSupabaseAdmin: () => storage.getAdmin() }));

vi.mock("@/lib/abuseDetection", () => ({ reportInjection: vi.fn(), reportRateLimit: vi.fn() }));

import { POST } from "@/app/api/score/route";
import { signQuestion } from "@/lib/questionToken";
import { _resetRateLimits } from "@/lib/rateLimit";
import { updateAxisRatings, scoreFromRubric, defaultDifficultyForBand, normalizeRubric } from "@/lib/scoring";
import { diagnosticSurfaceFor } from "@/lib/diagnosticBank";

// Complete 9-axis rubric helper (the grader emits these; the server derives the headline).
const mkRubric = (v, over = {}) => ({
  comprehension: v, principle: v, justification: v, strategy: v, logic: v,
  execution_method: v, computation: v, verification: v, communication: v, ...over,
});

// Substantive, multi-word reasoning that the deterministic pre-grade dock lets through
// to the real grader (so the Groq mock IS exercised). Short/"idk" answers are docked.
const REASONING = "I set up the derivative and applied the chain rule step by step to find the slope.";

// Sign a server-issued question token the way /api/generate does — the REAL lib
// (QUESTION_TOKEN_SECRET is set in beforeEach), so practice tests exercise the exact
// verify path the route runs (audit P1-1: the route derives every rating-relevant
// field from the token, never the request body).
function tok(q = {}) {
  return signQuestion({ subject: "math", question: "Q", difficulty: "intermediate", ...q });
}

// Build a POST Request the route handler can consume. `authHeader:true` attaches a
// bearer token (the route only checks the header's presence; requireUser is mocked).
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

// Fake service-role client. Routes results per table so the new reads (scores +
// attempts COUNT + item_difficulty maybeSingle) each resolve sensibly, and records
// every rpc/eq call for assertions.
function fakeAdmin({ scoresRows = [], scoresError = null, rpcError = null, recentAttempts = [], itemDifficulty = null } = {}) {
  const calls = { rpc: [], from: [], eq: [] };
  const resultFor = (table) => {
    if (table === "scores") return { data: scoresRows, error: scoresError, count: scoresRows.length };
    // The practice path reads the recent (topic, band) rows for the anti-farm repeat factor.
    if (table === "attempts") return { data: recentAttempts, error: null };
    if (table === "item_difficulty") return { data: itemDifficulty, error: null };
    return { data: [], error: null };
  };
  const sb = {
    rpc: vi.fn(async (fn, args) => {
      calls.rpc.push({ fn, args });
      return { data: null, error: rpcError };
    }),
    from: (table) => {
      calls.from.push(table);
      const chain = {
        select: () => chain,
        eq: (col, val) => {
          calls.eq.push([col, val]); // capture RLS-scoping filters for assertions
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => resultFor(table),
        then: (resolve, reject) => Promise.resolve(resultFor(table)).then(resolve, reject),
      };
      return chain;
    },
  };
  return { sb, calls };
}

const PRACTICE_GRADE = {
  rubric: mkRubric(3, { execution_method: 2, comprehension: 4, communication: 4 }),
  solve: { principle: "p", steps: ["s1"], finalAnswer: "42", units: "m" },
  errors: [{ type: "execution-slip", step: "last line", severity: "minor", what: "decimal slip", feedbackMode: "point", message: "100/32=3.125", socraticPrompt: "" }],
  finalAnswerMatches: false,
  correctnessNote: "Close, recheck the last step.",
  socraticHint: "What happens at the boundary?",
  microLesson: "The chain rule composes rates of change.",
  weakConcepts: ["chain rule"],
};
const DIAG_GRADE = {
  subject: "math",
  rubric: mkRubric(3),
  weakConcepts: ["vectors"],
  comment: "Solid attempt.",
};

// The score /api/score computes for one practice attempt, using the REAL functions: the
// per-attempt headline is the TRANSPARENT weighted mean of the rubric (scoreFromRubric, the
// raw outcome), and the subject score is the unified Glicko-2 derivation (updateAxisRatings,
// lazy-seeded from prevScore since these fixtures have no stored glicko/rubric; repeatFactor
// 1 since the mock returns no recent same-bucket attempts).
function expectedPracticeScore({ prevScore, grade, band = "intermediate", itemDifficulty = null, prevRubric = null }) {
  const rubric = normalizeRubric(grade.rubric);
  const reasoningScore = scoreFromRubric(rubric);
  const difficulty = itemDifficulty == null ? defaultDifficultyForBand(band) : itemDifficulty;
  const { score } = updateAxisRatings({ prevGlicko: null, prevRubric, prevScore, attemptRubric: rubric, difficulty, repeatFactor: 1 });
  return { newScore: score, reasoningScore };
}

beforeEach(() => {
  process.env.GROQ_API_KEY = "test-key";
  process.env.QUESTION_TOKEN_SECRET = "test-token-secret";
  delete process.env.GLOBAL_GROQ_BUDGET_PER_MIN;
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
      body: JSON.stringify({ kind: "practice", token: tok(), reasoning: REASONING }),
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
    const res = await POST(req({ kind: "practice", token: tok(), reasoning: REASONING }, { authHeader: true }));
    expect(res.status).toBe(401);
    expect(failFetch).not.toHaveBeenCalled();
  });

  it("returns 503 when the service-role client is unavailable (cannot persist)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    storage.getAdmin.mockReturnValue(null);
    const res = await POST(req({ kind: "practice", token: tok(), reasoning: REASONING }, { authHeader: true }));
    expect(res.status).toBe(503);
  });
});

describe("POST /api/score practice — server-authoritative Glicko-2 score", () => {
  it("computes the new score from the STORED per-axis Glicko state (derived aggregate) and persists glicko + topic/band for the verified uid", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb, calls } = fakeAdmin({ scoresRows: [{ subject: "math", score: 40, weak_concepts: ["old"], comment: "c", rubric: null, glicko: null }] });
    storage.getAdmin.mockReturnValue(sb);
    mockGroq(PRACTICE_GRADE);

    const res = await POST(req(
      { kind: "practice", token: tok({ targetConcept: "chain rule", topicSlug: "calculus_analysis" }), reasoning: REASONING },
      { authHeader: true }
    ));
    expect(res.status).toBe(200);
    const j = await res.json();

    const { newScore, reasoningScore } = expectedPracticeScore({ prevScore: 40, grade: PRACTICE_GRADE, band: "intermediate" });
    expect(j.newScore).toBe(newScore);
    expect(j.delta).toBe(newScore - 40);
    expect(j.subjectScore.score).toBe(newScore);
    expect(j.reasoningScore).toBe(reasoningScore); // the transparent weighted mean of the rubric axes
    expect(j.errors).toEqual(PRACTICE_GRADE.errors); // typed errors plumbed through
    expect(j.socraticHint).toBe(PRACTICE_GRADE.socraticHint);
    expect(typeof j.rationale).toBe("string");
    expect(j.rationale.length).toBeGreaterThan(0);
    expect(j.attempt).toMatchObject({ type: "attempt", subject: "math", newScore, rationale: j.rationale });

    const save = calls.rpc.find((c) => c.fn === "save_progress_for");
    expect(save).toBeTruthy();
    expect(save.args.p_user).toBe("u1"); // bound to the VERIFIED uid
    expect(save.args.p_scores[0].score).toBe(newScore);
    expect(save.args.p_scores[0].subject).toBe("math");
    // The per-axis Glicko state (source of truth) is persisted, with a finite rating per axis.
    expect(save.args.p_scores[0].glicko).toBeTruthy();
    expect(Number.isFinite(save.args.p_scores[0].glicko.principle.rating)).toBe(true);
    expect(save.args.p_attempt.rationale).toBe(j.rationale); // rationale is persisted
    // The practiced bucket (topic, band) is persisted for the anti-farm repeat window.
    expect(save.args.p_attempt.topic).toBe("calculus_analysis");
    expect(save.args.p_attempt.band).toBe("intermediate");
    // The stored-prev read MUST be scoped to the verified uid (defense-in-depth
    // alongside RLS) — otherwise a cross-user prev could leak into the rating.
    expect(calls.eq).toContainEqual(["user_id", "u1"]);
    // The item-difficulty bucket is calibrated (non-blocking) by the normalized slug.
    const bump = calls.rpc.find((c) => c.fn === "bump_item_difficulty");
    expect(bump).toBeTruthy();
    expect(bump.args.p_subject).toBe("math");
    expect(bump.args.p_topic).toBe("calculus_analysis");
    expect(bump.args.p_band).toBe("intermediate");
  });

  it("IGNORES a client-supplied score / newScore — the trust gap is closed", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb, calls } = fakeAdmin({ scoresRows: [{ subject: "math", score: 40, weak_concepts: [], comment: "", rubric: null }] });
    storage.getAdmin.mockReturnValue(sb);
    mockGroq(PRACTICE_GRADE);

    const res = await POST(req(
      { kind: "practice", token: tok(), reasoning: REASONING, score: 999, newScore: 999, reasoningScore: 999 },
      { authHeader: true }
    ));
    const j = await res.json();
    const { newScore } = expectedPracticeScore({ prevScore: 40, grade: PRACTICE_GRADE, band: "intermediate" });
    expect(j.newScore).toBe(newScore);
    expect(j.newScore).not.toBe(999);
    const save = calls.rpc.find((c) => c.fn === "save_progress_for");
    expect(save.args.p_scores[0].score).toBe(newScore);
    expect(save.args.p_scores[0].score).not.toBe(999);
  });

  it("uses the persisted item difficulty (not the band default) when the bucket is calibrated", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb } = fakeAdmin({
      scoresRows: [{ subject: "math", score: 40, weak_concepts: [], comment: "", rubric: null }],
      itemDifficulty: { difficulty: 90 }, // a much harder calibrated bucket than the intermediate default
      attemptCount: 3,
    });
    storage.getAdmin.mockReturnValue(sb);
    mockGroq(PRACTICE_GRADE);
    const res = await POST(req(
      { kind: "practice", token: tok({ topicSlug: "calculus_analysis" }), reasoning: REASONING },
      { authHeader: true }
    ));
    const j = await res.json();
    const { newScore } = expectedPracticeScore({ prevScore: 40, grade: PRACTICE_GRADE, itemDifficulty: 90, attemptCount: 3 });
    expect(j.newScore).toBe(newScore); // beating a HARD item lifts more than the band default would
  });

  it("DOCKS an 'idk' practice answer deterministically — no Groq call, rating drops, all-zero rubric", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb, calls } = fakeAdmin({ scoresRows: [{ subject: "math", score: 60, weak_concepts: [], comment: "", rubric: { conceptual_understanding: 3 } }] });
    storage.getAdmin.mockReturnValue(sb);
    const failFetch = vi.fn(() => { throw new Error("must not call Groq on a docked answer"); });
    vi.stubGlobal("fetch", failFetch);
    const res = await POST(req(
      { kind: "practice", token: tok(), reasoning: "idk" },
      { authHeader: true }
    ));
    expect(res.status).toBe(200);
    expect(failFetch).not.toHaveBeenCalled(); // deterministic, no LLM
    const j = await res.json();
    expect(j.docked).toBe(true);
    expect(j.reasoningScore).toBeLessThan(10); // single-digit forced score
    expect(Object.values(j.rubric).every((v) => v === 0)).toBe(true); // all-zero rubric this attempt
    expect(j.newScore).toBeLessThan(60); // docking DROPS the rating (anti-"idk"), not a no-op
    expect(j.rationale).toMatch(/docked/i);
    // A dock carries no difficulty signal, so the bucket is NOT calibrated from it.
    expect(calls.rpc.find((c) => c.fn === "bump_item_difficulty")).toBeFalsy();
    // A docked non-answer NEVER reveals the worked solution.
    expect(j.workedSolution).toBe("");
  });

  it("persists the answer-review (p_review) and reveals the worked solution on a substantive attempt (PR 6)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb, calls } = fakeAdmin({ scoresRows: [{ subject: "math", score: 40 }] });
    storage.getAdmin.mockReturnValue(sb);
    mockGroq({
      ...PRACTICE_GRADE,
      strengths: ["named the right principle"], improvements: ["show the intermediate step"],
      workedSolution: "Step 1 … Final answer: 7.",
    });
    const res = await POST(req(
      { kind: "practice", token: tok({ question: "Q-pencils", targetConcept: "addition", difficulty: "beginner" }), reasoning: REASONING },
      { authHeader: true }
    ));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.strengths).toEqual(["named the right principle"]);
    expect(j.improvements).toEqual(["show the intermediate step"]);
    expect(j.workedSolution).toMatch(/Final answer/); // revealed post-grade (substantive attempt)
    // The review detail is persisted atomically with the attempt (p_review on save_progress_for).
    const save = calls.rpc.find((c) => c.fn === "save_progress_for");
    expect(save.args.p_review).toBeTruthy();
    expect(save.args.p_review.question).toBe("Q-pencils");
    expect(save.args.p_review.answer).toBe(REASONING); // the learner's own reasoning
    expect(save.args.p_review.feedback.workedSolution).toMatch(/Final answer/);
  });

  it("ignores a model-supplied score that contradicts its rubric — the headline is ALWAYS the transparent rubric mean (all-zero rubric can't ship an 85)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb } = fakeAdmin({ scoresRows: [{ subject: "math", score: 50 }] });
    storage.getAdmin.mockReturnValue(sb);
    mockGroq({
      reasoningScore: 85,
      rubric: { conceptual_understanding: 0, logical_structure: 0, strategy: 0, execution_accuracy: 0, communication: 0 },
      correctnessNote: "", socraticHint: "h", microLesson: "m", weakConcepts: [], newScoreSuggestion: 85,
    });
    const res = await POST(req(
      { kind: "practice", token: tok(), reasoning: REASONING },
      { authHeader: true }
    ));
    const j = await res.json();
    // Rubric implies 0; reconcile pulls 85 down to within the tolerance band of 0.
    expect(j.reasoningScore).toBeLessThanOrEqual(25);
    expect(j.reasoningScore).toBeLessThan(85);
  });

  it("rejects an unknown subject with 400", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    storage.getAdmin.mockReturnValue(fakeAdmin().sb);
    const res = await POST(req({ kind: "practice", token: tok({ subject: "__proto__" }), reasoning: REASONING }, { authHeader: true }));
    expect(res.status).toBe(400);
  });

  it("returns a generic 500 (no upstream leak) when persistence fails", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb } = fakeAdmin({ scoresRows: [{ subject: "math", score: 40 }], rpcError: { message: "db boom" } });
    storage.getAdmin.mockReturnValue(sb);
    mockGroq(PRACTICE_GRADE);
    const res = await POST(req({ kind: "practice", token: tok(), reasoning: REASONING }, { authHeader: true }));
    expect(res.status).toBe(500);
    const j = await res.json();
    expect(j.error).not.toMatch(/db boom/);
  });

  it("retries ONCE on a 429 from Groq (transient rate cap) and then succeeds", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    storage.getAdmin.mockReturnValue(fakeAdmin({ scoresRows: [{ subject: "math", score: 40 }] }).sb);
    const fetchMock = mockGroq(PRACTICE_GRADE, { failFirstN: 1, failStatus: 429 });
    const res = await POST(req({ kind: "practice", token: tok(), reasoning: REASONING }, { authHeader: true }));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2); // first 429, retried once -> ok
  });
});

// ---- diagnostic: auth-optional batch baseline ------------------------------
describe("POST /api/score diagnostic", () => {
  const answers = [
    // No `question` field: the route grades the BANK's text by (subject, difficulty);
    // a client-echoed question is only checked for serve/submit consistency.
    { subject: "math", difficulty: "beginner", reasoning: "Adding the two fractions over a common denominator of twelve gives seven twelfths." },
    { subject: "math", difficulty: "advanced", reasoning: "Differentiating with the chain rule and setting the result to zero locates the maximum." },
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
    expect(Object.keys(j.scores.math.rubric)).toHaveLength(9); // per-subject 9-axis rubric profile
    expect(fetchMock).toHaveBeenCalledTimes(2); // one grade per answer (2 tiers)
  });

  it("derives the diagnostic reasoning-surface from the BANK, IGNORING a client-supplied spoof", async () => {
    const fetchMock = mockGroq(DIAG_GRADE);
    const spoof = "SPOOFED-naive-path-xyzzy";
    // math:intermediate is a TRAP slot in the curated bank; the client tries to override its trap.
    const res = await POST(
      req({
        kind: "diagnostic",
        answers: [{ subject: "math", difficulty: "intermediate", reasoning: REASONING, reasoningSurface: "trap", trap: spoof }],
      })
    );
    expect(res.status).toBe(200);
    const userMsg = JSON.parse(fetchMock.mock.calls[0][1].body).messages.find((m) => m.role === "user").content;
    const bank = diagnosticSurfaceFor("math", "intermediate");
    expect(bank.reasoningSurface).toBe("trap"); // sanity: this slot really is a trap in the bank
    expect(userMsg).toContain(`Reasoning surface: ${bank.reasoningSurface}`);
    expect(userMsg).toContain(bank.trap); // the BANK's trap reaches the grader
    expect(userMsg).not.toContain(spoof); // the client's spoofed trap is ignored
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

  it("DOCKS a blank diagnostic answer with no Groq call but still grades the substantive one", async () => {
    const mixed = [
      { subject: "math", difficulty: "beginner", reasoning: "   " }, // blank -> docked
      answers[1], // substantive -> graded
    ];
    const fetchMock = mockGroq(DIAG_GRADE);
    const res = await POST(req({ kind: "diagnostic", answers: mixed }));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1); // only the substantive answer hit Groq
    const j = await res.json();
    expect(j.scores.math.score).toBeGreaterThan(0);
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
    const many = Array.from({ length: 10 }, (_, i) => ({ subject: "math", question: `Q${i}`, difficulty: "beginner", reasoning: REASONING }));
    expect((await POST(req({ kind: "diagnostic", answers: many }))).status).toBe(400);
  });

  it("rejects an empty / non-array answers with 400", async () => {
    expect((await POST(req({ kind: "diagnostic", answers: [] }))).status).toBe(400);
    expect((await POST(req({ kind: "diagnostic" }))).status).toBe(400);
  });

  it("is resilient (allSettled): one failed grade doesn't sink the set", async () => {
    // First grade hard-fails (500, not retryable); the other succeeds → still 200.
    const fetchMock = mockGroq(DIAG_GRADE, { failFirstN: 1, failStatus: 500 });
    const res = await POST(req({ kind: "diagnostic", answers }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.scores.math.score).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
    const sixImages = [];
    for (const s of ["math", "physics", "chemistry"]) {
      for (const d of ["beginner", "advanced"]) {
        sixImages.push({ subject: s, difficulty: d, reasoning: REASONING, image: PNG });
      }
    }
    mockGroq(DIAG_GRADE);
    // First diagnostic: 6 image grades consume 6 of the 10-token :img budget → ok.
    expect((await POST(req({ kind: "diagnostic", answers: sixImages }))).status).toBe(200);
    // Second diagnostic: only 4 :img tokens remain but it needs 6, so the fan-out is
    // rejected (before this fix the diagnostic never touched :img and this returned 200).
    expect((await POST(req({ kind: "diagnostic", answers: sixImages }))).status).toBe(429);
  });
});

// ---- audit fix round 2: the server-issued question binding + concurrency ----
describe("POST /api/score practice — server-issued question tokens (audit P1-1)", () => {
  it("rejects a MISSING token with 400 — a PRE-DEPLOY (old-shape) body gets refresh guidance, a bare one gets generate-a-new-question; no Groq call either way", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    storage.getAdmin.mockReturnValue(fakeAdmin().sb);
    const failFetch = vi.fn(() => { throw new Error("must not call Groq"); });
    vi.stubGlobal("fetch", failFetch);
    // Old-shape stale client (loose subject/question, no token): "generate a new
    // question" would dead-end it (its regenerate path can't mint tokens) — it gets
    // the one instruction that works: refresh.
    const resOld = await POST(req(
      { kind: "practice", subject: "math", question: "Q", difficulty: "phd", reasoning: REASONING },
      { authHeader: true }
    ));
    expect(resOld.status).toBe(400);
    expect((await resOld.json()).error).toMatch(/refresh the page/i);
    // A current client that simply lost its token gets the regenerate guidance.
    const resBare = await POST(req({ kind: "practice", reasoning: REASONING }, { authHeader: true }));
    expect(resBare.status).toBe(400);
    expect((await resBare.json()).error).toMatch(/generate a new question/i);
    expect(failFetch).not.toHaveBeenCalled();
  });

  it("rejects a TAMPERED token (forged phd band) with 400 — the audit's rating-inflation vector is closed", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    storage.getAdmin.mockReturnValue(fakeAdmin().sb);
    const t = tok();
    const [body, mac] = t.split(".");
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    payload.difficulty = "phd";
    const forged = `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${mac}`;
    const res = await POST(req({ kind: "practice", token: forged, reasoning: REASONING }, { authHeader: true }));
    expect(res.status).toBe(400);
  });

  it("derives band/topic from the TOKEN — loose body fields claiming phd are ignored", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb, calls } = fakeAdmin({ scoresRows: [{ subject: "math", score: 40 }] });
    storage.getAdmin.mockReturnValue(sb);
    mockGroq(PRACTICE_GRADE);
    const res = await POST(req(
      {
        kind: "practice",
        token: tok({ difficulty: "beginner", topicSlug: "algebra" }),
        // The old attack surface, now inert:
        subject: "math", difficulty: "phd", topicSlug: "calculus_analysis", question: "trivial",
        reasoning: REASONING,
      },
      { authHeader: true }
    ));
    expect(res.status).toBe(200);
    const save = calls.rpc.find((c) => c.fn === "save_progress_for");
    expect(save.args.p_attempt.band).toBe("beginner"); // the SIGNED band, not the claimed phd
    expect(save.args.p_attempt.topic).toBe("algebra"); // the SIGNED topic
    expect(typeof save.args.p_attempt.jti).toBe("string"); // replay dedupe key persisted
    expect(save.args.p_check_conflict).toBe(true); // optimistic concurrency armed
  });

  it("returns 409 on a DUPLICATE (replayed) token — no second rating step", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb } = fakeAdmin({ scoresRows: [] });
    const realRpc = sb.rpc;
    sb.rpc = vi.fn(async (fn, args) => {
      if (fn === "save_progress_for") return { data: { status: "duplicate" }, error: null };
      return realRpc(fn, args);
    });
    storage.getAdmin.mockReturnValue(sb);
    mockGroq(PRACTICE_GRADE);
    const res = await POST(req({ kind: "practice", token: tok(), reasoning: REASONING }, { authHeader: true }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already been graded/i);
  });

  it("RECOMPUTES once on a concurrency conflict (status:'conflict' → fresh read → second save → 200)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb, calls } = fakeAdmin({ scoresRows: [{ subject: "math", score: 40 }] });
    const realRpc = sb.rpc;
    let saves = 0;
    sb.rpc = vi.fn(async (fn, args) => {
      if (fn === "save_progress_for") {
        saves += 1;
        if (saves === 1) { calls.rpc.push({ fn, args }); return { data: { status: "conflict" }, error: null }; }
        calls.rpc.push({ fn, args });
        return { data: { status: "ok" }, error: null };
      }
      return realRpc(fn, args);
    });
    storage.getAdmin.mockReturnValue(sb);
    mockGroq(PRACTICE_GRADE);
    const res = await POST(req({ kind: "practice", token: tok(), reasoning: REASONING }, { authHeader: true }));
    expect(res.status).toBe(200);
    expect(saves).toBe(2); // one conflicted, one committed — no lost update
  });

  it("gives up with 409 after TWO conflicts (no infinite loop; the learner just retries)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb } = fakeAdmin({ scoresRows: [] });
    const realRpc = sb.rpc;
    sb.rpc = vi.fn(async (fn, args) => {
      if (fn === "save_progress_for") return { data: { status: "conflict" }, error: null };
      return realRpc(fn, args);
    });
    storage.getAdmin.mockReturnValue(sb);
    mockGroq(PRACTICE_GRADE);
    const res = await POST(req({ kind: "practice", token: tok(), reasoning: REASONING }, { authHeader: true }));
    expect(res.status).toBe(409);
  });

  it("an IMAGE-ONLY answer whose vision call fails gets a retryable 500 — never a zero-grade of the placeholder (audit P1-3)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    storage.getAdmin.mockReturnValue(fakeAdmin({ scoresRows: [] }).sb);
    const fetchMock = mockGroq(PRACTICE_GRADE, { failFirstN: 99, failStatus: 500 });
    const PNG = { mime: "image/png", data: "iVBORw0KGgo=" };
    const res = await POST(req(
      { kind: "practice", token: tok(), reasoning: "", image: PNG },
      { authHeader: true }
    ));
    expect(res.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(1); // vision tried once; NO text-only fallback on the placeholder
  });
});

describe("POST /api/score diagnostic — bank-derived questions + global budget", () => {
  it("grades the BANK's question text for the slot — a substituted easy question is ignored", async () => {
    const fetchMock = mockGroq(DIAG_GRADE);
    const res = await POST(req({
      kind: "diagnostic",
      answers: [{ subject: "math", difficulty: "beginner", reasoning: REASONING }],
    }));
    expect(res.status).toBe(200);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userMsg = sent.messages.find((m) => m.role === "user").content;
    expect(userMsg).toContain("recipe uses 3 cups of flour"); // the curated bank's math/beginner question
    expect(userMsg).not.toContain("substituted");
  });

  it("answers without a question field still grade (the bank supplies the text)", async () => {
    mockGroq(DIAG_GRADE);
    const res = await POST(req({
      kind: "diagnostic",
      answers: [{ subject: "math", difficulty: "beginner", reasoning: REASONING }],
    }));
    expect(res.status).toBe(200);
    expect((await res.json()).scores.math).toBeTruthy();
  });

  it("the GLOBAL Groq budget bounds platform-wide spend: once exhausted, live grades 429 (audit P2-3)", async () => {
    process.env.GLOBAL_GROQ_BUDGET_PER_MIN = "1";
    try {
      mockGroq(DIAG_GRADE);
      // First request consumes the global window…
      expect((await POST(req({
        kind: "diagnostic",
        answers: [{ subject: "math", difficulty: "beginner", reasoning: REASONING }],
      }))).status).toBe(200);
      // …second (different IP — per-IP caps don't save it) is globally rejected.
      const r2 = new Request("http://test.local/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-real-ip": "203.0.113.99" },
        body: JSON.stringify({ kind: "diagnostic", answers: [{ subject: "physics", difficulty: "beginner", reasoning: REASONING }] }),
      });
      const res2 = await POST(r2);
      expect(res2.status).toBe(429);
      expect(res2.headers.get("Retry-After")).toBeTruthy();
    } finally {
      delete process.env.GLOBAL_GROQ_BUDGET_PER_MIN;
    }
  });
});

// ---- review round: band clamp + serve/submit consistency --------------------
describe("POST /api/score — review-round hardening", () => {
  it("CLAMPS the token band to one above the server-stored level (an injection-minted phd label on a low account grades near-level)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    // Stored level 30 → foundational; a phd-labeled token must clamp to intermediate.
    const { sb, calls } = fakeAdmin({ scoresRows: [{ subject: "math", score: 30, weak_concepts: [], comment: "", rubric: null, glicko: null }] });
    storage.getAdmin.mockReturnValue(sb);
    mockGroq(PRACTICE_GRADE);
    const res = await POST(req(
      { kind: "practice", token: tok({ difficulty: "phd", topicSlug: "algebra" }), reasoning: REASONING },
      { authHeader: true }
    ));
    expect(res.status).toBe(200);
    const save = calls.rpc.find((c) => c.fn === "save_progress_for");
    expect(save.args.p_attempt.band).toBe("intermediate"); // clamped, NOT phd
    // And the at/below-level direction is untouched (deflate-only):
    const { newScore } = expectedPracticeScore({ prevScore: 30, grade: PRACTICE_GRADE, band: "intermediate" });
    expect(save.args.p_scores[0].score).toBe(newScore);
  });

  it("a HIGH-level account is not clamped (phd at stored 85 stays phd)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb, calls } = fakeAdmin({ scoresRows: [{ subject: "math", score: 85, weak_concepts: [], comment: "", rubric: null, glicko: null }] });
    storage.getAdmin.mockReturnValue(sb);
    mockGroq(PRACTICE_GRADE);
    const res = await POST(req(
      { kind: "practice", token: tok({ difficulty: "phd" }), reasoning: REASONING },
      { authHeader: true }
    ));
    expect(res.status).toBe(200);
    expect(calls.rpc.find((c) => c.fn === "save_progress_for").args.p_attempt.band).toBe("phd");
  });

  it("diagnostic: a client-echoed question that MISMATCHES the bank's slot text is a retryable 409 (serve/submit consistency)", async () => {
    const failFetch = vi.fn(() => { throw new Error("must not grade a mismatched diagnostic"); });
    vi.stubGlobal("fetch", failFetch);
    const res = await POST(req({
      kind: "diagnostic",
      answers: [{ subject: "math", question: "a DIFFERENT question than was served", difficulty: "beginner", reasoning: REASONING }],
    }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/restart the diagnostic/i);
    expect(failFetch).not.toHaveBeenCalled();
  });

  it("diagnostic: an echoed question MATCHING the bank text passes the consistency check", async () => {
    mockGroq(DIAG_GRADE);
    const bankText = (await import("@/lib/diagnosticBank")).diagnosticQuestionFor("math", "beginner");
    const res = await POST(req({
      kind: "diagnostic",
      answers: [{ subject: "math", question: bankText, difficulty: "beginner", reasoning: REASONING }],
    }));
    expect(res.status).toBe(200);
  });

  it("a REPLAYED jti is caught by the cheap pre-grade check — 409 with NO Groq call and NO budget burn", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb } = fakeAdmin({ scoresRows: [] });
    const realFrom = sb.from.bind(sb);
    sb.from = (table) => {
      if (table === "attempts") {
        // The pre-grade jti lookup finds an existing row → replay.
        const chain = {
          select: () => chain, eq: () => chain, order: () => chain, limit: () => chain,
          then: (resolve, reject) => Promise.resolve({ data: [{ id: 7 }], error: null }).then(resolve, reject),
        };
        return chain;
      }
      return realFrom(table);
    };
    storage.getAdmin.mockReturnValue(sb);
    const failFetch = vi.fn(() => { throw new Error("replays must not reach Groq"); });
    vi.stubGlobal("fetch", failFetch);
    const res = await POST(req({ kind: "practice", token: tok(), reasoning: REASONING }, { authHeader: true }));
    expect(res.status).toBe(409);
    expect(failFetch).not.toHaveBeenCalled();
  });

  it("conflict recompute genuinely RE-READS: pass 2 computes from the moved row and threads its updated_at + the SAME jti", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    // Mutable fixture: the first persist-loop read sees score 40/t1; after the
    // conflict, the second read sees the concurrently-moved row (score 48/t2).
    const states = [
      [{ subject: "math", score: 40, weak_concepts: [], comment: "", rubric: null, glicko: null, updated_at: "2026-06-11T00:00:01.000000+00:00" }],
      [{ subject: "math", score: 48, weak_concepts: [], comment: "", rubric: null, glicko: null, updated_at: "2026-06-11T00:00:02.000000+00:00" }],
    ];
    let scoreReads = 0;
    const saves = [];
    const sb = {
      rpc: vi.fn(async (fn, args) => {
        if (fn === "save_progress_for") {
          saves.push(args);
          return { data: { status: saves.length === 1 ? "conflict" : "ok" }, error: null };
        }
        return { data: null, error: null };
      }),
      from: (table) => {
        const chain = {
          select: () => chain, eq: () => chain, order: () => chain, limit: () => chain,
          maybeSingle: async () => ({ data: null, error: null }),
          then: (resolve, reject) => {
            if (table === "scores") {
              const i = scoreReads++;
              // read 0 = pre-grade prompt read; reads 1,2 = the persist loop passes
              const data = i === 0 ? states[0] : states[Math.min(i - 1, 1)];
              return Promise.resolve({ data, error: null }).then(resolve, reject);
            }
            return Promise.resolve({ data: [], error: null }).then(resolve, reject);
          },
        };
        return chain;
      },
    };
    storage.getAdmin.mockReturnValue(sb);
    mockGroq(PRACTICE_GRADE);
    const res = await POST(req({ kind: "practice", token: tok(), reasoning: REASONING }, { authHeader: true }));
    expect(res.status).toBe(200);
    expect(saves).toHaveLength(2);
    // Pass 1 was computed from the t1 row; pass 2 MUST reflect the fresh t2 read.
    expect(saves[0].p_expected_updated_at).toBe("2026-06-11T00:00:01.000000+00:00");
    expect(saves[1].p_expected_updated_at).toBe("2026-06-11T00:00:02.000000+00:00");
    const s1 = expectedPracticeScore({ prevScore: 40, grade: PRACTICE_GRADE, band: "intermediate" });
    const s2 = expectedPracticeScore({ prevScore: 48, grade: PRACTICE_GRADE, band: "intermediate" });
    expect(saves[0].p_scores[0].score).toBe(s1.newScore);
    expect(saves[1].p_scores[0].score).toBe(s2.newScore); // recomputed, not reused
    expect(saves[1].p_attempt.jti).toBe(saves[0].p_attempt.jti); // same served question
    expect((await res.json()).newScore).toBe(s2.newScore);
  });
});
