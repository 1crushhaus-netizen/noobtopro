import { describe, it, expect } from "vitest";
import {
  RUBRIC_KEYS,
  RUBRIC_MAX,
  scoreFromRating,
  ratingFromScore,
  toGlickoRating,
  glicko2Update,
  updateAxisGlicko,
  updateAxisRatings,
  seedGlickoFromRubric,
  emptyGlickoState,
  normalizeGlickoState,
  aggregateSubjectRating,
  subjectScoreFromGlicko,
  radarFromGlicko,
  diagnosticSeedGlicko,
  diagnosticSeedFromReasoning,
  diagnosticSubjectScore,
  repeatFactorForCount,
  repeatFactorFromHistory,
  repeatFactorFromRecent,
  itemDifficultyDelta,
  scoreFromRubric,
} from "@/lib/scoring";

const fullRubric = (v) => Object.fromEntries(RUBRIC_KEYS.map((k) => [k, v]));
// One graded attempt at a given difficulty with every axis = `v`/4.
const attempt = (glicko, axisVal, difficulty, repeatFactor = 1) =>
  updateAxisRatings({ prevGlicko: glicko, attemptRubric: fullRubric(axisVal), difficulty, repeatFactor });

describe("Glicko display conversions", () => {
  it("scoreFromRating(1500) === 175 (the 0–350 midpoint) and is monotonic & bounded", () => {
    expect(scoreFromRating(1500)).toBe(175);
    expect(scoreFromRating(3000)).toBeGreaterThan(scoreFromRating(2000));
    expect(scoreFromRating(1e9)).toBeLessThanOrEqual(350);
    expect(scoreFromRating(-1e9)).toBeGreaterThanOrEqual(0);
    expect(scoreFromRating("nope")).toBe(175);
  });
  it("ratingFromScore is the inverse of scoreFromRating (round-trips)", () => {
    for (const s of [18, 95, 175, 256, 333]) expect(scoreFromRating(ratingFromScore(s))).toBe(s);
  });
  it("toGlickoRating(d) === ratingFromScore(d) (item rated by the same inverse → at-level symmetry)", () => {
    expect(toGlickoRating(175)).toBeCloseTo(1500, 6);
    expect(toGlickoRating(245)).toBeCloseTo(ratingFromScore(245), 6);
  });
});

describe("the core property: difficulty-proportional (ace easy ≠ maxed)", () => {
  it("a NEW user acing an EASY question barely moves — subject score stays mid, not 100", () => {
    const r = attempt(emptyGlickoState(), 4, 35); // ace a beginner (d=35)
    expect(r.score).toBeGreaterThan(175);
    expect(r.score).toBeLessThan(210); // nowhere near 350
  });
  it("a NEW user acing a HARD question climbs far more than acing an easy one", () => {
    const easy = attempt(emptyGlickoState(), 4, 35).score;
    const hard = attempt(emptyGlickoState(), 4, 315).score;
    expect(hard).toBeGreaterThan(easy + 52);
  });
  it("repeated easy aces asymptote well below the max", () => {
    let g = emptyGlickoState();
    for (let i = 0; i < 40; i++) g = attempt(g, 4, 35).glicko;
    expect(subjectScoreFromGlicko(g)).toBeLessThan(280);
  });
  it("the property holds at the AXIS level too (radar value mid after acing easy)", () => {
    const r = attempt(emptyGlickoState(), 4, 35);
    expect(r.rubric.principle).toBeGreaterThan(RUBRIC_MAX * 0.5);
    expect(r.rubric.principle).toBeLessThan(RUBRIC_MAX); // not pinned to 4
  });
});

