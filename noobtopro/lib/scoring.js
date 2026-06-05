// Shared scoring logic and constants. Plain JS (no browser APIs) so it can be
// imported from both client components and server route handlers.

export const SUBJECTS = {
  math: { label: "Mathematics", glyph: "∑", color: "#F2B441" },
  physics: { label: "Physics", glyph: "∂", color: "#5BD6C4" },
  chemistry: { label: "Chemistry", glyph: "⌬", color: "#FF7E74" },
};

export const ORDER = ["math", "physics", "chemistry"];

export const RUBRIC_LABELS = {
  conceptual_understanding: "Conceptual grasp",
  logical_structure: "Logical structure",
  strategy: "Strategy",
  execution_accuracy: "Execution",
  communication: "Communication",
};

export const SCALE_NOTE =
  "0–20 absolute beginner, 20–40 foundational, 40–60 intermediate, 60–80 advanced, 80–100 PhD-level.";

// scores shape used across the app: { math: { score, weakConcepts, comment }, ... }

// Coerce any value (including model output that may be missing, a string, or
// out of range) to an integer in [0, 100]. Returns null when there is no usable
// number, so callers can distinguish "no signal" from a real zero.
export function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function band(s) {
  const n = clampScore(s) ?? 0;
  if (n < 20) return "Absolute beginner";
  if (n < 40) return "Foundational";
  if (n < 60) return "Intermediate";
  if (n < 80) return "Advanced";
  return "PhD-level";
}

// Damped update so a single attempt nudges the score rather than whipsawing it.
// A production build should replace this with an IRT / Elo-style model that
// accounts for question difficulty and uncertainty.
export function blend(prev, suggestion) {
  const sug = clampScore(suggestion);
  // A malformed/missing suggestion (e.g. the grader returned no number) must not
  // drag an existing score toward zero — keep the learner's current level.
  if (sug === null) return typeof prev === "number" ? prev : 0;
  if (typeof prev !== "number") return sug;
  return Math.max(0, Math.min(100, Math.round(prev * 0.65 + sug * 0.35)));
}

export function totalPoints(scores) {
  if (!scores) return 0;
  return ORDER.reduce((a, k) => a + (scores[k]?.score || 0), 0); // out of 300
}

// "PhD-level intelligence": overall progress toward PhD mastery across all
// three subjects, expressed 0–100 (the mean of the three subject scores).
export function phdIndex(scores) {
  if (!scores) return 0;
  return Math.round(totalPoints(scores) / ORDER.length);
}
