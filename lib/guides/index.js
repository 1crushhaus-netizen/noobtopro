// ---------------------------------------------------------------------------
// CURATED WRITTEN GUIDES (Phase D, RANKS_PLAN §12.3) — the static concept-page
// content: explanation + worked example + self-questions for every concept in
// the curriculum (lib/curriculum.js). All 224 guides are original content
// authored for noobtopro (no third-party lesson text), validated in CI by
// test/guides.test.js against the shape rules in ./validate.js.
//
// The loader map is EXPLICIT (not a template-string dynamic import) so the
// bundler statically code-splits one lazy chunk per (subject, rank) module —
// a concept page downloads only its own cell's guides, and the main bundle
// ships none of them.
// ---------------------------------------------------------------------------

export const GUIDE_MODULES = {
  math: {
    elementary: () => import("./math/elementary.js"),
    middle: () => import("./math/middle.js"),
    high: () => import("./math/high.js"),
    university: () => import("./math/university.js"),
  },
  physics: {
    elementary: () => import("./physics/elementary.js"),
    middle: () => import("./physics/middle.js"),
    high: () => import("./physics/high.js"),
    university: () => import("./physics/university.js"),
  },
  chemistry: {
    elementary: () => import("./chemistry/elementary.js"),
    middle: () => import("./chemistry/middle.js"),
    high: () => import("./chemistry/high.js"),
    university: () => import("./chemistry/university.js"),
  },
};

// The full GUIDES map for one (subject, rank) cell, or null for an unknown/WIP
// cell (doctorate has no modules). Prototype-safe lookups, mirroring curriculum.js.
export async function loadGuides(subject, rank) {
  if (typeof subject !== "string" || typeof rank !== "string") return null;
  if (!Object.prototype.hasOwnProperty.call(GUIDE_MODULES, subject)) return null;
  const cell = GUIDE_MODULES[subject];
  if (!Object.prototype.hasOwnProperty.call(cell, rank)) return null;
  const mod = await cell[rank]();
  return mod.GUIDES || null;
}

// One concept's guide ({ explanation, example, selfQuestions }) or null when the
// cell or key is unknown — the concept page renders its fallback hint on null.
export async function loadGuide(subject, rank, key) {
  const guides = await loadGuides(subject, rank);
  if (!guides || typeof key !== "string") return null;
  return Object.prototype.hasOwnProperty.call(guides, key) ? guides[key] : null;
}
