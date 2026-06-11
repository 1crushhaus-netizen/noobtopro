// Structural guarantee for the Phase-D written guides (RANKS_PLAN §12.3): every
// concept in every populated curriculum cell has a curated guide, there are no
// orphan guides (keys that left the curriculum), and every guide passes the shape
// rules shared with scripts/validate-guides.mjs (lib/guides/validate.js).
import { describe, it, expect } from "vitest";
import { CURRICULUM, RANKS, conceptsFor, allConcepts } from "@/lib/curriculum";
import { GUIDE_MODULES, loadGuides, loadGuide } from "@/lib/guides";
import { guideProblems } from "@/lib/guides/validate";

// Every populated (subject, rank) cell — doctorate is WIP/empty and excluded.
const CELLS = [];
for (const subject of Object.keys(CURRICULUM)) {
  for (const rank of RANKS) {
    if (conceptsFor(subject, rank).length > 0) CELLS.push([subject, rank]);
  }
}

describe("written guides — loader map (lib/guides/index.js)", () => {
  it("has a loader for every populated curriculum cell and no orphan loaders", () => {
    for (const [subject, rank] of CELLS) {
      expect(typeof (GUIDE_MODULES[subject] || {})[rank], `${subject}/${rank} loader`).toBe("function");
    }
    for (const subject of Object.keys(GUIDE_MODULES)) {
      for (const rank of Object.keys(GUIDE_MODULES[subject])) {
        expect(conceptsFor(subject, rank).length, `orphan loader ${subject}/${rank}`).toBeGreaterThan(0);
      }
    }
  });

  it("loadGuide resolves a real concept and returns null for unknown cells/keys", async () => {
    const g = await loadGuide("math", "high", "quadratics");
    expect(g && Array.isArray(g.explanation)).toBe(true);
    expect(await loadGuide("math", "doctorate", "quadratics")).toBe(null); // WIP rank
    expect(await loadGuide("biology", "high", "quadratics")).toBe(null); // unknown subject
    expect(await loadGuide("math", "high", "not_a_concept")).toBe(null); // unknown key
    expect(await loadGuide("math", "high", "__proto__")).toBe(null); // prototype-safe
  });
});

describe("written guides — coverage & shape (Phase D, §12.3)", () => {
  it.each(CELLS)("%s/%s: every concept has a guide, no extras, all well-formed", async (subject, rank) => {
    const guides = await loadGuides(subject, rank);
    expect(guides, "GUIDES export").toBeTruthy();
    const wanted = conceptsFor(subject, rank).map((c) => c.key);
    const have = Object.keys(guides);
    expect(wanted.filter((k) => !have.includes(k)), "concepts missing a guide").toEqual([]);
    expect(have.filter((k) => !wanted.includes(k)), "orphan guide keys").toEqual([]);
    const problems = [];
    for (const k of have) for (const p of guideProblems(guides[k])) problems.push(`${k} — ${p}`);
    expect(problems).toEqual([]);
  });

  it("covers the full curriculum: one guide per concept (224 total)", async () => {
    let total = 0;
    for (const [subject, rank] of CELLS) total += Object.keys(await loadGuides(subject, rank)).length;
    expect(total).toBe(allConcepts().length);
    expect(total).toBe(224);
  });
});
