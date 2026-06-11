// Shared scoring logic and constants. Plain JS (no browser APIs) so it can be
// imported from both client components and server route handlers.

// The subject palette. These hexes MIRROR the CSS tokens --math/--phys/--chem in
// app/globals.css (keep them in sync). They stay literal here — not var(--math) — because
// they feed SVG presentation attributes (Ring/RadarChart strokes), where CSS custom
// properties do NOT resolve. SUBJECTS is the single source for JS/SVG color; :root is the
// single source for CSS. Components must read this rather than re-typing subject hexes.
// Greyscale design system: these are the ONLY chromatic accents, desaturated mid-tones
// chosen to hold ≥3:1 contrast on BOTH the true-black dark theme and the white light
// theme (the same value serves both, which is what keeps SVG and CSS in sync).
export const SUBJECTS = {
  math: { label: "Mathematics", glyph: "∑", color: "#97804d" },
  physics: { label: "Physics", glyph: "∂", color: "#56897e" },
  chemistry: { label: "Chemistry", glyph: "⌬", color: "#9d685e" },
};

export const ORDER = ["math", "physics", "chemistry"];

// The chain-link reasoning axes, in display order: the links of the reasoning chain
// (givens → principle → justify → strategy → logic → method → compute → verify →
// communicate). Each axis carries ONE error TYPE, and the per-axis WEIGHT below
// realizes the process-first ordering "conceptual ≫ strategic ≈ reasoning ≫ slip ≫
// communication": the error TYPE decides which axis it docks; the axis WEIGHT decides
// how much it costs. Crucially `execution_method` (right operations, correctly ordered)
// is split from `computation` (are the numbers right) so a clean arithmetic slip costs
// almost nothing while a broken inference costs heavily — even if the final answer is
// right. Units/sanity-checking is a first-class axis (`verification`).
export const RUBRIC_LABELS = {
  comprehension: "Comprehension",       // states the givens + the goal
  principle: "Principle",               // names the governing principle (conceptual)
  justification: "Justification",       // why THIS method applies (closes "power = force×time")
  strategy: "Strategy",                 // route choice (strategic)
  logic: "Logic",                       // valid connections; no inverted ratio / non-sequitur (reasoning)
  execution_method: "Method",           // right operations in the right order — NOT the numbers
  computation: "Computation",           // arithmetic / transcription only (the execution-SLIP axis)
  verification: "Verification",         // units carried + sanity-check performed
  communication: "Communication",       // clarity of expression
};

// Short labels for the dense radar spokes (full labels stay in the breakdown panel).
export const RUBRIC_SHORT = {
  comprehension: "Givens",
  principle: "Principle",
  justification: "Justify",
  strategy: "Strategy",
  logic: "Logic",
  execution_method: "Method",
  computation: "Compute",
  verification: "Verify",
  communication: "Clarity",
};

// The rubric axes in display order — the radar axes and the keys of every rubric the
// grader emits / we persist. Derived from RUBRIC_LABELS so there is ONE source of truth;
// exported so the grade/score routes (server) and the dashboard (client) never drift.
export const RUBRIC_KEYS = Object.keys(RUBRIC_LABELS);
// Each rubric axis is scored on a 0–4 scale (per PRACTICE_GRADE_SYS).
export const RUBRIC_MAX = 4;

// Per-axis weights for the TRANSPARENT headline score. Descending by the error taxonomy
// the app penalizes: conceptual (principle 5 + justification 4 = 9) ≫ strategic (3) ≈
// reasoning (logic 4) ≫ execution-slip (computation 1) ≫ communication (1); units/sanity
// (verification) rides at 3 on purpose (sanity-checking is a reasoning habit). The sum is
// 25, so with RUBRIC_MAX=4 the weighted sum maxes at 100 and scoreFromRubric === Σ(wᵢ·vᵢ)
// directly — each axis contributes weight×value POINTS that visibly add up to the headline
// (no hidden reconciliation slack). MUST stay keyed exactly to RUBRIC_KEYS (CI-asserted).
export const RUBRIC_WEIGHTS = {
  comprehension: 2,
  principle: 5,
  justification: 4,
  strategy: 3,
  logic: 4,
  execution_method: 2,
  computation: 1,
  verification: 3,
  communication: 1,
};
// Σ of the axis weights — the weighted-mean denominator. A positive constant (25).
export const RUBRIC_WEIGHT_SUM = RUBRIC_KEYS.reduce((a, k) => a + (RUBRIC_WEIGHTS[k] || 0), 0);

export const SCALE_NOTE =
  "0–69 Elementary, 70–139 Middle, 140–209 High, 210–279 University, 280–350 Doctorate.";

// THE 0–350 SUBJECT-SCORE SCALE (RANKS_PLAN §2–§3, shipped 2026-06-11): a subject
// score lives on 0–350 and maps 1:1 onto the five curriculum ranks (70 points per
// rank). Per-attempt QUALITY (the rubric's transparent weighted mean) stays 0–100
// (§4: weights sum 25 × axis max 4) — the two scales are linked by ×3.5 wherever a
// quality aggregate seeds a score (the diagnostic placement target).
export const SCORE_MAX = 350;

// scores shape used across the app: { math: { score, weakConcepts, comment }, ... }

// Coerce any value (including model output that may be missing, a string, or
// out of range) to an integer in [0, 100] — the per-attempt QUALITY scale (and
// the frozen legacy blend()/eloUpdate path). Returns null when there is no
// usable number, so callers can distinguish "no signal" from a real zero.
export function clampScore(value) {
  // Guard null/undefined/"" explicitly: Number(null) and Number("") are 0 (a
  // finite value), which would silently turn "no score" into a real zero and,
  // via blend(), drag an existing score down. Treat those as "no signal".
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// The SUBJECT-SCORE twin of clampScore: integer in [0, SCORE_MAX] or null. Every
// site that clamps a subject score / rank number (never a quality) uses this.
export function clampSubjectScore(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(SCORE_MAX, Math.round(n)));
}

export function band(s) {
  const n = clampSubjectScore(s) ?? 0;
  if (n < 70) return "Elementary";
  if (n < 140) return "Middle";
  if (n < 210) return "High";
  if (n < 280) return "University";
  return "Doctorate";
}

// Numeric anchor (band midpoint on the 0–350 scale) for each difficulty band
// emitted by the practice generator. Treated as the "question rating" on the
// same 0–350 subject scale, so we can tell whether an item sits above or below
// the learner's current level (the bands are documented in SCALE_NOTE above and
// in PRACTICE_GEN_SYS in lib/groq.js).
const DIFFICULTY_ANCHORS = {
  beginner: 35, // band 0–70 (Elementary-level items)
  foundational: 105, // band 70–140
  intermediate: 175, // band 140–210
  advanced: 245, // band 210–280
  phd: 315, // band 280–350
};

// Legacy damping factor: the old flat update was prev*0.65 + sug*0.35, i.e. a
// step of alpha=0.35 toward the suggestion. Kept as the natural anchor for the
// adaptive learning rate, and reproduced exactly on the two-arg / no-signal path.
const LEGACY_ALPHA = 0.35;
// Bounds on the weighted learning rate. ALPHA_MIN keeps a low-confidence attempt
// from being a complete no-op; ALPHA_MAX (<= 0.6) caps how far any single
// attempt can move the score, so nothing whipsaws.
const ALPHA_MIN = 0.05;
const ALPHA_MAX = 0.6;
// Logistic spread (in score points) of the Elo expected-outcome curve, using a
// base-10 logistic (expected = 1 / (1 + 10^((anchor - prev) / ELO_SCALE))). On the
// 0–350 scale a learner ~87.5 points above a question is expected to "win" ~91% of
// the time (the same probabilities as the old 25-point spread on 0–100 — the
// rescale is exactly linear ×3.5, so no expected-outcome behavior changed).
const ELO_SCALE = 87.5;

function clamp(x, lo, hi) {
  return x < lo ? lo : x > hi ? hi : x;
}

