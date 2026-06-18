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
import { clampScore, clampSubjectScore, SCORE_MAX } from "@/lib/scoring";
import { normalizeMasteryMap, applyMasteryUpdates, masteryMapFromRows } from "@/lib/mastery";

const KEY = "noobtopro:v1";

function readLocal() {
  if (typeof window === "undefined") return null;
  try {
    return migrateLocalScale(JSON.parse(window.localStorage.getItem(KEY) || "null"));
  } catch {
    return null;
  }
}

// ONE-TIME guest 0–100 → 0–350 rescale (RANKS_PLAN §2–§3, shipped 2026-06-11).
// Blobs written before the rescale carry no `scale` stamp; multiply every
// SCORE-scale field ×3.5 (subject scores, attempt new_score/delta, totals, the
// phd index) and stamp `scale: 350` so it can never double-apply. QUALITY
// fields (reasoningScore, mastery counters) stay 0–100 by design. The glicko
// state is scale-free and untouched. Pure on the parsed blob (the migrated
// shape persists on the next writeLocal — no eager write needed).
function migrateLocalScale(raw) {
  if (!raw || typeof raw !== "object" || raw.scale === 350) return raw;
  const x35 = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 3.5) : v);
  if (raw.scores && typeof raw.scores === "object") {
    for (const k of Object.keys(raw.scores)) {
      if (raw.scores[k] && typeof raw.scores[k] === "object") raw.scores[k].score = x35(raw.scores[k].score);
    }
  }
  if (Array.isArray(raw.history)) {
    for (const e of raw.history) {
      if (!e || typeof e !== "object") continue;
      if (e.newScore !== undefined) e.newScore = x35(e.newScore);
      if (e.delta !== undefined) e.delta = x35(e.delta);
      if (e.totalAfter !== undefined) e.totalAfter = x35(e.totalAfter);
      if (e.phdAfter !== undefined) e.phdAfter = x35(e.phdAfter);
    }
  }
  raw.scale = 350;
  return raw;
}

// Returns true if the write persisted, false if it was a no-op (SSR) or failed
// (quota exceeded / storage blocked). Callers that must not silently lose data
// (saveProgress) check the result; fire-and-forget callers ignore it.
function writeLocal(state) {
  if (typeof window === "undefined") return false;
  try {
    // EVERY post-rescale write is scale-stamped, so migrateLocalScale can never
    // re-multiply a blob this code wrote (only genuinely pre-rescale blobs lack it).
    window.localStorage.setItem(KEY, JSON.stringify({ ...state, scale: 350 }));
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
  if (!raw || typeof raw !== "object") return { scores: null, history: [], mastery: {} };
  let scores = null;
  if (raw.scores && typeof raw.scores === "object") {
    scores = {};
    Object.keys(raw.scores).forEach((subject) => {
      const s = raw.scores[subject];
      if (!s || typeof s !== "object") return;
      const wc = s.weakConcepts;
      scores[subject] = {
        score: clampSubjectScore(s.score) ?? 0,
        weakConcepts: Array.isArray(wc) ? wc.filter((c) => typeof c === "string").slice(0, 64) : [],
        comment: typeof s.comment === "string" ? s.comment : "",
        // Per-subject rubric profile (radar chart) — derived from glicko. Kept as-is if
        // it's an object, else null — a hand-edited blob can't push a non-object into the chart.
        rubric: s.rubric && typeof s.rubric === "object" ? s.rubric : null,
        // Per-axis Glicko-2 state (the source of truth from which score + rubric derive).
        glicko: s.glicko && typeof s.glicko === "object" ? s.glicko : null,
      };
    });
    // An all-garbage blob (no usable subject survived) collapses to null, so the
    // guest path matches the signed-in path (hydrate() treats null as "new user" →
    // intro, not a 0/0/0 dashboard).
    if (Object.keys(scores).length === 0) scores = null;
  }
  const history = (Array.isArray(raw.history) ? raw.history : []).filter((e) => e && typeof e === "object");
  // Per-concept mastery counters (Learn-tab chip coloring). normalizeMasteryMap
  // allow-lists subjects + curriculum concept keys and clamps the counters, so a
  // hand-edited blob can't smuggle junk keys or non-numeric counters into state.
  const mastery = normalizeMasteryMap(raw.mastery);
  return { scores, history, mastery };
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
    // The persisted "why your rank moved" line (null for baselines / pre-0004 rows).
    rationale: r.rationale || null,
  };
}

