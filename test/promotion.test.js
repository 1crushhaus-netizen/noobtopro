// The §7 CURRICULUM BREADTH GATE (lib/promotion.js): coverage of a (subject, rank)
// cell counts GREEN concepts only, and the gated display rank walks the score-derived
// rank back to the highest band whose lower curricula are fully covered. Display-layer
// only by design — §11.3 (score soft-cap vs gated label) and §11.5 (grandfathering)
// are open items layered on later; these tests pin the v1 label-gating semantics.
import { describe, it, expect } from "vitest";
import { rankCoverage, gatedRankFor, RANK_COVERAGE_REQUIRED } from "@/lib/promotion";
import { conceptsFor, RANKS as CURRICULUM_RANKS } from "@/lib/curriculum";
import { RANKS as DISPLAY_RANKS } from "@/lib/scoring";

// A green counter record (≥2 hits at ≥70 quality — lib/mastery.js) and a yellow one.
const GREEN = { attempts: 2, greenHits: 2, lastQuality: 85, bestQuality: 90 };
const YELLOW = { attempts: 1, greenHits: 1, lastQuality: 80, bestQuality: 80 };

// Mastery map with EVERY concept of the given (subject, ranks) cells green.
function fullCoverage(subject, ranks) {
  const subj = {};
  for (const rank of ranks) for (const c of conceptsFor(subject, rank)) subj[c.key] = { ...GREEN };
  return { [subject]: subj };
}

describe("rankCoverage — green-only coverage of one curriculum cell", () => {
  it("counts only GREEN concepts as mastered and lists the missing ones", () => {
    const mastery = {
      math: {
        counting_cardinality: { ...GREEN },
        place_value_base_ten: { ...YELLOW }, // practiced but not mastered → missing
      },
    };
    const cov = rankCoverage(mastery, "math", "elementary");
    expect(cov.total).toBe(conceptsFor("math", "elementary").length);
    expect(cov.mastered).toBe(1);
    expect(cov.complete).toBe(false);
    expect(cov.missing.length).toBe(cov.total - 1);
    expect(cov.missing.some((m) => m.key === "place_value_base_ten")).toBe(true);
    expect(cov.missing.some((m) => m.key === "counting_cardinality")).toBe(false);
    expect(cov.rankLabel).toBe("Elementary");
  });

  it("a fully green cell is complete (the §7 gate requires the FULL set)", () => {
    expect(RANK_COVERAGE_REQUIRED).toBe(1);
    const cov = rankCoverage(fullCoverage("math", ["elementary"]), "math", "elementary");
    expect(cov.complete).toBe(true);
    expect(cov.missing).toEqual([]);
  });

  it("an empty/WIP cell (doctorate) is complete and never blocks", () => {
    const cov = rankCoverage({}, "math", "doctorate");
    expect(cov.total).toBe(0);
    expect(cov.complete).toBe(true);
  });

  it("tolerates an empty/garbage mastery map (everything missing, nothing thrown)", () => {
    expect(rankCoverage({}, "physics", "middle").mastered).toBe(0);
    expect(rankCoverage(null, "physics", "middle").mastered).toBe(0);
    expect(rankCoverage({ physics: "junk" }, "physics", "middle").mastered).toBe(0);
  });
});

describe("gatedRankFor — coverage-gated display rank (§7, v1 label gating)", () => {
  it("with no mastery data, a high score is gated all the way down to the first band", () => {
    const g = gatedRankFor(85, {}, "math"); // score alone says PhD-level (index 4)
    expect(g.ungated).toMatchObject({ index: 4 });
    expect(g.rank).toMatchObject({ name: DISPLAY_RANKS[0], index: 0 });
    expect(g.gated).toBe(true);
    // The binding cell is the FIRST uncovered curriculum rank.
    expect(g.next.rank).toBe("elementary");
    expect(g.next.complete).toBe(false);
  });

  it("opens exactly as far as the covered curricula reach (blocked at the first gap)", () => {
    // Elementary + middle fully green, high untouched → may hold index 2, not 3+.
    const mastery = fullCoverage("math", ["elementary", "middle"]);
    const g = gatedRankFor(85, mastery, "math");
    expect(g.rank.index).toBe(2);
    expect(g.gated).toBe(true);
    expect(g.next.rank).toBe("high"); // the blocking cell
    expect(g.next.mastered).toBe(0);
  });

  it("is ungated when every rank below the score rank is covered", () => {
    const mastery = fullCoverage("physics", ["elementary", "middle"]);
    const g = gatedRankFor(50, mastery, "physics"); // score rank = Intermediate (index 2)
    expect(g.gated).toBe(false);
    expect(g.rank.index).toBe(2);
    // The next gate is the CURRENT rank's own cell (what unlocks index 3).
    expect(g.next.rank).toBe("high");
  });

  it("a bottom-band score is never gated (there is nothing below to cover)", () => {
    const g = gatedRankFor(5, {}, "chemistry");
    expect(g.gated).toBe(false);
    expect(g.rank.index).toBe(0);
    expect(g.next.rank).toBe("elementary"); // progress toward the band above
  });

  it("at the top with all populated ranks covered: ungated, next = null (doctorate is WIP)", () => {
    const mastery = fullCoverage("math", ["elementary", "middle", "high", "university"]);
    const g = gatedRankFor(95, mastery, "math");
    expect(g.gated).toBe(false);
    expect(g.rank.index).toBe(4);
    expect(g.next).toBe(null); // nothing above PhD-level to gate
  });

  it("the display ranks align 1:1 with the curriculum ranks (the walk is well-defined)", () => {
    expect(DISPLAY_RANKS.length).toBe(CURRICULUM_RANKS.length);
  });

  it("tolerates junk score/subject inputs (clamped score, empty coverage)", () => {
    expect(gatedRankFor(null, {}, "math").rank.index).toBe(0);
    const g = gatedRankFor(85, {}, "biology"); // unknown subject → no concepts → never blocks
    expect(g.gated).toBe(false);
    expect(g.rank.index).toBe(4);
  });
});
