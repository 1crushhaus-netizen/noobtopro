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
// matches no one. Email is matched case-insensitively; an admin must have a
// non-empty email (OAuth providers supply a verified one).
export function isAdminUser(user) {
  if (!user || typeof user !== "object") return false;
  const emails = adminEmails();
  const ids = adminUserIds();
  if (emails.size === 0 && ids.size === 0) return false; // no allowlist => nobody
  const email = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
  if (email && emails.has(email)) return true;
  if (typeof user.id === "string" && user.id && ids.has(user.id)) return true;
  return false;
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
 * Verify the request's bearer token and admin membership.
 * @returns {{user:object}} on success, or {error:string, status:number} where
 *   401 = missing/invalid token, 403 = authenticated but not an admin,
 *   503 = Supabase not configured server-side.
 */
export async function requireAdmin(req) {
  const token = bearerToken(req);
  if (!token) return { error: "Authentication required.", status: 401 };
  const sb = verifyClient();
  if (!sb) return { error: "Admin is not configured.", status: 503 };
  let user = null;
  try {
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data || !data.user) return { error: "Invalid or expired session.", status: 401 };
    user = data.user;
  } catch {
    return { error: "Invalid or expired session.", status: 401 };
  }
  if (!isAdminUser(user)) return { error: "Not authorized.", status: 403 };
  return { user };
}

// Test-only: drop the cached verify client so a test can swap env/mocks.
export function _resetVerifyClient() {
  _verifyClient = null;
}