describe("anti-farm: diminishing returns on repeats (gains damped, losses not)", () => {
  it("repeatFactorForCount decays geometrically and floors", () => {
    expect(repeatFactorForCount(0)).toBe(1);
    expect(repeatFactorForCount(1)).toBeCloseTo(0.85, 6);
    expect(repeatFactorForCount(3)).toBeCloseTo(0.85 ** 3, 6);
    expect(repeatFactorForCount(50)).toBe(0.2); // floor
  });
  it("a heavily-repeated bucket gains far less than the first time", () => {
    const g0 = emptyGlickoState();
    const firstGain = attempt(g0, 4, 210, 1).score - subjectScoreFromGlicko(g0);
    const repeatedGain = attempt(g0, 4, 210, repeatFactorForCount(10)).score - subjectScoreFromGlicko(g0);
    expect(repeatedGain).toBeLessThan(firstGain * 0.5);
    expect(repeatedGain).toBeGreaterThan(0); // still positive, not frozen
  });
  it("losses are NOT damped by the repeat factor (can't farm UP, but can still drop)", () => {
    // a poor outcome on an at-level item should drop the rating regardless of repeatFactor
    const g = seedGlickoFromRubric(fullRubric(3)); // start mid-high
    const a = updateAxisGlicko(g.principle, 0.0, 210, 0.2); // bomb it, heavy repeat damping
    expect(a.rating).toBeLessThan(g.principle.rating);
  });
  it("repeatFactorFromHistory counts same-bucket attempts in the recent window", () => {
    const hist = [];
    for (let i = 0; i < 6; i++) hist.push({ type: "attempt", subject: "math", topic: "algebra", band: "beginner" });
    expect(repeatFactorFromHistory(hist, "math", "algebra", "beginner")).toBeCloseTo(0.85 ** 6, 6);
    expect(repeatFactorFromHistory(hist, "math", "calculus", "beginner")).toBe(1); // different bucket → no damping
    expect(repeatFactorFromRecent([{ topic: "algebra", band: "beginner" }, { topic: "x", band: "y" }], "algebra", "beginner")).toBeCloseTo(0.85, 6);
  });
});

describe("rollout continuity: seeding preserves the subject score (no leaderboard jump)", () => {
  it("deriveSubjectScore(seedGlickoFromRubric(rubric, oldScore)) ≈ oldScore", () => {
    for (const oldScore of [42, 133, 224, 308]) {
      const rubric = { ...fullRubric(2), principle: 4, computation: 1 }; // a non-uniform profile
      const seeded = seedGlickoFromRubric(rubric, oldScore);
      expect(Math.abs(subjectScoreFromGlicko(seeded) - oldScore)).toBeLessThanOrEqual(1);
    }
  });
  it("holds for SPIKY profiles with axes pinned at 0 and 4 across the whole score range", () => {
    // The hard case: lopsided radars (axes at the rubric extremes) crossed with scores far
    // from the rubric's implied mean. A naive additive-offset seed clips an extreme axis and
    // drifts tens of points; the deviation-scaling seed must stay exact.
    const spiky = [
      { ...fullRubric(0), principle: 4 },                       // one max axis, rest zero
      { ...fullRubric(4), principle: 0 },                       // one zero axis, rest max
      { principle: 4, computation: 4, modeling: 0, abstraction: 0, comprehension: 4, communication: 0, evidence: 4, alternatives: 0, verification: 0 },
      { ...fullRubric(4), comprehension: 0, communication: 0, evidence: 0, alternatives: 0 }, // half max / half zero
    ];
    for (const rubric of spiky) {
      for (const oldScore of [18, 77, 175, 273, 343]) {
        const seeded = seedGlickoFromRubric(rubric, oldScore);
        expect(Math.abs(subjectScoreFromGlicko(seeded) - oldScore)).toBeLessThanOrEqual(1);
      }
    }
  });
  it("the radar SHAPE is preserved (the high axis stays the highest)", () => {
    const rubric = { ...fullRubric(2), principle: 4, computation: 1 };
    const radar = radarFromGlicko(seedGlickoFromRubric(rubric, 175));
    expect(radar.principle).toBeGreaterThan(radar.comprehension);
    expect(radar.comprehension).toBeGreaterThan(radar.computation);
  });
  it("an already-Glicko state passes through unchanged", () => {
    const g = emptyGlickoState();
    g.principle.rating = 2000;
    expect(seedGlickoFromRubric(g).principle.rating).toBe(2000);
  });
  it("no rubric → seeds every axis from the fallback score (continuous)", () => {
    expect(subjectScoreFromGlicko(seedGlickoFromRubric(null, 256))).toBe(256);
  });
  it("a fresh seed with no rubric and no score derives to 175 (the midpoint)", () => {
    expect(subjectScoreFromGlicko(emptyGlickoState())).toBe(175);
  });
  it("a score-0 / no-rubric placeholder is NOT stuck — a hard ace moves it in ONE attempt", () => {
    // An un-baselined subject (partial diagnostic / un-practiced) defaults to {score:0, rubric:null}.
    // Seeding every axis at the dead rating floor would freeze a strong learner at 0 for several
    // perfect hard answers; the neutral-prior seed lets the first genuine result move freely.
    const r = updateAxisRatings({ prevGlicko: null, prevRubric: null, prevScore: 0, attemptRubric: fullRubric(4), difficulty: 315 });
    expect(r.score).toBeGreaterThan(175);
    // and it behaves like a fresh user, not a floored one
    const fresh = updateAxisRatings({ prevGlicko: emptyGlickoState(), attemptRubric: fullRubric(4), difficulty: 315 });
    expect(Math.abs(r.score - fresh.score)).toBeLessThanOrEqual(2);
  });
});