// How many recent GUEST attempts keep their full review detail in localStorage (answer
// + feedback + worked solution). Bounds storage growth for a heavy guest; older attempts
// keep their lightweight history row but shed the heavy review payload.
const GUEST_REVIEW_KEEP = 25;

// Load the learner's reviewable past answers (newest first). Signed-in: "answer history"
// is a PRO feature, so reads go through the server route /api/reviews, which verifies the
// JWT and the Pro entitlement before returning rows via the service role (direct client
// SELECT on attempt_reviews is revoked — db/migrations/0018). A non-Pro caller gets 402
// (the UI already gates the drawer, so this is the server backstop). Guest: from the
// review detail embedded in the local history. Returns { reviews } or { error }.
export async function loadReviews() {
  const uid = await activeUserId();
  if (uid) {
    const sb = getSupabase();
    let token = null;
    try {
      const { data } = await sb.auth.getSession();
      token = (data && data.session && data.session.access_token) || null;
    } catch {
      /* fall through to the error below */
    }
    if (!token) return { error: new Error("Sign in to review your answers.") };
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: "{}",
      });
      if (res.status === 402) return { error: new Error("Answer history is a Pro feature.") };
      if (!res.ok) return { error: new Error("Couldn't load your past answers.") };
      const data = await res.json();
      return { reviews: Array.isArray(data.reviews) ? data.reviews : [] };
    } catch (e) {
      return { error: e };
    }
  }
  const s = sanitizeState(readLocal());
  const reviews = (s.history || [])
    .filter((h) => h && h.review && typeof h.review === "object")
    .slice(-50)
    .reverse()
    .map((h) => ({
      subject: h.subject,
      t: h.t,
      reasoningScore: h.reasoningScore,
      delta: h.delta,
      question: h.review.question || "",
      answer: h.review.answer || "",
      targetConcept: h.review.targetConcept || "",
      difficulty: h.review.difficulty || "",
      rubric: h.review.rubric || null,
      feedback: h.review.feedback && typeof h.review.feedback === "object" ? h.review.feedback : {},
    }));
  return { reviews };
}

// Load the learner's per-concept mastery map (Learn-tab chip coloring). Signed-in:
// read their OWN concept_mastery rows (RLS SELECT-own) directly via PostgREST; a
// missing table (DB predates migration 0010) surfaces as { error } and the UI just
// renders uncolored chips. Guest: from the sanitized local blob. Returns
// { mastery } or { error } — mastery is { [subject]: { [conceptKey]: counters } }.
export async function loadMastery() {
  const uid = await activeUserId();
  if (uid) {
    const sb = getSupabase();
    const { data, error } = await sb.from("concept_mastery").select("*").eq("user_id", uid);
    if (error) return { error };
    return { mastery: masteryMapFromRows(data) };
  }
  return { mastery: sanitizeState(readLocal()).mastery };
}

// Load the signed-in user's OWN subscription row (Polar "Pro" entitlement) for the UI:
// the Pro badge, the upgrade CTA, and the Dashboard trends/answer-history gate. Reads via
// the SELECT-own RLS policy (subscriptions_select_own) directly through PostgREST. Guests
// have no subscription (and no row) → { subscription: null }. A missing table (DB predates
// migration 0017) or any error surfaces as { subscription: null } too — the UI then simply
// treats the user as Free (deny-by-default, exactly like the server gate). The "is Pro"
// decision is the caller's, via lib/proStatus.js#isActiveSubscription, so this stays a
// thin row read.
export async function loadSubscription() {
  const uid = await activeUserId();
  if (!uid) return { subscription: null };
  const sb = getSupabase();
  if (!sb) return { subscription: null };
  try {
    const { data, error } = await sb
      .from("subscriptions")
      .select("status, product_id, current_period_end, cancel_at_period_end")
      .eq("user_id", uid)
      .maybeSingle();
    if (error || !data) return { subscription: null };
    return { subscription: data };
  } catch {
    return { subscription: null };
  }
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
      // NEWEST first + a hard limit (audit P2-11): unbounded ascending reads grew
      // with the account forever, and past PostgREST's max-rows cap (default 1000)
      // the ASCENDING order silently kept the OLDEST rows — freezing the dashboard
      // history. Newest-500 keeps charts accurate where it matters; we re-reverse
      // below so callers still see chronological order.
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(500),
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
      scores[r.subject] = { score: r.score, weakConcepts: r.weak_concepts || [], comment: r.comment || "", rubric: r.rubric || null, glicko: r.glicko || null };
    });
  }
  // Restore chronological (oldest→newest) order for the charts.
  return { scores, history: (attemptRows || []).map(rowToEvent).reverse() };
}

