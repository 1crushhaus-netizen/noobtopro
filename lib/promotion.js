// ---------------------------------------------------------------------------
// CURRICULUM BREADTH GATE (RANKS_PLAN §7) — coverage-gated rank advancement.
//
// §7's rule: depth (the rating) alone cannot carry a learner into the next
// rank — they must first MASTER the current rank's concept set (mastered =
// GREEN under the §12.1 sustained-quality flag; "full set" per §7, see
// RANK_COVERAGE_REQUIRED). Because green is sticky and counters only grow
// (§12.1), coverage is monotonic — the gate can only ever open further.
//
// SCOPE (display-layer BY DECISION): this module is pure and feeds the UI
// (per-subject band chips, coverage nudges). It never touches the server-
// authoritative rating path — §11.3 was RESOLVED as Option B (owner decision,
// 2026-06-11): the score is never capped, the rank LABEL alone carries the
// gate. §11.5 likewise resolved: no grandfathering — every account's label
// climbs from zero coverage while its score keeps its value.
//
// The five display ranks (lib/scoring.js RANKS, one per 20-point score band)
// map 1:1 onto the five curriculum ranks (lib/curriculum.js RANKS) — same
// alignment RANK_TO_BAND pins. To HOLD display rank i, every curriculum rank
// BELOW i that has concepts must be fully covered; an empty rank (doctorate,
// WIP) never blocks.
// ---------------------------------------------------------------------------

import { RANKS as CURRICULUM_RANKS, RANK_LABELS, conceptsFor } from "@/lib/curriculum";
import { conceptState } from "@/lib/mastery";
import { rankFor, RANKS as DISPLAY_RANKS, ORDER, clampSubjectScore } from "@/lib/scoring";

// §7: "mastered the current rank's FULL concept set" — the 100% bar was confirmed
// by the owner (2026-06-11). A single named knob so pacing can be retuned later
// without touching the gate logic.
export const RANK_COVERAGE_REQUIRED = 1;

// Coverage of one (subject, curriculum-rank) cell against the learner's mastery
// map: { rank, rankLabel, mastered, total, complete, missing: [{ key, label }] }.
// Only GREEN counts as covered (§12.1); an empty/WIP cell (total 0) is complete.
export function rankCoverage(mastery, subject, rank) {
  const concepts = conceptsFor(subject, rank);
  const missing = [];
  let mastered = 0;
  for (const c of concepts) {
    if (conceptState(mastery, subject, c.key) === "green") mastered++;
    else missing.push({ key: c.key, label: c.label });
  }
  const total = concepts.length;
  return {
    rank,
    rankLabel: RANK_LABELS[rank] || rank,
    mastered,
    total,
    complete: total === 0 || mastered / total >= RANK_COVERAGE_REQUIRED,
    missing,
  };
}

// The gated display rank for one subject:
//   rank     — the rank to DISPLAY ({ name, index }): the score-derived rank,
//              walked back to the highest index whose lower curricula are covered.
//   ungated  — the pure score-derived rank (what depth alone would show).
//   gated    — true when coverage is holding the label below the score rank.
//   next     — the BINDING coverage cell: the one to master next (the blocking
//              cell when gated, else the current rank's own cell — what stands
//              between the learner and the rank above). null at the top.
export function gatedRankFor(score, mastery, subject) {
  const ungated = rankFor(score);
  let allowed = 0;
  let blocking = null;
  for (let i = 0; i < ungated.index; i++) {
    const cov = rankCoverage(mastery, subject, CURRICULUM_RANKS[i]);
    if (!cov.complete) {
      blocking = cov;
      break;
    }
    allowed = i + 1;
  }
  if (!blocking) allowed = ungated.index;
  const next =
    blocking ||
    (allowed < CURRICULUM_RANKS.length - 1 ? rankCoverage(mastery, subject, CURRICULUM_RANKS[allowed]) : null);
  return {
    rank: { name: DISPLAY_RANKS[allowed], index: allowed },
    ungated,
    gated: allowed < ungated.index,
    next,
  };
}

// ---------------------------------------------------------------------------
// MASTERY-BLENDED SUBJECT SCORE (owner decision 2026-06-17, "Blend depth × coverage").
//
// The §11.3 Option-B model kept the score a PURE depth aggregate and only gated the
// rank LABEL, which let a learner sit at a high number with zero mastered concepts —
// no correlation between "concepts mastered" and the displayed rank. This layer makes
// that correlation the headline: the DISPLAYED subject score is the depth score scaled
// by how much of the curriculum the learner has actually mastered:
//
//   effective = round(depthScore × coverageFraction)
//   coverageFraction = (# GREEN concepts) / (# curriculum concepts), across all
//                      populated ranks of the subject.
//
// Properties: 0 mastered → 0 (the user's complaint); every concept mastered → the full
// reasoning depth counts (fraction 1); each newly-mastered concept raises the number
// (mastery is "the one moving you up the ranks"); and for a FIXED coverage, stronger
// reasoning still earns (depth rises). It is SMOOTHER than a hard cap — un-mastered
// breadth scales the number down rather than clipping it.
//
// This is a pure DISPLAY derivation: the stored scores.score stays the depth aggregate
// (the Glicko engine, anti-farm, leaderboard binning, and item calibration all keep
// operating on real depth) and `depthScore` is always recoverable. Green is sticky
// (§11.6), so coverageFraction — and therefore the blended score — is monotonic.
// ---------------------------------------------------------------------------

