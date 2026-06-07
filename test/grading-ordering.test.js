import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "@/app/api/grade/route";
import { _resetRateLimits } from "@/lib/rateLimit";
import { RUBRIC_KEYS, scoreFromRubric } from "@/lib/scoring";

// ---------------------------------------------------------------------------
// THE ORDERING GUARANTEE — "process over product" made testable.
//
// The headline is a pure, transparent function of the rubric (scoreFromRubric), so the
// required inversion of normal grading is unit-testable WITHOUT a Groq key: feed the
// canonical archetypes (as the grader would score them) through /api/grade and assert
//   clean-correct  ≈ 100   >   sound-method + decimal slip (WRONG answer)
//                          >   right-looking answer reached by broken reasoning
//                          >   fluent jargon-salad  (≈ single digits)
// A clean arithmetic slip costs almost nothing (computation, weight 1); a broken
// inference costs heavily (logic/justification/principle) even when the final answer is
// right. That is the whole point of the weighted axes.
// ---------------------------------------------------------------------------

const rub = (v, over = {}) => Object.fromEntries(RUBRIC_KEYS.map((k) => [k, over[k] != null ? over[k] : v]));
const REASONING = "I applied the governing principle and worked through the steps, carrying units.";

function req(body) {
  return new Request("http://test.local/api/grade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
function mockGrader(payload) {
  const f = vi.fn(async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
    text: async () => "",
  }));
  vi.stubGlobal("fetch", f);
  return f;
}
async function gradePractice(payload) {
  mockGrader(payload);
  const res = await POST(
    req({ kind: "practice", subject: "chemistry", question: "Q", targetConcept: "limiting reagents", score: 50, reasoning: REASONING })
  );
  expect(res.status).toBe(200);
  const j = await res.json();
  vi.unstubAllGlobals();
  return j;
}

// Each archetype is a (mocked) grader verdict: the 9-axis rubric + typed errors.
const FEEDBACK = { strengths: [], improvements: ["x"], workedSolution: "...", correctnessNote: "n", socraticHint: "h", microLesson: "m", weakConcepts: [] };
const ARCHETYPES = {
  // every link sound
  cleanCorrect: { ...FEEDBACK, rubric: rub(4), errors: [], finalAnswerMatches: true },
  // reasoning intact, ONE arithmetic slip → WRONG final answer
  soundMethodSlip: {
    ...FEEDBACK,
    rubric: rub(4, { computation: 1, verification: 2 }),
    finalAnswerMatches: false,
    errors: [{ type: "execution-slip", step: "final division", severity: "minor", what: "decimal slip", feedbackMode: "point", message: "468,750/10 = 46,875, not 4,687.5 — method was right.", socraticPrompt: "" }],
  },
  // RIGHT-looking final answer reached by an inverted ratio (broken reasoning)
  rightAnswerWrongReasoning: {
    ...FEEDBACK,
    rubric: rub(2, { principle: 1, justification: 0, logic: 1, computation: 4, verification: 0 }),
    finalAnswerMatches: true,
    errors: [{ type: "reasoning", step: "mole ratio", severity: "major", what: "inverted the 2:1 H2:O2 ratio", feedbackMode: "socratic", message: "Re-examine the mole ratio you used.", socraticPrompt: "If 2 mol H2 react with 1 mol O2, how much O2 does 50 mol H2 need — does your ratio reflect that?" }],
  },
  // fluent nonsense — names principles without using them
  jargonSalad: {
    ...FEEDBACK,
    rubric: rub(0, { communication: 2 }),
    finalAnswerMatches: false,
    errors: [{ type: "communication", step: "whole answer", severity: "major", what: "names principles without applying them", feedbackMode: "point", message: "No real inference is present.", socraticPrompt: "" }],
  },
};

beforeEach(() => {
  process.env.GROQ_API_KEY = "test-key";
  _resetRateLimits();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("grading ordering — process over product", () => {
  it("orders archetypes by REASONING quality, not by final-answer correctness", async () => {
    const score = {};
    for (const [k, payload] of Object.entries(ARCHETYPES)) score[k] = (await gradePractice(payload)).reasoningScore;

    // The core inversion: a clean method + a decimal slip (WRONG answer) beats a
    // right-LOOKING answer reached by broken reasoning, which beats fluent nonsense.
    expect(score.soundMethodSlip).toBeGreaterThan(score.rightAnswerWrongReasoning);
    expect(score.rightAnswerWrongReasoning).toBeGreaterThan(score.jargonSalad);
    expect(score.cleanCorrect).toBeGreaterThanOrEqual(95);
    expect(score.jargonSalad).toBeLessThan(25);
    // And the slip costs almost nothing vs the clean-correct baseline.
    expect(score.cleanCorrect - score.soundMethodSlip).toBeLessThanOrEqual(10);
  });

  it("a reasoning error surfaces a Socratic prompt (a question, not the handed-over correction)", async () => {
    const j = await gradePractice(ARCHETYPES.rightAnswerWrongReasoning);
    const re = (j.errors || []).find((e) => e.type === "reasoning");
    expect(re).toBeTruthy();
    expect(re.socraticPrompt).toMatch(/\?\s*$/); // it's a QUESTION
    expect(re.socraticPrompt).not.toMatch(/the answer is|correct answer/i); // not the correction
  });

  it("the headline equals scoreFromRubric exactly (transparent — no hidden factor)", async () => {
    const j = await gradePractice(ARCHETYPES.soundMethodSlip);
    expect(j.reasoningScore).toBe(scoreFromRubric(ARCHETYPES.soundMethodSlip.rubric));
  });

  it("non-reasoning errors carry NO Socratic prompt (only reasoning errors do)", async () => {
    const j = await gradePractice(ARCHETYPES.soundMethodSlip);
    for (const e of j.errors || []) if (e.type !== "reasoning") expect(e.socraticPrompt).toBe("");
  });
});
