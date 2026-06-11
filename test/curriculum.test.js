import { describe, it, expect } from "vitest";
import {
  conceptByKey,
  bandForRank,
  RANK_TO_BAND,
  RANKS,
  conceptsFor,
  BAND_LADDER,
  calibratedDrillBand,
  PREREQUISITES,
  CROSS_SUBJECT_PREREQUISITES,
  SUBJECT_FOUNDATION_ORDER,
  crossPrereqRefsFor,
  crossRootsFor,
} from "@/lib/curriculum";

// The concept-practice drill (increment 3) leans on conceptByKey as its server-side
// allowlist and bandForRank to frame the question — pin both.

describe("conceptByKey (the concept-drill allowlist)", () => {
  it("resolves a real (subject, key) to its metadata incl. rank", () => {
    expect(conceptByKey("math", "quadratics")).toEqual({
      key: "quadratics",
      label: "Quadratic functions & equations",
      strand: "Algebra",
      rank: "high",
    });
    expect(conceptByKey("math", "counting_cardinality").rank).toBe("elementary");
  });

  it("returns null for an unknown key, a cross-subject key, or a bad subject", () => {
    expect(conceptByKey("math", "totally_fake")).toBeNull();
    expect(conceptByKey("physics", "quadratics")).toBeNull(); // a math key under physics
    expect(conceptByKey("biology", "quadratics")).toBeNull();
  });

  it("is prototype-safe (constructor/__proto__ are not subjects or concepts)", () => {
    expect(conceptByKey("constructor", "toString")).toBeNull();
    expect(conceptByKey("__proto__", "quadratics")).toBeNull();
    expect(conceptByKey("math", "__proto__")).toBeNull();
    expect(conceptByKey(null, "quadratics")).toBeNull();
    expect(conceptByKey("math", null)).toBeNull();
  });

  it("can resolve every concept in the curriculum (round-trip)", () => {
    for (const subject of ["math", "physics", "chemistry"]) {
      for (const rank of RANKS) {
        for (const c of conceptsFor(subject, rank)) {
          const r = conceptByKey(subject, c.key);
          expect(r, `${subject}/${c.key}`).toBeTruthy();
          expect(r.rank).toBe(rank);
          expect(r.label).toBe(c.label);
        }
      }
    }
  });
});

describe("bandForRank (rank -> difficulty band)", () => {
  it("maps the five ranks 1:1 onto the five bands", () => {
    expect(bandForRank("elementary")).toBe("beginner");
    expect(bandForRank("middle")).toBe("foundational");
    expect(bandForRank("high")).toBe("intermediate");
    expect(bandForRank("university")).toBe("advanced");
    expect(bandForRank("doctorate")).toBe("phd");
    expect(Object.keys(RANK_TO_BAND).sort()).toEqual([...RANKS].sort());
  });

  it("defaults an unknown/prototype rank to intermediate", () => {
    expect(bandForRank("bogus")).toBe("intermediate");
    expect(bandForRank("__proto__")).toBe("intermediate");
    expect(bandForRank(undefined)).toBe("intermediate");
  });
});

describe("calibratedDrillBand (mastery-calibrated drill difficulty, RANKS_PLAN §6)", () => {
  it("BAND_LADDER is the five bands in ascending order and covers every rank's band", () => {
    expect(BAND_LADDER).toEqual(["beginner", "foundational", "intermediate", "advanced", "phd"]);
    for (const rank of RANKS) expect(BAND_LADDER).toContain(bandForRank(rank));
  });

  it("green stretches one band UP, red drops one band DOWN, yellow/grey stay at the rank band", () => {
    expect(calibratedDrillBand("high", "green")).toBe("advanced"); // intermediate +1
    expect(calibratedDrillBand("high", "red")).toBe("foundational"); // intermediate -1
    expect(calibratedDrillBand("high", "yellow")).toBe("intermediate");
    expect(calibratedDrillBand("high", "grey")).toBe("intermediate");
  });

  it("clamps at both ends of the ladder", () => {
    expect(calibratedDrillBand("elementary", "red")).toBe("beginner"); // no band below beginner
    expect(calibratedDrillBand("doctorate", "green")).toBe("phd"); // no band above phd
    expect(calibratedDrillBand("university", "green")).toBe("phd");
    expect(calibratedDrillBand("middle", "red")).toBe("beginner");
  });

  it("degrades unknown states/ranks to the plain rank band (never widens the range)", () => {
    expect(calibratedDrillBand("high", "purple")).toBe("intermediate");
    expect(calibratedDrillBand("high", undefined)).toBe("intermediate");
    expect(calibratedDrillBand("bogus", "green")).toBe("advanced"); // unknown rank → intermediate +1
    expect(calibratedDrillBand("__proto__", "__proto__")).toBe("intermediate");
  });
});

