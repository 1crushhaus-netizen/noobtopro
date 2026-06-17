// MASTERY-BLENDED SUBJECT SCORE (lib/promotion.js, "Blend depth × coverage",
// owner decision 2026-06-17): the DISPLAYED subject score = depth × the fraction of
// the curriculum the learner has mastered (green). 0 mastered → 0; all mastered →
// the full depth; each newly-mastered concept raises the number. These pin that
// correlation (the whole point of the change) plus the practice-routing picker that
// makes ordinary practice accrue mastery.
import { describe, it, expect } from "vitest";
import {
  masteryCounts,
  coverageFraction,
  effectiveSubjectScore,
  effectiveScores,
  subjectRankView,
  pickPracticeConcept,
} from "@/lib/promotion";
import { conceptsFor, RANKS as CURRICULUM_RANKS } from "@/lib/curriculum";
import { ORDER, SCORE_MAX, rankFor } from "@/lib/scoring";

// A green counter record (≥2 hits at ≥70 — lib/mastery.js) and a yellow (not-green) one.
const GREEN = { attempts: 2, greenHits: 2, lastQuality: 85, bestQuality: 90 };
const YELLOW = { attempts: 1, greenHits: 1, lastQuality: 80, bestQuality: 80 };

// Every concept of a subject across the given ranks, set to the same counter record.
function coverMap(subject, ranks, rec) {
  const subj = {};
  for (const rank of ranks) for (const c of conceptsFor(subject, rank)) subj[c.key] = { ...rec };
  return { [subject]: subj };
}

const allConceptKeys = (subject) =>
  CURRICULUM_RANKS.flatMap((r) => conceptsFor(subject, r).map((c) => c.key));

describe("masteryCounts / coverageFraction", () => {
  it("0 green → fraction 0; all green → fraction 1", () => {
    const total = allConceptKeys("chemistry").length;
    expect(masteryCounts({}, "chemistry")).toEqual({ green: 0, total });
    expect(coverageFraction({}, "chemistry")).toBe(0);

    const full = coverMap("chemistry", CURRICULUM_RANKS, GREEN);
    expect(masteryCounts(full, "chemistry")).toEqual({ green: total, total });
    expect(coverageFraction(full, "chemistry")).toBe(1);
  });

  it("only GREEN concepts count (yellow/red/grey do not)", () => {
    const yellowAll = coverMap("math", CURRICULUM_RANKS, YELLOW);
    expect(coverageFraction(yellowAll, "math")).toBe(0);
  });

  it("partial coverage is the green fraction of the whole curriculum", () => {
    const total = allConceptKeys("math").length;
    const elem = conceptsFor("math", CURRICULUM_RANKS[0]).length;
    const cov = coverMap("math", [CURRICULUM_RANKS[0]], GREEN); // all elementary green
    expect(masteryCounts(cov, "math")).toEqual({ green: elem, total });
    expect(coverageFraction(cov, "math")).toBeCloseTo(elem / total, 10);
  });

  it("an unknown subject (no concepts) is never penalized (fraction 1)", () => {
    expect(coverageFraction({}, "biology")).toBe(1);
    expect(masteryCounts({}, "biology")).toEqual({ green: 0, total: 0 });
  });
});

describe("effectiveSubjectScore — depth × coverage", () => {
  it("0 mastered zeroes a high depth (the reported bug)", () => {
    expect(effectiveSubjectScore(307, {}, "chemistry")).toBe(0);
  });

  it("full mastery returns the full depth unchanged", () => {
    const full = coverMap("chemistry", CURRICULUM_RANKS, GREEN);
    expect(effectiveSubjectScore(307, full, "chemistry")).toBe(307);
    expect(effectiveSubjectScore(SCORE_MAX, full, "chemistry")).toBe(SCORE_MAX);
  });

  it("is monotonic: mastering more never lowers the score, for fixed depth", () => {
    const elem = coverMap("math", [CURRICULUM_RANKS[0]], GREEN);
    const elemMid = coverMap("math", [CURRICULUM_RANKS[0], CURRICULUM_RANKS[1]], GREEN);
    const a = effectiveSubjectScore(300, elem, "math");
    const b = effectiveSubjectScore(300, elemMid, "math");
    expect(b).toBeGreaterThan(a);
    expect(a).toBeGreaterThan(0);
  });

  it("for fixed coverage, stronger reasoning (depth) still earns more", () => {
    const elem = coverMap("math", [CURRICULUM_RANKS[0]], GREEN);
    expect(effectiveSubjectScore(300, elem, "math")).toBeGreaterThan(
      effectiveSubjectScore(150, elem, "math")
    );
  });

  it("coerces a garbage/missing depth to 0 rather than NaN", () => {
    expect(effectiveSubjectScore(null, {}, "math")).toBe(0);
    expect(effectiveSubjectScore("oops", coverMap("math", CURRICULUM_RANKS, GREEN), "math")).toBe(0);
  });
});

