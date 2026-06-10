import { describe, it, expect } from "vitest";
import {
  MASTERY_GREEN_QUALITY,
  MASTERY_GREEN_ATTEMPTS,
  MASTERY_RED_QUALITY,
  isCurriculumConcept,
  emptyCounters,
  applyMasteryAttempt,
  masteryStateFor,
  normalizeMasteryMap,
  applyMasteryUpdates,
  masteryMapFromRows,
  conceptState,
  MASTERY_LABELS,
} from "@/lib/mastery";
import { CURRICULUM } from "@/lib/curriculum";

// A few real curriculum keys to test against (pinned — they exist in lib/curriculum.js).
const MATH_KEY = "ratios_unit_rates";
const PHYS_KEY = "balanced_unbalanced_forces";

describe("isCurriculumConcept", () => {
  it("accepts real (subject, key) pairs and rejects everything else", () => {
    expect(isCurriculumConcept("math", MATH_KEY)).toBe(true);
    expect(isCurriculumConcept("physics", PHYS_KEY)).toBe(true);
    expect(isCurriculumConcept("math", PHYS_KEY)).toBe(false); // wrong subject
    expect(isCurriculumConcept("math", "not_a_concept")).toBe(false);
    expect(isCurriculumConcept("biology", MATH_KEY)).toBe(false);
    expect(isCurriculumConcept(null, MATH_KEY)).toBe(false);
    expect(isCurriculumConcept("math", null)).toBe(false);
  });

  it("is prototype-safe (constructor/__proto__ are not subjects or concepts)", () => {
    expect(isCurriculumConcept("constructor", "toString")).toBe(false);
    expect(isCurriculumConcept("__proto__", MATH_KEY)).toBe(false);
    expect(isCurriculumConcept("math", "__proto__")).toBe(false);
  });
});

describe("applyMasteryAttempt + masteryStateFor (the sustained-quality flag)", () => {
  it("starts grey with no attempts", () => {
    expect(masteryStateFor(null)).toBe("grey");
    expect(masteryStateFor(emptyCounters())).toBe("grey");
  });

  it("one good attempt is yellow (not yet green)", () => {
    const c = applyMasteryAttempt(emptyCounters(), 85);
    expect(c).toEqual({ attempts: 1, greenHits: 1, lastQuality: 85, bestQuality: 85 });
    expect(masteryStateFor(c)).toBe("yellow");
  });

  it(`turns green after ${MASTERY_GREEN_ATTEMPTS} attempts at quality ≥ ${MASTERY_GREEN_QUALITY}`, () => {
    let c = emptyCounters();
    c = applyMasteryAttempt(c, MASTERY_GREEN_QUALITY); // boundary counts
    c = applyMasteryAttempt(c, 90);
    expect(masteryStateFor(c)).toBe("green");
  });

  it(`a failed last attempt (< ${MASTERY_RED_QUALITY}) or a docked skip is red`, () => {
    expect(masteryStateFor(applyMasteryAttempt(emptyCounters(), 20))).toBe("red");
    expect(masteryStateFor(applyMasteryAttempt(emptyCounters(), 3))).toBe("red"); // dock floor
    expect(masteryStateFor(applyMasteryAttempt(emptyCounters(), MASTERY_RED_QUALITY))).toBe("yellow"); // boundary is NOT red
  });

  it("recovers red → yellow on a mid-quality attempt", () => {
    let c = applyMasteryAttempt(emptyCounters(), 10);
    expect(masteryStateFor(c)).toBe("red");
    c = applyMasteryAttempt(c, 55);
    expect(masteryStateFor(c)).toBe("yellow");
  });

  it("green is STICKY: a later fail does not demote (coverage is monotonic, §11.6)", () => {
    let c = emptyCounters();
    c = applyMasteryAttempt(c, 80);
    c = applyMasteryAttempt(c, 85);
    expect(masteryStateFor(c)).toBe("green");
    c = applyMasteryAttempt(c, 5); // bombs one later
    expect(masteryStateFor(c)).toBe("green");
    expect(c.lastQuality).toBe(5); // the record still tells the truth
  });

  it("quality just below the green bar never accumulates green hits", () => {
    let c = emptyCounters();
    for (let i = 0; i < 10; i++) c = applyMasteryAttempt(c, MASTERY_GREEN_QUALITY - 1);
    expect(c.greenHits).toBe(0);
    expect(masteryStateFor(c)).toBe("yellow");
  });

  it("clamps and coerces garbage quality (non-finite → no-op; out-of-range → clamped)", () => {
    const base = applyMasteryAttempt(emptyCounters(), 50);
    expect(applyMasteryAttempt(base, NaN)).toEqual(base);
    expect(applyMasteryAttempt(base, "nope")).toEqual(base);
    expect(applyMasteryAttempt(base, null)).toEqual(base);
    expect(applyMasteryAttempt(emptyCounters(), 250).lastQuality).toBe(100);
    expect(applyMasteryAttempt(emptyCounters(), -10).lastQuality).toBe(0);
  });

  it("is immutable (the previous record is not mutated)", () => {
    const a = applyMasteryAttempt(emptyCounters(), 80);
    const snapshot = { ...a };
    applyMasteryAttempt(a, 90);
    expect(a).toEqual(snapshot);
  });
});

