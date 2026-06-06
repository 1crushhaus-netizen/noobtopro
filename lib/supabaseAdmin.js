// ---------------------------------------------------------------------------
// Server-only Supabase admin client (service-role key) for API routes.
//
// Used by /api/learn to read/write the SHARED, internal concept_guides cache.
// The service-role key bypasses RLS, so the cache table can stay fully private
// (RLS on, no policies) — only this server code can touch it, and no end user
// can read or pollute the shared guides.
//
// IMPORTANT: SUPABASE_SERVICE_ROLE_KEY is a SECRET. It has NO NEXT_PUBLIC_ prefix
// so it is never sent to the browser. If it isn't set, getSupabaseAdmin() returns
// null and the caller simply skips caching (the app still works, just without the
// shared cache). Add it in Vercel (Settings → Environment Variables, mark
// Sensitive) — value from Supabase → Settings → API → service_role secret.
// ---------------------------------------------------------------------------

import { createClient } from "@supabase/supabase-js";

let _admin = null;

export function getSupabaseAdmin() {
  // Read env lazily (not at module load) so the client reflects the current env.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  if (!_admin) {
    _admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}

// Normalize a concept into a stable cache key so trivial phrasing differences
// (case, surrounding whitespace/quotes, internal spacing) share one guide.
export function conceptKey(concept) {
  // Stable cache key, kept byte-for-byte identical to the SQL _concept_key()
  // (db/schema.sql) so grader-registered keys match generated ones. Steps MUST
  // mirror the SQL exactly:
  //   1. strip control/format chars (C0, DEL+C1, zero-width, BOM) — the chars
  //      where JS \s / String.trim() and Postgres \s disagree — so the two
  //      normalizers cannot diverge on exotic input;
  //   2. trim -> lowercase -> strip surrounding quote runs -> collapse whitespace;
  //   3. truncate to 200 by CODE POINT (Array.from), matching SQL left(), so an
  //      astral/emoji char straddling position 200 isn't split into a lone surrogate.
  const cleaned = String(concept ?? "").replace(/[\x00-\x1F\x7F-\x9F​-‍﻿]/g, "");
  const normalized = cleaned
    .trim()
    .toLowerCase()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ");
  return Array.from(normalized).slice(0, 200).join("");
}
