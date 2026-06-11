// ---------------------------------------------------------------------------
// CURRICULUM BREADTH GATE (RANKS_PLAN §7) — coverage-gated rank advancement.
//
// §7's rule: depth (the rating) alone cannot carry a learner into the next
// rank — they must first MASTER the current rank's concept set (mastered =
// GREEN under the §12.1 sustained-quality flag; "full set" per §7, see
// RANK_COVERAGE_REQUIRED). Because green is sticky and counters only grow
// (§12.1), coverage is monotonic — the gate can only ever open further.
//
// SCOPE (v1 — deliberately display-layer only): this module is pure and feeds
// the UI (per-subject band chips, coverage nudges). It does NOT touch the
// server-authoritative rating path — the §11.3 decision (soft-cap the score at
// the rank ceiling vs. uncapped score with a gated label) and §11.5
// (grandfathering existing users) are still OPEN; v1 ships the Option-B-shaped
// gated *label* because it is reversible and rating-neutral either way.
//
// The five display ranks (lib/scoring.js RANKS, one per 20-point score band)
// map 1:1 onto the five curriculum ranks (lib/curriculum.js RANKS) — same
// alignment RANK_TO_BAND pins. To HOLD display rank i, every curriculum rank
// BELOW i that has concepts must be fully covered; an empty rank (doctorate,
// WIP) never blocks.
// ---------------------------------------------------------------------------

import { RANKS as CURRICULUM_RANKS, RANK_LABELS, conceptsFor } from "@/lib/curriculum";
import { conceptState } from "@/lib/mastery";
import { rankFor, RANKS as DISPLAY_RANKS } from "@/lib/scoring";

// §7: "mastered the current rank's FULL concept set". A single named knob so the
// §11.3/§11.5 consult can soften it (e.g. 0.8) without touching the gate logic.
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
