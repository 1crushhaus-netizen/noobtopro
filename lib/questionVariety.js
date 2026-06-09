// ---------------------------------------------------------------------------
// Question-variety levers for practice generation.
//
// The LLM, asked repeatedly for "a <band> question on <concept>" with identical
// conditioning, collapses onto the single canonical textbook exemplar (e.g.
// "2x + 5 = 11" for linear equations) and only reskins the wording. To break that,
// the server ROLLS a fresh spec on every /api/generate call and injects it into the
// prompt — so the conditioning changes each time even with no history. These are
// generic, cross-subject dimensions (they apply to any STEM concept), so they work
// for the open-ended weak concepts the grader invents, not just a fixed bank.
//
// Pure + seedable (pass a deterministic `rand` in tests).
// ---------------------------------------------------------------------------

// Real-world framings. "Where natural for the concept" — the prompt tells the model
// to keep it abstract if a frame would distort the concept (so these never force nonsense).
export const VARIETY_THEMES = [
  "a pure, abstract form (symbols and quantities only)",
  "a money or finance scenario (prices, budgets, interest, discounts)",
  "a motion, rate, or time scenario",
  "a measurement or geometry context (lengths, areas, volumes)",
  "a mixing, ratio, or proportion scenario",
  "an everyday real-world situation",
  "a lab, experiment, or data-from-a-table scenario",
  "a comparison between two options or quantities",
];

// Structural angles — the SHAPE of the reasoning task, independent of the surface theme.
export const VARIETY_ANGLES = [
  "a direct, single-idea form",
  "a multi-step form that requires combining two ideas",
  "a work-backwards form (given the result, reason to the cause)",
  "a compare-two-cases form (which is larger/better/faster, and why)",
  "a spot-and-justify form (decide whether a stated claim or method is valid)",
  "a form with a subtle trap that rewards careful reasoning over pattern-matching",
];

function pick(list, r) {
  const n = list.length;
  if (!n) return undefined;
  const i = Math.floor((Number.isFinite(r) ? r : 0) * n);
  return list[Math.min(n - 1, Math.max(0, i))];
}

// A short base-36 "variation key" — even at temperature 0 this changes the token
// stream, nudging the model off the canonical mode. Cosmetic to the learner (the key
// is never shown); it just perturbs generation.
function nonce(r) {
  const span = 36 ** 4; // 1,679,616 → 4 base-36 chars
  const v = Math.floor((Number.isFinite(r) ? r : 0) * span);
  return Math.min(span - 1, Math.max(0, v)).toString(36).padStart(4, "0");
}

/**
 * Roll a variety spec. Independent draws for theme / angle / nonce.
 * @param {() => number} rand  a [0,1) RNG (default Math.random; inject for tests)
 * @returns {{theme:string, angle:string, nonce:string}}
 */
export function pickVariety(rand = Math.random) {
  const r = typeof rand === "function" ? rand : Math.random;
  return {
    theme: pick(VARIETY_THEMES, r()),
    angle: pick(VARIETY_ANGLES, r()),
    nonce: nonce(r()),
  };
}

// Render the spec as prompt lines. Empty string for a missing spec (so the caller can
// concatenate unconditionally).
export function varietyDirectiveText(v) {
  if (!v || typeof v !== "object") return "";
  return (
    "Variation directives (honor where natural for the concept):\n" +
    `- Context theme: ${v.theme}\n` +
    `- Structural angle: ${v.angle}\n` +
    `- Variation key: ${v.nonce} (use fresh, non-canonical numbers; do NOT reuse the most common textbook example)`
  );
}

/**
 * Sanitize a client-supplied list of recently-shown question texts: keep strings,
 * trim, drop blanks/dupes, cap the count and per-item length (bounding both the
 * prompt cost and any injection surface — these are echoed into the prompt).
 */
export function sanitizeRecentQuestions(list, { maxItems = 5, maxLen = 240 } = {}) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  // Walk NEWEST-first (end of the array). When the caller sends more than maxItems we
  // must keep the most-recently-shown questions — those are the ones a fresh generation
  // is most likely to re-derive — NOT the oldest. Restore chronological order at the end.
  for (let i = list.length - 1; i >= 0 && out.length < maxItems; i--) {
    const q = list[i];
    if (typeof q !== "string") continue;
    const t = q.trim().slice(0, maxLen);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out.reverse();
}

// Render the avoid-list as prompt lines. Empty string when there's nothing to avoid.
export function avoidListText(recent) {
  const items = sanitizeRecentQuestions(recent);
  if (!items.length) return "";
  return (
    "Recent questions to AVOID repeating (make the new one substantively different — " +
    "change the numbers, the setup, and the framing; never reproduce or merely reword any of these):\n" +
    items.map((q, i) => `${i + 1}. ${q}`).join("\n")
  );
}