// Map a difficulty band string to its numeric anchor, tolerating case/whitespace.
// Returns null for an unknown/missing band so the weighted path can drop the
// difficulty term gracefully. hasOwnProperty (not bracket-truthiness) so inherited
// keys like "constructor"/"toString"/"__proto__" can never resolve to an anchor.
function difficultyAnchor(difficulty) {
  if (typeof difficulty !== "string") return null;
  const key = difficulty.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(DIFFICULTY_ANCHORS, key)
    ? DIFFICULTY_ANCHORS[key]
    : null;
}

/**
 * Damped, difficulty- and confidence-weighted subject-score update — an Elo-style
 * step toward an IRT/Elo model.
 *
 * Treat each attempt as a rated "match" between the learner (rating = prev) and the
 * question (rating = its difficulty anchor on the same subject-score scale). The grader's
 * `suggestion` sets the TARGET/direction; the move is new = prev + alpha*(sug-prev).
 * The learning rate `alpha` is the legacy anchor 0.35 scaled by two factors:
 *   - confMult: a confidence multiplier from reasoningScore — a blank/garbage
 *     attempt barely moves the score, an excellent one moves it more.
 *   - surpMult: an Elo surprise multiplier — the gap between the attempt's actual
 *     outcome (reasoningScore/100) and the outcome the Elo logistic EXPECTED given
 *     prev vs the question's anchor, ALIGNED to the suggested direction. Beating a
 *     HARD (above-level) item amplifies an upward move; acing an EASY one barely
 *     does; an outcome that CONTRADICTS the suggested direction damps alpha.
 * alpha is clamped to [ALPHA_MIN, ALPHA_MAX] so one attempt can never whipsaw the
 * score. Difficulty only ever shapes step SIZE, never direction, so it cannot
 * overshoot or flip the move (this also bounds the double-counting of the grader's
 * already difficulty-aware suggestion).
 *
 * `opts` is OPTIONAL. Called with two args — or with an `opts` lacking BOTH a
 * usable `difficulty` and a usable `reasoningScore` — blend reproduces the EXACT
 * legacy 65/35 update (the literal 0.65/0.35 expression, which can differ from the
 * alpha-reconstructed form by 1 in ~0.1% of integer pairs via half-rounding).
 *
 * Null-safety is preserved: a malformed/missing suggestion never drags an existing
 * score toward zero (returns prev, or 0 with no prev); a no-previous-score seeds
 * from the suggestion. Output is always an integer clamped to [0, 100] — never NaN,
 * even for a literal prev = NaN / out-of-range prev.
 *
 * @param {*} prev        Learner's current subject score (int 0-SCORE_MAX); non-number
 *                        means "no previous score" and seeds from the suggestion.
 * @param {*} suggestion  Grader's proposed new level (int 0-SCORE_MAX, may be null/garbage).
 * @param {{difficulty?: string, reasoningScore?: number}} [opts]
 *                        difficulty: band string (beginner|foundational|intermediate
 *                        |advanced|phd). reasoningScore: quality of THIS attempt,
 *                        int 0-100 quality (0 = blank/garbage, 100 = excellent).
 * @returns {number}      Integer in [0, 100].
 */
export function blend(prev, suggestion, opts) {
  const sug = clampSubjectScore(suggestion);
  // A malformed/missing suggestion (the grader returned no number) must not drag
  // an existing score toward zero — keep the learner's current level (clamped to a
  // clean int so a buggy/out-of-range/NaN prev never leaks through). 0 if no prev.
  if (sug === null) {
    return Number.isFinite(prev) ? clamp(Math.round(prev), 0, SCORE_MAX) : 0;
  }
  // Coerce a numeric-STRING prev (defensive — shouldn't occur in prod) so it is
  // still damped rather than overwritten; any other non-number (null/""/garbage)
  // means "no previous score" and seeds directly from the suggestion.
  let prevNum = prev;
  if (typeof prev === "string" && prev.trim() !== "" && Number.isFinite(Number(prev))) {
    prevNum = Number(prev);
  }
  if (typeof prevNum !== "number") return sug;

  // Defensive: prev is a number but may be out of range / NaN-ish from upstream.
  // Clamp ONCE here so every path below (legacy and weighted) operates on a clean
  // int in [0,SCORE_MAX] and can never produce NaN.
  const p = Number.isFinite(prevNum) ? clamp(Math.round(prevNum), 0, SCORE_MAX) : 0;

  // Read the optional signals (both null on no-signal). reasoningScore reuses
  // clampScore, so out-of-range/garbage degrades safely (200->100, NaN/null->null).
  const reasoning = clampScore(opts ? opts.reasoningScore : undefined);
  const anchor = difficultyAnchor(opts ? opts.difficulty : undefined);

  // --- Legacy fallback: no usable signal at all -> EXACT 65/35 behavior. ---
  // Literal 0.65/0.35 expression (not the alpha-reconstructed form) for bit-
  // identical rounding with the original placeholder.
  if (reasoning === null && anchor === null) {
    return clamp(Math.round(p * 0.65 + sug * 0.35), 0, SCORE_MAX);
  }

  // --- Weighted (Elo-style surprise) path ---

  // Match outcome in [0,1]. Absent reasoningScore => neutral 0.5 so a difficulty
  // signal alone still yields a sensible (non-degenerate) surprise.
  const outcome = reasoning === null ? 0.5 : reasoning / 100;

  // Confidence multiplier in [0.4, 1.3], = 1.0 when reasoningScore is absent:
  // a blank attempt (reasoning 0) -> 0.4 (barely moves); an excellent one
  // (reasoning 100) -> 1.3 (moves more). The 0.4 floor keeps low-quality attempts
  // from freezing the score entirely.
  const confMult = reasoning === null ? 1.0 : 0.4 + 0.9 * (reasoning / 100);

  // Elo surprise: actual outcome minus the outcome EXPECTED from prev vs the
  // question's anchor. With no anchor there is no surprise component.
  let surprise = 0;
  if (anchor !== null) {
    const expected = 1 / (1 + Math.pow(10, (anchor - p) / ELO_SCALE)); // (0,1)
    surprise = outcome - expected; // in (-1, 1)
  }

  // Align the surprise with the direction the suggestion wants to move the score:
  // aligned > 0 means the surprise SUPPORTS the proposed move (e.g. beating a hard
  // question while the suggestion pushes up); aligned < 0 means the outcome
  // CONTRADICTS the move and damps alpha. dir 0 (sug == p) => no move.
  const dir = Math.sign(sug - p);
  const aligned = dir === 0 ? 0 : surprise * dir; // in (-1, 1)

  // Surprise multiplier in [0.3, 1.7], = 1.0 at zero surprise.
  const surpMult = 1 + 0.7 * aligned;

  // Final learning rate, anchored at LEGACY_ALPHA and bounded so no single attempt
  // whipsaws the score.
  const alpha = clamp(LEGACY_ALPHA * confMult * surpMult, ALPHA_MIN, ALPHA_MAX);

  return clamp(Math.round(p + alpha * (sug - p)), 0, SCORE_MAX);
}

export function totalPoints(scores) {
  if (!scores) return 0;
  // Coerce each subject score via clampSubjectScore (same path as band()) so a
  // string/float/NaN from a hand-edited guest localStorage blob can't string-
  // concatenate or carry a non-integer into the sum. Null ("no signal")
  // contributes 0.
  return ORDER.reduce((a, k) => a + (clampSubjectScore(scores[k]?.score) ?? 0), 0); // out of 1050
}

// "Doctorate index": overall progress toward Doctorate mastery across all
// three subjects, expressed 0–350 (the mean of the three subject scores).
export function phdIndex(scores) {
  if (!scores) return 0;
  return Math.round(totalPoints(scores) / ORDER.length);
}

