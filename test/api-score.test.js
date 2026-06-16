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

// reportInjection returns the scan result (the route uses it for the HIGH-confidence
// auto-dock, audit P2-3). Default: a clean scan (no dock). A test can override
// inject.reportInjection to return a flagged HIGH scan. shouldDockForInjection mirrors
// the real pure threshold (dock only on severity 'high').
const inject = vi.hoisted(() => ({
  reportInjection: vi.fn(() => ({ flagged: false, severity: null, matches: [] })),
}));
vi.mock("@/lib/abuseDetection", () => ({
  reportInjection: (...a) => inject.reportInjection(...a),
  reportRateLimit: vi.fn(),
  shouldDockForInjection: (scan) => !!(scan && scan.flagged && scan.severity === "high"),
}));

import { POST } from "@/app/api/score/route";
import { signQuestion, signDiagState, verifyDiagToken } from "@/lib/questionToken";
import { _resetRateLimits } from "@/lib/rateLimit";
import { ORDER, updateAxisRatings, scoreFromRubric, defaultDifficultyForBand, normalizeRubric, diagnosticPathScore, DIAG_PLACEMENT_CEILING } from "@/lib/scoring";
import { diagnosticItemById, DIAG_STEPS_PER_SUBJECT } from "@/lib/diagnosticBank";

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

// ---- numeric verifier fixtures (lib/numericVerify.js) -----------------------
// A grade whose `solve.check` PROVES the grader's own finalAnswer wrong
// (100/32 = 3.125, not 31.25) while the learner's stated answer matches the
// machine value — the exact failure mode the verifier exists to catch.
const VERIFY_BAD = {
  rubric: mkRubric(3, { computation: 1 }),
  solve: { principle: "p", steps: ["s1"], finalAnswer: "31.25 m", units: "m", check: "(100 / 32) m" },
  errors: [{ type: "execution-slip", step: "last line", severity: "minor", what: "decimal slip", feedbackMode: "point", message: "m", socraticPrompt: "" }],
  learnerAnswer: "3.125 m",
  finalAnswerMatches: false,
  strengths: ["s"],
  improvements: ["i"],
  workedSolution: "ws",
  correctnessNote: "c",
  socraticHint: "h",
  microLesson: "ml",
  weakConcepts: [],
};
// What an honest corrective re-grade returns: arithmetic fixed, check consistent.
const VERIFY_FIXED = {
  ...VERIFY_BAD,
  rubric: mkRubric(3, { computation: 4 }),
  solve: { ...VERIFY_BAD.solve, finalAnswer: "3.125 m" },
  errors: [],
  finalAnswerMatches: true,
};

