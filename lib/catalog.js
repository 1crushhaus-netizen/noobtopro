// ---------------------------------------------------------------------------
// CONCEPT HUB — browse catalog (client-side reads).
//
// The hub is a public, browsable directory. The browser reads it DIRECTLY from
// Supabase via PostgREST (no Groq, no API route): the public read policy on
// concept_guides exposes only vetted rows (visibility='public' AND
// status='ready'), and concept_topics is fully public. So both guests and
// signed-in users can browse the curated catalog; RLS guarantees nothing
// unapproved/hidden leaks here.
//
// Unapproved (hidden) guides are NOT readable through this path — by design.
// The admin browse overlay fetches those separately via the authenticated
// /api/admin/data route (see components/Noobtopro.jsx / LearnTab).
// ---------------------------------------------------------------------------

import { getSupabase } from "@/lib/supabase";
import { conceptKey as normalizeConceptKey } from "@/lib/conceptKey";
import { ORDER } from "@/lib/scoring";

// All curated Subject→Topic rows (labels + ordering for the directory).
// Returns [] when Supabase isn't configured (guest-only / SSR) or on error.
export async function loadTopics() {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from("concept_topics").select("subject, slug, label, sort").order("subject").order("sort");
  if (error || !data) return [];
  return data;
}

// Approved (public+ready) guides for the directory list. Optional subject filter
// + case-insensitive substring search on the concept label (plain ILIKE — fuzzy
// search is a v1.1 item). Returns lightweight rows (no `content`; the full guide
// is fetched on open via the cached /api/learn path). { error } on a DB failure
// so the UI can distinguish "empty" from "couldn't load".
export async function browsePublicConcepts({ subject, query } = {}) {
  const sb = getSupabase();
  if (!sb) return { concepts: [] };
  let q = sb.from("concept_guides").select("subject, concept, concept_key, topic, level_band").limit(500);
  if (subject && ORDER.includes(subject)) q = q.eq("subject", subject);
  const term = typeof query === "string" ? query.trim() : "";
  if (term) {
    // Escape ILIKE wildcards in user input so "%" / "_" are matched literally.
    const escaped = term.replace(/[\\%_]/g, (c) => `\\${c}`);
    q = q.ilike("concept", `%${escaped}%`);
  }
  q = q.order("subject").order("concept");
  const { data, error } = await q;
  if (error) return { error };
  return { concepts: data || [] };
}

// File a report about a guide. Signed-in only — the concept_reports RLS policy
// requires reporter_id = auth.uid(); guests are rejected (return a clear error).
// Returns { ok:true } or { error }.
export async function reportConcept({ subject, conceptKey, reason } = {}) {
  const sb = getSupabase();
  if (!sb) return { error: "Reporting isn't available right now." };
  if (!ORDER.includes(subject)) return { error: "Unknown subject." };
  const key = normalizeConceptKey(conceptKey);
  if (!key) return { error: "Nothing to report." };

  const { data: sess } = await sb.auth.getSession();
  const uid = sess && sess.session && sess.session.user && sess.session.user.id;
  if (!uid) return { error: "Please sign in to report a concept." };

  // Reports go through the submit_concept_report RPC (0011, audit P2-8): the direct
  // PostgREST INSERT is revoked, and the RPC caps each reporter at 20 OPEN reports so
  // the admin queue can't be flooded with distinct keys.
  const { data, error } = await sb.rpc("submit_concept_report", {
    p_subject: subject,
    p_concept_key: key,
    p_reason: typeof reason === "string" && reason.trim() ? reason.trim().slice(0, 1000) : null,
  });
  if (error) {
    // Schema-cache lag right after the 0011 deploy (the RPC not yet visible) — give a
    // human message instead of raw PostgREST text.
    if (error.code === "PGRST202") return { error: "Reporting is being upgraded — please try again in a minute." };
    return { error: error.message || "Could not submit the report." };
  }
  // "duplicate" = an already-open report for this guide by this user — success UX
  // (same as the old 23505 handling). "limited" = the open-report cap.
  if (data && data.status === "limited") {
    return { error: "You have too many open reports — please wait for the team to review them." };
  }
  return { ok: true };
}