// ---------------------------------------------------------------------------
// 3-tier diagnostic ("Prove it"): each subject asks a BEGINNER, an INTERMEDIATE, and a
// HARD question (9 total — 3 subjects × 3 levels), probing each subject at three depths
// for a finer placement. Questions come from the curated bank (lib/diagnosticBank.js) —
// no Groq generation. UI shows the friendly DIFFICULTY_LABELS; the band string is what
// the grader/anchor logic understands. diagnosticSubjectScore/Rubric weight by the
// difficulty anchors (beginner 10 / intermediate 50 / advanced 70), so points are
// proportional to difficulty and a missing/skipped tier contributes 0.
// ---------------------------------------------------------------------------
export const DIAGNOSTIC_DIFFICULTIES = ["beginner", "intermediate", "advanced"];
export const DIFFICULTY_LABELS = { beginner: "Beginner", foundational: "Easy", intermediate: "Intermediate", advanced: "Hard", phd: "PhD" };

// Sum of the difficulty anchors across the diagnostic tiers (beginner 10 + intermediate
// 50 + advanced 70 = 130). diagnosticSubjectScore divides by AT LEAST this, so a MISSING
// or SKIPPED tier contributes 0 instead of being silently dropped (see the function below).
const DIAGNOSTIC_FULL_WEIGHT = DIAGNOSTIC_DIFFICULTIES.reduce((a, d) => a + (difficultyAnchor(d) ?? 0), 0);

/**
 * Combine a subject's diagnostic answers into a difficulty-weighted QUALITY aggregate (0–100
 * score, with points PROPORTIONAL TO DIFFICULTY: each question's reasoning score
 * scale) — each answer is weighted by its difficulty anchor (relative ratios only),
 * so a strong answer on the hard question counts for more than the same on the easy
 * one. Acing both → ~100; acing only the easy one → ~30. This is the BASELINE (no
 * blend()).
 *
 * ANTI-GAMING: the divisor is floored at the FULL expected tier weight
 * (DIAGNOSTIC_FULL_WEIGHT), so a MISSING tier counts as 0 rather than cancelling out.
 * Without that floor a single aced easy answer would score 100 (30·100/30) — letting a
 * client inflate a baseline to PhD rank by submitting only the easy tier, and
 * over-crediting a transient hard-tier grading failure. A richer-than-expected
 * submission (extra/unknown tiers, totalWeight > full) stays a plain weighted mean.
 *
 * @param {{difficulty:string, reasoningScore:*}[]} perQuestion
 * @returns {number} integer in [0,100]
 */
export function diagnosticSubjectScore(perQuestion) {
  if (!Array.isArray(perQuestion) || perQuestion.length === 0) return 0;
  let weighted = 0;
  let totalWeight = 0;
  for (const q of perQuestion) {
    // Unknown/missing difficulty falls back to the intermediate anchor so a
    // malformed band still contributes sensibly rather than being dropped.
    const w = difficultyAnchor(q && q.difficulty) ?? DIFFICULTY_ANCHORS.intermediate;
    const v = clampScore(q && q.reasoningScore) ?? 0;
    weighted += w * v;
    totalWeight += w;
  }
  if (totalWeight <= 0) return 0;
  const denom = Math.max(totalWeight, DIAGNOSTIC_FULL_WEIGHT);
  return clamp(Math.round(weighted / denom), 0, 100);
}

/**
 * Path-weighted aggregate for the ADAPTIVE diagnostic (RANKS_PLAN §8): the plain
 * difficulty-weighted mean over the bands the walk actually faced — NO full-weight
 * floor. The floor in diagnosticSubjectScore guards a CLIENT-CHOSEN submission
 * ("send only the aced easy tier"); the adaptive walk's bands are chosen by the
 * SERVER and carried in the signed step-token chain (every step is graded or
 * docked, none can be dropped), so the inflation that floor prevents cannot
 * arise — while flooring here at a fixed band-set would wrongly punish the
 * legitimately-descending path (weak answers walk DOWN to low-anchor bands).
 * Acing a descending path still scores low: the early high-band failures carry
 * the largest weights in the same mean.
 *
 * @param {{difficulty:string, reasoningScore:*}[]} perQuestion
 * @returns {number} integer in [0,100]
 */
export function diagnosticPathScore(perQuestion) {
  if (!Array.isArray(perQuestion) || perQuestion.length === 0) return 0;
  let weighted = 0;
  let totalWeight = 0;
  for (const q of perQuestion) {
    const w = difficultyAnchor(q && q.difficulty) ?? DIFFICULTY_ANCHORS.intermediate;
    const v = clampScore(q && q.reasoningScore) ?? 0;
    weighted += w * v;
    totalWeight += w;
  }
  if (totalWeight <= 0) return 0;
  return clamp(Math.round(weighted / totalWeight), 0, 100);
}

// ---------------------------------------------------------------------------
// Per-subject reasoning rubric (the 5 dimensions, 0–4 each). Powers the radar
// chart and the "what to work on" guidance. These are PURE (no I/O), so the
// server route computes them exactly like the client would.
// ---------------------------------------------------------------------------

// Old (pre-redesign) 5-axis rubric keys → the new axis they map onto, so a stored
// LEGACY rubric (in scores.rubric / attempt_reviews.rubric — opaque jsonb, no migration)
// still renders and blends after the redesign. The 3 axes the old rubric never had are
// derived from the closest old signal (below) so a legacy radar profile stays plausible
// rather than cratering three spokes to 0 the day this ships.
const LEGACY_RUBRIC_MAP = {
  conceptual_understanding: "principle",
  logical_structure: "logic",
  strategy: "strategy",
  execution_accuracy: "execution_method",
  communication: "communication",
};

// Shared coercion to a complete object over RUBRIC_KEYS. Handles a NEW 9-axis rubric, a
// LEGACY 5-axis rubric (mapped + derived), or garbage (→ 0s). `round` true → integer axes
// (per-attempt bars); false → floats (stored radar resolution). Prototype-safe: only reads
// own RUBRIC_KEYS / LEGACY keys, never inherited props.
function coerceRubric(rubric, round) {
  const src = rubric && typeof rubric === "object" ? rubric : {};
  const fix = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return null;
    return round ? clamp(Math.round(v), 0, RUBRIC_MAX) : clamp(v, 0, RUBRIC_MAX);
  };
  // Legacy = has at least one OLD key and NO new-only key (so a half-migrated blob,
  // which shouldn't occur, is treated as new-shape and reads its new keys directly).
  const isLegacy =
    Object.keys(LEGACY_RUBRIC_MAP).some((k) => Object.prototype.hasOwnProperty.call(src, k)) &&
    !RUBRIC_KEYS.some((k) => Object.prototype.hasOwnProperty.call(src, k) && !(k in LEGACY_RUBRIC_MAP));
  const mapped = {};
  if (isLegacy) {
    for (const [oldK, newK] of Object.entries(LEGACY_RUBRIC_MAP)) {
      const v = fix(src[oldK]);
      if (v != null) mapped[newK] = v;
    }
    // Derive the new-only axes from the nearest old signal:
    //   justification ← conceptual_understanding (it WAS bundled into "concept grasp")
    //   computation   ← execution_accuracy (the number-slip half of the old conflation)
    //   verification  ← mean(logical_structure, execution_accuracy), the closest proxy
    //   comprehension has no old analog → defaults to 0 below (no evidence).
    const cu = fix(src.conceptual_understanding);
    const ea = fix(src.execution_accuracy);
    const ls = fix(src.logical_structure);
    if (cu != null) mapped.justification = cu;
    if (ea != null) mapped.computation = ea;
    if (ls != null || ea != null) {
      const vv = ((ls || 0) + (ea || 0)) / 2;
      mapped.verification = round ? clamp(Math.round(vv), 0, RUBRIC_MAX) : clamp(vv, 0, RUBRIC_MAX);
    }
  }
  const out = {};
  for (const k of RUBRIC_KEYS) {
    const v = mapped[k] != null ? mapped[k] : fix(src[k]);
    out[k] = v != null ? v : 0;
  }
  return out;
}