// Stub Groq to return payloads IN SEQUENCE (clamped to the last) — the verifier's
// corrective re-grade is a second upstream call with a different answer.
function mockGroqSeq(payloads) {
  let n = 0;
  const fetchMock = vi.fn(async () => {
    const payload = payloads[Math.min(n, payloads.length - 1)];
    n += 1;
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }], usage: {} }),
      text: async () => "",
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

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
  inject.reportInjection.mockReset();
  inject.reportInjection.mockReturnValue({ flagged: false, severity: null, matches: [] });
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
    const { sb, calls } = fakeAdmin({ scoresRows: [{ subject: "math", score: 140, weak_concepts: ["old"], comment: "c", rubric: null, glicko: null }] });
    storage.getAdmin.mockReturnValue(sb);
    mockGroq(PRACTICE_GRADE);

    const res = await POST(req(
      { kind: "practice", token: tok({ targetConcept: "chain rule", topicSlug: "calculus_analysis" }), reasoning: REASONING },
      { authHeader: true }
    ));
    expect(res.status).toBe(200);
    const j = await res.json();

    const { newScore, reasoningScore } = expectedPracticeScore({ prevScore: 140, grade: PRACTICE_GRADE, band: "intermediate" });
    expect(j.newScore).toBe(newScore);
    expect(j.delta).toBe(newScore - 140);
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
    const { sb, calls } = fakeAdmin({ scoresRows: [{ subject: "math", score: 140, weak_concepts: [], comment: "", rubric: null }] });
    storage.getAdmin.mockReturnValue(sb);
    mockGroq(PRACTICE_GRADE);

    const res = await POST(req(
      { kind: "practice", token: tok(), reasoning: REASONING, score: 999, newScore: 999, reasoningScore: 999 },
      { authHeader: true }
    ));
    const j = await res.json();
    const { newScore } = expectedPracticeScore({ prevScore: 140, grade: PRACTICE_GRADE, band: "intermediate" });
    expect(j.newScore).toBe(newScore);
    expect(j.newScore).not.toBe(999);
    const save = calls.rpc.find((c) => c.fn === "save_progress_for");
    expect(save.args.p_scores[0].score).toBe(newScore);
    expect(save.args.p_scores[0].score).not.toBe(999);
  });

  it("uses the persisted item difficulty (not the band default) when the bucket is calibrated", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb } = fakeAdmin({
      scoresRows: [{ subject: "math", score: 140, weak_concepts: [], comment: "", rubric: null }],
      itemDifficulty: { difficulty: 315, attempts: 50 }, // a much harder, well-CALIBRATED bucket (>= the min-attempts floor)
      attemptCount: 3,
    });
    storage.getAdmin.mockReturnValue(sb);
    mockGroq(PRACTICE_GRADE);
    const res = await POST(req(
      { kind: "practice", token: tok({ topicSlug: "calculus_analysis" }), reasoning: REASONING },
      { authHeader: true }
    ));
    const j = await res.json();
    const { newScore } = expectedPracticeScore({ prevScore: 140, grade: PRACTICE_GRADE, itemDifficulty: 315, attemptCount: 3 });
    expect(j.newScore).toBe(newScore); // beating a HARD item lifts more than the band default would
  });

  it("DOCKS an 'idk' practice answer deterministically — no Groq call, rating drops, all-zero rubric", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb, calls } = fakeAdmin({ scoresRows: [{ subject: "math", score: 210, weak_concepts: [], comment: "", rubric: { conceptual_understanding: 3 } }] });
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
    expect(j.newScore).toBeLessThan(210); // docking DROPS the rating (anti-"idk"), not a no-op
    expect(j.rationale).toMatch(/docked/i);
    // A dock carries no difficulty signal, so the bucket is NOT calibrated from it.
    expect(calls.rpc.find((c) => c.fn === "bump_item_difficulty")).toBeFalsy();
    // A docked non-answer NEVER reveals the worked solution.
    expect(j.workedSolution).toBe("");
  });

  it("persists the answer-review (p_review) and reveals the worked solution on a substantive attempt (PR 6)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb, calls } = fakeAdmin({ scoresRows: [{ subject: "math", score: 140 }] });
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
    const { sb } = fakeAdmin({ scoresRows: [{ subject: "math", score: 175 }] });
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
    const { sb } = fakeAdmin({ scoresRows: [{ subject: "math", score: 140 }], rpcError: { message: "db boom" } });
    storage.getAdmin.mockReturnValue(sb);
    mockGroq(PRACTICE_GRADE);
    const res = await POST(req({ kind: "practice", token: tok(), reasoning: REASONING }, { authHeader: true }));
    expect(res.status).toBe(500);
    const j = await res.json();
    expect(j.error).not.toMatch(/db boom/);
  });

  it("retries ONCE on a 429 from Groq (transient rate cap) and then succeeds", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    storage.getAdmin.mockReturnValue(fakeAdmin({ scoresRows: [{ subject: "math", score: 140 }] }).sb);
    const fetchMock = mockGroq(PRACTICE_GRADE, { failFirstN: 1, failStatus: 429 });
    const res = await POST(req({ kind: "practice", token: tok(), reasoning: REASONING }, { authHeader: true }));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2); // first 429, retried once -> ok
  });
});

// ---- HIGH-confidence injection auto-dock (audit P2-3) -----------------------
describe("POST /api/score practice — HIGH-confidence injection auto-dock", () => {
  it("docks a flagged HIGH injection to ~0, persists it, and never calls Groq", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb, calls } = fakeAdmin({ scoresRows: [{ subject: "math", score: 175, weak_concepts: [], comment: "", rubric: null, glicko: null }] });
    storage.getAdmin.mockReturnValue(sb);
    // A successful injection could otherwise inflate the persisted rating — the route
    // reads the scan from reportInjection and docks on a HIGH verdict.
    inject.reportInjection.mockReturnValue({ flagged: true, severity: "high", matches: [{ label: "grading-override", severity: "high", snippet: "x" }] });
    const failFetch = vi.fn(() => { throw new Error("must not call Groq on an injection-docked attempt"); });
    vi.stubGlobal("fetch", failFetch);

    const res = await POST(req({ kind: "practice", token: tok(), reasoning: REASONING }, { authHeader: true }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.docked).toBe(true);
    expect(j.reasoningScore).toBeLessThan(10);
    expect(Object.values(j.rubric).every((v) => v === 0)).toBe(true);
    expect(j.workedSolution).toBe(""); // no solution leaked to a docked attempt
    expect(failFetch).not.toHaveBeenCalled(); // the LLM grade was skipped entirely
    // The dock outcome (a low quality) is persisted — a high-band injection can't pin a 100.
    const save = calls.rpc.find((c) => c.fn === "save_progress_for");
    expect(save).toBeTruthy();
    expect(save.args.p_attempt.reasoning_score).toBeLessThan(10);
  });

  it("a clean scan (benign keyword) grades normally — no false-positive dock", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    storage.getAdmin.mockReturnValue(fakeAdmin({ scoresRows: [{ subject: "math", score: 175 }] }).sb);
    inject.reportInjection.mockReturnValue({ flagged: false, severity: null, matches: [] });
    const fetchMock = mockGroq(PRACTICE_GRADE);
    const res = await POST(req({ kind: "practice", token: tok(), reasoning: REASONING }, { authHeader: true }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.docked).toBeFalsy();
    expect(fetchMock).toHaveBeenCalled(); // graded by the LLM
  });
});