describe("PREREQUISITES (same-subject root graph) — invariants", () => {
  it("every root key resolves within its subject and sits at a STRICTLY LOWER rank (acyclic)", () => {
    for (const subject of Object.keys(PREREQUISITES)) {
      for (const [key, rootKeys] of Object.entries(PREREQUISITES[subject])) {
        const source = conceptByKey(subject, key);
        expect(source, `${subject}/${key} is not a curriculum concept`).toBeTruthy();
        for (const rk of rootKeys) {
          const root = conceptByKey(subject, rk);
          expect(root, `${subject}/${key} root "${rk}" does not resolve`).toBeTruthy();
          expect(
            RANKS.indexOf(root.rank),
            `${subject}/${key} root "${rk}" is not lower-rank`
          ).toBeLessThan(RANKS.indexOf(source.rank));
        }
      }
    }
  });
});

describe("CROSS_SUBJECT_PREREQUISITES (§12.2 enhancement) — invariants & resolution", () => {
  it("every edge points to an EARLIER subject in SUBJECT_FOUNDATION_ORDER at a rank ≤ the source's (acyclic)", () => {
    expect(SUBJECT_FOUNDATION_ORDER).toEqual(["math", "physics", "chemistry"]);
    for (const subject of Object.keys(CROSS_SUBJECT_PREREQUISITES)) {
      const sourceOrder = SUBJECT_FOUNDATION_ORDER.indexOf(subject);
      expect(sourceOrder, `unknown source subject "${subject}"`).toBeGreaterThanOrEqual(0);
      for (const [key, refs] of Object.entries(CROSS_SUBJECT_PREREQUISITES[subject])) {
        const source = conceptByKey(subject, key);
        expect(source, `${subject}/${key} is not a curriculum concept`).toBeTruthy();
        expect(refs.length, `${subject}/${key} has an empty cross list (omit instead)`).toBeGreaterThan(0);
        for (const ref of refs) {
          const target = conceptByKey(ref.subject, ref.key);
          expect(target, `${subject}/${key} → ${ref.subject}/${ref.key} does not resolve`).toBeTruthy();
          expect(
            SUBJECT_FOUNDATION_ORDER.indexOf(ref.subject),
            `${subject}/${key} → ${ref.subject}/${ref.key} must point to an EARLIER subject`
          ).toBeLessThan(sourceOrder);
          expect(
            RANKS.indexOf(target.rank),
            `${subject}/${key} → ${ref.subject}/${ref.key} must not point to a HIGHER rank`
          ).toBeLessThanOrEqual(RANKS.indexOf(source.rank));
        }
      }
    }
  });

  it("math (the foundation subject) has no outgoing cross-subject edges", () => {
    expect(CROSS_SUBJECT_PREREQUISITES.math).toBeUndefined();
  });

  it("crossRootsFor resolves refs to full concepts tagged with their OWN subject", () => {
    const roots = crossRootsFor("physics", "vectors_kinematics_calc");
    expect(roots.map((r) => `${r.subject}:${r.key}`)).toEqual(["math:derivatives", "math:vectors_intro"]);
    for (const r of roots) {
      expect(typeof r.label).toBe("string");
      expect(RANKS).toContain(r.rank);
    }
    // pH leans on logarithms — the canonical chemistry → math edge.
    expect(crossRootsFor("chemistry", "acids_bases_intro").map((r) => r.key)).toEqual(["logarithms"]);
  });

  it("returns [] for concepts without cross roots, unknown inputs, and prototype keys", () => {
    expect(crossPrereqRefsFor("math", "quadratics")).toEqual([]);
    expect(crossRootsFor("physics", "pushes_pulls")).toEqual([]);
    expect(crossRootsFor("biology", "anything")).toEqual([]);
    expect(crossRootsFor("physics", "__proto__")).toEqual([]);
    expect(crossRootsFor("constructor", "toString")).toEqual([]);
    expect(crossRootsFor(null, undefined)).toEqual([]);
  });
});
