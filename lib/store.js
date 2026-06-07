// ---------------------------------------------------------------------------
// DATA LAYER
//
// The UI only ever calls these functions. They transparently use Supabase when
// a user is signed in (durable, multi-device, scoped per user by row-level
// security) and fall back to the browser's localStorage for guests, so the app
// is fully usable before anyone signs in.
//
// Note: guest (local) progress IS migrated into the account on first sign-in
// via migrateGuestToAccount() (see below).
// ---------------------------------------------------------------------------

import { getSupabase } from "@/lib/supabase";
import { clampScore } from "@/lib/scoring";

const KEY = "noobtopro:v1";

function readLocal() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

// Returns true if the write persisted, false if it was a no-op (SSR) or failed
// (quota exceeded / storage blocked). Callers that must not silently lose data
// (saveProgress) check the result; fire-and-forget callers ignore it.
function writeLocal(state) {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    /* storage full or blocked */
    return false;
  }
}

// Validate/clamp a raw guest localStorage blob into the shape React state expects.
// A structurally-valid-but-wrong-typed blob (e.g. weakConcepts as a string, a garbage
// score) would otherwise flow straight into state and crash rendering (.slice/.filter/
// .map on a string). Mirrors the validation in _migrateGuestToAccount. Returns
// { scores, history } with scores null OR a normalized per-subject map, and history
// always an array of objects.
function sanitizeState(raw) {
  if (!raw || typeof raw !== "object") return { scores: null, history: [] };
  let scores = null;
  if (raw.scores && typeof raw.scores === "object") {
    scores = {};
    Object.keys(raw.scores).forEach((subject) => {
      const s = raw.scores[subject];
      if (!s || typeof s !== "object") return;
      const wc = s.weakConcepts;
      scores[subject] = {
        score: clampScore(s.score) ?? 0,
        weakConcepts: Array.isArray(wc) ? wc.filter((c) => typeof c === "string").slice(0, 64) : [],
        comment: typeof s.comment === "string" ? s.comment : "",
        // Per-subject rubric profile (radar chart). Kept as-is if it's an object,
        // else null — a hand-edited blob can't push a non-object into the chart.
        rubric: s.rubric && typeof s.rubric === "object" ? s.rubric : null,
      };
    });
  }
  const history = (Array.isArray(raw.history) ? raw.history : []).filter((e) => e && typeof e === "object");
  return { scores, history };
}

async function activeUserId() {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return (data && data.session && data.session.user && data.session.user.id) || null;
}

// DB row (snake_case) -> app event (camelCase)
function rowToEvent(r) {
  return {
    type: r.type,
    t: r.created_at,
    subject: r.subject,
    reasoningScore: r.reasoning_score,
    delta: r.delta,
    newScore: r.new_score,
    totalAfter: r.total_after,
    phdAfter: r.phd_after,
  };
}