// Coerce a model/stored rubric into a complete object over RUBRIC_KEYS, each an INTEGER
// in [0, RUBRIC_MAX]; missing/garbage axes default to 0; legacy 5-axis rubrics are mapped.
// Used for the per-ATTEMPT rubric (rendered as 0–4 segment bars) — every bar gets a clean
// integer and malformed model output can't show NaN. normalizeRubric(null) → all zeros
// (the dock relies on this for an all-zero rubric → score 0).
export function normalizeRubric(rubric) {
  return coerceRubric(rubric, true);
}

// Float-preserving variant (no rounding) — used where stored radar RESOLUTION matters
// (blendRubric's EWMA, diagnosticSubjectRubric) so repeated blends don't degrade to ints.
export function normalizeRubricFloat(rubric) {
  return coerceRubric(rubric, false);
}

// Difficulty-weighted per-subject rubric from a subject's diagnostic answers —
// the rubric analogue of diagnosticSubjectScore. Each question contributes its
// rubric weighted by the question's difficulty anchor (foundational 30 /
// intermediate 50 / advanced 70 ≈ 3:5:7). Values are kept as FLOATS in [0,
// RUBRIC_MAX] (not rounded) so the profile has resolution and small changes from
// later practice (see blendRubric) aren't swallowed by integer rounding. Returns
// null when there is nothing to aggregate, so a subject with no graded answers
// simply has no profile (and the radar skips it).
export function diagnosticSubjectRubric(perQuestion) {
  if (!Array.isArray(perQuestion) || perQuestion.length === 0) return null;
  const sums = {};
  for (const k of RUBRIC_KEYS) sums[k] = 0;
  let totalWeight = 0;
  for (const q of perQuestion) {
    const w = difficultyAnchor(q && q.difficulty) ?? DIFFICULTY_ANCHORS.intermediate;
    const r = normalizeRubric(q && q.rubric);
    for (const k of RUBRIC_KEYS) sums[k] += w * r[k];
    totalWeight += w;
  }
  if (totalWeight <= 0) return null;
  const out = {};
  for (const k of RUBRIC_KEYS) out[k] = clamp(sums[k] / totalWeight, 0, RUBRIC_MAX);
  return out;
}

// Damped (EWMA) update of a subject's stored rubric toward this attempt's rubric,
// mirroring blend()'s philosophy for the score: a single attempt nudges the profile
// rather than replacing it, so the radar evolves smoothly as the learner practices.
// `prev` is the stored float rubric (or null/garbage for a fresh subject → seed from
// the attempt). `next` is the attempt rubric (normalized to ints internally). Output
// is a complete float rubric over RUBRIC_KEYS, clamped to [0, RUBRIC_MAX].
export function blendRubric(prev, next, alpha = 0.35) {
  const target = normalizeRubric(next);
  if (!prev || typeof prev !== "object") return { ...target };
  // Coerce prev through the FLOAT-preserving legacy mapping so a stored 5-axis profile
  // migrates onto the new axes (and keeps its resolution) instead of seeding from zero.
  const base = normalizeRubricFloat(prev);
  const a = clamp(Number.isFinite(Number(alpha)) ? Number(alpha) : 0.35, 0, 1);
  const out = {};
  for (const k of RUBRIC_KEYS) {
    out[k] = clamp(base[k] + a * (target[k] - base[k]), 0, RUBRIC_MAX);
  }
  return out;
}

// The n lowest-scoring rubric dimension KEYS (ties broken by RUBRIC_KEYS order) —
// the learner's weakest reasoning dimensions, used to phrase "what to work on".
// Returns [] for a missing/empty rubric.
export function lowestRubricDimensions(rubric, n = 1) {
  if (!rubric || typeof rubric !== "object") return [];
  const entries = RUBRIC_KEYS
    .map((k, i) => ({ key: k, i, value: Number(rubric[k]) }))
    .filter((e) => Number.isFinite(e.value));
  if (entries.length === 0) return [];
  entries.sort((a, b) => a.value - b.value || a.i - b.i);
  return entries.slice(0, Math.max(1, n)).map((e) => e.key);
}

// ---------------------------------------------------------------------------
// ITEM-AS-OPPONENT ELO (the rating engine).
//
// The question is the rated OPPONENT. Per-subject rating AND the item's difficulty
// both live on the same 0–350 subject-score scale (reusing the bands + all UI). Each practice
// attempt is a "match":
//   expected = 1 / (1 + 10^((difficulty − rating) / ELO_SCALE))     // P(learner wins)
//   outcome  = gradedReasoning / 100  ∈ [0,1]                       // how they did
//   rating      += K · (outcome − expected)                        // learner moves
//   difficulty  −= k · (outcome − expected)   (k ≪ K)              // item self-calibrates
// A low outcome on an at-level item therefore LOSES rating — the update is
// NON-ADDITIVE by construction (the anti-gaming property `blend()` couldn't give,
// since it only ever moved toward the grader's suggested score). The item difficulty
// is persisted per (subject, topic, band) bucket and drifts toward what the user
// POPULATION actually scores on it ("adjusts based on the users"). K shrinks as the
// learner accrues attempts (provisional → stable) so early estimates move fast and a
// settled rating doesn't whipsaw. These are PURE so /api/score computes them exactly
// as a client would; persistence (the bucket table) lives in the route + db/schema.sql.
// ---------------------------------------------------------------------------

// Rating learning rate K: high while provisional (few attempts), decaying smoothly to
// a stable floor. PROVISIONAL_N is the attempt count at which K sits halfway between
// the two — at attemptCount 0 → 24, ~6 → 17, ~18 → ~13.5, →∞ → 10.
export const ELO_K_PROVISIONAL = 24;
export const ELO_K_STABLE = 10;
export const ELO_PROVISIONAL_N = 6;
// Item-difficulty learning rate k — much smaller than K so an item's difficulty
// drifts slowly (one learner barely nudges it; the population calibrates it over time).
export const ELO_K_DIFFICULTY = 4;

// Expected score (probability the learner "beats" the item) on the base-10 logistic.
// Defensive: non-finite inputs → a neutral 0.5 rather than NaN.
export function eloExpected(rating, difficulty) {
  const r = Number(rating);
  const d = Number(difficulty);
  if (!Number.isFinite(r) || !Number.isFinite(d)) return 0.5;
  return 1 / (1 + Math.pow(10, (clamp(d, 0, SCORE_MAX) - clamp(r, 0, SCORE_MAX)) / ELO_SCALE));
}

// K for a learner with `attemptCount` prior attempts (in this subject). Monotonic
// decreasing from ELO_K_PROVISIONAL toward ELO_K_STABLE.
export function eloK(attemptCount) {
  const a = Number.isFinite(Number(attemptCount)) ? Math.max(0, Math.floor(Number(attemptCount))) : 0;
  return ELO_K_STABLE + (ELO_K_PROVISIONAL - ELO_K_STABLE) * (ELO_PROVISIONAL_N / (ELO_PROVISIONAL_N + a));
}

// Default difficulty for a band when an item bucket has no calibrated value yet —
// the band midpoint anchor (beginner 35 … phd 315), intermediate (175) if unknown.
export function defaultDifficultyForBand(band) {
  return difficultyAnchor(band) ?? DIFFICULTY_ANCHORS.intermediate;
}

/**
 * One Elo "match": update the learner's rating AND the item's difficulty.
 *
 * @param {{rating:*, difficulty:*, outcome:number, attemptCount?:number}} args
 *   rating: learner's current subject rating (non-number → seed from 0; Elo's low
 *           expected at rating 0 means a strong first answer still lifts sensibly).
 *   difficulty: the item's current difficulty (non-number → defaults to 175).
 *   outcome: graded reasoning quality in [0,1] (clamped). This is the ONLY driver of
 *           direction — a low outcome moves the rating DOWN even on an easy item.
 *   attemptCount: learner's prior attempts (sets K via eloK).
 * @returns {{newRating:number, newDifficulty:number, diffDelta:number,
 *            expected:number, k:number}}
 *   newRating/newDifficulty are clamped to [0,SCORE_MAX] (rating is an int; difficulty is
 *   kept as a float for calibration resolution). diffDelta is the raw difficulty
 *   change so the route can apply it as an atomic SQL increment on the bucket.
 */