describe("aggregation: weighted by reasoning importance", () => {
  it("a strong high-weight axis (principle, ×5) lifts the subject more than a weak one (computation, ×1)", () => {
    const base = emptyGlickoState();
    const liftPrinciple = { ...emptyGlickoState() };
    liftPrinciple.principle = { rating: 2200, rd: 100, vol: 0.06 };
    const liftComputation = { ...emptyGlickoState() };
    liftComputation.computation = { rating: 2200, rd: 100, vol: 0.06 };
    expect(subjectScoreFromGlicko(liftPrinciple)).toBeGreaterThan(subjectScoreFromGlicko(liftComputation));
    expect(subjectScoreFromGlicko(base)).toBe(175);
  });
});

describe("dock: a low outcome nudges the rating down", () => {
  it("a docked attempt (outcome ≈ 0.03) drops every axis and the subject score", () => {
    const g = seedGlickoFromRubric(fullRubric(3)); // start above mid
    const before = subjectScoreFromGlicko(g);
    const r = updateAxisRatings({ prevGlicko: g, attemptRubric: fullRubric(0), difficulty: 50, repeatFactor: 1 });
    expect(r.score).toBeLessThan(before);
  });
});

describe("diagnostic seeding", () => {
  it("produces a finite difficulty-aware profile; acing all 3 tiers does NOT pin to the max", () => {
    const perQ = [
      { difficulty: "beginner", rubric: fullRubric(4) },
      { difficulty: "intermediate", rubric: fullRubric(4) },
      { difficulty: "advanced", rubric: fullRubric(4) },
    ];
    const seed = diagnosticSeedGlicko(perQ);
    expect(seed.score).toBeGreaterThan(175);
    expect(seed.score).toBeLessThan(350);
    for (const k of RUBRIC_KEYS) expect(Number.isFinite(seed.glicko[k].rating)).toBe(true);
  });
  it("a weaker hard-tier answer lowers the seed vs acing all tiers", () => {
    const aceAll = diagnosticSeedGlicko([
      { difficulty: "beginner", rubric: fullRubric(4) },
      { difficulty: "advanced", rubric: fullRubric(4) },
    ]).score;
    const bombHard = diagnosticSeedGlicko([
      { difficulty: "beginner", rubric: fullRubric(4) },
      { difficulty: "advanced", rubric: fullRubric(1) },
    ]).score;
    expect(bombHard).toBeLessThan(aceAll);
  });
});