export async function loadState() {
  const uid = await activeUserId();
  if (!uid) return sanitizeState(readLocal());

  const sb = getSupabase();
  const [scoreRes, attemptRes] = await Promise.all([
    sb.from("scores").select("*").eq("user_id", uid),
    sb
      .from("attempts")
      .select("*")
      .eq("user_id", uid)
      // created_at + id gives a stable order even when two rows share a timestamp.
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  // Surface query failures instead of returning empty data: an empty result is
  // indistinguishable from a brand-new user, and the caller would otherwise wipe
  // a signed-in user back to the intro screen (and risk overwriting real scores).
  if (scoreRes.error || attemptRes.error) {
    return { error: scoreRes.error || attemptRes.error };
  }
  const scoreRows = scoreRes.data;
  const attemptRows = attemptRes.data;

  let scores = null;
  if (scoreRows && scoreRows.length) {
    scores = {};
    scoreRows.forEach((r) => {
      scores[r.subject] = { score: r.score, weakConcepts: r.weak_concepts || [], comment: r.comment || "", rubric: r.rubric || null };
    });
  }
  return { scores, history: (attemptRows || []).map(rowToEvent) };
}

// Persist a score change + its attempt for a GUEST (localStorage). Signed-in users
// do NOT use this path: their scores are SERVER-AUTHORITATIVE — graded, computed, and
// persisted by /api/score for the verified auth.uid() (see app/api/score/route.js).
// The scores/attempts tables are SELECT-only under RLS, so the browser can no longer
// write them directly; the client routes signed-in saves through the server route and
// only calls this for guests. Returns { history } (the refreshed local attempt list)
// on success; throws on a failed write so the caller surfaces a banner.
export async function saveProgress(scores, evt) {
  const uid = await activeUserId();
  if (uid) {
    // Reaching here while signed in means a stale path tried to write the DB from the
    // browser (now blocked by RLS). Fail loudly rather than silently writing to the
    // wrong (local) store — the signed-in flow must go through /api/score.
    throw new Error("Signed-in progress is saved on the server, not locally.");
  }
  const s = readLocal() || { scores: null, history: [] };
  // MERGE the (possibly single-subject) payload over the stored map, mirroring the
  // server's upsert-only-present-subjects semantics. submitPractice sends one subject,
  // so a replace here would wipe the other two; the full-map diagnostic merges cleanly.
  s.scores = { ...(s.scores || {}), ...scores };
  s.history = [...(s.history || []), evt];
  // Surface a failed local write (quota exceeded / storage blocked) instead of
  // reporting success, so the caller shows a banner rather than silently losing the
  // attempt. Throwing keeps in-memory React state as the source of truth.
  if (!writeLocal(s)) throw new Error("Couldn't save your progress — this browser's storage is full or blocked.");
  return { history: s.history };
}

// Clears the LOCAL (guest) session view only — never deletes a signed-in
// user's stored data. For signed-in accounts use deleteAllUserData().
export async function resetAll() {
  writeLocal({ scores: null, history: [] });
}

// On first sign-in, fold any guest (localStorage) progress into the account.
// Single-flight (concurrent callers — mount + SIGNED_IN — share one run) wrapping
// an atomic, idempotent Postgres RPC (migrate_guest_data): the RPC advisory-locks
// per user, only migrates into an empty account, and writes scores + attempts in
// ONE transaction, so it can't double-insert or partially lose history. A no-op
// when not signed in / nothing to move.
let _migrating = null;
export function migrateGuestToAccount() {
  if (!_migrating) {
    _migrating = _migrateGuestToAccount().finally(() => {
      _migrating = null;
    });
  }
  return _migrating;
}

async function _migrateGuestToAccount() {
  const uid = await activeUserId();
  if (!uid) return { migrated: false };
  const local = readLocal();
  if (!local || !local.scores || typeof local.scores !== "object") return { migrated: false };

  // Build a clamped/validated payload — defensive against a corrupt localStorage
  // blob, and the one write path that would otherwise bypass score normalization.
  const p_scores = Object.keys(local.scores)
    .filter((k) => local.scores[k] && typeof local.scores[k] === "object")
    .map((subject) => ({
      subject,
      score: clampScore(local.scores[subject].score) ?? 0,
      weak_concepts: Array.isArray(local.scores[subject].weakConcepts)
        ? local.scores[subject].weakConcepts.filter((c) => typeof c === "string").slice(0, 64)
        : [],
      comment: typeof local.scores[subject].comment === "string" ? local.scores[subject].comment : "",
      // Carry the per-subject rubric profile across the guest→account migration so the
      // radar chart survives sign-in (the migrate_guest_data RPC stores it; a non-object
      // degrades to null). Without this a guest's reasoning profile was lost on sign-in.
      rubric:
        local.scores[subject].rubric && typeof local.scores[subject].rubric === "object"
          ? local.scores[subject].rubric
          : null,
    }));

  // The migrate_guest_data RPC rejects payloads over 5000 attempts ('migration
  // payload too large'). Keep the most recent 5000 so a guest who somehow amassed
  // more can still migrate (scores + recent history) instead of failing forever and
  // never clearing the guest copy — the older tail of the attempt chart is dropped.
  const MAX_MIGRATED_ATTEMPTS = 5000;
  const history = (Array.isArray(local.history) ? local.history : []).slice(-MAX_MIGRATED_ATTEMPTS);
  const p_attempts = history
    .filter((evt) => evt && typeof evt === "object")
    .map((evt) => ({
      type: typeof evt.type === "string" ? evt.type : "attempt",
      subject: evt.subject || null,
      reasoning_score: clampScore(evt.reasoningScore),
      delta: typeof evt.delta === "number" ? evt.delta : null,
      new_score: clampScore(evt.newScore),
      total_after: typeof evt.totalAfter === "number" ? evt.totalAfter : null,
      phd_after: clampScore(evt.phdAfter),
      created_at: typeof evt.t === "string" ? evt.t : null,
    }));

  const sb = getSupabase();
  const { error } = await sb.rpc("migrate_guest_data", { p_scores, p_attempts });
  if (error) return { migrated: false, error };
  // The RPC is atomic + idempotent, so the guest copy is safe to clear now.
  writeLocal({ scores: null, history: [] });
  return { migrated: true };
}

// Permanently delete the current user's stored data (Profile → "Reset my
// progress"). Signed-in: deletes their scores + attempts rows. Guest: clears
// localStorage. Throws so the caller can surface an error.
export async function deleteAllUserData() {
  const uid = await activeUserId();
  if (!uid) {
    writeLocal({ scores: null, history: [] });
    return { ok: true };
  }
  const sb = getSupabase();
  // One transaction (RPC) so a partial failure can't leave scores without
  // attempts or vice versa.
  const { error } = await sb.rpc("delete_user_data");
  if (error) throw new Error(error.message || "Could not delete your data.");
  writeLocal({ scores: null, history: [] });
  return { ok: true };
}