export function eloUpdate({ rating, difficulty, outcome, attemptCount } = {}) {
  const r = Number.isFinite(Number(rating)) ? clamp(Math.round(Number(rating)), 0, SCORE_MAX) : 0;
  const d = Number.isFinite(Number(difficulty)) ? clamp(Number(difficulty), 0, SCORE_MAX) : DIFFICULTY_ANCHORS.intermediate;
  const o = Number.isFinite(Number(outcome)) ? clamp(Number(outcome), 0, 1) : 0.5;
  const expected = eloExpected(r, d);
  const k = eloK(attemptCount);
  const surprise = o - expected; // in (-1, 1)
  const newRating = clamp(Math.round(r + k * surprise), 0, SCORE_MAX);
  const diffDelta = -ELO_K_DIFFICULTY * surprise; // item easier than rated if learner over-performs
  const newDifficulty = clamp(d + diffDelta, 0, SCORE_MAX);
  return { newRating, newDifficulty, diffDelta, expected, k };
}

// ===========================================================================
// UNIFIED GLICKO-2 RATING ENGINE (the source of truth for ALL ratings).
//
// Each of the 9 reasoning axes (per subject) is a Glicko-2 rating; the QUESTION is
// the rated opponent (its difficulty is its rating, on the same 0–350 scale → Glicko
// space). Per attempt, each axis updates against the question difficulty with the
// axis's rubric value (/RUBRIC_MAX) as the match outcome. The DERIVED subject score =
// RUBRIC_WEIGHTS-weighted mean of the 9 axis ratings, squashed to 0–350 — so acing an
// EASY question barely moves you (you were expected to), beating HARD climbs hard, and
// the radar + subject score + leaderboard are ONE difficulty-adjusted system.
//
// Glicko-2 runs on its NATIVE scale (1500 / RD 350 / vol 0.06, the 173.7178 q-scale,
// τ); we convert only at the boundaries: a question difficulty (0–350) → opponent
// rating via toGlickoRating, and a rating → 0–350 display via a LOGISTIC squash (a
// linear map clips at the extremes since ratings are unbounded). Pure (no I/O), so
// /api/score and the guest client compute identically.
// ===========================================================================

const GLICKO_SCALE = 173.7178; // Glickman's q: μ = (rating − 1500) / SCALE
const GLICKO_R0 = 1500;        // seed rating
const GLICKO_RD0 = 350;        // seed (max) rating deviation
const GLICKO_VOL0 = 0.06;      // seed volatility σ
const GLICKO_TAU = 0.5;        // system constant (how much volatility may change)
const GLICKO_CONV_EPS = 1e-6;  // Illinois-algorithm convergence tolerance
const DISPLAY_D = 275;         // logistic display spread (rating → 0–SCORE_MAX)
const RD_FLOOR = 50;           // min RD after an update (stay responsive; no time-decay)
const RD_OPP = 50;             // opponent (item) RD — questions are well-calibrated
const VOL_CAP = 0.1;           // clamp volatility (insurance vs a pathological streak)
const E_LO = 1e-6, E_HI = 1 - 1e-6; // clamp expected score before the variance (no 1/0)
// Rating band = the exact range of ratingFromScore(0..100), so a maxed rubric axis
// (→ score 100) seeds at the true ceiling and exp() stays comfortably finite
// (|arg| ≤ ~13.8 in the squash, ~22 in the Glicko logistic). The continuity seed below
// SCALES per-axis deviations (never a clipping additive shift) so the aggregate lands on
// the target exactly without any axis leaving this band.
const RATING_BOUND = DISPLAY_D * Math.log((1 - E_LO) / E_LO);
const RATING_LO = GLICKO_R0 - RATING_BOUND;
const RATING_HI = GLICKO_R0 + RATING_BOUND;

// Anti-farm: how many of your last REPEAT_WINDOW_K attempts in a subject hit the same
// (subject, topic, band) bucket; the repeat factor decays geometrically and floors so
// grinding one bucket yields diminishing rating GAIN (losses are never damped).
export const REPEAT_WINDOW_K = 20;
const REPEAT_DECAY = 0.85;
const REPEAT_FLOOR = 0.2;

function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

// Glicko rating → integer 0–SCORE_MAX display score (the logistic squash). Bounded
// by construction; r=1500 → SCORE_MAX/2 = 175. (The Glicko state itself is
// scale-free — the 0–350 scale exists only in this squash and its inverse.)
export function scoreFromRating(rating) {
  const r = Number(rating);
  if (!Number.isFinite(r)) return SCORE_MAX / 2;
  return clamp(Math.round(SCORE_MAX * sigmoid((clamp(r, RATING_LO, RATING_HI) - GLICKO_R0) / DISPLAY_D)), 0, SCORE_MAX);
}

// 0–SCORE_MAX score → Glicko rating: the EXACT (unrounded) inverse of
// scoreFromRating. Used to seed legacy users (continuity) and to rate the
// question as an opponent.
export function ratingFromScore(score) {
  const s = Number(score);
  const p = clamp(Number.isFinite(s) ? s / SCORE_MAX : 0.5, E_LO, E_HI);
  return GLICKO_R0 + DISPLAY_D * Math.log(p / (1 - p));
}

// Question difficulty (0–SCORE_MAX) → opponent Glicko rating (rated by the same
// inverse, so an at-level item d=175 vs a score-175 learner yields expected 0.5).
export function toGlickoRating(difficulty) {
  return ratingFromScore(Number.isFinite(Number(difficulty)) ? Number(difficulty) : SCORE_MAX / 2);
}

// Is `obj` a stored per-axis Glicko state ({axis:{rating,...}}) vs a legacy 0–4 rubric?
function isGlickoState(obj) {
  if (!obj || typeof obj !== "object") return false;
  return RUBRIC_KEYS.some((k) => obj[k] && typeof obj[k] === "object" && Number.isFinite(Number(obj[k].rating)));
}

// Coerce a stored glicko blob to a complete, clamped state over RUBRIC_KEYS (every axis
// a finite {rating, rd, vol}); missing/garbage axes seed fresh. Prototype-safe.
export function normalizeGlickoState(glicko) {
  const src = glicko && typeof glicko === "object" ? glicko : {};
  const out = {};
  for (const k of RUBRIC_KEYS) {
    const a = Object.prototype.hasOwnProperty.call(src, k) ? src[k] : null;
    if (a && typeof a === "object" && Number.isFinite(Number(a.rating))) {
      out[k] = {
        rating: clamp(Number(a.rating), RATING_LO, RATING_HI),
        rd: clamp(Number.isFinite(Number(a.rd)) ? Number(a.rd) : GLICKO_RD0, RD_FLOOR, GLICKO_RD0),
        vol: clamp(Number.isFinite(Number(a.vol)) ? Number(a.vol) : GLICKO_VOL0, 1e-6, VOL_CAP),
      };
    } else {
      out[k] = { rating: GLICKO_R0, rd: GLICKO_RD0, vol: GLICKO_VOL0 };
    }
  }
  return out;
}

export function emptyGlickoState() {
  const out = {};
  for (const k of RUBRIC_KEYS) out[k] = { rating: GLICKO_R0, rd: GLICKO_RD0, vol: GLICKO_VOL0 };
  return out;
}

/**
 * One Glicko-2 rating period for a single rating, against ≥0 opponents.
 * @param {{rating,rd,vol}} prev   current axis state (null/garbage → fresh seed)
 * @param {{rating,rd,score}[]} opponents  rating native-scale, score ∈ [0,1]
 * @returns {{rating, rd, vol}}     finite, clamped (RD floored, vol capped)
 */
