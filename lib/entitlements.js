// ---------------------------------------------------------------------------
// Server-only entitlements for the paid "Pro" tier (Polar.sh monetization).
//
// This module answers ONE question: "is this caller Pro right now?" It is read-only.
// The WRITE path is the Polar webhook (app/api/webhooks/polar/route.js) which records
// the latest subscription state via the service-role upsert_subscription RPC (see
// db/schema.sql).
//
// "Is Pro" is decided in lib/proStatus.js (one place), not as a SQL CHECK enum, so an
// unrecognized future Polar status simply reads as non-Pro instead of breaking the
// webhook write. That predicate is dependency-free so the browser UI can share it; this
// module re-exports it (+ PRO_STATUSES) for the server callers/tests that import from here.
//
// DENY-BY-DEFAULT: with no SUPABASE_SERVICE_ROLE_KEY configured (local/dev/CI/tests),
// getSupabaseAdmin() returns null and EVERYONE is treated as Free — the safe default,
// matching how the shared caches / admin surface degrade when the key is absent.
//
// Server-only: imports the service-role admin client and the JWT verifier. Never import
// from a client component.
// ---------------------------------------------------------------------------

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/adminAuth";
import { PRO_STATUSES, isActiveSubscription } from "@/lib/proStatus";

export { PRO_STATUSES, isActiveSubscription };

/**
 * Fetch the caller's subscription row via the service-role client (bypasses the
 * SELECT-own RLS so this works for the server gate). Returns null when there is no row,
 * on error, or when no service-role store is configured (deny-by-default).
 */
export async function getSubscriptionRow(userId) {
  if (!userId) return null;
  const sb = getSupabaseAdmin();
  if (!sb) return null; // no service-role store -> nobody is Pro
  try {
    const { data, error } = await sb
      .from("subscriptions")
      .select("user_id,status,product_id,current_period_end,cancel_at_period_end,updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

/** Is the user (by id) Pro right now? */
export async function isProUserId(userId) {
  return isActiveSubscription(await getSubscriptionRow(userId));
}

/**
 * Non-erroring resolution of the caller and their Pro state. A guest (no/invalid token)
 * resolves to { user: null, isPro: false } WITHOUT a DB hit. Use in routes that BRANCH
 * on Pro rather than block — e.g. /api/grade applying a free daily-practice cap only to
 * non-Pro callers.
 * @returns {Promise<{user: object|null, isPro: boolean}>}
 */
export async function proStatusFromRequest(req) {
  const res = await requireUser(req);
  if (res.error || !res.user) return { user: null, isPro: false };
  return { user: res.user, isPro: await isProUserId(res.user.id) };
}

/**
 * Hard gate for Pro-only routes (e.g. photo-of-work grading, data export). Builds on
 * requireUser, then checks the entitlement.
 * @returns {Promise<{user: object}>} on success, or {error, status} where
 *   401 = missing/invalid token, 402 = authenticated but not Pro (Payment Required),
 *   503 = Supabase not configured server-side.
 */
export async function requireProUser(req) {
  const res = await requireUser(req);
  if (res.error) return res;
  if (!(await isProUserId(res.user.id))) {
    return { error: "Pro subscription required.", status: 402 };
  }
  return { user: res.user };
}
