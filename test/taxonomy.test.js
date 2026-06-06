import { describe, it, expect } from "vitest";
import {
  TOPICS,
  isValidTopic,
  normalizeTopic,
  fallbackTopic,
  topicLabel,
  allTopicRows,
  topicSlugsFor,
} from "@/lib/taxonomy";
import { ORDER } from "@/lib/scoring";

describe("taxonomy", () => {
  it("has exactly 12 topics per subject incl. a general_<subject> fallback", () => {
    for (const s of ORDER) {
      expect(TOPICS[s]).toHaveLength(12);
      expect(TOPICS[s].some((t) => t.slug === `general_${s}`)).toBe(true);
    }
    expect(allTopicRows()).toHaveLength(36); // mirrors the concept_topics seed
  });

  it("isValidTopic accepts real slugs and rejects unknown/cross-subject/inherited keys", () => {
    expect(isValidTopic("math", "calculus_analysis")).toBe(true);
    expect(isValidTopic("math", "electromagnetism")).toBe(false); // a physics slug
    expect(isValidTopic("math", "nope")).toBe(false);
    expect(isValidTopic("astrology", "algebra")).toBe(false); // bad subject
    // prototype-safety: inherited keys must never resolve as valid
    expect(isValidTopic("math", "constructor")).toBe(false);
    expect(isValidTopic("math", "__proto__")).toBe(false);
    expect(isValidTopic("math", "toString")).toBe(false);
  });

  it("normalizeTopic keeps valid slugs (case/space-tolerant) and falls back otherwise", () => {
    expect(normalizeTopic("math", "calculus_analysis")).toBe("calculus_analysis");
    expect(normalizeTopic("math", "  Calculus_Analysis ")).toBe("calculus_analysis");
    expect(normalizeTopic("math", "not_a_topic")).toBe("general_math");
    expect(normalizeTopic("physics", undefined)).toBe("general_physics");
    expect(normalizeTopic("chemistry", "__proto__")).toBe("general_chemistry");
    expect(normalizeTopic("astrology", "algebra")).toBe(null); // unknown subject
  });

  it("fallbackTopic / topicLabel / topicSlugsFor behave", () => {
    expect(fallbackTopic("physics")).toBe("general_physics");
    expect(topicLabel("math", "calculus_analysis")).toBe("Calculus & Analysis");
    expect(topicLabel("math", "nonexistent")).toBe("nonexistent"); // falls back to slug
    expect(topicSlugsFor("chemistry")).toContain("equilibrium");
    expect(topicSlugsFor("chemistry").split(", ")).toHaveLength(12);
  });
});
