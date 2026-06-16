import { describe, it, expect } from "vitest";
import { resolveConceptKey } from "@/lib/curriculum";
import { resolveWeakConcepts } from "@/lib/gradeInput";

// The grader now reports weak concepts as CURRICULUM KEYS, and the dashboard opens
// the prepared library guide for each. resolveConceptKey is the bridge that maps
// the grader's output (and any legacy free-text) onto a canonical curriculum key.

describe("resolveConceptKey — map grader output onto a curriculum key", () => {
  it("accepts an exact curriculum key verbatim", () => {
    expect(resolveConceptKey("math", "multiplication_division")).toBe("multiplication_division");
  });

  it("accepts a concept LABEL, case/punctuation-insensitive", () => {
    expect(resolveConceptKey("math", "Multiplication & division")).toBe("multiplication_division");
    expect(resolveConceptKey("math", "multiplication and division")).toBe("multiplication_division");
  });

  it("maps LEGACY free text that contains all of a concept's label tokens", () => {
    expect(resolveConceptKey("physics", "the learner struggles with conservation of energy")).toBe(
      "conservation_energy"
    );
  });

  it("returns null for unrelated text, unknown subjects, and empties", () => {
    expect(resolveConceptKey("math", "epsilon-delta wizardry")).toBeNull();
    expect(resolveConceptKey("astrology", "stars")).toBeNull();
    expect(resolveConceptKey("math", "")).toBeNull();
    expect(resolveConceptKey("math", null)).toBeNull();
  });

  // Real legacy free-text weakConcepts taken from the live `scores` table (rows
  // written before the grader reported keys). Each must now resolve to a real,
  // prepared curriculum concept so the dashboard "Work on" chip deep-links instead of
  // dead-ending on the Learn tab, and never shows a phantom topic.
  it("maps real legacy free-text rows onto the best curriculum concept", () => {
    expect(resolveConceptKey("math", "isolating variable in linear equations")).toBe("linear_equations_two_var");
    expect(resolveConceptKey("math", "interpreting rates and fixed fees")).toBe("ratios_unit_rates");
    expect(resolveConceptKey("math", "percentage profit calculation")).toBe("percentages");
    expect(resolveConceptKey("math", "stating and justifying proportional relationships")).toBe("proportional_relationships");
    expect(resolveConceptKey("physics", "work calculation")).toBe("work_energy_power");
    expect(resolveConceptKey("physics", "units of work vs force")).toBe("work_energy_power");
    expect(resolveConceptKey("physics", "potential energy increase on frictionless incline")).toBe("kinetic_potential_energy");
    expect(resolveConceptKey("physics", "quantitative velocity-time relationship")).toBe("speed_velocity_acceleration");
    expect(resolveConceptKey("physics", "thermodynamic cycles")).toBe("thermodynamics_intro");
    expect(resolveConceptKey("chemistry", "stoichiometric ratios for products")).toBe("stoichiometry");
    expect(resolveConceptKey("chemistry", "atomic stability")).toBe("atomic_structure");
    expect(resolveConceptKey("chemistry", "principles of conservation of mass explanation")).toBe("conservation_mass");
  });

  // Single-token concept labels ("Stoichiometry", "Percentages") were previously
  // unmatchable by the free-text fallback (it skipped <2-token labels); guard that.
  it("resolves single-token concept labels via stem/prefix match", () => {
    expect(resolveConceptKey("chemistry", "stoichiometric ratios")).toBe("stoichiometry");
    expect(resolveConceptKey("math", "computing a percentage")).toBe("percentages");
  });

  it("still drops genuinely unmappable legacy phrases (no phantom chip)", () => {
    expect(resolveConceptKey("math", "justifying formulas")).toBeNull();
    expect(resolveConceptKey("math", "checking domain/extraneous solutions")).toBeNull();
    expect(resolveConceptKey("physics", "efficiency derivation")).toBeNull();
  });
});

describe("resolveWeakConcepts — validate + dedupe + cap the grader's weakConcepts", () => {
  it("keeps only resolvable concepts, as canonical keys, order-preserving + deduped", () => {
    const out = resolveWeakConcepts("math", [
      "multiplication_division", // exact key
      "Multiplication & division", // same concept via label → dropped as a dup
      "total nonsense concept", // unresolvable → dropped
      "fractions_meaning_equivalence", // exact key
    ]);
    expect(out).toEqual(["multiplication_division", "fractions_meaning_equivalence"]);
  });

  it("tolerates non-arrays and honors the cap", () => {
    expect(resolveWeakConcepts("math", null)).toEqual([]);
    expect(resolveWeakConcepts("math", "nope")).toEqual([]);
    const capped = resolveWeakConcepts(
      "math",
      ["multiplication_division", "fractions_meaning_equivalence", "addition_subtraction", "factors_multiples"],
      2
    );
    expect(capped).toHaveLength(2);
  });
});