// Persist a score change + its attempt for a GUEST (localStorage). Signed-in users
// do NOT use this path: their scores are SERVER-AUTHORITATIVE — graded, computed, and
// persisted by /api/score for the verified auth.uid() (see app/api/score/route.js).
// The scores/attempts tables are SELECT-only under RLS, so the browser can no longer
// write them directly; the client routes signed-in saves through the server route and
// only calls this for guests. Returns { history } (the refreshed local attempt list)
// on success; throws on a failed write so the caller surfaces a banner.
export async function saveProgress(scores, evt, masteryUpdates) {
  const uid = await activeUserId();
  if (uid) {
    // Reaching here while signed in means a stale path tried to write the DB from the
    // browser (now blocked by RLS). Fail loudly rather than silently writing to the
    // wrong (local) store — the signed-in flow must go through /api/score.
    throw new Error("Signed-in progress is saved on the server, not locally.");
  }
  // Merge onto the SANITIZED stored blob (not the raw one) so a corrupt/typed
  // localStorage value can't be carried through the spread; sanitizeState guarantees
  // history is an array and scores is null or a normalized map.
  const s = sanitizeState(readLocal());
  // MERGE the (possibly single-subject) payload over the stored map, mirroring the
  // server's upsert-only-present-subjects semantics. submitPractice sends one subject,
  // so a replace here would wipe the other two; the full-map diagnostic merges cleanly.
  s.scores = { ...(s.scores || {}), ...scores };
  s.history = [...(s.history || []), evt];
  // Per-concept mastery counters ([{ subject, conceptKey, quality }], allow-listed in
  // applyMasteryUpdates) — written atomically with the score + attempt, mirroring the
  // server path where bump_concept_mastery rides the same graded attempt.
  if (Array.isArray(masteryUpdates) && masteryUpdates.length) {
    s.mastery = applyMasteryUpdates(s.mastery, masteryUpdates);
  }
  // Bound localStorage growth: keep the heavy `review` payload (answer + feedback +
  // worked solution) only on the most recent GUEST_REVIEW_KEEP attempts; older entries
  // shed it (their lightweight history row — score/delta/rationale — is retained).
  if (s.history.length > GUEST_REVIEW_KEEP) {
    const cutoff = s.history.length - GUEST_REVIEW_KEEP;
    s.history = s.history.map((h, i) => (i < cutoff && h && h.review ? { ...h, review: undefined } : h));
  }
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
      score: clampSubjectScore(local.scores[subject].score) ?? 0,
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
      // Carry the per-axis Glicko-2 state (the source of truth) so the unified score +
      // radar continue seamlessly after sign-in.
      glicko:
        local.scores[subject].glicko && typeof local.scores[subject].glicko === "object"
          ? local.scores[subject].glicko
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
      new_score: clampSubjectScore(evt.newScore),
      total_after: typeof evt.totalAfter === "number" ? evt.totalAfter : null,
      phd_after: clampSubjectScore(evt.phdAfter),
      created_at: typeof evt.t === "string" ? evt.t : null,
      // Carry the practiced bucket so the anti-farm repeat window survives sign-in.
      topic: typeof evt.topic === "string" ? evt.topic : undefined,
      band: typeof evt.band === "string" ? evt.band : undefined,
      // Carry the guest's embedded answer-review detail (question/answer/rubric/worked
      // solution) so it survives first sign-in: migrate_guest_data links it to the new
      // attempt id and writes attempt_reviews. Only practice attempts carry one; older
      // history rows already shed it (GUEST_REVIEW_KEEP), so the payload stays bounded.
      review: evt.review && typeof evt.review === "object" ? evt.review : undefined,
    }));

  const sb = getSupabase();
  // Carry the guest's per-concept mastery map across sign-in (first-writer-wins,
  // same as scores). normalizeMasteryMap means only real curriculum concepts with
  // clamped counters ever leave the device. Send p_mastery only when there IS any —
  // and if the DB predates the concept_mastery migration (PGRST202: no 3-arg
  // signature), retry without it so the scores/attempts migration still succeeds.
  const p_mastery = normalizeMasteryMap(local.mastery);
  const hasMastery = Object.keys(p_mastery).length > 0;
  let masteryMigrated = hasMastery;
  let { data, error } = await sb.rpc("migrate_guest_data", hasMastery ? { p_scores, p_attempts, p_mastery } : { p_scores, p_attempts });
  if (error && hasMastery && error.code === "PGRST202") {
    masteryMigrated = false;
    ({ data, error } = await sb.rpc("migrate_guest_data", { p_scores, p_attempts }));
  }
  if (error) return { migrated: false, error };
  // The RPC returns FALSE when the account already has data ("nothing to migrate").
  // Honor it (audit P1-4): the guest blob must NOT be cleared in that case — wiping
  // it silently destroyed real guest progress whenever someone signed back into an
  // existing account on a browser they'd practiced on as a guest.
  if (data === false) return { migrated: false, reason: "account-not-empty" };
  // The RPC is atomic + idempotent, so the guest copy is safe to clear now. If the
  // mastery map could NOT ride along (pre-migration DB → 2-arg fallback), keep it in
  // the local blob instead of destroying it — it costs a few KB and stays recoverable.
  writeLocal({ scores: null, history: [], ...(hasMastery && !masteryMigrated ? { mastery: p_mastery } : {}) });
  return { migrated: true };
}

