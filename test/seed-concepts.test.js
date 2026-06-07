import { describe, it, expect } from "vitest";
import { TOPICS, SEED_CONCEPTS, allSeedConcepts, isValidTopic } from "@/lib/taxonomy";
import { ORDER } from "@/lib/scoring";

// The public seed (PR 4) makes the hub the same vetted catalog for everyone from day
// one. Its correctness hinges on covering EVERY taxonomy topic exactly once with a
// valid slug — a drift here would leave a topic with no curated guide (empty hub).
describe("SEED_CONCEPTS — Concept Hub public seed coverage", () => {
  it("covers every taxonomy topic exactly once (36 total)", () => {
    let count = 0;
    for (const subject of ORDER) {
      const topicSlugs = TOPICS[subject].map((t) => t.slug);
      const seedSlugs = SEED_CONCEPTS[subject].map((c) => c.slug);
      expect(new Set(seedSlugs).size, `${subject} seed slugs must be unique`).toBe(seedSlugs.length);
      expect([...seedSlugs].sort()).toEqual([...topicSlugs].sort()); // one per topic, all covered
      count += seedSlugs.length;
    }
    expect(count).toBe(36);
  });

  it("every seed slug is a valid taxonomy slug for its subject", () => {
    for (const subject of ORDER) {
      for (const { slug } of SEED_CONCEPTS[subject]) {
        expect(isValidTopic(subject, slug), `${subject}/${slug}`).toBe(true);
      }
    }
  });

  it("every seed concept is a non-empty, reasonable-length string", () => {
    for (const subject of ORDER) {
      for (const { concept } of SEED_CONCEPTS[subject]) {
        expect(typeof concept).toBe("string");
        expect(concept.trim().length).toBeGreaterThan(0);
        expect(concept.length).toBeLessThanOrEqual(200); // fits the concept column / left(…,200)
      }
    }
  });

  it("allSeedConcepts flattens to 36 {subject, slug, concept} rows", () => {
    const all = allSeedConcepts();
    expect(all).toHaveLength(36);
    expect(all.every((r) => ORDER.includes(r.subject) && r.slug && r.concept)).toBe(true);
  });
});
