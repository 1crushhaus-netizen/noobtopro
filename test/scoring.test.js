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
  it("maps scores to the right band", () => {
    expect(band(0)).toBe("Absolute beginner");
    expect(band(19)).toBe("Absolute beginner");
    expect(band(20)).toBe("Foundational");
    expect(band(40)).toBe("Intermediate");
    expect(band(60)).toBe("Advanced");
    expect(band(80)).toBe("PhD-level");
    expect(band(100)).toBe("PhD-level");
  });

  it("treats non-numeric input as 0, not PhD-level", () => {
    // Regression: band(undefined) used to fall through every comparison and
    // return "PhD-level".
    expect(band(undefined)).toBe("Absolute beginner");
    expect(band(null)).toBe("Absolute beginner");
    expect(band(NaN)).toBe("Absolute beginner");
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
    expect(blend(70, 100, {})).toBe(81);
    expect(blend(70, 100, { foo: 1 })).toBe(81);
    expect(blend(70, 100, null)).toBe(81);
    expect(blend(50, 80, { difficulty: null, reasoningScore: null })).toBe(61);
    // Unknown difficulty string + non-numeric reasoningScore => no signal => legacy.
    expect(blend(50, 80, { difficulty: "xyz", reasoningScore: NaN })).toBe(61); // 0.65*50 + 0.35*80
  });

  it("reasoningScore alone scales the step: a blank attempt barely moves, an excellent one moves more", () => {
    expect(blend(50, 80, { reasoningScore: 0 })).toBe(54); // low confidence -> small move
    expect(blend(50, 80, { reasoningScore: 50 })).toBe(59);
    expect(blend(50, 80, { reasoningScore: 100 })).toBe(64); // high confidence -> larger move
    // Strictly monotonic at the extremes.
    expect(
      Math.abs(blend(50, 80, { reasoningScore: 100 }) - 50)
    ).toBeGreaterThan(Math.abs(blend(50, 80, { reasoningScore: 0 }) - 50));
  });

  it("doing well on a HARDER question is stronger upward evidence than acing an easy one", () => {
    // Fixed quality (r100), fixed upward target (50->80): up-move is non-decreasing
    // in difficulty (the core README requirement; NOT symmetric in the gap).
    expect(blend(50, 80, { difficulty: "beginner", reasoningScore: 100 })).toBe(64);
    expect(blend(50, 80, { difficulty: "foundational", reasoningScore: 100 })).toBe(65);
    expect(blend(50, 80, { difficulty: "intermediate", reasoningScore: 100 })).toBe(68);
    expect(blend(50, 80, { difficulty: "advanced", reasoningScore: 100 })).toBe(68);
    expect(blend(50, 80, { difficulty: "phd", reasoningScore: 100 })).toBe(68);
    // Acing PhD moves at least as much as acing beginner (the symmetric-info bug
    // this design must NOT have).
    expect(
      blend(50, 80, { difficulty: "phd", reasoningScore: 100 })
    ).toBeGreaterThanOrEqual(
      blend(50, 80, { difficulty: "beginner", reasoningScore: 100 })
    );
  });

  it("realized-alpha differentiation is visible on a wider span (50 -> 100, r100)", () => {
    // alpha-cap + integer rounding collapse difficulty differences on narrow spans;
    // a wide span makes the harder-moves-more property explicit.
    expect(blend(50, 100, { difficulty: "beginner", reasoningScore: 100 })).toBe(73); // alpha ~0.46
    expect(blend(50, 100, { difficulty: "foundational", reasoningScore: 100 })).toBe(75);
    expect(blend(50, 100, { difficulty: "intermediate", reasoningScore: 100 })).toBe(80); // alpha capped 0.60
    expect(blend(50, 100, { difficulty: "phd", reasoningScore: 100 })).toBe(80);
    expect(
      blend(50, 100, { difficulty: "phd", reasoningScore: 100 })
    ).toBeGreaterThan(
      blend(50, 100, { difficulty: "beginner", reasoningScore: 100 })
    );
  });

  it("an outcome that contradicts the suggested direction is damped (Elo alignment)", () => {
    // Suggestion pushes UP to 100 but the attempt was blank on a hard item: surprise
    // is negative, so alpha shrinks and the up-move is small.
    expect(blend(50, 100, { difficulty: "phd", reasoningScore: 0 })).toBe(57);
    // vs a high-quality attempt on the same hard item, which moves much more.
    expect(blend(50, 100, { difficulty: "phd", reasoningScore: 100 })).toBe(80);
    expect(
      blend(50, 100, { difficulty: "phd", reasoningScore: 0 })
    ).toBeLessThan(blend(50, 100, { difficulty: "phd", reasoningScore: 100 }));
  });

  it("a high-quality attempt DAMPS a downward demotion on an above-level item (D1's distinguishing behavior)", () => {
    // Suggestion pushes DOWN to 30 on a PhD (above-level) item: a high reasoningScore
    // CONTRADICTS the demotion, so the drop saturates/shrinks rather than deepening.
    expect(blend(50, 30, { difficulty: "phd", reasoningScore: 0 })).toBe(47);
    expect(blend(50, 30, { difficulty: "phd", reasoningScore: 100 })).toBe(47);
    expect(
      blend(50, 30, { difficulty: "phd", reasoningScore: 100 })
    ).toBeGreaterThanOrEqual(blend(50, 30, { difficulty: "phd", reasoningScore: 0 }));
  });

  it("botching an EASY question is stronger downward evidence than botching a brutal one", () => {
    // Demotion to 30; a poor attempt (r25) on an easy item moves DOWN more than on a
    // hard item (down-direction asymmetry grafted from the prior repo design).
    expect(blend(50, 30, { difficulty: "beginner", reasoningScore: 25 })).toBe(43);
    expect(blend(50, 30, { difficulty: "phd", reasoningScore: 25 })).toBe(46);
    expect(50 - blend(50, 30, { difficulty: "beginner", reasoningScore: 25 })).toBeGreaterThan(
      50 - blend(50, 30, { difficulty: "phd", reasoningScore: 25 })
    );
  });

  it("difficulty-only (no reasoningScore) still adjusts via neutral outcome", () => {
    expect(blend(50, 80, { difficulty: "phd" })).toBe(64);
    expect(blend(50, 80, { difficulty: "intermediate" })).toBe(61);
    expect(blend(50, 80, { difficulty: "beginner" })).toBe(57);
  });

  it("difficulty lookup is case/whitespace-insensitive and prototype-pollution-safe", () => {
    expect(blend(50, 80, { difficulty: "PHD ", reasoningScore: 100 })).toBe(68);
    expect(blend(50, 80, { difficulty: "  Advanced  ", reasoningScore: 100 })).toBe(
      blend(50, 80, { difficulty: "advanced", reasoningScore: 100 })
    );
    // Inherited keys must NOT resolve to an anchor -> degrade to legacy 65/35.
    expect(blend(50, 80, { difficulty: "__proto__" })).toBe(61);
    expect(blend(50, 80, { difficulty: "constructor" })).toBe(61);
    expect(blend(50, 80, { difficulty: "toString" })).toBe(61);
  });

  it("reasoningScore is clamped/coerced via clampScore", () => {
    expect(blend(50, 80, { reasoningScore: 200 })).toBe(
      blend(50, 80, { reasoningScore: 100 })
    ); // 64
    expect(blend(50, 80, { reasoningScore: -10 })).toBe(
      blend(50, 80, { reasoningScore: 0 })
    ); // 54
    expect(blend(50, 80, { reasoningScore: "100" })).toBe(64);
  });

  it("is a strict no-op when the suggestion equals prev, regardless of weights", () => {
    expect(blend(50, 50, { difficulty: "phd", reasoningScore: 100 })).toBe(50);
    expect(blend(0, 0, { difficulty: "phd", reasoningScore: 100 })).toBe(0);
    expect(blend(100, 100, { difficulty: "beginner", reasoningScore: 0 })).toBe(100);
  });

  it("stays in [0, 100] at the boundaries (alpha cap prevents a full snap)", () => {
    expect(blend(0, 100, { difficulty: "phd", reasoningScore: 100 })).toBe(60);
    expect(blend(100, 0, { difficulty: "beginner", reasoningScore: 0 })).toBe(76);
  });

  it("never lets a null/garbage suggestion drag the score toward zero, even with full opts", () => {
    expect(blend(70, null, { difficulty: "phd", reasoningScore: 100 })).toBe(70);
    expect(blend(70, "garbage", { difficulty: "beginner", reasoningScore: 0 })).toBe(70);
    expect(blend(undefined, null, { difficulty: "phd", reasoningScore: 100 })).toBe(0);
    // No prev seeds from the suggestion regardless of opts.
    expect(blend(undefined, 40, { difficulty: "advanced", reasoningScore: 90 })).toBe(40);
  });

  it("is monotonic non-decreasing in reasoningScore for an upward suggestion", () => {
    let last = -1;
    for (let r = 0; r <= 100; r += 10) {
      const v = blend(50, 80, { difficulty: "intermediate", reasoningScore: r });
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });

  it("is monotonic non-decreasing in the suggestion at fixed weights", () => {
    let last = -1;
    for (let s = 0; s <= 100; s += 10) {
      const v = blend(50, s, { difficulty: "phd", reasoningScore: 100 });
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });

  it("is robust: never NaN and always an int in [0, 100] across malformed inputs", () => {
    const prevs = [0, 25, 50, 75, 100, undefined, null, NaN, -200, 300, 50.7];
    const sugs = [0, 50, 100, null, undefined, "", "garbage", -5, 150, "73"];
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
            expect(v).toBeLessThanOrEqual(100);
          }
        }
        // also two-arg / opts-null / empty-opts shapes
        for (const v of [blend(p, s), blend(p, s, null), blend(p, s, {})]) {
          expect(Number.isInteger(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it("defends a literal prev = NaN / out-of-range prev on every path (never NaN)", () => {
    expect(blend(NaN, 80)).toBe(28); // NaN prev -> treated as 0 -> 0.65*0 + 0.35*80
    expect(blend(NaN, 80, {})).toBe(28);
    expect(blend(NaN, 80, { difficulty: "phd", reasoningScore: 100 })).toBe(48);
    expect(blend(NaN, null)).toBe(0); // null suggestion + NaN prev -> 0, not NaN
    expect(blend(150, null)).toBe(100); // out-of-range prev clamped on the null-sug path
    expect(blend(-30, null)).toBe(0);
  });
});

describe("totalPoints / phdIndex", () => {
  const scores = {
    math: { score: 60 },
    physics: { score: 30 },
    chemistry: { score: 90 },
  };

  it("sums subject scores out of 300", () => {
    expect(totalPoints(scores)).toBe(180);
    expect(totalPoints(null)).toBe(0);
    expect(totalPoints({})).toBe(0);
  });

  it("averages subject scores to a 0-100 PhD index", () => {
    expect(phdIndex(scores)).toBe(60);
    expect(phdIndex(null)).toBe(0);
  });

  it("tolerates missing subjects", () => {
    expect(totalPoints({ math: { score: 50 } })).toBe(50);
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

  it("clamps out-of-range subject scores into [0, 100] before summing", () => {
    // -50 -> 0, 250 -> 100, 50 stays 50 => 150.
    expect(
      totalPoints({
        math: { score: -50 },
        physics: { score: 250 },
        chemistry: { score: 50 },
      })
    ).toBe(150);
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

  it("phdIndex stays a clean integer in [0, 100] for malformed inputs", () => {
    const v = phdIndex({
      math: { score: "60" },
      physics: { score: 250 },
      chemistry: { score: -10 },
    });
    // (60 + 100 + 0) / 3 = 53.33 -> 53.
    expect(v).toBe(53);
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(100);
  });
});

// 3-tier diagnostic baseline: combine a subject's three answers (easy/intermediate
// /hard) into a 0-100 score, each reasoningScore weighted by its difficulty ANCHOR
// (foundational 30 / intermediate 50 / advanced 70 ~= 3:5:7). Sum(anchor) = 150 for
// the canonical 3-question set, so the closed form is round(Sum(anchor*score)/150).
describe("diagnosticSubjectScore", () => {
  // Helper: build the canonical easy/intermediate/hard triple.
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

  it("unknown/missing difficulty falls back to the intermediate anchor (50) as its weight", () => {
    // Single unknown-difficulty item: weight = 50, score 100 -> 5000/50 = 100.
    expect(
      diagnosticSubjectScore([{ difficulty: "wat", reasoningScore: 100 }])
    ).toBe(100);
    // Pair "wat" (must weigh 50) acing with a foundational (30) zero:
    // (50*100 + 30*0) / (50 + 30) = 5000/80 = 62.5 -> 63. This pins the fallback
    // weight at 50: it would be 70 (->70) if treated as advanced, or the item
    // would be dropped (->0) if unknown difficulty contributed no weight.
    expect(
      diagnosticSubjectScore([
        { difficulty: "wat", reasoningScore: 100 },
        { difficulty: "foundational", reasoningScore: 0 },
      ])
    ).toBe(63);
    // A missing difficulty key behaves the same as an unknown string (weight 50).
    expect(diagnosticSubjectScore([{ reasoningScore: 80 }])).toBe(80);
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
          expect(v).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});

describe("DIAGNOSTIC_DIFFICULTIES / DIFFICULTY_LABELS", () => {
  it("DIAGNOSTIC_DIFFICULTIES is the easy->hard band order", () => {
    expect(DIAGNOSTIC_DIFFICULTIES).toEqual([
      "foundational",
      "intermediate",
      "advanced",
    ]);
  });

  it("DIFFICULTY_LABELS maps each band to its friendly UI label", () => {
    expect(DIFFICULTY_LABELS.foundational).toBe("Easy");
    expect(DIFFICULTY_LABELS.intermediate).toBe("Intermediate");
    expect(DIFFICULTY_LABELS.advanced).toBe("Hard");
  });
});
