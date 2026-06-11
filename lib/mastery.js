// ---------------------------------------------------------------------------
// PER-CONCEPT MASTERY — the sustained-quality flag (RANKS_PLAN §12.1).
//
// Each curriculum concept (lib/curriculum.js) a learner has practiced carries a
// small counter record; the display STATE is derived from it:
//
//   green  — MASTERED: ≥ MASTERY_GREEN_ATTEMPTS distinct attempts at quality ≥
//            MASTERY_GREEN_QUALITY. Sticky by construction (counters only grow),
//            per RANKS_PLAN §11.6 — coverage is monotonic.
//   red    — STRUGGLING: the most recent attempt failed (quality <
//            MASTERY_RED_QUALITY) or was skipped/docked ("I don't know" docks to
//            a single-digit quality). A warning, not a gate (§12.1).
//   yellow — IN PROGRESS: practiced, neither green nor red yet.
//   grey   — never attempted. Coloring is DIRECT-only — no propagation; the
//            diagnostic colors only the concepts it actually tested.
//
// The same pure logic runs on both sides of the trust boundary: the server
// persists counters per (user, subject, concept_key) via the service-role-only
// bump_concept_mastery RPC (quality is always the SERVER-computed reasoning
// score — a client can never supply it), and guests keep the identical map in
// localStorage. The SQL increment in db/schema.sql mirrors applyMasteryAttempt
// — keep MASTERY_GREEN_QUALITY in sync with the `>= 70` there.
// ---------------------------------------------------------------------------

import { CURRICULUM, RANKS } from "@/lib/curriculum";

export const MASTERY_GREEN_QUALITY = 70; // quality ≥ this counts toward green (owner decision)
export const MASTERY_GREEN_ATTEMPTS = 2; // green hits needed for green (owner decision)
export const MASTERY_RED_QUALITY = 40; // last quality below this (or a dock) → red

// Counter caps keep a hand-edited guest blob int4-safe and bounded.
const MAX_COUNT = 100000;

// Per-subject Set of valid curriculum concept keys (prototype-safe membership —
// the allowlist every stored/submitted concept key is validated against).
const KEYSETS = {};
for (const subject of Object.keys(CURRICULUM)) {
  const set = new Set();
  for (const rank of RANKS) for (const c of CURRICULUM[subject][rank] || []) set.add(c.key);
  KEYSETS[subject] = set;
}

// Is (subject, key) a real curriculum concept? The server uses this to allowlist
// a client-threaded conceptKey; normalizeMasteryMap uses it to drop junk entries.
export function isCurriculumConcept(subject, key) {
  return (
    typeof subject === "string" &&
    typeof key === "string" &&
    Object.prototype.hasOwnProperty.call(KEYSETS, subject) &&
    KEYSETS[subject].has(key)
  );
}

export function emptyCounters() {
  return { attempts: 0, greenHits: 0, lastQuality: null, bestQuality: null };
}

const clampCount = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(MAX_COUNT, Math.round(n))) : 0;
};
const clampQuality = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
};

// One graded attempt on a concept → the next counter record (immutable). The SQL
// upsert in bump_concept_mastery applies the identical increments server-side.
export function applyMasteryAttempt(prev, quality) {
  const p = prev && typeof prev === "object" ? prev : emptyCounters();
  const q = clampQuality(quality);
  if (q === null) return p; // no usable quality signal — leave the record untouched
  return {
    attempts: clampCount(p.attempts) + 1,
    greenHits: clampCount(p.greenHits) + (q >= MASTERY_GREEN_QUALITY ? 1 : 0),
    lastQuality: q,
    bestQuality: Math.max(clampQuality(p.bestQuality) ?? 0, q),
  };
}

// Derive the display state from a counter record. Green is sticky: greenHits
// only ever grows, so once earned it can't be lost (coverage is monotonic).
export function masteryStateFor(counters) {
  if (!counters || typeof counters !== "object") return "grey";
  const attempts = clampCount(counters.attempts);
  if (attempts === 0) return "grey";
  if (clampCount(counters.greenHits) >= MASTERY_GREEN_ATTEMPTS) return "green";
  const last = clampQuality(counters.lastQuality);
  if (last !== null && last < MASTERY_RED_QUALITY) return "red";
  return "yellow";
}

// Sanitize a stored mastery blob (guest localStorage / migrated payload) into
// { [subject]: { [conceptKey]: counters } }. Unknown subjects/concepts and
// garbage-typed counters are dropped, so a hand-edited blob can't smuggle junk
// keys (prototype pollution) or non-numeric counters into state or the DB.
export function normalizeMasteryMap(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const subject of Object.keys(KEYSETS)) {
    const subj = raw[subject];
    if (!subj || typeof subj !== "object") continue;
    const clean = {};
    for (const key of Object.keys(subj)) {
      if (!isCurriculumConcept(subject, key)) continue;
      const c = subj[key];
      if (!c || typeof c !== "object") continue;
      const attempts = clampCount(c.attempts);
      if (attempts === 0) continue; // an untouched record is the same as absent
      clean[key] = {
        attempts,
        greenHits: Math.min(clampCount(c.greenHits), attempts),
        lastQuality: clampQuality(c.lastQuality),
        bestQuality: clampQuality(c.bestQuality),
      };
    }
    if (Object.keys(clean).length) out[subject] = clean;
  }
  return out;
}

// Apply a batch of attempt updates ([{ subject, conceptKey, quality }]) to a
// mastery map, immutably. Invalid entries are skipped (same allowlist).
export function applyMasteryUpdates(map, updates) {
  const base = normalizeMasteryMap(map);
  if (!Array.isArray(updates) || updates.length === 0) return base;
  for (const u of updates) {
    if (!u || typeof u !== "object") continue;
    if (!isCurriculumConcept(u.subject, u.conceptKey)) continue;
    const subj = { ...(base[u.subject] || {}) };
    subj[u.conceptKey] = applyMasteryAttempt(subj[u.conceptKey], u.quality);
    base[u.subject] = subj;
  }
  return base;
}

// DB rows (snake_case, from concept_mastery) -> the same map shape the guest
// path uses, so the UI renders both identically.
export function masteryMapFromRows(rows) {
  const raw = {};
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r !== "object") continue;
    (raw[r.subject] = raw[r.subject] || {})[r.concept_key] = {
      attempts: r.attempts,
      greenHits: r.green_hits,
      lastQuality: r.last_quality,
      bestQuality: r.best_quality,
    };
  }
  return normalizeMasteryMap(raw);
}

// Convenience for the UI: the state for one concept out of a mastery map.
export function conceptState(map, subject, conceptKey) {
  const c = map && map[subject] && typeof map[subject] === "object" ? map[subject][conceptKey] : null;
  return masteryStateFor(c);
}

// Display copy per state (chip titles + the concept-page status line).
export const MASTERY_LABELS = {
  green: "Mastered — clear understanding shown across attempts",
  yellow: "In progress — practiced, keep going",
  red: "Struggling — review the foundations first",
  grey: "Not yet attempted",
};
