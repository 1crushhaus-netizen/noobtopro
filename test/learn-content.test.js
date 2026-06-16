// Unit coverage for the Learn library's content-shaping layer
// (lib/learn/content.js): concept grouping, totals, the per-concept page payload
// (guide + prerequisites + siblings), and the schema.org Course builder shared by
// the rank page and the subject-hub Course-List carousel.
import { describe, it, expect } from "vitest";
import { ORDER } from "@/lib/scoring";
import { conceptsFor } from "@/lib/curriculum";
import { PUBLIC_RANKS } from "@/lib/learn/seo";
import {
  subjectRanks,
  subjectConceptCount,
  totalConceptCount,
  conceptsByStrand,
  getConceptData,
  buildCourse,
} from "@/lib/learn/content";

describe("learn/content — counts & grouping", () => {
  it("totals 224 concepts across the three subjects", () => {
    expect(totalConceptCount()).toBe(224);
    expect(subjectConceptCount("math")).toBe(100);
    expect(subjectConceptCount("physics")).toBe(62);
    expect(subjectConceptCount("chemistry")).toBe(62);
  });

  it("returns four populated ranks per subject (doctorate excluded)", () => {
    for (const s of ORDER) {
      const ranks = subjectRanks(s).map((r) => r.rank);
      expect(ranks).toEqual(["elementary", "middle", "high", "university"]);
    }
  });

  it("groups every concept of a cell by strand, losslessly and in order", () => {
    for (const s of ORDER) {
      for (const rank of PUBLIC_RANKS) {
        const groups = conceptsByStrand(s, rank);
        // grouping reorders (same-strand concepts collapse together) but loses
        // nothing — the SET of keys must equal the cell's keys exactly.
        const flat = groups.flatMap((g) => g.concepts.map((c) => c.key)).sort();
        expect(flat).toEqual(conceptsFor(s, rank).map((c) => c.key).sort());
        // strands are unique within the grouping
        const strands = groups.map((g) => g.strand);
        expect(new Set(strands).size).toBe(strands.length);
        // within a strand, curriculum order is preserved
        for (const g of groups) {
          const curriculumOrder = conceptsFor(s, rank)
            .filter((c) => c.strand === g.strand)
            .map((c) => c.key);
          expect(g.concepts.map((c) => c.key)).toEqual(curriculumOrder);
        }
      }
    }
  });
});

describe("learn/content — getConceptData", () => {
  it("returns the guide + foundations + siblings for a real concept", async () => {
    const data = await getConceptData("math", "high", "quadratics");
    expect(data).toBeTruthy();
    expect(data.concept.label).toBe("Quadratic functions & equations");
    expect(Array.isArray(data.guide.explanation)).toBe(true);
    expect(data.guide.example.steps.length).toBeGreaterThanOrEqual(3);
    expect(data.guide.selfQuestions.length).toBeGreaterThanOrEqual(3);
    // prerequisites resolve to real, public concepts (same subject)
    expect(data.roots.every((r) => r.key && r.rank)).toBe(true);
    // related are siblings in the same rank, excluding self
    expect(data.related.every((r) => r.key !== "quadratics")).toBe(true);
    expect(data.related.length).toBeGreaterThan(0);
  });

  it("resolves cross-subject prerequisites for a concept that has them", async () => {
    // pH / acid–base equilibria leans on logarithms (math) per the curriculum.
    const data = await getConceptData("chemistry", "university", "acid_base_equilibria");
    expect(data).toBeTruthy();
    expect(data.crossRoots.some((r) => r.subject === "math")).toBe(true);
  });

  it("returns null for unknown subject/rank/key and is prototype-safe", async () => {
    expect(await getConceptData("biology", "high", "quadratics")).toBe(null);
    expect(await getConceptData("math", "doctorate", "quadratics")).toBe(null);
    expect(await getConceptData("math", "high", "not_a_concept")).toBe(null);
    expect(await getConceptData("math", "high", "__proto__")).toBe(null);
  });
});

describe("learn/content — buildCourse (Course-List carousel item)", () => {
  it("is a valid free, online Course with the carousel-required fields", () => {
    const course = buildCourse("math", "high");
    expect(course["@type"]).toBe("Course");
    // Google-required: name + description
    expect(course.name).toBe("High School Mathematics");
    expect(typeof course.description).toBe("string");
    expect(course.description.length).toBeGreaterThan(20);
    // provider must carry a name
    expect(course.provider.name).toBe("noobtopro");
    // teaches lists every concept in the cell
    expect(course.teaches).toEqual(conceptsFor("math", "high").map((c) => c.label));
    // hasCourseInstance with free offer + ISO-8601 workload + valid courseMode
    expect(course.hasCourseInstance.courseMode).toBe("online");
    expect(course.hasCourseInstance.courseWorkload).toMatch(/^PT\d+H$/);
    expect(course.hasCourseInstance.offers).toMatchObject({ price: "0", priceCurrency: "EUR" });
    expect(course.isAccessibleForFree).toBe(true);
  });

  it("every subject yields 4 courses (≥3 → carousel-eligible)", () => {
    for (const s of ORDER) {
      const courses = subjectRanks(s).map((r) => buildCourse(s, r.rank));
      expect(courses.length).toBe(4);
      expect(courses.every((c) => c.name && c.description)).toBe(true);
    }
  });
});
