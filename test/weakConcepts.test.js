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