// ---- numeric verifier on the practice path ----------------------------------
describe("POST /api/score practice — numeric verifier (sandboxed arithmetic check)", () => {
  const signedIn = () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const admin = fakeAdmin({ scoresRows: [{ subject: "math", score: 140, weak_concepts: [], comment: "", rubric: null, glicko: null }] });
    storage.getAdmin.mockReturnValue(admin.sb);
    return admin;
  };

  it("confirms a self-consistent grade and corrects a wrong learner flag WITHOUT a second Groq call", async () => {
    const { calls } = signedIn();
    // The grader's arithmetic checks out ((120-40)/16 = 5) and the learner matched
    // it — but the grader misflagged the match and docked computation anyway.
    const misflagged = {
      ...VERIFY_BAD,
      solve: { principle: "p", steps: ["s1"], finalAnswer: "5 m", units: "m", check: "((120 - 40) / 16) m" },
      learnerAnswer: "5 m",
    };
    const fetchMock = mockGroqSeq([misflagged]);
    const res = await POST(req({ kind: "practice", token: tok(), reasoning: REASONING }, { authHeader: true }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(j.verification).toEqual({ status: "confirmed", value: "5 m", changed: true });
    expect(j.finalAnswerMatches).toBe(true);
    expect(j.rubric.computation).toBe(4); // raise-only restore
    expect(j.errors).toEqual([]); // the refuted final-number execution-slip is dropped
    expect(j.reasoningScore).toBe(scoreFromRubric(normalizeRubric(mkRubric(3, { computation: 4 }))));
    // The verdict rides the persisted attempt review.
    const save = calls.rpc.find((c) => c.fn === "save_progress_for");
    expect(save.args.p_review.feedback.verification.status).toBe("confirmed");
  });

  it("re-grades ONCE on a proven-wrong solve, injecting the server-verified value into the system prompt", async () => {
    signedIn();
    const fetchMock = mockGroqSeq([VERIFY_BAD, VERIFY_FIXED]);
    const res = await POST(req({ kind: "practice", token: tok(), reasoning: REASONING }, { authHeader: true }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const system2 = JSON.parse(fetchMock.mock.calls[1][1].body).messages.find((m) => m.role === "system").content;
    expect(system2).toContain("SERVER ARITHMETIC CHECK");
    expect(system2).toContain("3.125 m");
    expect(j.verification.status).toBe("regraded");
    expect(j.finalAnswerMatches).toBe(true);
    expect(j.rubric.computation).toBe(4);
    expect(j.errors).toEqual([]);
    // The CORRECTED grade is what scores and persists.
    expect(j.reasoningScore).toBe(scoreFromRubric(normalizeRubric(VERIFY_FIXED.rubric)));
  });

  it("falls back to FIELD-LEVEL correction when the global Groq budget denies the re-grade (a successful grade is never 429'd)", async () => {
    signedIn();
    process.env.GLOBAL_GROQ_BUDGET_PER_MIN = "1"; // the primary grade consumes the whole window
    const fetchMock = mockGroqSeq([VERIFY_BAD, VERIFY_FIXED]);
    const res = await POST(req({ kind: "practice", token: tok(), reasoning: REASONING }, { authHeader: true }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(fetchMock).toHaveBeenCalledTimes(1); // the re-grade never fired
    expect(j.verification.status).toBe("corrected");
    // The learner's answer matches the machine value: flag + computation + slip fixed in place.
    expect(j.finalAnswerMatches).toBe(true);
    expect(j.rubric.computation).toBe(4);
    expect(j.errors).toEqual([]);
  });

  it("NEVER re-fires the expensive vision path: an image grade falls back to field-level correction", async () => {
    signedIn();
    const PNG = { mime: "image/png", data: "iVBORw0KGgo=" };
    const fetchMock = mockGroqSeq([VERIFY_BAD, VERIFY_FIXED]);
    const res = await POST(req({ kind: "practice", token: tok(), reasoning: REASONING, image: PNG }, { authHeader: true }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(fetchMock).toHaveBeenCalledTimes(1); // exactly one (vision) upstream call
    expect(j.verification.status).toBe("corrected");
    expect(j.finalAnswerMatches).toBe(true);
  });
});

// ---- diagnostic: auth-optional batch baseline ------------------------------
// ---- adaptive diagnostic helpers (RANKS_PLAN §8) -----------------------------

// A signed mid-run step state, the way /api/generate mints the start (REAL lib —
// the secret is set in beforeEach), with overridable fields for tamper tests.
function stepTok(state = {}) {
  const subject = state.subject || "math";
  const itemId = state.itemId || `${subject}:intermediate:1`;
  return signDiagState({ subject, step: 1, itemId, asked: [itemId], transcript: [], ...state });
}

// Drive ONE subject's full walk through the route (Groq mocked per test),
// returning the finalToken. `reasonings[i]` is step i's answer (default strong).
async function runSubjectWalk(subject, { reasonings = [], authHeader = false } = {}) {
  let token = stepTok({ subject });
  for (let i = 0; i < DIAG_STEPS_PER_SUBJECT; i++) {
    const reasoning = reasonings[i] !== undefined ? reasonings[i] : REASONING;
    const res = await POST(req({ kind: "diagnostic", token, reasoning }, { authHeader }));
    expect(res.status).toBe(200);
    const j = await res.json();
    if (i < DIAG_STEPS_PER_SUBJECT - 1) {
      token = j.next.token;
    } else {
      expect(j.subjectComplete).toBe(true);
      return j.finalToken;
    }
  }
}

describe("POST /api/score diagnostic — adaptive STEP (signed ±1-band walk)", () => {
  it("grades the BANK item named by the SIGNED token (question + trap from the bank, nothing from the body)", async () => {
    const fetchMock = mockGroq(DIAG_GRADE);
    const item = diagnosticItemById("math:intermediate:1"); // a TRAP item in the bank
    expect(item.reasoningSurface).toBe("trap");
    const res = await POST(req({ kind: "diagnostic", token: stepTok({}), reasoning: REASONING, question: "substituted easy question", trap: "SPOOF-xyzzy" }));
    expect(res.status).toBe(200);
    const userMsg = JSON.parse(fetchMock.mock.calls[0][1].body).messages.find((m) => m.role === "user").content;
    expect(userMsg).toContain(item.question.slice(0, 40)); // the bank's text is graded
    expect(userMsg).toContain(`Reasoning surface: ${item.reasoningSurface}`);
    expect(userMsg).toContain(item.trap); // the BANK's trap reaches the grader
    expect(userMsg).not.toContain("substituted easy question");
    expect(userMsg).not.toContain("SPOOF-xyzzy");
  });

  it("walks UP on a strong grade: next item is one band higher, the chain extends by the graded entry", async () => {
    mockGroq(DIAG_GRADE); // rubric of 3s → quality ≥ the up-threshold
    const res = await POST(req({ kind: "diagnostic", token: stepTok({}), reasoning: REASONING }));
    const j = await res.json();
    const quality = scoreFromRubric(normalizeRubric(DIAG_GRADE.rubric));
    expect(j.graded).toEqual({ subject: "math", difficulty: "intermediate", reasoningScore: quality });
    expect(j.next.difficulty).toBe("advanced");
    expect(j.next.stepNo).toBe(2);
    const v = verifyDiagToken(j.next.token);
    expect(v.ok).toBe(true);
    expect(v.state.step).toBe(2);
    expect(v.state.itemId.startsWith("math:advanced:")).toBe(true);
    expect(v.state.asked).toEqual(["math:intermediate:1", v.state.itemId]);
    expect(v.state.transcript).toHaveLength(1);
    expect(v.state.transcript[0]).toMatchObject({ i: "math:intermediate:1", d: "intermediate", s: quality });
  });

  it("DOCKS a blank step with no Groq call and walks DOWN a band", async () => {
    const failFetch = vi.fn(() => { throw new Error("a docked step must not call Groq"); });
    vi.stubGlobal("fetch", failFetch);
    const res = await POST(req({ kind: "diagnostic", token: stepTok({}), reasoning: "   " }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(failFetch).not.toHaveBeenCalled();
    expect(j.graded.reasoningScore).toBeLessThan(10); // the dock floor
    expect(j.next.difficulty).toBe("foundational"); // intermediate − 1
  });

  it("the final step returns subjectComplete + a verifiable done-token carrying the whole walk", async () => {
    mockGroq(DIAG_GRADE);
    const finalToken = await runSubjectWalk("math");
    const v = verifyDiagToken(finalToken);
    expect(v.ok).toBe(true);
    expect(v.state.done).toBe(true);
    expect(v.state.subject).toBe("math");
    expect(v.state.transcript).toHaveLength(DIAG_STEPS_PER_SUBJECT);
    // Strong grades from the middle: intermediate → advanced → phd.
    expect(v.state.transcript.map((e) => e.d)).toEqual(["intermediate", "advanced", "phd"]);
  });

  it("rejects tampered/foreign tokens: a practice token, a forged signature, and a signed-but-unknown item", async () => {
    const failFetch = vi.fn(() => { throw new Error("must not grade an unverified step"); });
    vi.stubGlobal("fetch", failFetch);
    // A PRACTICE question token is not a diag step (kind separation).
    expect((await POST(req({ kind: "diagnostic", token: tok(), reasoning: REASONING }))).status).toBe(401);
    // A flipped signature fails the MAC.
    const t = stepTok({});
    expect((await POST(req({ kind: "diagnostic", token: t.slice(0, -4) + "AAAA", reasoning: REASONING }))).status).toBe(401);
    // A validly-signed state naming a non-bank item fails closed.
    expect((await POST(req({ kind: "diagnostic", token: stepTok({ itemId: "math:intermediate:99", asked: ["math:intermediate:99"] }), reasoning: REASONING }))).status).toBe(400);
    // A done-token can't be replayed as a step.
    const done = signDiagState({ subject: "math", done: true, transcript: [] });
    expect((await POST(req({ kind: "diagnostic", token: done, reasoning: REASONING }))).status).toBe(400);
    expect(failFetch).not.toHaveBeenCalled();
  });

  it("rejects an INVALID auth header rather than silently downgrading to guest", async () => {
    auth.requireUser.mockResolvedValue({ error: "Invalid or expired session.", status: 401 });
    const failFetch = vi.fn(() => { throw new Error("must not grade with a bad token"); });
    vi.stubGlobal("fetch", failFetch);
    const res = await POST(req({ kind: "diagnostic", token: stepTok({}), reasoning: REASONING }, { authHeader: true }));
    expect(res.status).toBe(401);
    expect(failFetch).not.toHaveBeenCalled();
  });

  it("a grader failure is a retryable 500 and the SAME token still works on the retry", async () => {
    mockGroq({ comment: "no rubric here" }); // grader returned no usable rubric
    const token = stepTok({});
    expect((await POST(req({ kind: "diagnostic", token, reasoning: REASONING }))).status).toBe(500);
    mockGroq(DIAG_GRADE);
    expect((await POST(req({ kind: "diagnostic", token, reasoning: REASONING }))).status).toBe(200);
  });

  it("a stale (pre-adaptive) batch payload gets the retryable restart error, never a grade", async () => {
    const failFetch = vi.fn(() => { throw new Error("must not grade the legacy shape"); });
    vi.stubGlobal("fetch", failFetch);
    const res = await POST(req({ kind: "diagnostic", answers: [{ subject: "math", difficulty: "beginner", reasoning: REASONING }] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/restart the diagnostic/i);
    expect(failFetch).not.toHaveBeenCalled();
  });

  it("numeric verifier: a proven-wrong diagnostic grade re-grades once and the CORRECTED rubric feeds the walk", async () => {
    const DIAG_BAD = {
      subject: "math",
      rubric: mkRubric(3, { computation: 0 }),
      solve: { principle: "p", steps: ["s"], finalAnswer: "31.25 m", units: "m", check: "(100 / 32) m" },
      errors: [],
      learnerAnswer: "3.125 m",
      finalAnswerMatches: false,
      weakConcepts: ["w"],
      comment: "c",
    };
    const DIAG_FIXED = {
      ...DIAG_BAD,
      rubric: mkRubric(3, { computation: 4 }),
      solve: { ...DIAG_BAD.solve, finalAnswer: "3.125 m" },
      finalAnswerMatches: true,
    };
    const fetchMock = mockGroqSeq([DIAG_BAD, DIAG_FIXED]);
    const res = await POST(req({ kind: "diagnostic", token: stepTok({}), reasoning: REASONING }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const system2 = JSON.parse(fetchMock.mock.calls[1][1].body).messages.find((m) => m.role === "system").content;
    expect(system2).toContain("SERVER ARITHMETIC CHECK");
    // The corrected rubric is the step's quality — it routes the ±1-band walk and
    // rides the signed chain.
    const quality = scoreFromRubric(normalizeRubric(DIAG_FIXED.rubric));
    expect(j.graded.reasoningScore).toBe(quality);
    const v = verifyDiagToken(j.next.token);
    expect(v.ok).toBe(true);
    expect(v.state.transcript[0].s).toBe(quality);
  });

  it("image-bearing steps charge the :img budget (the multimodal path can't bypass the cap)", async () => {
    const PNG = { mime: "image/png", data: "iVBORw0KGgo=" };
    mockGroq(DIAG_GRADE);
    for (let i = 0; i < 10; i++) {
      const res = await POST(req({ kind: "diagnostic", token: stepTok({}), reasoning: REASONING, image: PNG }));
      expect(res.status).toBe(200); // tokens 1..10 of the :img budget
    }
    const over = await POST(req({ kind: "diagnostic", token: stepTok({}), reasoning: REASONING, image: PNG }));
    expect(over.status).toBe(429);
  });
});

describe("POST /api/score diagnostic — FINALIZE (aggregate the signed walks)", () => {
  it("GUEST: verifies the three done-tokens and returns the path-weighted baseline WITHOUT persisting (zero Groq on finalize)", async () => {
    mockGroq(DIAG_GRADE);
    const tokens = [];
    for (const s of ORDER) tokens.push(await runSubjectWalk(s));
    const failFetch = vi.fn(() => { throw new Error("finalize must not call Groq"); });
    vi.stubGlobal("fetch", failFetch);
    const res = await POST(req({ kind: "diagnostic", tokens }));
    expect(res.status).toBe(200);
    expect(failFetch).not.toHaveBeenCalled();
    const j = await res.json();
    expect(j.persisted).toBe(false);
    expect(j.attempt).toBe(null);
    for (const s of ORDER) {
      expect(j.scores[s].score).toBeGreaterThan(0);
      expect(Object.keys(j.scores[s].rubric)).toHaveLength(9);
    }
    // The seed target is the REAL path-weighted aggregate over the walked bands.
    const quality = scoreFromRubric(normalizeRubric(DIAG_GRADE.rubric));
    const walked = ["intermediate", "advanced", "phd"].map((d) => ({ difficulty: d, reasoningScore: quality }));
    // FIX 7: quality aggregate maps through the conservative DIAG_PLACEMENT_CEILING.
    expect(j.scores.math.score).toBe(Math.round((diagnosticPathScore(walked) * DIAG_PLACEMENT_CEILING) / 100));
    expect(j.masteryUpdates).toHaveLength(ORDER.length * DIAG_STEPS_PER_SUBJECT);
  });

  it("SIGNED-IN: persists the baseline for the verified uid (save first, mastery bump after)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb, calls } = fakeAdmin();
    storage.getAdmin.mockReturnValue(sb);
    mockGroq(DIAG_GRADE);
    const tokens = [];
    for (const s of ORDER) tokens.push(await runSubjectWalk(s, { authHeader: true }));
    const res = await POST(req({ kind: "diagnostic", tokens }, { authHeader: true }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.persisted).toBe(true);
    expect(j.attempt).toMatchObject({ type: "baseline", subject: null });
    const save = calls.rpc.find((c) => c.fn === "save_progress_for");
    expect(save.args.p_user).toBe("u1");
    expect(save.args.p_attempt.type).toBe("baseline");
    expect(save.args.p_scores).toHaveLength(ORDER.length);
    expect(save.args.p_scores[0].rubric).toBeTruthy();
    const saveIdx = calls.rpc.findIndex((c) => c.fn === "save_progress_for");
    const bumpIdx = calls.rpc.findIndex((c) => c.fn === "bump_concept_mastery");
    expect(bumpIdx).toBeGreaterThan(saveIdx);
  });

  it("fails closed (400 restart) on: a missing subject, a duplicated subject, a mid-run token, or an unknown transcript item", async () => {
    mockGroq(DIAG_GRADE);
    const m = await runSubjectWalk("math");
    const p = await runSubjectWalk("physics");
    const c = await runSubjectWalk("chemistry");
    // Two tokens (missing chemistry).
    expect((await POST(req({ kind: "diagnostic", tokens: [m, p] }))).status).toBe(400);
    // Duplicate math instead of chemistry.
    expect((await POST(req({ kind: "diagnostic", tokens: [m, p, m] }))).status).toBe(400);
    // A mid-run step token isn't a completed walk.
    expect((await POST(req({ kind: "diagnostic", tokens: [m, p, stepTok({ subject: "chemistry", itemId: "chemistry:intermediate:1" })] }))).status).toBe(400);
    // A signed transcript naming an item no longer in the bank (a mid-sitting bank
    // edit/deploy) fails closed into a free restart.
    const ghost = signDiagState({
      subject: "chemistry",
      done: true,
      transcript: Array.from({ length: DIAG_STEPS_PER_SUBJECT }, () => ({ i: "chemistry:intermediate:99", d: "intermediate", s: 80, r: {}, w: [], c: "" })),
    });
    expect((await POST(req({ kind: "diagnostic", tokens: [m, p, ghost] }))).status).toBe(400);
    // The intact set still finalizes (the failures above consumed nothing).
    expect((await POST(req({ kind: "diagnostic", tokens: [m, p, c] }))).status).toBe(200);
  });
});

// ---- per-concept mastery (Learn-tab coloring, RANKS_PLAN §12.1) -------------
describe("POST /api/score — per-concept mastery counters", () => {
  it("practice with an allow-listed conceptKey bumps mastery with the SERVER-computed quality", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb, calls } = fakeAdmin({ scoresRows: [{ subject: "math", score: 40, weak_concepts: [], comment: "", rubric: null, glicko: null }] });
    storage.getAdmin.mockReturnValue(sb);
    mockGroq(PRACTICE_GRADE);

    const res = await POST(req(
      { kind: "practice", token: tok({ conceptKey: "ratios_unit_rates" }), reasoning: REASONING },
      { authHeader: true }
    ));
    expect(res.status).toBe(200);
    const body = await res.json();

    const expectedQuality = scoreFromRubric(normalizeRubric(PRACTICE_GRADE.rubric));
    const bump = calls.rpc.find((c) => c.fn === "bump_concept_mastery");
    expect(bump).toBeTruthy();
    expect(bump.args.p_user).toBe("u1");
    expect(bump.args.p_entries).toEqual([{ subject: "math", concept_key: "ratios_unit_rates", quality: expectedQuality }]);
    // The applied update is mirrored to the client (camelCase) for in-memory merges.
    expect(body.masteryUpdates).toEqual([{ subject: "math", conceptKey: "ratios_unit_rates", quality: expectedQuality }]);
  });

  it("an unknown/forged conceptKey is DROPPED (no bump, empty masteryUpdates) — and so is a cross-subject key", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    for (const conceptKey of ["totally_fake", "balanced_unbalanced_forces", "__proto__"]) {
      const { sb, calls } = fakeAdmin({ scoresRows: [] });
      storage.getAdmin.mockReturnValue(sb);
      mockGroq(PRACTICE_GRADE);
      const res = await POST(req(
        { kind: "practice", token: tok({ conceptKey }), reasoning: REASONING },
        { authHeader: true }
      ));
      expect(res.status).toBe(200);
      expect((await res.json()).masteryUpdates).toEqual([]);
      expect(calls.rpc.find((c) => c.fn === "bump_concept_mastery")).toBeFalsy();
    }
  });

  it("a DOCKED concept-tagged attempt still bumps (a skip marks the concept red by design)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb, calls } = fakeAdmin({ scoresRows: [] });
    storage.getAdmin.mockReturnValue(sb);
    const failFetch = vi.fn(() => { throw new Error("docked answers must not reach Groq"); });
    vi.stubGlobal("fetch", failFetch);

    const res = await POST(req(
      { kind: "practice", token: tok({ conceptKey: "ratios_unit_rates" }), reasoning: "" },
      { authHeader: true }
    ));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.docked).toBe(true);
    const bump = calls.rpc.find((c) => c.fn === "bump_concept_mastery");
    expect(bump).toBeTruthy();
    // The dock's forced-low score is the quality — single digits, i.e. a red signal.
    expect(bump.args.p_entries[0].quality).toBe(body.reasoningScore);
    expect(body.reasoningScore).toBeLessThan(10);
    expect(failFetch).not.toHaveBeenCalled();
  });

  it("diagnostic masteryUpdates carry the BANK's concept tags for the walked items (incl. a docked skip → red signal)", async () => {
    mockGroq(DIAG_GRADE);
    // Math: skip the FIRST step (docked, walks down), then answer strongly.
    // Walk: intermediate(dock) → foundational → intermediate.
    const m = await runSubjectWalk("math", { reasonings: ["   ", REASONING, REASONING] });
    const p = await runSubjectWalk("physics");
    const c = await runSubjectWalk("chemistry");
    const res = await POST(req({ kind: "diagnostic", tokens: [m, p, c] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.persisted).toBe(false);

    const gradedQuality = scoreFromRubric(normalizeRubric(DIAG_GRADE.rubric));
    const math = body.masteryUpdates.filter((u) => u.subject === "math");
    expect(math).toHaveLength(DIAG_STEPS_PER_SUBJECT);
    // Step 1 = the docked skip on math:intermediate:1 — colors the BANK's concept red.
    expect(math[0].conceptKey).toBe(diagnosticItemById("math:intermediate:1").conceptKey);
    expect(math[0].quality).toBeLessThan(10);
    // The rest carry the graded quality and the walked items' bank tags.
    for (const u of math.slice(1)) {
      expect(u.quality).toBe(gradedQuality);
      expect(typeof u.conceptKey).toBe("string");
    }
  });

  it("a signed-in diagnostic finalize persists the mastery counters via bump_concept_mastery (snake_case entries)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u9" } });
    const { sb, calls } = fakeAdmin();
    storage.getAdmin.mockReturnValue(sb);
    mockGroq(DIAG_GRADE);
    const tokens = [];
    for (const s of ORDER) tokens.push(await runSubjectWalk(s, { authHeader: true }));
    const res = await POST(req({ kind: "diagnostic", tokens }, { authHeader: true }));
    expect(res.status).toBe(200);
    const bump = calls.rpc.find((c) => c.fn === "bump_concept_mastery");
    expect(bump).toBeTruthy();
    expect(bump.args.p_user).toBe("u9");
    expect(bump.args.p_entries).toHaveLength(ORDER.length * DIAG_STEPS_PER_SUBJECT);
    expect(bump.args.p_entries[0]).toEqual({
      subject: "math",
      concept_key: diagnosticItemById("math:intermediate:1").conceptKey,
      quality: scoreFromRubric(normalizeRubric(DIAG_GRADE.rubric)),
    });
    // And the save still happened first (mastery rides AFTER the authoritative write).
    const saveIdx = calls.rpc.findIndex((c) => c.fn === "save_progress_for");
    const bumpIdx = calls.rpc.findIndex((c) => c.fn === "bump_concept_mastery");
    expect(saveIdx).toBeGreaterThanOrEqual(0);
    expect(bumpIdx).toBeGreaterThan(saveIdx);
  });

  it("a mastery-bump failure NEVER fails the grade — both failure shapes (resolved {error} like real supabase-js, and a network throw)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    // Shape 1 — the REAL supabase-js behavior: rpc() resolves { error }, never throws
    // (e.g. a live DB that predates migration 0010 → PGRST202). The route must log it
    // (checked via the resolved error, not a dead catch) and still return 200.
    {
      const { sb } = fakeAdmin({ scoresRows: [] });
      const realRpc = sb.rpc;
      sb.rpc = vi.fn(async (fn, args) => {
        if (fn === "bump_concept_mastery") return { data: null, error: { code: "PGRST202", message: "function not found" } };
        return realRpc(fn, args);
      });
      storage.getAdmin.mockReturnValue(sb);
      mockGroq(PRACTICE_GRADE);
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const res = await POST(req(
        { kind: "practice", token: tok({ conceptKey: "ratios_unit_rates" }), reasoning: REASONING },
        { authHeader: true }
      ));
      expect(res.status).toBe(200);
      expect(errSpy.mock.calls.some(([msg]) => String(msg).includes("bump_concept_mastery"))).toBe(true);
      errSpy.mockRestore();
    }
    // Shape 2 — a network-level rejection also must not fail the grade.
    {
      const { sb } = fakeAdmin({ scoresRows: [] });
      const realRpc = sb.rpc;
      sb.rpc = vi.fn(async (fn, args) => {
        if (fn === "bump_concept_mastery") throw new Error("socket hang up");
        return realRpc(fn, args);
      });
      storage.getAdmin.mockReturnValue(sb);
      mockGroq(PRACTICE_GRADE);
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const res = await POST(req(
        { kind: "practice", token: tok({ conceptKey: "ratios_unit_rates" }), reasoning: REASONING },
        { authHeader: true }
      ));
      expect(res.status).toBe(200);
      errSpy.mockRestore();
    }
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
    const { sb, calls } = fakeAdmin({ scoresRows: [{ subject: "math", score: 140 }] });
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
    const { sb, calls } = fakeAdmin({ scoresRows: [{ subject: "math", score: 140 }] });
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

describe("POST /api/score diagnostic — global budget", () => {
  it("the GLOBAL Groq budget bounds platform-wide spend: once exhausted, live step grades 429 (audit P2-3)", async () => {
    process.env.GLOBAL_GROQ_BUDGET_PER_MIN = "1";
    try {
      mockGroq(DIAG_GRADE);
      // First step consumes the global window…
      expect((await POST(req({ kind: "diagnostic", token: stepTok({}), reasoning: REASONING }))).status).toBe(200);
      // …second (different IP — per-IP caps don't save it) is globally rejected.
      const r2 = new Request("http://test.local/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-real-ip": "203.0.113.99" },
        body: JSON.stringify({ kind: "diagnostic", token: stepTok({ subject: "physics" }), reasoning: REASONING }),
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
    // Stored level 105 → Middle band (idx 1); a phd-labeled token must clamp to intermediate (idx 2).
    const { sb, calls } = fakeAdmin({ scoresRows: [{ subject: "math", score: 105, weak_concepts: [], comment: "", rubric: null, glicko: null }] });
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
    const { newScore } = expectedPracticeScore({ prevScore: 105, grade: PRACTICE_GRADE, band: "intermediate" });
    expect(save.args.p_scores[0].score).toBe(newScore);
  });

  it("a HIGH-level account is not clamped (phd at stored 298 stays phd)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb, calls } = fakeAdmin({ scoresRows: [{ subject: "math", score: 298, weak_concepts: [], comment: "", rubric: null, glicko: null }] });
    storage.getAdmin.mockReturnValue(sb);
    mockGroq(PRACTICE_GRADE);
    const res = await POST(req(
      { kind: "practice", token: tok({ difficulty: "phd" }), reasoning: REASONING },
      { authHeader: true }
    ));
    expect(res.status).toBe(200);
    expect(calls.rpc.find((c) => c.fn === "save_progress_for").args.p_attempt.band).toBe("phd");
  });

  // (The old diagnostic serve/submit echo-consistency 409 is gone by construction:
  // the step token SIGNS the served item id, and finalize re-resolves every
  // transcript entry against the bank — a mid-sitting bank edit fails closed into
  // the 400 restart covered in the finalize suite.)

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
    // Mutable fixture: the first persist-loop read sees score 140/t1; after the
    // conflict, the second read sees the concurrently-moved row (score 168/t2).
    const states = [
      [{ subject: "math", score: 140, weak_concepts: [], comment: "", rubric: null, glicko: null, updated_at: "2026-06-11T00:00:01.000000+00:00" }],
      [{ subject: "math", score: 168, weak_concepts: [], comment: "", rubric: null, glicko: null, updated_at: "2026-06-11T00:00:02.000000+00:00" }],
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
    const s1 = expectedPracticeScore({ prevScore: 140, grade: PRACTICE_GRADE, band: "intermediate" });
    const s2 = expectedPracticeScore({ prevScore: 168, grade: PRACTICE_GRADE, band: "intermediate" });
    expect(saves[0].p_scores[0].score).toBe(s1.newScore);
    expect(saves[1].p_scores[0].score).toBe(s2.newScore); // recomputed, not reused
    expect(saves[1].p_attempt.jti).toBe(saves[0].p_attempt.jti); // same served question
    expect((await res.json()).newScore).toBe(s2.newScore);
  });
});

describe("POST /api/score practice — account-bound token (audit F2)", () => {
  it("rejects a token whose signed uid is a DIFFERENT account (no token pooling/sharing)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb } = fakeAdmin({ scoresRows: [{ subject: "math", score: 140, weak_concepts: [], comment: "", rubric: null, glicko: null }] });
    storage.getAdmin.mockReturnValue(sb);
    const failFetch = vi.fn(() => { throw new Error("must not grade a cross-account token"); });
    vi.stubGlobal("fetch", failFetch);
    const res = await POST(req(
      { kind: "practice", token: tok({ uid: "u2" }), reasoning: REASONING },
      { authHeader: true }
    ));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/different account/i);
    expect(failFetch).not.toHaveBeenCalled(); // rejected before any Groq spend
  });

  it("accepts a token whose signed uid MATCHES the scoring account", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb } = fakeAdmin({ scoresRows: [{ subject: "math", score: 140, weak_concepts: [], comment: "", rubric: null, glicko: null }] });
    storage.getAdmin.mockReturnValue(sb);
    mockGroq(PRACTICE_GRADE);
    const res = await POST(req(
      { kind: "practice", token: tok({ uid: "u1" }), reasoning: REASONING },
      { authHeader: true }
    ));
    expect(res.status).toBe(200);
  });

  it("accepts a legacy token with NO signed uid (backward compatible)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const { sb } = fakeAdmin({ scoresRows: [{ subject: "math", score: 140, weak_concepts: [], comment: "", rubric: null, glicko: null }] });
    storage.getAdmin.mockReturnValue(sb);
    mockGroq(PRACTICE_GRADE);
    const res = await POST(req(
      { kind: "practice", token: tok(), reasoning: REASONING }, // tok() signs no uid
      { authHeader: true }
    ));
    expect(res.status).toBe(200);
  });
});
