import { describe, it, expect } from "vitest";
import {
  clampScore,
  band,
  blend,
  totalPoints,
  phdIndex,
  ORDER,
  diagnosticSubjectScore,
  DIAGNOSTIC_DIFFICULTIES,
  DIFFICULTY_LABELS,
  RUBRIC_KEYS,
  RUBRIC_MAX,
  RUBRIC_WEIGHTS,
  RUBRIC_WEIGHT_SUM,
  scoreFromRubric,
  contributionBreakdown,
  normalizeRubric,
  diagnosticSubjectRubric,
  blendRubric,
  lowestRubricDimensions,
} from "@/lib/scoring";

describe("clampScore", () => {
  it("returns null for no signal (null/undefined/empty string)", () => {
    // Regression: Number(null) === 0 is finite, which would silently become a
    // real 0 and, via blend(), drag a score toward zero.
    expect(clampScore(null)).toBe(null);
    expect(clampScore(undefined)).toBe(null);
    expect(clampScore("")).toBe(null);
  });

  it("returns null for non-numeric values", () => {
    expect(clampScore("abc")).toBe(null);
    expect(clampScore(NaN)).toBe(null);
    expect(clampScore({})).toBe(null);
  });

  it("clamps numbers into [0, 100] and rounds", () => {
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(0)).toBe(0);
    expect(clampScore(73)).toBe(73);
    expect(clampScore(150)).toBe(100);
    expect(clampScore(72.6)).toBe(73);
  });

  it("coerces numeric strings", () => {
    expect(clampScore("73")).toBe(73);
    expect(clampScore("250")).toBe(100);
  });
});

describe("band", () => {
  it("maps scores to the right band (70-point curriculum ranks on the 0–350 scale)", () => {
    expect(band(0)).toBe("Elementary");
    expect(band(69)).toBe("Elementary");
    expect(band(70)).toBe("Middle");
    expect(band(140)).toBe("High");
    expect(band(210)).toBe("University");
    expect(band(280)).toBe("Doctorate");
    expect(band(350)).toBe("Doctorate");
  });

  it("treats non-numeric input as 0, not Doctorate", () => {
    // Regression: band(undefined) used to fall through every comparison and
    // return the top band.
    expect(band(undefined)).toBe("Elementary");
    expect(band(null)).toBe("Elementary");
    expect(band(NaN)).toBe("Elementary");
  });
});

describe("blend", () => {
  it("seeds from the suggestion when there is no previous score", () => {
    expect(blend(undefined, 40)).toBe(40);
    expect(blend(null, 88)).toBe(88);
  });

  it("damps a real suggestion toward the previous score (0.65/0.35)", () => {
    expect(blend(70, 100)).toBe(81); // round(0.65*70 + 0.35*100)
    expect(blend(50, 0)).toBe(33); // round(0.65*50)
  });

  it("keeps the previous score when the suggestion is missing/malformed", () => {
    // Regression: a null/undefined suggestion must NOT pull the score to zero.
    expect(blend(70, null)).toBe(70);
    expect(blend(70, undefined)).toBe(70);
    expect(blend(70, "")).toBe(70);
    expect(blend(70, "garbage")).toBe(70);
  });

  it("returns 0 when there is neither a previous score nor a usable suggestion", () => {
    expect(blend(undefined, null)).toBe(0);
  });

  it("never produces a value outside [0, 100]", () => {
    expect(blend(100, 100)).toBe(100);
    expect(blend(0, 0)).toBe(0);
  });
});

