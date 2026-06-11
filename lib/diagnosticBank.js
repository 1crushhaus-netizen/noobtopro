// ---------------------------------------------------------------------------
// CURATED ADAPTIVE DIAGNOSTIC BANK — the "Prove it" placement (RANKS_PLAN §8).
//
// The diagnostic is an ADAPTIVE, curated placement: each subject runs
// DIAG_STEPS_PER_SUBJECT graded steps, starting at the middle band and moving
// ±1 band per step by the SERVER-graded quality of the previous answer
// (nextDiagBand). Items come from this hand-curated bank — TWO reasoning-rich
// items per (subject, band) cell across ALL FIVE bands (a ±1 walk of 3 steps
// can face any band at most twice, so two per cell always suffices) — so the
// placement stays fully standardized (identical paths face identical items)
// and serving costs ZERO Groq (grading is the only model call per step).
// The PhD band is included so a flawless run can place near the top of the
// range even while the Doctorate practice tier stays WIP (owner decision).
//
// Every item demands EXPLAINED reasoning, not plug-and-chug; harder items carry
// a deliberate TRAP where the naive path is wrong. No solutions appear here
// (the grader solves each item itself). Item shape:
//   { id, subject, band, conceptKey, topic, topicSlug, targetConcept,
//     reasoningSurface, trap?, question }
//   - `id`         stable unique slug ("subject:band:n") — signed into the step
//                  token chain; the grader resolves everything by id.
//   - `band`       a lib/scoring.js difficulty band (BAND_LADDER).
//   - `conceptKey` the lib/curriculum.js concept the item evidences (mastery
//                  coloring §12.1); PhD-band items map to the hardest existing
//                  university-rank concept (doctorate cells are WIP).
// Items live in lib/diagnosticItems/{math,physics,chemistry}.js (one file per
// subject); test/diagnostic-bank.test.js pins the 2-per-cell coverage + shape.
// ---------------------------------------------------------------------------

import { MATH_DIAGNOSTIC_ITEMS } from "@/lib/diagnosticItems/math";
import { PHYSICS_DIAGNOSTIC_ITEMS } from "@/lib/diagnosticItems/physics";
import { CHEMISTRY_DIAGNOSTIC_ITEMS } from "@/lib/diagnosticItems/chemistry";
import { BAND_LADDER } from "@/lib/curriculum";

// §8 decisions (owner, 2026-06-11): 3 steps per subject (down from 4 — a 9-step
// sitting eases the rate-limit pressure of 12 graded rounds while a ±1 walk from
// the middle still reaches either extreme); start at the middle band; quality ≥
// the threshold moves one band up, below moves one band down.
export const DIAG_STEPS_PER_SUBJECT = 3;
export const DIAG_START_BAND = "intermediate";
export const DIAG_STEP_UP_QUALITY = 55;

export const DIAGNOSTIC_BANK = [
  ...MATH_DIAGNOSTIC_ITEMS,
  ...PHYSICS_DIAGNOSTIC_ITEMS,
  ...CHEMISTRY_DIAGNOSTIC_ITEMS,
];

const BY_ID = new Map(DIAGNOSTIC_BANK.map((q) => [q.id, q]));

// SERVER-SIDE source of truth for everything about a served item — the step
// token signs only the item ID; question text, band, reasoning surface/trap,
// and conceptKey are all resolved from HERE at grade time, so no client field
// can substitute an easier question, spoof the grader's calibration, or color
// arbitrary concepts. Unknown id → null.
export function diagnosticItemById(id) {
  return (typeof id === "string" && BY_ID.get(id)) || null;
}

// The next item for (subject, band), skipping already-asked ids. Deterministic
// (first unasked item in bank order) so identical paths face identical items —
// the standardization guarantee. Falls back to the cell's first item if all are
// asked (unreachable on a well-formed 3-step walk; two per cell suffice).
export function pickDiagnosticItem(subject, band, askedIds = []) {
  const asked = new Set(Array.isArray(askedIds) ? askedIds : []);
  const cell = DIAGNOSTIC_BANK.filter((q) => q.subject === subject && q.band === band);
  if (cell.length === 0) return null;
  return cell.find((q) => !asked.has(q.id)) || cell[0];
}

// The §8 ±1-band walk: graded quality at/above DIAG_STEP_UP_QUALITY moves one
// band up, below moves one band down — clamped to the ladder. Unknown bands
// re-center on the start band so a malformed state can't walk off the ladder.
export function nextDiagBand(band, quality) {
  const idx = BAND_LADDER.indexOf(band);
  const at = idx === -1 ? BAND_LADDER.indexOf(DIAG_START_BAND) : idx;
  const up = Number(quality) >= DIAG_STEP_UP_QUALITY;
  return BAND_LADDER[Math.max(0, Math.min(BAND_LADDER.length - 1, at + (up ? 1 : -1)))];
}