describe("normalizeMasteryMap (the guest-blob gate)", () => {
  it("passes a valid map through", () => {
    const map = { math: { [MATH_KEY]: { attempts: 2, greenHits: 2, lastQuality: 80, bestQuality: 90 } } };
    expect(normalizeMasteryMap(map)).toEqual(map);
  });

  it("drops unknown subjects, unknown concepts, and garbage-typed counters", () => {
    const out = normalizeMasteryMap({
      math: {
        [MATH_KEY]: { attempts: 1, greenHits: 0, lastQuality: 50, bestQuality: 50 },
        fake_concept: { attempts: 5, greenHits: 5, lastQuality: 100, bestQuality: 100 },
        [PHYS_KEY]: { attempts: 3, greenHits: 3, lastQuality: 90, bestQuality: 90 }, // physics key under math
      },
      biology: { anything: { attempts: 1 } },
      physics: "not-an-object",
    });
    expect(Object.keys(out)).toEqual(["math"]);
    expect(Object.keys(out.math)).toEqual([MATH_KEY]);
  });

  it("caps greenHits at attempts (a forged blob can't pre-bake an impossible record)", () => {
    const out = normalizeMasteryMap({ math: { [MATH_KEY]: { attempts: 1, greenHits: 99, lastQuality: 80, bestQuality: 80 } } });
    expect(out.math[MATH_KEY].greenHits).toBe(1);
    expect(masteryStateFor(out.math[MATH_KEY])).toBe("yellow"); // not green off one attempt
  });

  it("drops zero-attempt records and survives null/garbage input", () => {
    expect(normalizeMasteryMap({ math: { [MATH_KEY]: { attempts: 0 } } })).toEqual({});
    expect(normalizeMasteryMap(null)).toEqual({});
    expect(normalizeMasteryMap("junk")).toEqual({});
    expect(normalizeMasteryMap([1, 2, 3])).toEqual({});
  });
});

describe("applyMasteryUpdates", () => {
  it("applies allow-listed updates and skips junk entries", () => {
    const out = applyMasteryUpdates({}, [
      { subject: "math", conceptKey: MATH_KEY, quality: 80 },
      { subject: "math", conceptKey: "fake_concept", quality: 100 },
      { subject: "biology", conceptKey: MATH_KEY, quality: 100 },
      null,
      "junk",
    ]);
    expect(Object.keys(out)).toEqual(["math"]);
    expect(out.math[MATH_KEY].attempts).toBe(1);
    expect(out.math[MATH_KEY].greenHits).toBe(1);
  });

  it("accumulates across calls and subjects without mutating the input", () => {
    const first = applyMasteryUpdates({}, [{ subject: "math", conceptKey: MATH_KEY, quality: 75 }]);
    const snapshot = JSON.parse(JSON.stringify(first));
    const second = applyMasteryUpdates(first, [
      { subject: "math", conceptKey: MATH_KEY, quality: 90 },
      { subject: "physics", conceptKey: PHYS_KEY, quality: 10 },
    ]);
    expect(first).toEqual(snapshot);
    expect(second.math[MATH_KEY].attempts).toBe(2);
    expect(masteryStateFor(second.math[MATH_KEY])).toBe("green");
    expect(masteryStateFor(second.physics[PHYS_KEY])).toBe("red");
  });
});

describe("masteryMapFromRows (DB rows → the same map shape)", () => {
  it("maps snake_case rows and applies the same allowlist", () => {
    const out = masteryMapFromRows([
      { subject: "math", concept_key: MATH_KEY, attempts: 2, green_hits: 2, last_quality: 80, best_quality: 90 },
      { subject: "math", concept_key: "fake_concept", attempts: 9, green_hits: 9, last_quality: 99, best_quality: 99 },
      null,
    ]);
    expect(Object.keys(out)).toEqual(["math"]);
    expect(masteryStateFor(out.math[MATH_KEY])).toBe("green");
  });

  it("returns {} for non-array input", () => {
    expect(masteryMapFromRows(null)).toEqual({});
    expect(masteryMapFromRows("junk")).toEqual({});
  });
});

describe("conceptState + labels", () => {
  it("reads a state out of a map (grey when absent) and has copy for every state", () => {
    const map = applyMasteryUpdates({}, [{ subject: "math", conceptKey: MATH_KEY, quality: 10 }]);
    expect(conceptState(map, "math", MATH_KEY)).toBe("red");
    expect(conceptState(map, "math", "anything_else")).toBe("grey");
    expect(conceptState(null, "math", MATH_KEY)).toBe("grey");
    for (const s of ["green", "yellow", "red", "grey"]) expect(typeof MASTERY_LABELS[s]).toBe("string");
  });
});

describe("curriculum integrity required by mastery identity", () => {
  it("concept keys are unique within each subject (mastery is keyed on them)", () => {
    for (const subject of Object.keys(CURRICULUM)) {
      const seen = new Set();
      for (const rank of Object.keys(CURRICULUM[subject])) {
        for (const c of CURRICULUM[subject][rank]) {
          expect(seen.has(c.key), `${subject}/${rank}/${c.key} duplicated`).toBe(false);
          seen.add(c.key);
        }
      }
    }
  });
});
