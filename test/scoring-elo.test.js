import { describe, it, expect } from "vitest";
import {
  eloExpected,
  eloK,
  eloUpdate,
  defaultDifficultyForBand,
  rankFor,
  RANKS,
  reconcileReasoningScore,
  rubricImpliedScore,
  explainRankMove,
  ELO_K_PROVISIONAL,
  ELO_K_STABLE,
  normalizeRubric,
} from "@/lib/scoring";
import { preGradeDock } from "@/lib/preGrade";

describe("eloExpected", () => {
  it("is 0.5 at equal rating and difficulty", () => {
    expect(eloExpected(50, 50)).toBeCloseTo(0.5, 6);
  });
  it("rises above 0.5 when the learner outrates the item, and below when under", () => {
    expect(eloExpected(80, 50)).toBeGreaterThan(0.5);
    expect(eloExpected(20, 50)).toBeLessThan(0.5);
  });
  it("returns a neutral 0.5 for non-finite inputs (never NaN)", () => {
    expect(eloExpected(NaN, 50)).toBe(0.5);
    expect(eloExpected(50, undefined)).toBe(0.5);
  });
});

describe("eloK (provisional → stable)", () => {
  it("starts high and decays monotonically toward the stable floor", () => {
    expect(eloK(0)).toBeCloseTo(ELO_K_PROVISIONAL, 6);
    expect(eloK(5)).toBeLessThan(eloK(0));
    expect(eloK(50)).toBeLessThan(eloK(5));
    expect(eloK(100000)).toBeGreaterThan(ELO_K_STABLE);
    expect(eloK(100000)).toBeLessThan(ELO_K_STABLE + 1);
  });
  it("treats garbage attempt counts as 0", () => {
    expect(eloK("x")).toBeCloseTo(ELO_K_PROVISIONAL, 6);
  });
});

describe("eloUpdate (item-as-opponent, NON-additive)", () => {
  it("LOSES rating on a poor outcome at an at-level item (the anti-gaming property)", () => {
    const { newRating } = eloUpdate({ rating: 50, difficulty: 50, outcome: 0.1, attemptCount: 5 });
    expect(newRating).toBeLessThan(50);
  });
  it("gains rating on a strong outcome, and MORE for beating an above-level item", () => {
    const atLevel = eloUpdate({ rating: 50, difficulty: 50, outcome: 0.9, attemptCount: 5 }).newRating;
    const aboveLevel = eloUpdate({ rating: 50, difficulty: 80, outcome: 0.9, attemptCount: 5 }).newRating;
    expect(atLevel).toBeGreaterThan(50);
    expect(aboveLevel).toBeGreaterThan(atLevel); // a bigger upset moves you more
  });
  it("self-calibrates item difficulty in the opposite direction (over-perform → item easier)", () => {
    const { diffDelta } = eloUpdate({ rating: 50, difficulty: 50, outcome: 0.9, attemptCount: 1 });
    expect(diffDelta).toBeLessThan(0); // difficulty drops when learners beat it
  });
  it("keeps rating + difficulty clamped to [0,100] and never NaN", () => {
    const a = eloUpdate({ rating: 100, difficulty: 0, outcome: 1, attemptCount: 0 });
    expect(a.newRating).toBeLessThanOrEqual(100);
    expect(a.newRating).toBeGreaterThanOrEqual(0);
    const b = eloUpdate({ rating: 0, difficulty: 100, outcome: 0, attemptCount: 0 });
    expect(b.newRating).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(a.newRating) && Number.isFinite(b.newRating)).toBe(true);
  });
  it("a settled (high attemptCount) rating moves LESS than a provisional one for the same surprise", () => {
    const provisional = eloUpdate({ rating: 50, difficulty: 50, outcome: 1, attemptCount: 0 }).newRating - 50;
    const settled = eloUpdate({ rating: 50, difficulty: 50, outcome: 1, attemptCount: 200 }).newRating - 50;
    expect(settled).toBeLessThan(provisional);
  });
});

describe("defaultDifficultyForBand", () => {
  it("maps bands to ascending midpoint anchors", () => {
    expect(defaultDifficultyForBand("beginner")).toBeLessThan(defaultDifficultyForBand("foundational"));
    expect(defaultDifficultyForBand("advanced")).toBeLessThan(defaultDifficultyForBand("phd"));
    expect(defaultDifficultyForBand("nonsense")).toBe(50); // intermediate fallback
  });
});

describe("rankFor (5 fixed bands now, percentile-ready)", () => {
  it("maps scores to the 5 ranks by fixed bands", () => {
    expect(rankFor(5).name).toBe("Absolute beginner");
    expect(rankFor(5).index).toBe(0);
    expect(rankFor(30).name).toBe("Foundational");
    expect(rankFor(50).name).toBe("Intermediate");
    expect(rankFor(70).name).toBe("Advanced");
    expect(rankFor(95).name).toBe("PhD-level");
    expect(rankFor(95).index).toBe(4);
    expect(RANKS).toHaveLength(5);
  });
  it("honors percentile cutoffs when supplied (architected for the later recut)", () => {
    const cutoffs = [10, 20, 30, 40];
    expect(rankFor(5, { cutoffs }).index).toBe(0);
    expect(rankFor(25, { cutoffs }).index).toBe(2);
    expect(rankFor(45, { cutoffs }).index).toBe(4);
  });
});

