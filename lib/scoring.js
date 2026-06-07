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

// The five rubric dimensions in display order — the axes of the reasoning radar
// and the keys of every rubric object the grader emits / we persist. Derived from
// RUBRIC_LABELS so there is ONE source of truth; exported so the grade/score routes
// (server) and the dashboard (client) never drift on the set or the ordering.
export const RUBRIC_KEYS = Object.keys(RUBRIC_LABELS);
// Each rubric dimension is scored on a 0–4 scale (per PRACTICE_GRADE_SYS).
export const RUBRIC_MAX = 4;

export const SCALE_NOTE =
  "0–20 absolute beginner, 20–40 foundational, 40–60 intermediate, 60–80 advanced, 80–100 PhD-level.";

// scores shape used across the app: { math: { score, weakConcepts, comment }, ... }

// Coerce any value (including model output that may be missing, a string, or
// out of range) to an integer in [0, 100]. Returns null when there is no usable
// number, so callers can distinguish "no signal" from a real zero.
export function clampScore(value) {
  // Guard null/undefined/"" explicitly: Number(null) and Number("") are 0 (a
  // finite value), which would silently turn "no score" into a real zero and,
  // via blend(), drag an existing score down. Treat those as "no signal".
  if (value == null || value === "") return null;
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

// Numeric anchor (band midpoint on the 0–100 scale) for each difficulty band
// emitted by the practice generator. Treated as the "question rating" on the
// same 0–100 subject scale, so we can tell whether an item sits above or below
// the learner's current level (the bands are documented in SCALE_NOTE above and
// in PRACTICE_GEN_SYS in lib/groq.js).
const DIFFICULTY_ANCHORS = {
  beginner: 10, // band 0–20
  foundational: 30, // band 20–40
  intermediate: 50, // band 40–60
  advanced: 70, // band 60–80
  phd: 90, // band 80–100
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
// base-10 logistic (expected = 1 / (1 + 10^((anchor - prev) / ELO_SCALE))). At
// this spread a learner ~25 points above a question is expected to "win" ~91% of
// the time, and a ~12-13 point edge maps to ~76%.
const ELO_SCALE = 25;

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
 * question (rating = its difficulty anchor on the same 0–100 scale). The grader's
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
 * @param {*} prev        Learner's current subject score (int 0-100); non-number
 *                        means "no previous score" and seeds from the suggestion.
 * @param {*} suggestion  Grader's proposed new level (int 0-100, may be null/garbage).
 * @param {{difficulty?: string, reasoningScore?: number}} [opts]
 *                        difficulty: band string (beginner|foundational|intermediate
 *                        |advanced|phd). reasoningScore: quality of THIS attempt,
 *                        int 0-100 (0 = blank/garbage, 100 = excellent).
 * @returns {number}      Integer in [0, 100].
 */
export function blend(prev, suggestion, opts) {
  const sug = clampScore(suggestion);
  // A malformed/missing suggestion (the grader returned no number) must not drag
  // an existing score toward zero — keep the learner's current level (clamped to a
  // clean int so a buggy/out-of-range/NaN prev never leaks through). 0 if no prev.
  if (sug === null) {
    return Number.isFinite(prev) ? clamp(Math.round(prev), 0, 100) : 0;
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
  // int in [0,100] and can never produce NaN.
  const p = Number.isFinite(prevNum) ? clamp(Math.round(prevNum), 0, 100) : 0;

  // Read the optional signals (both null on no-signal). reasoningScore reuses
  // clampScore, so out-of-range/garbage degrades safely (200->100, NaN/null->null).
  const reasoning = clampScore(opts ? opts.reasoningScore : undefined);
  const anchor = difficultyAnchor(opts ? opts.difficulty : undefined);

  // --- Legacy fallback: no usable signal at all -> EXACT 65/35 behavior. ---
  // Literal 0.65/0.35 expression (not the alpha-reconstructed form) for bit-
  // identical rounding with the original placeholder.
  if (reasoning === null && anchor === null) {
    return clamp(Math.round(p * 0.65 + sug * 0.35), 0, 100);
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

  return clamp(Math.round(p + alpha * (sug - p)), 0, 100);
}

export function totalPoints(scores) {
  if (!scores) return 0;
  // Coerce each subject score via clampScore (same path as band()/blend()) so a
  // string/float/NaN from a hand-edited guest localStorage blob can't string-
  // concatenate or carry a non-integer into the sum. clampScore returns null for
  // "no signal", which contributes 0.
  return ORDER.reduce((a, k) => a + (clampScore(scores[k]?.score) ?? 0), 0); // out of 300
}

// "PhD-level intelligence": overall progress toward PhD mastery across all
// three subjects, expressed 0–100 (the mean of the three subject scores).
export function phdIndex(scores) {
  if (!scores) return 0;
  return Math.round(totalPoints(scores) / ORDER.length);
}

// ---------------------------------------------------------------------------
// 2-tier diagnostic ("Prove it"): each subject asks an EASY and a HARD question
// (6 total), spanning low/high ability to seed the rating without overwhelming the
// LLM rate limit (9 questions bursted into 429s). UI shows the friendly labels; the
// band name is what the generator emits and the grader/anchor logic understands.
// (diagnosticSubjectScore/Rubric weight by the difficulty anchors, so 2 tiers — 30
// & 70 — still produce a sensible 0–100 baseline.)
// ---------------------------------------------------------------------------
export const DIAGNOSTIC_DIFFICULTIES = ["foundational", "advanced"];
export const DIFFICULTY_LABELS = { foundational: "Easy", intermediate: "Intermediate", advanced: "Hard" };

// Sum of the difficulty anchors across the live diagnostic tiers (foundational 30 +
// advanced 70 = 100). diagnosticSubjectScore divides by AT LEAST this, so a MISSING
// tier contributes 0 instead of being silently dropped (see the function below).
const DIAGNOSTIC_FULL_WEIGHT = DIAGNOSTIC_DIFFICULTIES.reduce((a, d) => a + (difficultyAnchor(d) ?? 0), 0);

/**
 * Combine a subject's two diagnostic answers (easy + hard) into a baseline 0–100
 * score, with points PROPORTIONAL TO DIFFICULTY: each question's reasoning score
 * (0–100) is weighted by its difficulty anchor (foundational 30 / advanced 70 ≈ 3:7),
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

// ---------------------------------------------------------------------------
// Per-subject reasoning rubric (the 5 dimensions, 0–4 each). Powers the radar
// chart and the "what to work on" guidance. These are PURE (no I/O), so the
// server route computes them exactly like the client would.
// ---------------------------------------------------------------------------

// Coerce a model/stored rubric into a complete object over RUBRIC_KEYS, each an
// INTEGER in [0, RUBRIC_MAX]; missing/garbage dimensions default to 0. Used for the
// per-ATTEMPT rubric the grader returns (rendered as 0–4 segment bars) — so every
// bar always has a clean integer value and malformed model output can't show NaN.
export function normalizeRubric(rubric) {
  const out = {};
  for (const k of RUBRIC_KEYS) {
    const n = Number(rubric ? rubric[k] : undefined);
    out[k] = Number.isFinite(n) ? clamp(Math.round(n), 0, RUBRIC_MAX) : 0;
  }
  return out;
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
  const a = clamp(Number.isFinite(Number(alpha)) ? Number(alpha) : 0.35, 0, 1);
  const out = {};
  for (const k of RUBRIC_KEYS) {
    const pv = Number(prev[k]);
    const base = Number.isFinite(pv) ? clamp(pv, 0, RUBRIC_MAX) : target[k];
    out[k] = clamp(base + a * (target[k] - base), 0, RUBRIC_MAX);
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
// both live on the same 0–100 scale (reusing the bands + all UI). Each practice
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
  return 1 / (1 + Math.pow(10, (clamp(d, 0, 100) - clamp(r, 0, 100)) / ELO_SCALE));
}

// K for a learner with `attemptCount` prior attempts (in this subject). Monotonic
// decreasing from ELO_K_PROVISIONAL toward ELO_K_STABLE.
export function eloK(attemptCount) {
  const a = Number.isFinite(Number(attemptCount)) ? Math.max(0, Math.floor(Number(attemptCount))) : 0;
  return ELO_K_STABLE + (ELO_K_PROVISIONAL - ELO_K_STABLE) * (ELO_PROVISIONAL_N / (ELO_PROVISIONAL_N + a));
}

// Default difficulty for a band when an item bucket has no calibrated value yet —
// the band midpoint anchor (beginner 10 … phd 90), intermediate (50) if unknown.
export function defaultDifficultyForBand(band) {
  return difficultyAnchor(band) ?? DIFFICULTY_ANCHORS.intermediate;
}

/**
 * One Elo "match": update the learner's rating AND the item's difficulty.
 *
 * @param {{rating:*, difficulty:*, outcome:number, attemptCount?:number}} args
 *   rating: learner's current subject rating (non-number → seed from 0; Elo's low
 *           expected at rating 0 means a strong first answer still lifts sensibly).
 *   difficulty: the item's current difficulty (non-number → defaults to 50).
 *   outcome: graded reasoning quality in [0,1] (clamped). This is the ONLY driver of
 *           direction — a low outcome moves the rating DOWN even on an easy item.
 *   attemptCount: learner's prior attempts (sets K via eloK).
 * @returns {{newRating:number, newDifficulty:number, diffDelta:number,
 *            expected:number, k:number}}
 *   newRating/newDifficulty are clamped to [0,100] (rating is an int; difficulty is
 *   kept as a float for calibration resolution). diffDelta is the raw difficulty
 *   change so the route can apply it as an atomic SQL increment on the bucket.
 */
export function eloUpdate({ rating, difficulty, outcome, attemptCount } = {}) {
  const r = Number.isFinite(Number(rating)) ? clamp(Math.round(Number(rating)), 0, 100) : 0;
  const d = Number.isFinite(Number(difficulty)) ? clamp(Number(difficulty), 0, 100) : DIFFICULTY_ANCHORS.intermediate;
  const o = Number.isFinite(Number(outcome)) ? clamp(Number(outcome), 0, 1) : 0.5;
  const expected = eloExpected(r, d);
  const k = eloK(attemptCount);
  const surprise = o - expected; // in (-1, 1)
  const newRating = clamp(Math.round(r + k * surprise), 0, 100);
  const diffDelta = -ELO_K_DIFFICULTY * surprise; // item easier than rated if learner over-performs
  const newDifficulty = clamp(d + diffDelta, 0, 100);
  return { newRating, newDifficulty, diffDelta, expected, k };
}

// ---------------------------------------------------------------------------
// 5 RANKS (fixed score bands at launch). Reuse band()'s names as the rank ladder;
// architected so a later percentile recut can supply cutoffs without a UI change.
// ---------------------------------------------------------------------------
export const RANKS = ["Absolute beginner", "Foundational", "Intermediate", "Advanced", "PhD-level"];

// Map a 0–100 score to its rank { name, index (0–4) }. `opts.cutoffs` is reserved for
// the future percentile-recut tiers (an ascending array of 4 score cutoffs); when
// absent we use the FIXED bands (band()), the owner's explicit launch choice.
export function rankFor(score, opts) {
  const cutoffs = opts && Array.isArray(opts.cutoffs) && opts.cutoffs.length === 4 ? opts.cutoffs : null;
  if (cutoffs) {
    const s = clampScore(score) ?? 0;
    let index = 0;
    while (index < 4 && s >= cutoffs[index]) index++;
    return { name: RANKS[index], index };
  }
  const name = band(score);
  return { name, index: Math.max(0, RANKS.indexOf(name)) };
}

// ---------------------------------------------------------------------------
// GRADING RECONCILIATION (consistency / anti-gaming). A reasoningScore that
// contradicts its own rubric mean is pulled back toward what the rubric implies, so
// the headline number can never be wildly out of step with the per-dimension bars
// (e.g. an all-zero rubric with score 80, or all-4s with score 10). Pure + bounded.
// ---------------------------------------------------------------------------
export const RECONCILE_TOLERANCE = 25; // max points reasoningScore may sit from the rubric-implied score

// Score (0–100) implied by a rubric's mean over the 5 dimensions (mean/4 * 100).
export function rubricImpliedScore(rubric) {
  const r = normalizeRubric(rubric);
  const mean = RUBRIC_KEYS.reduce((a, k) => a + r[k], 0) / RUBRIC_KEYS.length; // 0..RUBRIC_MAX
  return clamp(Math.round((mean / RUBRIC_MAX) * 100), 0, 100);
}

// Reconcile a model reasoningScore against its rubric: if it sits more than `tol`
// points from the rubric-implied score, clamp it to within `tol` of that anchor (so
// it moves TOWARD the rubric without being fully overwritten). A null/garbage score
// falls back to the rubric-implied score outright.
export function reconcileReasoningScore(reasoningScore, rubric, tol = RECONCILE_TOLERANCE) {
  const implied = rubricImpliedScore(rubric);
  const rs = clampScore(reasoningScore);
  if (rs === null) return implied;
  const gap = rs - implied;
  if (Math.abs(gap) <= tol) return rs;
  return clamp(implied + Math.sign(gap) * tol, 0, 100);
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