describe("diagnosticSeedFromReasoning (reasoning-anchored placement)", () => {
  // tiers built from a uniform reasoning score + matching rubric value, mirroring how
  // /api/score feeds it ({difficulty, reasoningScore, rubric}).
  const tiers = (rubVal, rs) =>
    ["beginner", "intermediate", "advanced"].map((difficulty) => ({ difficulty, reasoningScore: rs, rubric: fullRubric(rubVal) }));

  it("places a blank/idk (docked) diagnostic at the dock floor, NOT the old ~18", () => {
    // a docked answer carries reasoningScore = DOCK_SCORE (3) + an all-zero rubric
    const seed = diagnosticSeedFromReasoning(tiers(0, 3));
    expect(seed.score).toBeLessThanOrEqual(Math.round((5 * 350) / 100)); // dock floor ×3.5; was ~18 (×3.5) under the Glicko-games seed
  });

  it("places a flawless diagnostic near 350 (full range restored; was capped ~270)", () => {
    expect(diagnosticSeedFromReasoning(tiers(4, 100)).score).toBeGreaterThanOrEqual(Math.round((95 * 350) / 100));
  });

  it("the subject score equals the difficulty-weighted QUALITY aggregate mapped onto the 0–350 scale", () => {
    for (const [rub, rs] of [[0, 3], [1, 30], [2, 50], [4, 100]]) {
      const qs = tiers(rub, rs);
      expect(diagnosticSeedFromReasoning(qs).score).toBe(Math.round((diagnosticSubjectScore(qs) * 350) / 100));
    }
  });

  it("is monotonic in answer quality (blank < weak < middling < flawless)", () => {
    const s = (rub, rs) => diagnosticSeedFromReasoning(tiers(rub, rs)).score;
    expect(s(0, 3)).toBeLessThan(s(1, 30));
    expect(s(1, 30)).toBeLessThan(s(2, 50));
    expect(s(2, 50)).toBeLessThan(s(4, 100));
  });

  it("returns a finite 9-axis profile + glicko state, and 0 for no answers", () => {
    const seed = diagnosticSeedFromReasoning(tiers(2, 50));
    expect(Object.keys(seed.rubric)).toHaveLength(9);
    for (const k of RUBRIC_KEYS) expect(Number.isFinite(seed.glicko[k].rating)).toBe(true);
    expect(diagnosticSeedFromReasoning([]).score).toBe(0);
  });
});

describe("itemDifficultyDelta (self-calibration)", () => {
  it("over-performing an item makes it easier (negative delta); under-performing harder", () => {
    expect(itemDifficultyDelta({ prevSubjectScore: 50, itemDifficulty: 50, aggregateOutcome: 1 })).toBeLessThan(0);
    expect(itemDifficultyDelta({ prevSubjectScore: 50, itemDifficulty: 50, aggregateOutcome: 0 })).toBeGreaterThan(0);
  });
});

describe("numerical safety (never NaN/Infinity)", () => {
  it("handles outcome exactly 0 and 1, null prev, runaway ratings", () => {
    const cases = [
      () => updateAxisGlicko(null, 0, 90),
      () => updateAxisGlicko(null, 1, 10),
      () => updateAxisGlicko({ rating: 9e9, rd: -5, vol: -1 }, 1, 50),
      () => glicko2Update(null, [{ rating: 5000, rd: 0, score: 1 }]),
      () => glicko2Update({ rating: 1500, rd: 350, vol: 0.06 }, []),
    ];
    for (const fn of cases) {
      const r = fn();
      expect(Number.isFinite(r.rating)).toBe(true);
      expect(Number.isFinite(r.rd)).toBe(true);
      expect(Number.isFinite(r.vol)).toBe(true);
      expect(r.rd).toBeGreaterThanOrEqual(50); // RD floor
      expect(r.vol).toBeLessThanOrEqual(0.1); // vol cap
    }
  });
  it("RD shrinks with evidence and floors at 50", () => {
    let g = emptyGlickoState().principle;
    const rd0 = g.rd;
    for (let i = 0; i < 30; i++) g = updateAxisGlicko(g, 0.7, 50);
    expect(g.rd).toBeLessThan(rd0);
    expect(g.rd).toBeGreaterThanOrEqual(50);
  });
  it("normalizeGlickoState coerces garbage to a complete, clamped state", () => {
    const st = normalizeGlickoState({ principle: { rating: "x" }, computation: { rating: 1700, rd: 9999, vol: 99 }, junk: 1 });
    for (const k of RUBRIC_KEYS) {
      expect(Number.isFinite(st[k].rating)).toBe(true);
      expect(st[k].rd).toBeLessThanOrEqual(350);
      expect(st[k].vol).toBeLessThanOrEqual(0.1);
    }
    expect(st.principle.rating).toBe(1500); // garbage rating → fresh seed
  });
});
