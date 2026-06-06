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

function writeLocal(state) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked */
  }
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
  if (!uid) return readLocal();

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
      scores[r.subject] = { score: r.score, weakConcepts: r.weak_concepts || [], comment: r.comment || "" };
    });
  }
  return { scores, history: (attemptRows || []).map(rowToEvent) };
}

export async function saveScores(scores) {
  const uid = await activeUserId();
  if (!uid) {
    const s = readLocal() || { scores: null, history: [] };
    s.scores = scores;
    writeLocal(s);
    return s;
  }
  const sb = getSupabase();
  const rows = Object.keys(scores).map((subject) => ({
    user_id: uid,
    subject,
    score: scores[subject].score,
    weak_concepts: scores[subject].weakConcepts || [],
    comment: scores[subject].comment || "",
    updated_at: new Date().toISOString(),
  }));
  // supabase-js does NOT throw on a write failure (RLS denial, paused project,
  // network blip) — it resolves with { error }. Surface it so the caller's catch
  // can show an error instead of optimistically committing an unpersisted score.
  const { error } = await sb.from("scores").upsert(rows, { onConflict: "user_id,subject" });
  if (error) throw new Error(error.message || "Could not save your scores.");
  return { scores };
}

// Atomic per-update persist: write the subject-score change AND append its
// attempt-history row together. Signed-in users go through the save_progress RPC,
// which does both in ONE transaction (capturing auth.uid() once server-side), so a
// partial failure can't persist a score without its attempt — and the in-memory
// React state never diverges from what's stored. Guests get a single localStorage
// write of both. Returns { history } (refreshed attempt list) on success, or
// { history: null } if only the post-write refresh read failed (the write held).
// Throws on a write failure so the caller surfaces a banner (nothing was committed).
export async function saveProgress(scores, evt) {
  const uid = await activeUserId();
  if (!uid) {
    const s = readLocal() || { scores: null, history: [] };
    // MERGE the (possibly single-subject) payload over the stored map, mirroring
    // the signed-in save_progress RPC's upsert-only-present-subjects semantics.
    // submitPractice sends one subject, so a replace here would wipe the other two
    // from a guest's localStorage; the full-map diagnostic caller merges cleanly too.
    s.scores = { ...(s.scores || {}), ...scores };
    s.history = [...(s.history || []), evt];
    writeLocal(s);
    return { history: s.history };
  }
  const sb = getSupabase();
  const p_scores = Object.keys(scores).map((subject) => ({
    subject,
    score: scores[subject].score,
    weak_concepts: scores[subject].weakConcepts || [],
    comment: scores[subject].comment || "",
  }));
  const p_attempt = {
    type: evt.type,
    subject: evt.subject || null,
    reasoning_score: evt.reasoningScore != null ? evt.reasoningScore : null,
    delta: evt.delta != null ? evt.delta : null,
    new_score: evt.newScore != null ? evt.newScore : null,
    total_after: evt.totalAfter != null ? evt.totalAfter : null,
    phd_after: evt.phdAfter != null ? evt.phdAfter : null,
    created_at: evt.t || null,
  };
  const { error } = await sb.rpc("save_progress", { p_scores, p_attempt });
  if (error) throw new Error(error.message || "Could not save your progress.");

  // The write committed atomically; refresh history for the chart. A failed refresh
  // returns null so the caller keeps its current history (the new row appears on the
  // next hydrate) rather than blanking it.
  const { data, error: selectError } = await sb
    .from("attempts")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (selectError || !data) return { history: null };
  return { history: data.map(rowToEvent) };
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
        ? local.scores[subject].weakConcepts.filter((c) => typeof c === "string")
        : [],
      comment: typeof local.scores[subject].comment === "string" ? local.scores[subject].comment : "",
    }));

  const history = Array.isArray(local.history) ? local.history : [];
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
