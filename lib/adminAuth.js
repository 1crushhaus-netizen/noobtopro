// ---------------------------------------------------------------------------
// Server-only admin authorization for the /api/admin/* routes.
//
// The browser attaches its Supabase session JWT as `Authorization: Bearer <jwt>`.
// We VERIFY that token server-side (supabase.auth.getUser(token) validates it
// against the project and returns the real user) — we NEVER trust a client-
// supplied identity or any field in the request body — then check the verified
// user against a DENY-BY-DEFAULT allowlist held in server-only env vars:
//   ADMIN_EMAILS    comma-separated emails (matched case-insensitively to the JWT email)
//   ADMIN_USER_IDS  comma-separated Supabase auth user UUIDs (fallback)
// If BOTH are empty/unset there are NO admins (the admin surface stays dark).
//
// Server-only: imports the Supabase server SDK and reads secrets. Never import
// from a client component.
// ---------------------------------------------------------------------------

import { createClient } from "@supabase/supabase-js";

function parseList(v) {
  return String(v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function adminEmails() {
  return new Set(parseList(process.env.ADMIN_EMAILS).map((e) => e.toLowerCase()));
}

export function adminUserIds() {
  return new Set(parseList(process.env.ADMIN_USER_IDS));
}

// Is this VERIFIED Supabase user an admin? Deny-by-default: an empty allowlist
// matches no one.
//
// The id branch (ADMIN_USER_IDS) is the strongest — a UUID can't be claimed by
// registering an address. The email branch (ADMIN_EMAILS) only honors a CONFIRMED
// email: Supabase populates `user.email` for ANY identity, including an unconfirmed
// email/password signup, so without the email_confirmed_at gate an attacker who knows
// an admin's address could self-register it and gain admin if the email/password
// provider were ever enabled. OAuth providers (the app's only identity source today)
// always set email_confirmed_at, so this never rejects a legitimate admin.
export function isAdminUser(user) {
  if (!user || typeof user !== "object") return false;
  const emails = adminEmails();
  const ids = adminUserIds();
  if (emails.size === 0 && ids.size === 0) return false; // no allowlist => nobody
  if (typeof user.id === "string" && user.id && ids.has(user.id)) return true;
  const emailConfirmed = Boolean(user.email_confirmed_at || user.confirmed_at);
  const email = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
  if (emailConfirmed && email && emails.has(email)) return true;
  return false;
}

// Is this VERIFIED user age-confirmed (18+)? The flag lives in `app_metadata`, which —
// unlike `user_metadata` — the user CANNOT change via the client SDK (`updateUser` only
// writes user_metadata); only the service-role Admin API sets it, and only after the server
// has computed the age from a submitted date of birth (see /api/account/age). So this is a
// trustworthy, server-authoritative gate, not a client self-assertion.
export function isAgeVerified(user) {
  return !!(user && user.app_metadata && user.app_metadata.age_verified === true);
}

function bearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

let _verifyClient = null;
function verifyClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  if (!_verifyClient) {
    _verifyClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return _verifyClient;
}

/**
 * Verify the request's bearer token and return the authenticated Supabase user.
 *
 * Identity comes ONLY from the verified JWT (supabase.auth.getUser validates the
 * token against the project and returns the real user) — never from any field in
 * the request body. This is the per-user authentication primitive: requireAdmin
 * layers an allowlist check on top, and /api/score (server-authoritative scoring)
 * uses it to bind every write to the verified auth.uid().
 *
 * @returns {{user:object}} on success, or {error:string, status:number} where
 *   401 = missing/invalid token, 503 = Supabase not configured server-side.
 */
export async function requireUser(req) {
  const token = bearerToken(req);
  if (!token) return { error: "Authentication required.", status: 401 };
  const sb = verifyClient();
  if (!sb) return { error: "Sign-in is not configured.", status: 503 };
  try {
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data || !data.user) return { error: "Invalid or expired session.", status: 401 };
    return { user: data.user };
  } catch {
    return { error: "Invalid or expired session.", status: 401 };
  }
}

/**
 * Verify the request's bearer token AND admin membership. Builds on requireUser,
 * then checks the verified user against the deny-by-default allowlist.
 * @returns {{user:object}} on success, or {error:string, status:number} where
 *   401 = missing/invalid token, 403 = authenticated but not an admin,
 *   503 = Supabase not configured server-side.
 */
export async function requireAdmin(req) {
  const res = await requireUser(req);
  if (res.error) return res;
  if (!isAdminUser(res.user)) return { error: "Not authorized.", status: 403 };
  return { user: res.user };
}

// Test-only: drop the cached verify client so a test can swap env/mocks.
export function _resetVerifyClient() {
  _verifyClient = null;
}
