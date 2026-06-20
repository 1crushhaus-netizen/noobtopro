// ---------------------------------------------------------------------------
// Supabase browser client + auth helpers.
//
// The client is created lazily and only if the public env vars are present, so
// the app still runs out of the box (in guest/local mode) before Supabase is
// configured. The anon key is safe to expose in the browser BECAUSE row-level
// security (see the schema in the README) restricts every row to its owner.
// ---------------------------------------------------------------------------

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anon);

let _client = null;
let _loading = null;

// PERF (Lighthouse "Reduce unused JavaScript" + "Legacy JavaScript"): @supabase/supabase-js
// is ~240 KiB raw (it bundles its own core-js, which is what Lighthouse flags as legacy JS).
// A first-time, signed-out visitor — the landing page Lighthouse measures — never needs auth
// until they interact, yet a STATIC `import` forced the whole library into the page's initial,
// critical bundle. This DYNAMIC import code-splits it into its own chunk that loads AFTER
// hydration (when the auth bootstrap below first calls ensureSupabase), off the critical path.
//
// ensureSupabase() loads-and-creates the client on first use and caches it; concurrent callers
// share one in-flight import (single-flight). Returns null when Supabase isn't configured or on
// the server. The data layer (lib/store.js) and the auth bootstrap (components/Noobtopro.jsx)
// `await ensureSupabase()` before touching the client.
export async function ensureSupabase() {
  if (!isSupabaseConfigured) return null;
  if (typeof window === "undefined") return null; // browser-side only here
  if (_client) return _client;
  if (!_loading) {
    _loading = import("@supabase/supabase-js")
      .then(({ createClient }) => {
        // PKCE (authorization-code) flow instead of the implicit flow, so the OAuth
        // tokens are exchanged server-to-server rather than exposed in the URL fragment.
        if (!_client) _client = createClient(url, anon, { auth: { flowType: "pkce" } });
        return _client;
      })
      .finally(() => {
        _loading = null;
      });
  }
  return _loading;
}

// Synchronous accessor for the ALREADY-loaded client. Returns null until ensureSupabase()
// has resolved at least once (or when Supabase isn't configured / on the server). Call sites
// that may run before the dynamic import finishes await ensureSupabase() first; this stays a
// cheap synchronous getter for code that already knows the client is loaded.
export function getSupabase() {
  if (!isSupabaseConfigured) return null;
  if (typeof window === "undefined") return null;
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
  const sb = await ensureSupabase();
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
  // Use the already-loaded client if present (the user must have signed in to sign out,
  // so it's cached); ensureSupabase() is a safe no-op load otherwise.
  const sb = _client || (await ensureSupabase());
  if (sb) await sb.auth.signOut();
}
