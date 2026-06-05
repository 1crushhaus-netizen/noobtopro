// ---------------------------------------------------------------------------
// Supabase browser client + auth helpers.
//
// The client is created lazily and only if the public env vars are present, so
// the app still runs out of the box (in guest/local mode) before Supabase is
// configured. The anon key is safe to expose in the browser BECAUSE row-level
// security (see the schema in the README) restricts every row to its owner.
// ---------------------------------------------------------------------------

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anon);

let _client = null;

export function getSupabase() {
  if (!isSupabaseConfigured) return null;
  if (typeof window === "undefined") return null; // browser-side only here
  if (!_client) _client = createClient(url, anon);
  return _client;
}

export async function signInWithGoogle() {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
}

export async function signOutUser() {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}