// Green vs. total curriculum concepts for a subject (across every populated rank;
// empty/WIP ranks like doctorate contribute nothing). Pure + prototype-safe.
export function masteryCounts(mastery, subject) {
  let green = 0;
  let total = 0;
  for (const rank of CURRICULUM_RANKS) {
    for (const c of conceptsFor(subject, rank)) {
      total++;
      if (conceptState(mastery, subject, c.key) === "green") green++;
    }
  }
  return { green, total };
}

// Fraction of the subject's curriculum the learner has MASTERED (green), in [0,1].
// A subject with no concepts (shouldn't happen) returns 1 so it is never penalized.
export function coverageFraction(mastery, subject) {
  const { green, total } = masteryCounts(mastery, subject);
  return total > 0 ? green / total : 1;
}

// The displayed subject score: the depth score scaled by mastery coverage. Integer
// in [0, SCORE_MAX]. clampSubjectScore coerces a garbage/guest-edited depth safely.
export function effectiveSubjectScore(depthScore, mastery, subject) {
  const depth = clampSubjectScore(depthScore) ?? 0;
  return Math.round(depth * coverageFraction(mastery, subject));
}

// Map a raw (depth) scores object → the same shape with each subject's `.score`
// replaced by its mastery-blended value, so the existing aggregate consumers
// (phdIndex/totalPoints/rankFor) reflect mastery with no change to those helpers.
// Every other field (rubric, weakConcepts, glicko, comment) is carried through
// untouched — the radar/reasoning profile is about quality, not coverage.
export function effectiveScores(scores, mastery) {
  const out = {};
  for (const k of ORDER) {
    const s = scores && typeof scores === "object" ? scores[k] : null;
    const depth = s && typeof s === "object" ? clampSubjectScore(s.score) ?? 0 : 0;
    out[k] = { ...(s && typeof s === "object" ? s : {}), score: effectiveSubjectScore(depth, mastery, k) };
  }
  return out;
}

// Everything the per-subject rank chip needs in one shot: the blended `effective`
// score (the headline), the underlying `depth` (surfaced so the learner sees their
// reasoning IS recognized — it just converts to rank through mastery), the green/total
// coverage counts, the resulting rank, and whether the curriculum is fully mastered.
export function subjectRankView(depthScore, mastery, subject) {
  const depth = clampSubjectScore(depthScore) ?? 0;
  const { green, total } = masteryCounts(mastery, subject);
  const frac = total > 0 ? green / total : 1;
  const effective = Math.round(depth * frac);
  return {
    depth,
    effective,
    green,
    total,
    remaining: Math.max(0, total - green),
    rank: rankFor(effective),
    fullyMastered: total > 0 && green >= total,
  };
}

// Pick the curriculum concept a generic "Practice <subject>" click should target, so
// every practice attempt accrues mastery (closing the tagging gap: untagged practice
// never colored a concept). Deterministic (first not-yet-green concept), searching
// OUTWARD from the learner's level — their own band first (so difficulty stays natural),
// then lower ranks (backfill the basics), then higher — and finally, when the whole
// curriculum is green, any concept at their band (depth upkeep). Returns the concept
// shape startConceptDrill/the generate drill path expect, or null when the subject has
// no concepts. Pure (no randomness) so the route is stable + unit-testable.
export function pickPracticeConcept(mastery, subject, depthScore) {
  const at = rankFor(clampSubjectScore(depthScore) ?? 0).index;
  // Search order: band rank, then down to 0, then up to the top.
  const order = [at];
  for (let d = 1; d < CURRICULUM_RANKS.length; d++) {
    if (at - d >= 0) order.push(at - d);
    if (at + d < CURRICULUM_RANKS.length) order.push(at + d);
  }
  const make = (c, rank) => ({
    subject,
    key: c.key,
    label: c.label,
    rank,
    strand: c.strand || "core",
    masteryState: conceptState(mastery, subject, c.key),
  });
  for (const i of order) {
    const rank = CURRICULUM_RANKS[i];
    for (const c of conceptsFor(subject, rank)) {
      if (conceptState(mastery, subject, c.key) !== "green") return make(c, rank);
    }
  }
  // Fully mastered (or nothing below the fallback): re-drill at the band rank, else
  // the first populated rank, to keep practicing once coverage is complete.
  for (const i of [at, ...order]) {
    const rank = CURRICULUM_RANKS[i];
    const concepts = conceptsFor(subject, rank);
    if (concepts.length) return make(concepts[0], rank);
  }
  return null;
}