// The two-arg `describe("blend")` block above is the backward-compat contract and
// MUST keep passing unchanged. The block below exercises the difficulty- and
// confidence-weighted (Elo-style) path that activates only when opts carries a
// usable difficulty and/or reasoningScore.
describe("blend (weighted Elo-style path)", () => {
  it("falls back to legacy 65/35 when opts lacks both usable signals", () => {
    // No opts read can change the legacy contract; an empty/garbage opts is inert.
    expect(blend(245, 350, {})).toBe(282);
    expect(blend(245, 350, { foo: 1 })).toBe(282);
    expect(blend(245, 350, null)).toBe(282);
    expect(blend(175, 280, { difficulty: null, reasoningScore: null })).toBe(212);
    // Unknown difficulty string + non-numeric reasoningScore => no signal => legacy.
    expect(blend(175, 280, { difficulty: "xyz", reasoningScore: NaN })).toBe(212); // 0.65*175 + 0.35*280
  });

  it("reasoningScore alone scales the step: a blank attempt barely moves, an excellent one moves more", () => {
    expect(blend(175, 280, { reasoningScore: 0 })).toBe(190); // low confidence -> small move
    expect(blend(175, 280, { reasoningScore: 50 })).toBe(206);
    expect(blend(175, 280, { reasoningScore: 100 })).toBe(223); // high confidence -> larger move
    // Strictly monotonic at the extremes.
    expect(
      Math.abs(blend(175, 280, { reasoningScore: 100 }) - 175)
    ).toBeGreaterThan(Math.abs(blend(175, 280, { reasoningScore: 0 }) - 175));
  });

  it("doing well on a HARDER question is stronger upward evidence than acing an easy one", () => {
    // Fixed quality (r100), fixed upward target (50->80): up-move is non-decreasing
    // in difficulty (the core README requirement; NOT symmetric in the gap).
    expect(blend(175, 280, { difficulty: "beginner", reasoningScore: 100 })).toBe(224);
    expect(blend(175, 280, { difficulty: "foundational", reasoningScore: 100 })).toBe(227);
    expect(blend(175, 280, { difficulty: "intermediate", reasoningScore: 100 })).toBe(238);
    expect(blend(175, 280, { difficulty: "advanced", reasoningScore: 100 })).toBe(238);
    expect(blend(175, 280, { difficulty: "phd", reasoningScore: 100 })).toBe(238);
    // Acing PhD moves at least as much as acing beginner (the symmetric-info bug
    // this design must NOT have).
    expect(
      blend(175, 280, { difficulty: "phd", reasoningScore: 100 })
    ).toBeGreaterThanOrEqual(
      blend(175, 280, { difficulty: "beginner", reasoningScore: 100 })
    );
  });

  it("realized-alpha differentiation is visible on a wider span (50 -> 100, r100)", () => {
    // alpha-cap + integer rounding collapse difficulty differences on narrow spans;
    // a wide span makes the harder-moves-more property explicit.
    expect(blend(175, 350, { difficulty: "beginner", reasoningScore: 100 })).toBe(256); // alpha ~0.46
    expect(blend(175, 350, { difficulty: "foundational", reasoningScore: 100 })).toBe(262);
    expect(blend(175, 350, { difficulty: "intermediate", reasoningScore: 100 })).toBe(280); // alpha capped 0.60
    expect(blend(175, 350, { difficulty: "phd", reasoningScore: 100 })).toBe(280);
    expect(
      blend(175, 350, { difficulty: "phd", reasoningScore: 100 })
    ).toBeGreaterThan(
      blend(175, 350, { difficulty: "beginner", reasoningScore: 100 })
    );
  });

  it("an outcome that contradicts the suggested direction is damped (Elo alignment)", () => {
    // Suggestion pushes UP to 100 but the attempt was blank on a hard item: surprise
    // is negative, so alpha shrinks and the up-move is small.
    expect(blend(175, 350, { difficulty: "phd", reasoningScore: 0 })).toBe(199);
    // vs a high-quality attempt on the same hard item, which moves much more.
    expect(blend(175, 350, { difficulty: "phd", reasoningScore: 100 })).toBe(280);
    expect(
      blend(175, 350, { difficulty: "phd", reasoningScore: 0 })
    ).toBeLessThan(blend(175, 350, { difficulty: "phd", reasoningScore: 100 }));
  });

  it("a high-quality attempt DAMPS a downward demotion on an above-level item (D1's distinguishing behavior)", () => {
    // Suggestion pushes DOWN to 30 on a PhD (above-level) item: a high reasoningScore
    // CONTRADICTS the demotion, so the drop saturates/shrinks rather than deepening.
    expect(blend(175, 105, { difficulty: "phd", reasoningScore: 0 })).toBe(165);
    expect(blend(175, 105, { difficulty: "phd", reasoningScore: 100 })).toBe(165);
    expect(
      blend(175, 105, { difficulty: "phd", reasoningScore: 100 })
    ).toBeGreaterThanOrEqual(blend(175, 105, { difficulty: "phd", reasoningScore: 0 }));
  });

  it("botching an EASY question is stronger downward evidence than botching a brutal one", () => {
    // Demotion to 30; a poor attempt (r25) on an easy item moves DOWN more than on a
    // hard item (down-direction asymmetry grafted from the prior repo design).
    expect(blend(175, 105, { difficulty: "beginner", reasoningScore: 25 })).toBe(152);
    expect(blend(175, 105, { difficulty: "phd", reasoningScore: 25 })).toBe(162);
    expect(175 - blend(175, 105, { difficulty: "beginner", reasoningScore: 25 })).toBeGreaterThan(
      175 - blend(175, 105, { difficulty: "phd", reasoningScore: 25 })
    );
  });

  it("difficulty-only (no reasoningScore) still adjusts via neutral outcome", () => {
    expect(blend(175, 280, { difficulty: "phd" })).toBe(224);
    expect(blend(175, 280, { difficulty: "intermediate" })).toBe(212);
    expect(blend(175, 280, { difficulty: "beginner" })).toBe(200);
  });

  it("difficulty lookup is case/whitespace-insensitive and prototype-pollution-safe", () => {
    expect(blend(175, 280, { difficulty: "PHD ", reasoningScore: 100 })).toBe(238);
    expect(blend(175, 280, { difficulty: "  Advanced  ", reasoningScore: 100 })).toBe(
      blend(175, 280, { difficulty: "advanced", reasoningScore: 100 })
    );
    // Inherited keys must NOT resolve to an anchor -> degrade to legacy 65/35.
    expect(blend(175, 280, { difficulty: "__proto__" })).toBe(212);
    expect(blend(175, 280, { difficulty: "constructor" })).toBe(212);
    expect(blend(175, 280, { difficulty: "toString" })).toBe(212);
  });

  it("reasoningScore is clamped/coerced via clampScore", () => {
    expect(blend(175, 280, { reasoningScore: 200 })).toBe(
      blend(175, 280, { reasoningScore: 100 })
    ); // 223
    expect(blend(175, 280, { reasoningScore: -10 })).toBe(
      blend(175, 280, { reasoningScore: 0 })
    ); // 190
    expect(blend(175, 280, { reasoningScore: "100" })).toBe(223);
  });

  it("is a strict no-op when the suggestion equals prev, regardless of weights", () => {
    expect(blend(175, 175, { difficulty: "phd", reasoningScore: 100 })).toBe(175);
    expect(blend(0, 0, { difficulty: "phd", reasoningScore: 100 })).toBe(0);
    expect(blend(350, 350, { difficulty: "beginner", reasoningScore: 0 })).toBe(350);
  });

  it("stays in [0, 350] at the boundaries (alpha cap prevents a full snap)", () => {
    expect(blend(0, 350, { difficulty: "phd", reasoningScore: 100 })).toBe(210);
    expect(blend(350, 0, { difficulty: "beginner", reasoningScore: 0 })).toBe(267);
  });

  it("never lets a null/garbage suggestion drag the score toward zero, even with full opts", () => {
    expect(blend(245, null, { difficulty: "phd", reasoningScore: 100 })).toBe(245);
    expect(blend(245, "garbage", { difficulty: "beginner", reasoningScore: 0 })).toBe(245);
    expect(blend(undefined, null, { difficulty: "phd", reasoningScore: 100 })).toBe(0);
    // No prev seeds from the suggestion regardless of opts.
    expect(blend(undefined, 40, { difficulty: "advanced", reasoningScore: 90 })).toBe(40);
  });

  it("is monotonic non-decreasing in reasoningScore for an upward suggestion", () => {
    let last = -1;
    for (let r = 0; r <= 100; r += 10) {
      const v = blend(175, 280, { difficulty: "intermediate", reasoningScore: r });
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });

  it("is monotonic non-decreasing in the suggestion at fixed weights", () => {
    let last = -1;
    for (let s = 0; s <= 350; s += 35) {
      const v = blend(175, s, { difficulty: "phd", reasoningScore: 100 });
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });

  it("is robust: never NaN and always an int in [0, 350] across malformed inputs", () => {
    const prevs = [0, 88, 175, 263, 350, undefined, null, NaN, -200, 700, 175.7];
    const sugs = [0, 175, 350, null, undefined, "", "garbage", -5, 525, "256"];
    const diffs = [
      "beginner", "intermediate", "phd", "xyz", "", null, undefined, 123,
      "PHD ", "__proto__", "constructor",
    ];
    const rs = [0, 50, 100, null, undefined, NaN, -10, 200, "x", "100", ""];
    for (const p of prevs) {
      for (const s of sugs) {
        for (const d of diffs) {
          for (const r of rs) {
            const v = blend(p, s, { difficulty: d, reasoningScore: r });
            expect(Number.isInteger(v)).toBe(true);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(350);
          }
        }
        // also two-arg / opts-null / empty-opts shapes
        for (const v of [blend(p, s), blend(p, s, null), blend(p, s, {})]) {
          expect(Number.isInteger(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(350);
        }
      }
    }
  });

  it("defends a literal prev = NaN / out-of-range prev on every path (never NaN)", () => {
    expect(blend(NaN, 280)).toBe(98); // NaN prev -> treated as 0 -> 0.65*0 + 0.35*280
    expect(blend(NaN, 280, {})).toBe(98);
    expect(blend(NaN, 280, { difficulty: "phd", reasoningScore: 100 })).toBe(168);
    expect(blend(NaN, null)).toBe(0); // null suggestion + NaN prev -> 0, not NaN
    expect(blend(525, null)).toBe(350); // out-of-range prev clamped on the null-sug path
    expect(blend(-30, null)).toBe(0);
  });
});

describe("totalPoints / phdIndex", () => {
  const scores = {
    math: { score: 210 },
    physics: { score: 105 },
    chemistry: { score: 315 },
  };

  it("sums subject scores out of 1050", () => {
    expect(totalPoints(scores)).toBe(630);
    expect(totalPoints(null)).toBe(0);
    expect(totalPoints({})).toBe(0);
  });

  it("averages subject scores to a 0-350 Doctorate index", () => {
    expect(phdIndex(scores)).toBe(210);
    expect(phdIndex(null)).toBe(0);
  });

  it("tolerates missing subjects", () => {
    expect(totalPoints({ math: { score: 175 } })).toBe(175);
    expect(ORDER).toEqual(["math", "physics", "chemistry"]);
  });

  it("coerces a numeric-string subject score to a number (no string concat)", () => {
    // Regression: a hand-edited guest localStorage blob can carry a string score;
    // "60" + 30 + 10 would string-concatenate without clampScore coercion.
    const v = totalPoints({
      math: { score: "60" },
      physics: { score: 30 },
      chemistry: { score: 10 },
    });
    expect(v).toBe(100);
    expect(typeof v).toBe("number");
  });

  it("clamps out-of-range subject scores into [0, 350] before summing", () => {
    // -50 -> 0, 900 -> 350, 175 stays 175 => 525.
    expect(
      totalPoints({
        math: { score: -50 },
        physics: { score: 900 },
        chemistry: { score: 175 },
      })
    ).toBe(525);
  });

  it("treats a NaN/undefined subject score as 0", () => {
    expect(
      totalPoints({
        math: { score: NaN },
        physics: { score: undefined },
        chemistry: { score: 40 },
      })
    ).toBe(40);
  });

  it("phdIndex stays a clean integer in [0, 350] for malformed inputs", () => {
    const v = phdIndex({
      math: { score: "210" },
      physics: { score: 900 },
      chemistry: { score: -10 },
    });
    // (210 + 350 + 0) / 3 = 186.67 -> 187.
    expect(v).toBe(187);
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(350);
  });
});

// Diagnostic baseline: combine a subject's answers into a 0-100 score, each
// reasoningScore weighted by its difficulty ANCHOR (foundational 30 / intermediate 50 /
// advanced 70). The divisor is max(Sum(submitted anchors), FULL=30+70=100): a richer set
// (e.g. the 3-tier triples below, Sum=150) is a plain weighted mean, but a SINGLE/PARTIAL
// submission is divided by the full tier weight so a missing tier counts as 0 (anti-gaming:
// an easy-only submission can't reach 100). The live diagnostic is 2-tier (easy+hard).
describe("diagnosticSubjectScore", () => {
  // Helper: build a 3-tier easy/intermediate/hard set (Sum(anchor)=150 > FULL, so these
  // remain a plain weighted mean — the denominator floor never bites a full set).
  const triple = (easy, mid, hard) => [
    { difficulty: "foundational", reasoningScore: easy },
    { difficulty: "intermediate", reasoningScore: mid },
    { difficulty: "advanced", reasoningScore: hard },
  ];

  it("acing all three (100/100/100) -> 100", () => {
    // (30*100 + 50*100 + 70*100) / 150 = 15000/150 = 100.
    expect(diagnosticSubjectScore(triple(100, 100, 100))).toBe(100);
  });

  it("all zero -> 0", () => {
    expect(diagnosticSubjectScore(triple(0, 0, 0))).toBe(0);
  });

  it("acing ONLY the easy/foundational -> round(30*100/150) = 20", () => {
    expect(diagnosticSubjectScore(triple(100, 0, 0))).toBe(20);
  });

  it("acing easy+intermediate, failing advanced -> round((30+50)*100/150) = 53", () => {
    // 8000/150 = 53.33 -> 53.
    expect(diagnosticSubjectScore(triple(100, 100, 0))).toBe(53);
  });

  it("acing ONLY advanced -> round(70*100/150) = 47", () => {
    // 7000/150 = 46.67 -> 47.
    expect(diagnosticSubjectScore(triple(0, 0, 100))).toBe(47);
  });

  it("a mixed realistic case is the difficulty-weighted mean (hand-computed)", () => {
    // easy 80, intermediate 60, hard 40:
    // (30*80 + 50*60 + 70*40) / 150 = (2400 + 3000 + 2800)/150 = 8200/150
    // = 54.67 -> 55.
    expect(diagnosticSubjectScore(triple(80, 60, 40))).toBe(55);
  });

  it("clamps each reasoningScore via clampScore (150->100, negative->0, garbage->0)", () => {
    // 150 treated as 100 on the easy item, the rest 0 -> same as acing only easy = 20.
    expect(diagnosticSubjectScore(triple(150, 0, 0))).toBe(20);
    // A negative reasoningScore is treated as 0 -> all-zero -> 0.
    expect(diagnosticSubjectScore(triple(-50, -1, -999))).toBe(0);
    // Non-number / garbage (clampScore -> null) becomes 0; only the hard item scores.
    expect(diagnosticSubjectScore(triple("garbage", null, 100))).toBe(47);
    // 150 on every item all clamp to 100 -> 100.
    expect(diagnosticSubjectScore(triple(150, 150, 150))).toBe(100);
  });

  it("a single submitted tier cannot inflate the baseline (anti-gaming: missing tier = 0 credit)", () => {
    // The exploit fix: divisor floored at the FULL tier weight (beginner 10 + intermediate
    // 50 + advanced 70 = 130), so a lone aced BEGINNER answer is 10·100/130 = 8 (NOT 100),
    // and a lone aced HARD answer is 70·100/130 = 54 — omitting tiers can't reach the top.
    expect(diagnosticSubjectScore([{ difficulty: "beginner", reasoningScore: 100 }])).toBe(8);
    expect(diagnosticSubjectScore([{ difficulty: "advanced", reasoningScore: 100 }])).toBe(54);
  });

  it("unknown/missing difficulty falls back to the intermediate anchor (50) as its weight", () => {
    // Single unknown-difficulty item: numerator weight 50, divisor floored to FULL=130 ->
    // 5000/130 = 38 (the 50 weight confirms the intermediate fallback: 70 -> higher, 30 -> lower).
    expect(
      diagnosticSubjectScore([{ difficulty: "wat", reasoningScore: 100 }])
    ).toBe(38);
    // Pair "wat" (weight 50) acing + a beginner (10) zero: numerator 50*100 = 5000,
    // divisor = max(50+10, 130) = 130 -> 38.
    expect(
      diagnosticSubjectScore([
        { difficulty: "wat", reasoningScore: 100 },
        { difficulty: "beginner", reasoningScore: 0 },
      ])
    ).toBe(38);
    // A missing difficulty key behaves the same as an unknown string (weight 50):
    // 50*80 = 4000, divisor max(50,130)=130 -> 31.
    expect(diagnosticSubjectScore([{ reasoningScore: 80 }])).toBe(31);
  });

  it("empty array and non-array (null/undefined) -> 0", () => {
    expect(diagnosticSubjectScore([])).toBe(0);
    expect(diagnosticSubjectScore(null)).toBe(0);
    expect(diagnosticSubjectScore(undefined)).toBe(0);
    expect(diagnosticSubjectScore({})).toBe(0);
    expect(diagnosticSubjectScore("nope")).toBe(0);
  });

  it("always returns an integer in [0, 100] across messy inputs", () => {
    const scoreVals = [0, 50, 100, 150, -10, null, undefined, NaN, "100", "x", {}];
    const diffs = ["foundational", "intermediate", "advanced", "wat", "", null, 123];
    for (const e of scoreVals) {
      for (const m of diffs) {
        for (const h of scoreVals) {
          const v = diagnosticSubjectScore([
            { difficulty: m, reasoningScore: e },
            { difficulty: "intermediate", reasoningScore: h },
          ]);
          expect(Number.isInteger(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(350);
        }
      }
    }
  });
});

describe("DIAGNOSTIC_DIFFICULTIES / DIFFICULTY_LABELS", () => {
  it("DIAGNOSTIC_DIFFICULTIES is the easy->hard band order (3 tiers, 9-question diagnostic)", () => {
    expect(DIAGNOSTIC_DIFFICULTIES).toEqual([
      "beginner",
      "intermediate",
      "advanced",
    ]);
  });

  it("DIFFICULTY_LABELS maps each band to its friendly UI label", () => {
    expect(DIFFICULTY_LABELS.beginner).toBe("Beginner");
    expect(DIFFICULTY_LABELS.intermediate).toBe("Intermediate");
    expect(DIFFICULTY_LABELS.advanced).toBe("Hard");
  });
});

// Helper: a complete 9-axis rubric (every key = v), overridden by `over`.
const rub = (v, over = {}) => Object.fromEntries(RUBRIC_KEYS.map((k) => [k, over[k] != null ? over[k] : v]));

describe("rubric constants", () => {
  it("RUBRIC_KEYS is the 9 chain-link axes in display order, RUBRIC_MAX is 4", () => {
    expect(RUBRIC_KEYS).toEqual([
      "comprehension", "principle", "justification", "strategy",
      "logic", "execution_method", "computation", "verification", "communication",
    ]);
    expect(RUBRIC_MAX).toBe(4);
  });

  it("RUBRIC_WEIGHTS is keyed EXACTLY to RUBRIC_KEYS (a missing weight would NaN the score) and sums to 25", () => {
    expect(Object.keys(RUBRIC_WEIGHTS).sort()).toEqual([...RUBRIC_KEYS].sort());
    expect(RUBRIC_WEIGHT_SUM).toBe(25);
    for (const k of RUBRIC_KEYS) expect(Number.isFinite(RUBRIC_WEIGHTS[k])).toBe(true);
  });
});

describe("scoreFromRubric (transparent weighted headline)", () => {
  it("all-4s → 100, all-0s → 0", () => {
    expect(scoreFromRubric(rub(4))).toBe(100);
    expect(scoreFromRubric(rub(0))).toBe(0);
  });

  it("equals Σ(weight·value) directly because ΣW·MAX = 100", () => {
    expect(scoreFromRubric(rub(0, { principle: 4 }))).toBe(20); // 5·4
    expect(scoreFromRubric(rub(0, { computation: 4 }))).toBe(4); // 1·4 — a slip axis is worth almost nothing
  });

  it("is a pure function of the rubric — never NaN, even for garbage / prototype keys", () => {
    for (const g of [null, undefined, "x", 42, {}, JSON.parse('{"__proto__":{"principle":4}}')]) {
      const s = scoreFromRubric(g);
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });
});

describe("contributionBreakdown (legible — points sum to the headline)", () => {
  it("each axis's points = weight·value and they ADD UP to the total", () => {
    const r = rub(4, { computation: 1 }); // sound method + a decimal slip
    const { items, total } = contributionBreakdown(r);
    expect(total).toBe(97);
    expect(items.reduce((a, i) => a + i.points, 0)).toBe(97);
    const principle = items.find((i) => i.key === "principle");
    expect(principle.points).toBe(20); // 5·4
    expect(principle.max).toBe(20); // worth 20 pts at 4/4
  });
});

describe("normalizeRubric (9 axes + legacy coercion)", () => {
  it("clamps each axis to an INTEGER in [0,4], fills missing with 0, over the new keys", () => {
    const out = normalizeRubric({ principle: 3, logic: 9, strategy: -2, computation: 2.6 });
    expect(out.principle).toBe(3);
    expect(out.logic).toBe(4); // clamped down
    expect(out.strategy).toBe(0); // clamped up
    expect(out.computation).toBe(3); // rounded
    expect(out.communication).toBe(0); // missing -> 0
    expect(Object.keys(out).sort()).toEqual([...RUBRIC_KEYS].sort());
  });

  it("returns an all-zero complete object for null/garbage (never NaN)", () => {
    const z = normalizeRubric(null);
    for (const k of RUBRIC_KEYS) expect(z[k]).toBe(0);
    for (const k of RUBRIC_KEYS) expect(Number.isFinite(normalizeRubric("x")[k])).toBe(true);
  });

  it("coerces a stored LEGACY 5-axis rubric onto the new axes (no DB migration needed)", () => {
    const out = normalizeRubric({ conceptual_understanding: 4, logical_structure: 3, strategy: 2, execution_accuracy: 2, communication: 4 });
    expect(out.principle).toBe(4); // conceptual_understanding → principle
    expect(out.justification).toBe(4); // derived ← conceptual_understanding
    expect(out.logic).toBe(3); // logical_structure → logic
    expect(out.strategy).toBe(2);
    expect(out.execution_method).toBe(2); // execution_accuracy → execution_method
    expect(out.computation).toBe(2); // derived ← execution_accuracy
    expect(out.verification).toBe(3); // derived ← round(mean(logic 3, exec 2)) = 2.5 → 3
    expect(out.communication).toBe(4);
    expect(out.comprehension).toBe(0); // no old analog → 0
  });
});

describe("diagnosticSubjectRubric", () => {
  it("difficulty-weights the per-question rubrics (advanced ~70 vs foundational ~30)", () => {
    const out = diagnosticSubjectRubric([
      { difficulty: "foundational", rubric: rub(1) },
      { difficulty: "advanced", rubric: rub(4) },
    ]);
    // (30*1 + 70*4)/100 = 3.1 on every axis.
    for (const k of RUBRIC_KEYS) expect(out[k]).toBeCloseTo(3.1, 5);
  });

  it("keeps FLOAT resolution (not rounded) and clamps to [0,4]", () => {
    const out = diagnosticSubjectRubric([
      { difficulty: "intermediate", rubric: rub(0, { principle: 2, logic: 3 }) },
      { difficulty: "intermediate", rubric: rub(0, { principle: 3, logic: 4 }) },
    ]);
    expect(out.principle).toBeCloseTo(2.5, 5);
    expect(out.logic).toBeCloseTo(3.5, 5);
  });

  it("returns null when there is nothing to aggregate", () => {
    expect(diagnosticSubjectRubric([])).toBe(null);
    expect(diagnosticSubjectRubric(null)).toBe(null);
  });

  it("falls back to the intermediate anchor for an unknown difficulty band", () => {
    const out = diagnosticSubjectRubric([{ difficulty: "???", rubric: { principle: 2 } }]);
    expect(out.principle).toBeCloseTo(2, 5);
  });
});

describe("blendRubric", () => {
  it("seeds from the attempt when there is no prior rubric", () => {
    const next = rub(0, { principle: 3, logic: 2, strategy: 1, communication: 4 });
    expect(blendRubric(null, next)).toEqual(next);
  });

  it("EWMA-nudges the prior toward the attempt (default alpha 0.35), keeping floats", () => {
    const out = blendRubric(rub(2), rub(4)); // 2 + 0.35*(4-2) = 2.7
    for (const k of RUBRIC_KEYS) expect(out[k]).toBeCloseTo(2.7, 5);
  });

  it("migrates a LEGACY prev onto the new axes via the float coercion", () => {
    const out = blendRubric(
      { conceptual_understanding: 2, logical_structure: 2, strategy: 2, execution_accuracy: 2, communication: 2 },
      rub(4)
    );
    expect(out.principle).toBeCloseTo(2.7, 5); // 2 + .35*(4-2)
    expect(out.comprehension).toBeCloseTo(1.4, 5); // no legacy analog → 0 + .35*(4-0)
  });

  it("clamps to [0,4] and tolerates garbage prev axes", () => {
    const out = blendRubric({ principle: "bad", logic: 99 }, rub(4), 1);
    expect(out.principle).toBeCloseTo(4, 5); // garbage prev coerces to 0 → 0 + 1*(4-0) = 4
    expect(out.logic).toBeLessThanOrEqual(4);
  });
});

describe("lowestRubricDimensions", () => {
  it("returns the n lowest axis keys, ties broken by display order", () => {
    const rubric = rub(3, { strategy: 1, logic: 1, verification: 4 });
    expect(lowestRubricDimensions(rubric, 1)).toEqual(["strategy"]); // strategy precedes logic in display order
    expect(lowestRubricDimensions(rubric, 2)).toEqual(["strategy", "logic"]);
  });

  it("returns [] for a missing/empty rubric", () => {
    expect(lowestRubricDimensions(null)).toEqual([]);
    expect(lowestRubricDimensions({})).toEqual([]);
  });
});

// ---- diagnosticPathScore (the §8 adaptive walk's aggregate) -----------------
import { diagnosticPathScore, diagnosticSeedFromReasoning as _seedFR, DIAG_PLACEMENT_CEILING } from "@/lib/scoring";

describe("diagnosticPathScore (path-weighted, no full-weight floor)", () => {
  it("is the plain difficulty-weighted mean over the walked bands", () => {
    // intermediate(50)·80 + advanced(70)·60 → (4000+4200)/120 ≈ 68
    expect(diagnosticPathScore([
      { difficulty: "intermediate", reasoningScore: 80 },
      { difficulty: "advanced", reasoningScore: 60 },
    ])).toBe(68);
    // Acing a LOW walked path scores high on ITS bands — no fixed-tier floor
    // punishing the descent (the signed chain already forced every step)…
    expect(diagnosticPathScore([
      { difficulty: "beginner", reasoningScore: 100 },
      { difficulty: "beginner", reasoningScore: 100 },
    ])).toBe(100);
    // …while a descending walk that FAILED its high bands stays low: the early
    // failures carry the largest weights in the same mean.
    expect(diagnosticPathScore([
      { difficulty: "intermediate", reasoningScore: 10 },
      { difficulty: "foundational", reasoningScore: 20 },
      { difficulty: "beginner", reasoningScore: 95 },
      { difficulty: "beginner", reasoningScore: 95 },
    ])).toBe(Math.round((50 * 10 + 30 * 20 + 10 * 95 + 10 * 95) / 100));
  });

  it("handles junk: empty/missing input → 0; unknown bands fall back to the intermediate anchor", () => {
    expect(diagnosticPathScore([])).toBe(0);
    expect(diagnosticPathScore(null)).toBe(0);
    expect(diagnosticPathScore([{ difficulty: "bogus", reasoningScore: 50 }])).toBe(50);
  });

  it("diagnosticSeedFromReasoning({ pathWeighted: true }) pins the seed score on the path aggregate", () => {
    const rubric = { comprehension: 3, principle: 3, justification: 3, strategy: 3, logic: 3, execution_method: 3, computation: 3, verification: 3, communication: 3 };
    const qs = [
      { difficulty: "intermediate", reasoningScore: 75, rubric },
      { difficulty: "advanced", reasoningScore: 75, rubric },
      { difficulty: "phd", reasoningScore: 75, rubric },
      { difficulty: "phd", reasoningScore: 75, rubric },
    ];
    const seed = _seedFR(qs, { pathWeighted: true });
    // The aggregate is a QUALITY (0–100); FIX 7 maps it onto the subject scale through
    // the conservative DIAG_PLACEMENT_CEILING (rounded by the squash round-trip).
    expect(seed.score).toBe(Math.round((diagnosticPathScore(qs) * DIAG_PLACEMENT_CEILING) / 100));
  });
});