// Permanently DELETE the signed-in user's whole ACCOUNT (right to erasure) — distinct
// from deleteAllUserData / "Reset my progress", which keeps the account. Goes through the
// server route /api/account/delete, which cancels any Pro subscription and hard-deletes
// the auth user (cascading all their data). On success, clears the local blob and signs
// out (the SIGNED_OUT handler then returns the app to the intro view). Guest: nothing to
// delete server-side -> just clears local. Throws so the caller can surface an error.
export async function deleteAccount() {
  const sb = getSupabase();
  const uid = await activeUserId();
  if (!uid) {
    writeLocal({ scores: null, history: [] });
    return { ok: true };
  }
  let token = null;
  try {
    const { data } = await sb.auth.getSession();
    token = (data && data.session && data.session.access_token) || null;
  } catch {
    /* fall through */
  }
  if (!token) throw new Error("Please sign in again to delete your account.");
  const res = await fetch("/api/account/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: "{}",
  });
  if (!res.ok) {
    let msg = "Could not delete your account.";
    try {
      const j = await res.json();
      if (j && j.error) msg = j.error;
    } catch {
      /* keep default */
    }
    throw new Error(msg);
  }
  writeLocal({ scores: null, history: [] });
  try {
    await sb.auth.signOut();
  } catch {
    /* the account is already gone; ignore a sign-out hiccup */
  }
  return { ok: true };
}

// Submit a self-declared date of birth to the server for 18+ age verification
// (noobtopro is adults-only). The server recomputes the age, rejects under-18, and —
// only on success — records `age_verified` in the account's app_metadata (which the
// client cannot edit). Returns { ok:true } on success; throws (with the server's
// message) on rejection so the gate can surface why. `dob` is an ISO "YYYY-MM-DD".
export async function submitAgeVerification(dob) {
  const sb = getSupabase();
  if (!sb) throw new Error("Sign-in is not configured.");
  let token = null;
  try {
    const { data } = await sb.auth.getSession();
    token = (data && data.session && data.session.access_token) || null;
  } catch {
    /* fall through */
  }
  if (!token) throw new Error("Please sign in again to continue.");
  const res = await fetch("/api/account/age", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ dob }),
  });
  if (!res.ok) {
    let msg = "Couldn't confirm your age. Please try again.";
    try {
      const j = await res.json();
      if (j && j.error) msg = j.error;
    } catch {
      /* keep default */
    }
    throw new Error(msg);
  }
  return { ok: true };
}

// GUEST 18+ self-attestation (noobtopro is adults-only). A signed-in account's age check is
// SERVER-authoritative (app_metadata.age_verified, set by /api/account/age); a guest has no
// account, so their one-time 18+ confirmation is recorded CLIENT-side in localStorage. We
// store only a boolean acknowledgement — never the date of birth — so no extra personal data
// is kept on the device. Cleared with the rest of the guest blob is NOT desired (the ack is a
// device-level fact, not progress), so it lives under its own key.
const AGE_ACK_KEY = "noobtopro:age_ack";

export function hasGuestAgeAck() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(AGE_ACK_KEY) === "1";
  } catch {
    return false;
  }
}

export function recordGuestAgeAck() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AGE_ACK_KEY, "1");
  } catch {
    /* storage blocked — the in-memory ack still gates this session */
  }
}

// Clear the guest 18+ acknowledgement (used when a guest self-declares as under 18, so the
// gate re-appears rather than silently letting them back in).
export function clearGuestAgeAck() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AGE_ACK_KEY);
  } catch {
    /* ignore */
  }
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
