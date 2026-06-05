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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let _admin = null;

export function getSupabaseAdmin() {
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
  return String(concept || "")
    .trim()
    .toLowerCase()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 200);
}
