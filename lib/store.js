// ---------------------------------------------------------------------------
// DATA LAYER
//
// The UI only ever calls these functions. They transparently use Supabase when
// a user is signed in (durable, multi-device, scoped per user by row-level
// security) and fall back to the browser's localStorage for guests, so the app
// is fully usable before anyone signs in.
//
// Note: guest (local) progress is NOT auto-migrated on first sign-in — a
// signed-in user starts from their own (initially empty) Supabase record.
// ---------------------------------------------------------------------------

import { getSupabase } from "@/lib/supabase";

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

export async function recordAttempt(evt) {
  const uid = await activeUserId();
  if (!uid) {
    const s = readLocal() || { scores: null, history: [] };
    s.history = [...(s.history || []), evt];
    writeLocal(s);
    return s;
  }
  const sb = getSupabase();
  const { error: insertError } = await sb.from("attempts").insert({
    user_id: uid,
    type: evt.type,
    subject: evt.subject || null,
    reasoning_score: evt.reasoningScore != null ? evt.reasoningScore : null,
    delta: evt.delta != null ? evt.delta : null,
    new_score: evt.newScore != null ? evt.newScore : null,
    total_after: evt.totalAfter != null ? evt.totalAfter : null,
    phd_after: evt.phdAfter != null ? evt.phdAfter : null,
  });
  if (insertError) throw new Error(insertError.message || "Could not record your attempt.");

  const { data, error: selectError } = await sb
    .from("attempts")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  // The insert succeeded; if the refresh read fails, return history: null so the
  // caller keeps its current history instead of blanking the chart. The new row
  // will appear on the next hydrate.
  if (selectError || !data) return { history: null };
  return { history: data.map(rowToEvent) };
}

// Clears the LOCAL (guest) session view only — never deletes a signed-in
// user's stored data. Wire an explicit "delete my data" action if you want
// destructive clears for signed-in accounts.
export async function resetAll() {
  writeLocal({ scores: null, history: [] });
}