describe("reconcileReasoningScore (consistency / anti-gaming)", () => {
  const consistent = { conceptual_understanding: 3, logical_structure: 3, strategy: 3, execution_accuracy: 3, communication: 3 };
  const allZero = { conceptual_understanding: 0, logical_structure: 0, strategy: 0, execution_accuracy: 0, communication: 0 };

  it("leaves a rubric-consistent score alone", () => {
    expect(reconcileReasoningScore(75, consistent)).toBe(75); // implied 75, gap 0
  });
  it("pulls a contradicting high score down toward the rubric", () => {
    const out = reconcileReasoningScore(90, allZero); // implied 0
    expect(out).toBeLessThan(90);
    expect(out).toBeLessThanOrEqual(25); // within the tolerance band of 0
  });
  it("pulls a contradicting low score up toward an excellent rubric", () => {
    const out = reconcileReasoningScore(5, { conceptual_understanding: 4, logical_structure: 4, strategy: 4, execution_accuracy: 4, communication: 4 });
    expect(out).toBeGreaterThan(5);
  });
  it("falls back to the rubric-implied score for a null/garbage score", () => {
    expect(reconcileReasoningScore(null, consistent)).toBe(rubricImpliedScore(consistent));
    expect(reconcileReasoningScore("x", allZero)).toBe(0);
  });
});

describe("explainRankMove", () => {
  it("explains a dock", () => {
    const s = explainRankMove({ delta: -5, reasoningScore: 3, docked: true });
    expect(s).toMatch(/docked/i);
    expect(s).toMatch(/-5/);
  });
  it("explains a positive and a negative move with the score and sign", () => {
    expect(explainRankMove({ delta: 6, reasoningScore: 82, expected: 0.3, difficultyBand: "advanced" })).toMatch(/\+6/);
    expect(explainRankMove({ delta: -4, reasoningScore: 20, expected: 0.6, difficultyBand: "foundational" })).toMatch(/-4/);
  });
});

// GOLD SET — a tiny, hand-specified fixture run through the FULL deterministic pipeline
// (dock → reconcile → Elo) on every change. Catches drift in the engine constants /
// dock heuristics / reconciliation without needing a Groq key (so it runs in CI).
describe("gold set — deterministic dock+reconcile+Elo pipeline", () => {
  // Run an attempt the way /api/score does, minus the LLM: a docked input yields the
  // dock verdict; otherwise the (provided) model grade is reconciled, then Elo applies.
  function pipeline({ reasoning, prevRating, band, attemptCount, modelScore, modelRubric }) {
    const dock = preGradeDock(reasoning);
    const rubric = dock ? dock.rubric : normalizeRubric(modelRubric);
    const score = dock ? dock.reasoningScore : reconcileReasoningScore(modelScore, rubric);
    const { newRating } = eloUpdate({
      rating: prevRating,
      difficulty: defaultDifficultyForBand(band),
      outcome: score / 100,
      attemptCount,
    });
    return { docked: !!dock, score, newRating, delta: newRating - prevRating };
  }

  const cases = [
    // A blank answer DOCKS and DROPS an established rating (anti-"idk").
    { name: "blank docks and drops", in: { reasoning: "   ", prevRating: 60, band: "intermediate", attemptCount: 5 }, expect: { docked: true, dropped: true } },
    // A strong answer on an above-level item climbs.
    { name: "strong on hard climbs", in: { reasoning: "I derived it via the chain rule and verified the boundary case, 2x.", prevRating: 50, band: "advanced", attemptCount: 5, modelScore: 90, modelRubric: { conceptual_understanding: 4, logical_structure: 4, strategy: 4, execution_accuracy: 3, communication: 4 } }, expect: { docked: false, climbed: true } },
    // A buzzword answer whose model score contradicts an all-zero rubric is reconciled DOWN,
    // and then loses rating at an at-level item.
    { name: "contradiction reconciled then drops", in: { reasoning: "Quantum entropy eigen-flux resonance governs everything here obviously.", prevRating: 55, band: "intermediate", attemptCount: 10, modelScore: 85, modelRubric: { conceptual_understanding: 0, logical_structure: 0, strategy: 0, execution_accuracy: 0, communication: 1 } }, expect: { docked: false, scoreAtMost: 30, dropped: true } },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const r = pipeline(c.in);
      if (c.expect.docked !== undefined) expect(r.docked).toBe(c.expect.docked);
      if (c.expect.dropped) expect(r.delta).toBeLessThan(0);
      if (c.expect.climbed) expect(r.delta).toBeGreaterThan(0);
      if (c.expect.scoreAtMost !== undefined) expect(r.score).toBeLessThanOrEqual(c.expect.scoreAtMost);
    });
  }
});
