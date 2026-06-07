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

// conceptKey lives in the client-safe lib/conceptKey.js (so the browse UI can use
// it without importing this server-only module). Re-exported here for the server
// callers (and tests) that import it from "@/lib/supabaseAdmin".
export { conceptKey } from "@/lib/conceptKey";
