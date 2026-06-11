import { describe, it, expect } from "vitest";
import { conceptByKey, bandForRank, RANK_TO_BAND, RANKS, conceptsFor } from "@/lib/curriculum";

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
