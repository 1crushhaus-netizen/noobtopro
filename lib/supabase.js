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
  // PKCE (authorization-code) flow instead of the implicit flow, so the OAuth
  // tokens are exchanged server-to-server rather than exposed in the URL fragment.
  if (!_client) _client = createClient(url, anon, { auth: { flowType: "pkce" } });
  return _client;
}

// OAuth providers offered in the sign-in menu. We intentionally offer NO
// email/password sign-in: identity is delegated entirely to these providers so
// we never store credentials.
//
// GitHub and Discord are gated behind build-time env flags so a button only
// goes live once its provider is actually configured in Supabase (otherwise it
// would error on click). To enable one: finish the provider setup in Supabase
// (see AUTH_PROVIDERS.md), then set the matching NEXT_PUBLIC_ENABLE_* var to
// "true" in Vercel and redeploy. Default is off.
const on = (v) => v === "true";
export const PROVIDERS = [
  { id: "google", label: "Google", enabled: true },
  { id: "github", label: "GitHub", enabled: on(process.env.NEXT_PUBLIC_ENABLE_GITHUB) },
  { id: "discord", label: "Discord", enabled: on(process.env.NEXT_PUBLIC_ENABLE_DISCORD) },
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