export function glicko2Update(prev, opponents, tau = GLICKO_TAU) {
  const seedR = prev && Number.isFinite(Number(prev.rating)) ? Number(prev.rating) : GLICKO_R0;
  const seedRD = prev && Number.isFinite(Number(prev.rd)) && Number(prev.rd) > 0 ? Number(prev.rd) : GLICKO_RD0;
  const seedVol = prev && Number.isFinite(Number(prev.vol)) && Number(prev.vol) > 0 ? Number(prev.vol) : GLICKO_VOL0;

  const opps = (Array.isArray(opponents) ? opponents : []).filter(
    (o) => o && Number.isFinite(Number(o.rating)) && Number.isFinite(Number(o.score))
  );
  // No games: keep the rating/volatility, just floor RD (we don't time-decay RD).
  if (opps.length === 0) {
    return { rating: clamp(seedR, RATING_LO, RATING_HI), rd: clamp(Math.max(RD_FLOOR, seedRD), RD_FLOOR, GLICKO_RD0), vol: clamp(seedVol, 1e-6, VOL_CAP) };
  }

  const mu = (seedR - GLICKO_R0) / GLICKO_SCALE;
  const phi = seedRD / GLICKO_SCALE;
  const sigma = seedVol;
  const g = (phiJ) => 1 / Math.sqrt(1 + (3 * phiJ * phiJ) / (Math.PI * Math.PI));

  let vInv = 0, deltaSum = 0;
  for (const o of opps) {
    const muJ = (Number(o.rating) - GLICKO_R0) / GLICKO_SCALE;
    const phiJ = (Number.isFinite(Number(o.rd)) ? Number(o.rd) : RD_OPP) / GLICKO_SCALE;
    const gj = g(phiJ);
    const E = clamp(1 / (1 + Math.exp(-gj * (mu - muJ))), E_LO, E_HI);
    const s = clamp(Number(o.score), 0, 1);
    vInv += gj * gj * E * (1 - E);
    deltaSum += gj * (s - E);
  }
  if (!(vInv > 0) || !Number.isFinite(deltaSum)) {
    return { rating: clamp(seedR, RATING_LO, RATING_HI), rd: clamp(Math.max(RD_FLOOR, seedRD), RD_FLOOR, GLICKO_RD0), vol: clamp(sigma, 1e-6, VOL_CAP) };
  }
  const v = 1 / vInv;
  const delta = v * deltaSum;

  // --- volatility update (Illinois / regula-falsi, Glickman 2013 §5.1) ---
  const a = Math.log(sigma * sigma);
  const f = (x) => {
    const ex = Math.exp(x);
    const d2 = phi * phi + v + ex;
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * d2 * d2) - (x - a) / (tau * tau);
  };
  let A = a, B;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0 && k < 100) k++;
    B = a - k * tau;
  }
  let fA = f(A), fB = f(B), iter = 0;
  while (Math.abs(B - A) > GLICKO_CONV_EPS && iter < 100) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) { A = B; fA = fB; } else { fA = fA / 2; }
    B = C; fB = fC; iter++;
  }
  let newVol = Math.exp(A / 2);
  if (!Number.isFinite(newVol) || newVol <= 0) newVol = sigma;
  newVol = Math.min(VOL_CAP, newVol);

  const phiStar = Math.sqrt(phi * phi + newVol * newVol);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * deltaSum;

  const rating = clamp(Number.isFinite(newMu) ? GLICKO_R0 + GLICKO_SCALE * newMu : seedR, RATING_LO, RATING_HI);
  const rd = clamp(Number.isFinite(newPhi) ? Math.max(RD_FLOOR, GLICKO_SCALE * newPhi) : seedRD, RD_FLOOR, GLICKO_RD0);
  return { rating, rd, vol: newVol };
}

// One attempt's update for a single axis: opponent = the question difficulty (0–350),
// outcome = the axis's rubric value /RUBRIC_MAX. The anti-farm repeatFactor (∈ [0,1])
// damps the POSITIVE rating step only — you can't farm UP by grinding a bucket, but a
// genuine regression still drops you (and RD still tightens).
export function updateAxisGlicko(prevAxis, outcome, difficulty, repeatFactor = 1) {
  const prev = prevAxis && Number.isFinite(Number(prevAxis.rating))
    ? prevAxis
    : { rating: GLICKO_R0, rd: GLICKO_RD0, vol: GLICKO_VOL0 };
  const s = clamp(Number.isFinite(Number(outcome)) ? Number(outcome) : 0.5, 0, 1);
  const next = glicko2Update(prev, [{ rating: toGlickoRating(difficulty), rd: RD_OPP, score: s }]);
  const rf = clamp(Number.isFinite(Number(repeatFactor)) ? Number(repeatFactor) : 1, 0, 1);
  const step = next.rating - prev.rating;
  const rating = step > 0 && rf < 1 ? prev.rating + rf * step : next.rating;
  return { rating: clamp(rating, RATING_LO, RATING_HI), rd: next.rd, vol: next.vol };
}

// Seed a per-axis Glicko state from a stored 0–4 rubric (legacy EWMA radar) so existing
// users don't reset on rollout. If it's already a Glicko state, pass it through. The
// per-axis ratings take the rubric's SHAPE (rating = ratingFromScore(axis/RUBRIC_MAX·100));
// when `fallbackScore` (the user's existing subject score) is given, we anchor the weighted
// aggregate EXACTLY on that score (so the old difficulty-aware Elo rank is preserved) by
// (1) targeting the weighted mean at ratingFromScore(fs) and (2) SCALING each axis's
// deviation from the mean by the largest s∈[0,1] that keeps every axis inside the rating
// band. Scaling deviations leaves the weighted mean invariant (Σw·dev = 0), so the derived
// score hits the target exactly while the radar shape compresses only as much as the bounds
// require. (A constant additive offset — the naive approach — would instead push an extreme
// axis past the band, clip it, silently drop its weighted contribution, and miss the target
// by up to tens of points — reshuffling the leaderboard for exactly the lopsided profiles
// this seed exists to protect.) Full RD so the next attempts move freely. No rubric → a
// 0/absent score is an un-assessed placeholder, so seed the neutral prior (a fresh user)
// rather than the dead score-0 rating floor; a real score seeds every axis from it.
export function seedGlickoFromRubric(rubric, fallbackScore = null) {
  if (isGlickoState(rubric)) return normalizeGlickoState(rubric);
  const fs = clampSubjectScore(fallbackScore);
  if (rubric && typeof rubric === "object") {
    const r = normalizeRubricFloat(rubric);
    const raw = {};
    for (const k of RUBRIC_KEYS) raw[k] = ratingFromScore((r[k] / RUBRIC_MAX) * SCORE_MAX);
    const out = {};
    if (fs == null) {
      // No target score: keep the raw shape as-is.
      for (const k of RUBRIC_KEYS) out[k] = { rating: raw[k], rd: GLICKO_RD0, vol: GLICKO_VOL0 };
      return out;
    }
    const denom = RUBRIC_WEIGHT_SUM > 0 ? RUBRIC_WEIGHT_SUM : RUBRIC_KEYS.length;
    const wt = (k) => (Number.isFinite(RUBRIC_WEIGHTS[k]) ? RUBRIC_WEIGHTS[k] : 0);
    let rawMean = 0;
    for (const k of RUBRIC_KEYS) rawMean += wt(k) * raw[k];
    rawMean /= denom;
    const target = ratingFromScore(fs);
    // Largest deviation-scale that keeps target + s·dev within [RATING_LO, RATING_HI].
    let s = 1;
    for (const k of RUBRIC_KEYS) {
      const dev = raw[k] - rawMean;
      if (dev > 0) s = Math.min(s, (RATING_HI - target) / dev);
      else if (dev < 0) s = Math.min(s, (RATING_LO - target) / dev);
    }
    if (!Number.isFinite(s) || s < 0) s = 0;
    for (const k of RUBRIC_KEYS) {
      out[k] = { rating: clamp(target + s * (raw[k] - rawMean), RATING_LO, RATING_HI), rd: GLICKO_RD0, vol: GLICKO_VOL0 };
    }
    return out;
  }
  if (fs != null && fs > 0) {
    const rating = ratingFromScore(fs);
    const out = {};
    for (const k of RUBRIC_KEYS) out[k] = { rating, rd: GLICKO_RD0, vol: GLICKO_VOL0 };
    return out;
  }
  return emptyGlickoState();
}

