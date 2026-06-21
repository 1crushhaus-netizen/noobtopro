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
import { PRO_STATUSES, isActiveSubscription, isProSubscription, parseProductIds } from "@/lib/proStatus";

export { PRO_STATUSES, isActiveSubscription, isProSubscription, parseProductIds };

// The Pro product allow-list, from POLAR_PRODUCT_ID_PRO (comma-separated to allow e.g. a
// monthly + an annual plan). Empty when unset (Pro not sellable) -> the product check is
// skipped and the status-only predicate applies, exactly as before. Read lazily so it
// always reflects the current env (and tests can toggle it).
function proProductAllowlist() {
  return parseProductIds(process.env.POLAR_PRODUCT_ID_PRO);
}

// Internal read that DISTINGUISHES a transient failure from a confirmed answer, so the
// last-known-Pro cache (below) can fail OPEN on a blip but never on a confirmed not-Pro.
// Returns { row } on a definitive answer (row may be null = no subscription) or
// { error: true } when the store is configured but the query failed/threw (a transient
// condition). A missing store is NOT an error here — it's the deny-by-default answer.
async function readSubscriptionRow(userId) {
  if (!userId) return { row: null };
  const sb = getSupabaseAdmin();
  if (!sb) return { row: null }; // no service-role store -> nobody is Pro (confirmed, not transient)
  try {
    const { data, error } = await sb
      .from("subscriptions")
      .select("user_id,status,product_id,current_period_end,cancel_at_period_end,updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return { error: true };
    return { row: data || null };
  } catch {
    return { error: true };
  }
}

/**
 * Fetch the caller's subscription row via the service-role client (bypasses the
 * SELECT-own RLS so this works for the server gate). Returns null when there is no row,
 * on error, or when no service-role store is configured (deny-by-default).
 */
export async function getSubscriptionRow(userId) {
  const res = await readSubscriptionRow(userId);
  return res.error ? null : res.row;
}

// ---------------------------------------------------------------------------
// LAST-KNOWN-PRO cache (audit P2). getSubscriptionRow fails CLOSED on any query error, so a
// transient Supabase blip would momentarily downgrade a paying Pro user mid-session (and a
// gated route 402s them). To keep that correct-but-jarring failure from biting a confirmed
// payer, cache ONLY a confirmed Pro=true verdict per uid for a short TTL: on a transient
// ERROR (not a confirmed not-Pro), serve the cached Pro=true if still fresh. Guardrails:
//   - we cache ONLY Pro=true (never not-Pro) — so a confirmed not-Pro / no-row can never be
//     served as Pro, and a brand-new payer is never wrongly cached as Free.
//   - a confirmed read ALWAYS refreshes/expires the entry, so a cancel/downgrade takes effect
//     within one successful read (at worst TTL after the LAST confirmed Pro read).
//   - a COLD error (no fresh cached Pro) still denies — we never invent an entitlement.
// In-memory + per-instance (like the rate-limit fallback): a best-effort availability cushion
// for a blip, deliberately short so it can't paper over a real lapse.
const PRO_CACHE_TTL_MS = 60_000;
const proCache = new Map(); // uid -> expiresAt (epoch ms); presence == last-known Pro

function cacheKnownPro(userId, isPro, now = Date.now()) {
  if (!userId) return;
  if (isPro) {
    proCache.set(userId, now + PRO_CACHE_TTL_MS);
  } else {
    // A CONFIRMED not-Pro invalidates any stale Pro entry immediately (no grace for a lapse).
    proCache.delete(userId);
  }
}

function hasFreshCachedPro(userId, now = Date.now()) {
  const expiresAt = proCache.get(userId);
  if (expiresAt === undefined) return false;
  if (now >= expiresAt) {
    proCache.delete(userId); // expired -> drop it so the Map can't grow unbounded
    return false;
  }
  return true;
}

/**
 * Is the user (by id) Pro right now? The AUTHORITATIVE entitlement check that gates paid
 * features. Requires an active subscription AND — when POLAR_PRODUCT_ID_PRO is configured
 * — that the subscription is to the Pro product, so an active sub to a different product
 * in the same Polar org can never be mistaken for Pro.
 *
 * Fails OPEN on a TRANSIENT store error only when a fresh last-known-Pro verdict is cached
 * (see the cache above) — a cold error, a confirmed not-Pro, or no store all still deny.
 */
export async function isProUserId(userId) {
  const res = await readSubscriptionRow(userId);
  if (res.error) {
    // Transient store failure: serve the last-known Pro=true if still fresh, else deny.
    // We do NOT cache this result (it isn't a confirmed read).
    return hasFreshCachedPro(userId);
  }
  const isPro = isProSubscription(res.row, { allowedProductIds: proProductAllowlist() });
  cacheKnownPro(userId, isPro);
  return isPro;
}

// Test-only: clear the last-known-Pro cache so a module-level entry can't leak across cases.
export function _resetProCache() {
  proCache.clear();
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