describe("effectiveScores — blends every subject, preserves the profile", () => {
  it("replaces each .score with the blended value and keeps other fields", () => {
    const scores = {
      math: { score: 200, rubric: { principle: 3 }, weakConcepts: ["x"], glicko: { principle: { rating: 1500 } } },
      physics: { score: 100 },
      chemistry: { score: 307 },
    };
    const full = coverMap("math", CURRICULUM_RANKS, GREEN);
    const eff = effectiveScores(scores, full);
    expect(ORDER.every((k) => k in eff)).toBe(true);
    expect(eff.math.score).toBe(200); // math fully covered → unchanged
    expect(eff.chemistry.score).toBe(0); // chemistry 0 coverage → 0
    expect(eff.physics.score).toBe(0);
    // The reasoning profile rides through untouched.
    expect(eff.math.rubric).toEqual({ principle: 3 });
    expect(eff.math.weakConcepts).toEqual(["x"]);
    expect(eff.math.glicko).toEqual({ principle: { rating: 1500 } });
  });

  it("tolerates a null/garbage scores map", () => {
    const eff = effectiveScores(null, {});
    expect(ORDER.every((k) => eff[k].score === 0)).toBe(true);
  });
});

describe("subjectRankView — the chip's one-shot view", () => {
  it("surfaces depth, blended effective, counts, and the rank from the effective score", () => {
    const total = allConceptKeys("chemistry").length;
    const v = subjectRankView(307, {}, "chemistry");
    expect(v.depth).toBe(307);
    expect(v.effective).toBe(0);
    expect(v).toMatchObject({ green: 0, total, remaining: total, fullyMastered: false });
    expect(v.rank).toEqual(rankFor(0)); // Elementary
  });

  it("fullyMastered when every concept is green; effective === depth", () => {
    const full = coverMap("math", CURRICULUM_RANKS, GREEN);
    const v = subjectRankView(290, full, "math");
    expect(v.fullyMastered).toBe(true);
    expect(v.effective).toBe(290);
    expect(v.remaining).toBe(0);
    expect(v.rank).toEqual(rankFor(290));
  });
});

describe("pickPracticeConcept — routes practice through the curriculum (closes the tagging gap)", () => {
  it("returns a real, not-yet-green concept tagged for mastery", () => {
    const pick = pickPracticeConcept({}, "math", 5); // depth in Elementary band
    expect(pick).toBeTruthy();
    expect(typeof pick.key).toBe("string");
    expect(pick.subject).toBe("math");
    expect(pick.masteryState).toBe("grey");
    // It targets the learner's own band first when that rank has un-mastered concepts.
    expect(pick.rank).toBe(CURRICULUM_RANKS[0]);
    expect(conceptsFor("math", CURRICULUM_RANKS[0]).some((c) => c.key === pick.key)).toBe(true);
  });

  it("skips green concepts and moves on", () => {
    // All of the band rank (Elementary) green → the picker must NOT return a green one.
    const elemGreen = coverMap("math", [CURRICULUM_RANKS[0]], GREEN);
    const pick = pickPracticeConcept(elemGreen, "math", 5);
    expect(pick).toBeTruthy();
    expect(conceptsFor("math", CURRICULUM_RANKS[0]).find((c) => c.key === pick.key)).toBeUndefined();
  });

  it("falls back to a band concept once the whole curriculum is mastered (depth upkeep)", () => {
    const full = coverMap("math", CURRICULUM_RANKS, GREEN);
    const pick = pickPracticeConcept(full, "math", 5);
    expect(pick).toBeTruthy();
    expect(pick.masteryState).toBe("green");
  });

  it("returns null for a subject with no concepts", () => {
    expect(pickPracticeConcept({}, "biology", 100)).toBe(null);
  });

  it("is deterministic (stable target until it greens)", () => {
    const a = pickPracticeConcept({}, "chemistry", 40);
    const b = pickPracticeConcept({}, "chemistry", 40);
    expect(a.key).toBe(b.key);
  });
});