// Weighted mean (by RUBRIC_WEIGHTS) of the 9 axis RATINGS — aggregate in rating space,
// then squash once (avoids the Jensen bias of averaging display scores).
export function aggregateSubjectRating(glicko) {
  const st = normalizeGlickoState(glicko);
  const denom = RUBRIC_WEIGHT_SUM > 0 ? RUBRIC_WEIGHT_SUM : RUBRIC_KEYS.length;
  let w = 0;
  for (const k of RUBRIC_KEYS) w += (Number.isFinite(RUBRIC_WEIGHTS[k]) ? RUBRIC_WEIGHTS[k] : 0) * st[k].rating;
  return w / denom;
}

// The DERIVED subject score (int 0–SCORE_MAX) → scores.score / totalPoints / phdIndex / leaderboard.
export function subjectScoreFromGlicko(glicko) {
  return scoreFromRating(aggregateSubjectRating(glicko));
}

// The 0–4 radar rubric DERIVED from the per-axis ratings (the stored scores.rubric, so
// RadarChart / lowestRubricDimensions keep working unchanged).
export function radarFromGlicko(glicko) {
  const st = normalizeGlickoState(glicko);
  const out = {};
  for (const k of RUBRIC_KEYS) out[k] = clamp((scoreFromRating(st[k].rating) / SCORE_MAX) * RUBRIC_MAX, 0, RUBRIC_MAX);
  return out;
}

/**
 * Apply one graded attempt to the per-axis Glicko state (the unified update).
 * @param {{prevGlicko?, prevRubric?, prevScore?, attemptRubric, difficulty, repeatFactor?}} args
 *   prevGlicko: stored {axis:{rating,rd,vol}}; if absent → lazy-seed from prevRubric/prevScore (continuity).
 *   attemptRubric: this attempt's per-axis 0–4 rubric (the raw outcome).
 *   difficulty: the question difficulty (0–350; calibrated bucket server-side, band anchor for guests).
 *   repeatFactor: anti-farm gain damper (∈ [0,1]).
 * @returns {{glicko, rubric, score, expected}}  new state + derived radar (0–4) + subject score (0–350)
 *   + the aggregate `expected` (for explainRankMove's above/below-level phrasing).
 */
export function updateAxisRatings({ prevGlicko, prevRubric, prevScore, attemptRubric, difficulty, repeatFactor = 1 } = {}) {
  const base = isGlickoState(prevGlicko) ? normalizeGlickoState(prevGlicko) : seedGlickoFromRubric(prevRubric, prevScore);
  const rub = normalizeRubric(attemptRubric);
  const next = {};
  for (const k of RUBRIC_KEYS) next[k] = updateAxisGlicko(base[k], rub[k] / RUBRIC_MAX, difficulty, repeatFactor);
  return {
    glicko: next,
    rubric: radarFromGlicko(next),
    score: subjectScoreFromGlicko(next),
    expected: eloExpected(subjectScoreFromGlicko(base), difficulty),
  };
}

// Seed a subject's per-axis Glicko from its diagnostic answers ([{difficulty, rubric}]):
// run each axis's tier outcomes as opponents in one batch update from the fresh seed (so
// the 3 difficulty bands across the diagnostic place the profile). Returns {glicko, rubric, score}.
export function diagnosticSeedGlicko(perQuestion) {
  const qs = (Array.isArray(perQuestion) ? perQuestion : []).filter((q) => q && q.rubric != null);
  const glicko = {};
  for (const k of RUBRIC_KEYS) {
    const opponents = qs.map((q) => ({
      rating: toGlickoRating(defaultDifficultyForBand(q.difficulty)),
      rd: RD_OPP,
      score: clamp(normalizeRubric(q.rubric)[k] / RUBRIC_MAX, 0, 1),
    }));
    glicko[k] = opponents.length
      ? glicko2Update({ rating: GLICKO_R0, rd: GLICKO_RD0, vol: GLICKO_VOL0 }, opponents)
      : { rating: GLICKO_R0, rd: GLICKO_RD0, vol: GLICKO_VOL0 };
  }
  return { glicko, rubric: radarFromGlicko(glicko), score: subjectScoreFromGlicko(glicko) };
}

// Seed a subject's per-axis Glicko from its diagnostic answers by ANCHORING the aggregate on
// the difficulty-weighted reasoning score (diagnosticSubjectScore), with the radar SHAPE from
// the difficulty-weighted mean of the per-tier 0–4 rubrics. This is the placement path used by
// /api/score. It replaces seeding via diagnosticSeedGlicko (which replayed the tiers as raw
// Glicko games): from the neutral 1500/RD350 prior, losses to the intermediate/advanced tiers
// are "expected" and barely move the rating, so a first sitting collapsed into a narrow band —
// a blank/idk test floored at ~18 and a flawless one capped at ~77. Anchoring on the reasoning
// score instead places on the true 0–100 range (a non-substantive/docked test lands at the dock
// floor; a flawless one ≈ 100), consistent with the per-answer score the learner sees. Seeds at
// FULL RD so subsequent practice refines the placement freely. Returns {glicko, rubric, score};
// perQuestion: [{difficulty, reasoningScore, rubric}].
export function diagnosticSeedFromReasoning(perQuestion, { pathWeighted = false } = {}) {
  const qs = (Array.isArray(perQuestion) ? perQuestion : []).filter((q) => q && q.rubric != null);
  if (qs.length === 0) {
    const empty = emptyGlickoState();
    return { glicko: empty, rubric: radarFromGlicko(empty), score: 0 };
  }
  // Placement target = the difficulty-weighted mean of the per-answer reasoning
  // scores. `pathWeighted` (the §8 adaptive walk) drops the fixed full-weight
  // floor — the server-signed chain forces every step, so the floor's anti-gaming
  // job is already done upstream (see diagnosticPathScore). The aggregate is a
  // QUALITY (0–100); the placement target lives on the 0–SCORE_MAX subject scale,
  // so map it across (×3.5): a flawless walk places at the top of the range.
  const quality = pathWeighted ? diagnosticPathScore(qs) : diagnosticSubjectScore(qs);
  const target = Math.round((quality * SCORE_MAX) / 100);
  // Radar shape = the difficulty-weighted mean of the per-tier rubrics (harder tiers weigh
  // more, mirroring the score weighting), so the profile reflects where reasoning held up.
  const acc = {};
  for (const k of RUBRIC_KEYS) acc[k] = 0;
  let wsum = 0;
  for (const q of qs) {
    const w = difficultyAnchor(q.difficulty) ?? DIFFICULTY_ANCHORS.intermediate;
    const r = normalizeRubric(q.rubric);
    for (const k of RUBRIC_KEYS) acc[k] += w * r[k];
    wsum += w;
  }
  const shape = {};
  for (const k of RUBRIC_KEYS) shape[k] = wsum > 0 ? acc[k] / wsum : 0;
  // seedGlickoFromRubric pins the weighted aggregate EXACTLY on `target` while preserving the
  // shape's relative deviations, so subjectScoreFromGlicko(glicko) === target.
  const glicko = seedGlickoFromRubric(shape, target);
  return { glicko, rubric: radarFromGlicko(glicko), score: subjectScoreFromGlicko(glicko) };
}

