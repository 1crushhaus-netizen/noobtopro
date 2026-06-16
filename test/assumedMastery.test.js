import { describe, it, expect } from "vitest";
import { assumedMasteredKeys, MASTERY_LABELS } from "@/lib/mastery";

// "Assumed mastery": an elementary concept the learner never directly attempted is
// inferred mastered when it's a TRANSITIVE prerequisite of a concept they answered
// well (bestQuality >= 70). Display-only; direct evidence always wins.
//
// math chain used below:
//   quadratics -> algebraic_expressions -> {properties_of_operations*, patterns_relationships*}
//   quadratics -> exponents             -> {multiplication_division*, properties_of_operations*, factors_multiples*}
//   quadratics -> functions_intro       -> {patterns_relationships*, coordinate_plane_intro*}
//   (* = elementary-rank; the only tier ever marked "assumed")

const demonstrated = (bestQuality) => ({
  math: { quadratics: { attempts: 1, greenHits: bestQuality >= 70 ? 1 : 0, lastQuality: bestQuality, bestQuality } },
});

describe("assumedMasteredKeys", () => {
  it("infers the elementary prerequisites (transitive) of a well-answered concept", () => {
    const out = assumedMasteredKeys(demonstrated(80), "math");
    expect(out).toBeInstanceOf(Set);
    // Every elementary concept in quadratics' prerequisite closure:
    for (const k of [
      "properties_of_operations",
      "patterns_relationships",
      "multiplication_division",
      "factors_multiples",
      "coordinate_plane_intro",
    ]) {
      expect(out.has(k)).toBe(true);
    }
    // NON-elementary intermediates and the demonstrated seed itself are never inferred.
    expect(out.has("exponents")).toBe(false);
    expect(out.has("algebraic_expressions")).toBe(false);
    expect(out.has("quadratics")).toBe(false);
  });

  it("requires a green-quality (>=70) demonstration to seed the inference", () => {
    expect(assumedMasteredKeys(demonstrated(69), "math").size).toBe(0);
    expect(assumedMasteredKeys(demonstrated(70), "math").size).toBeGreaterThan(0);
  });

  it("direct evidence wins — a concept the learner actually attempted is never inferred", () => {
    const map = demonstrated(80);
    map.math.multiplication_division = { attempts: 1, greenHits: 0, lastQuality: 30, bestQuality: 30 }; // a real (red) attempt
    const out = assumedMasteredKeys(map, "math");
    expect(out.has("multiplication_division")).toBe(false); // its real state stands
    expect(out.has("factors_multiples")).toBe(true); // siblings still inferred
  });

  it("a demonstrated ELEMENTARY concept propagates nothing (roots have no prerequisites)", () => {
    const out = assumedMasteredKeys(
      { math: { multiplication_division: { attempts: 2, greenHits: 2, lastQuality: 90, bestQuality: 90 } } },
      "math"
    );
    expect(out.size).toBe(0);
  });

  it("is empty for an unknown subject, empty map, or no demonstrated work", () => {
    expect(assumedMasteredKeys({}, "math").size).toBe(0);
    expect(assumedMasteredKeys(null, "math").size).toBe(0);
    expect(assumedMasteredKeys(demonstrated(80), "astrology").size).toBe(0);
    expect(assumedMasteredKeys({ math: { quadratics: { attempts: 0 } } }, "math").size).toBe(0);
  });

  it("exposes a distinct display label for the assumed state", () => {
    expect(MASTERY_LABELS.assumed).toMatch(/assumed/i);
  });
});
