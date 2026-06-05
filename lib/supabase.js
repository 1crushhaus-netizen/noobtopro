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

// OAuth providers offered in the sign-in menu. `enabled` flips a provider on
// once its OAuth app is created and the provider is enabled in Supabase — see
// FEATURE_PLAN.md §7. We intentionally offer NO email/password sign-in: identity
// is delegated entirely to these providers so we never store credentials.
export const PROVIDERS = [
  { id: "google", label: "Google", enabled: true },
  { id: "github", label: "GitHub", enabled: false },
  { id: "discord", label: "Discord", enabled: false },
];

export async function signInWithProvider(provider) {
  const sb = getSupabase();
  if (!sb) return { error: new Error("Sign-in is not configured.") };
  // Returns { data, error }; on success this kicks off a full-page redirect.
  return sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin },
  });
}

// Back-compat wrapper.
export async function signInWithGoogle() {
  return signInWithProvider("google");
}

export async function signOutUser() {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}