// Anti-farm repeat factor from a repeat COUNT: max(FLOOR, DECAY^repeats). repeats=0→1.
export function repeatFactorForCount(repeats) {
  const n = Number.isFinite(Number(repeats)) ? Math.max(0, Math.floor(Number(repeats))) : 0;
  return Math.max(REPEAT_FLOOR, Math.pow(REPEAT_DECAY, n));
}

// Guest repeat factor: of your last REPEAT_WINDOW_K attempts in `subject`, how many hit
// the same (topic, band) bucket. `history` is newest-last (the local attempt log).
export function repeatFactorFromHistory(history, subject, topic, band) {
  if (!Array.isArray(history)) return 1;
  const recent = history.filter((h) => h && h.type === "attempt" && h.subject === subject).slice(-REPEAT_WINDOW_K);
  const repeats = recent.filter((h) => h.topic === topic && h.band === band).length;
  return repeatFactorForCount(repeats);
}

// Server repeat factor: from the most-recent ≤K attempt rows ({topic, band}) of a subject,
// count the same-bucket hits.
export function repeatFactorFromRecent(recentRows, topic, band) {
  const rows = (Array.isArray(recentRows) ? recentRows : []).slice(0, REPEAT_WINDOW_K);
  const repeats = rows.filter((r) => r && r.topic === topic && r.band === band).length;
  return repeatFactorForCount(repeats);
}

// Self-calibrating item-difficulty nudge (a commutative additive delta for the
// bump_item_difficulty bucket): the aggregate outcome surprise vs the learner's prior
// subject score. Replaces eloUpdate's diffDelta in the unified world; keeps the bucket
// drifting toward what the population actually scores. Skip on a dock (no signal).
export function itemDifficultyDelta({ prevSubjectScore, itemDifficulty, aggregateOutcome } = {}) {
  const E = eloExpected(prevSubjectScore, itemDifficulty);
  const o = clamp(Number.isFinite(Number(aggregateOutcome)) ? Number(aggregateOutcome) : 0.5, 0, 1);
  return -ELO_K_DIFFICULTY * (o - E);
}

// ---------------------------------------------------------------------------
// 5 RANKS (fixed 70-point score bands, RANKS_PLAN §3): the display ranks ARE the
// curriculum ranks (Elementary … Doctorate), so a learner's rank label, the Learn
// tab's rank tiers, and the §7 breadth gate all speak one ladder. Architected so
// a later percentile recut can supply cutoffs without a UI change.
// ---------------------------------------------------------------------------
export const RANKS = ["Elementary", "Middle", "High", "University", "Doctorate"];

// Map a 0–SCORE_MAX score to its rank { name, index (0–4) }. `opts.cutoffs` is
// reserved for the future percentile-recut tiers (an ascending array of 4 score
// cutoffs); when absent we use the FIXED bands (band()), the owner's launch choice.
export function rankFor(score, opts) {
  const cutoffs = opts && Array.isArray(opts.cutoffs) && opts.cutoffs.length === 4 ? opts.cutoffs : null;
  if (cutoffs) {
    const s = clampSubjectScore(score) ?? 0;
    let index = 0;
    while (index < 4 && s >= cutoffs[index]) index++;
    return { name: RANKS[index], index };
  }
  const name = band(score);
  return { name, index: Math.max(0, RANKS.indexOf(name)) };
}

// ---------------------------------------------------------------------------
// TRANSPARENT HEADLINE SCORE (process-first). The reasoning score is a WEIGHTED MEAN of
// the rubric axes — there is NO separate model-emitted headline and NO reconciliation
// slack (the old ±25 "hidden factor" is gone). Because RUBRIC_WEIGHT_SUM·RUBRIC_MAX = 100
// the score equals Σ(wᵢ·valueᵢ) directly, so each axis contributes weight×value POINTS
// that visibly add up to the total. The descending error taxonomy (conceptual ≫ strategic
// ≈ reasoning ≫ slip ≫ communication) is baked into RUBRIC_WEIGHTS, so a clean arithmetic
// slip (computation, weight 1) costs almost nothing while a broken inference (logic/
// justification/principle) costs heavily — even when the final answer is right. Pure +
// total (never NaN): normalizeRubric coerces every axis to a finite int; the denominator
// is a positive constant. Final-answer correctness is NEVER an input here (path-independent).
// ---------------------------------------------------------------------------

// The reasoning score (0–100) = weighted mean of the axes on the 0–RUBRIC_MAX scale.
export function scoreFromRubric(rubric) {
  const r = normalizeRubric(rubric);
  const denom = RUBRIC_WEIGHT_SUM > 0 ? RUBRIC_WEIGHT_SUM : RUBRIC_KEYS.length;
  let weighted = 0;
  for (const k of RUBRIC_KEYS) {
    const w = Number.isFinite(RUBRIC_WEIGHTS[k]) ? RUBRIC_WEIGHTS[k] : 0;
    weighted += w * r[k];
  }
  return clamp(Math.round((weighted / denom / RUBRIC_MAX) * 100), 0, 100);
}

// Per-axis breakdown for the "how this score is computed" UI panel: each axis's value,
// weight, the points it could be worth at 4/4 (`max`), and the points it actually
// contributes. The UNROUNDED contributions sum exactly to the unrounded headline; with
// the integer weights (Σ=25) the rounded points are integers that add up to the score.
export function contributionBreakdown(rubric) {
  const r = normalizeRubric(rubric);
  const denom = RUBRIC_WEIGHT_SUM > 0 ? RUBRIC_WEIGHT_SUM : RUBRIC_KEYS.length;
  const items = RUBRIC_KEYS.map((k) => {
    const w = Number.isFinite(RUBRIC_WEIGHTS[k]) ? RUBRIC_WEIGHTS[k] : 0;
    return {
      key: k,
      label: RUBRIC_LABELS[k],
      value: r[k], // 0..RUBRIC_MAX
      weight: w,
      max: Math.round((w / denom) * 100), // points this axis is worth at 4/4
      points: Math.round((w * r[k]) / denom / RUBRIC_MAX * 100),
    };
  });
  return { items, total: scoreFromRubric(rubric) };
}

// ---------------------------------------------------------------------------
// EXPLAINABILITY — a deterministic one-line "why your rank moved" rationale built
// from the Elo terms + the dock/grade signals, persisted per attempt and shown to
// the learner (the feedback panel + recent activity). Pure so it's unit-testable.
// ---------------------------------------------------------------------------
export function explainRankMove({ delta = 0, reasoningScore = 0, expected = null, difficultyBand = null, docked = false } = {}) {
  const d = Math.round(Number(delta) || 0);
  const sign = d > 0 ? `+${d}` : `${d}`;
  const rs = clampScore(reasoningScore) ?? 0;
  if (docked) {
    return `${sign} — docked: no substantive reasoning to grade (answer was empty, "I don't know", or off-topic).`;
  }
  const bandLabel = typeof difficultyBand === "string" && difficultyBand !== "(unspecified)" ? difficultyBand : null;
  // Was the item above or below the learner's level? expected < 0.5 ⇒ the item was
  // rated above them (a harder match), so over-performing it counts for more.
  let standing = "";
  if (typeof expected === "number" && Number.isFinite(expected)) {
    if (expected < 0.4) standing = bandLabel ? ` on an above-level (${bandLabel}) question` : " on an above-level question";
    else if (expected > 0.6) standing = bandLabel ? ` on a below-level (${bandLabel}) question` : " on a below-level question";
    else standing = bandLabel ? ` on an at-level (${bandLabel}) question` : " on an at-level question";
  } else if (bandLabel) {
    standing = ` on a ${bandLabel} question`;
  }
  const quality = rs >= 75 ? "strong reasoning" : rs >= 45 ? "solid reasoning" : rs > 0 ? "thin reasoning" : "no reasoning";
  if (d > 0) return `${sign} — ${quality} (${rs}/100)${standing} earned points.`;
  if (d < 0) return `${sign} — ${quality} (${rs}/100)${standing} cost points.`;
  return `±0 — ${quality} (${rs}/100)${standing} held your rank steady.`;
}
