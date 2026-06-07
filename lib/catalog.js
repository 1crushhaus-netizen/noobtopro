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

  const { error } = await sb.from("concept_reports").insert({
    subject,
    concept_key: key,
    reporter_id: uid,
    reason: typeof reason === "string" && reason.trim() ? reason.trim().slice(0, 1000) : null,
  });
  if (error) {
    // Duplicate of an already-open report by this user (concept_reports_one_open_per_user
    // unique index, anti-flooding) — treat as success so the user sees "reported", not an
    // error, and we don't spam the admin queue.
    if (error.code === "23505") return { ok: true };
    return { error: error.message || "Could not submit the report." };
  }
  return { ok: true };
}
