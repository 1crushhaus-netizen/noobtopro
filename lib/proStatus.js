// ---------------------------------------------------------------------------
// CLIENT-SAFE Pro entitlement predicate (Polar.sh monetization).
//
// The single "is this subscription row Pro right now?" decision, kept in a
// dependency-free module so BOTH sides can import it identically:
//   - the SERVER gate (lib/entitlements.js re-exports these for the API routes), and
//   - the BROWSER UI (lib/store.js#loadSubscription → the Pro badge / upgrade CTA /
//     the Dashboard trends+history gate), which reads its OWN SELECT-own subscriptions
//     row via PostgREST.
//
// "Is Pro" lives HERE (one place), NOT as a SQL CHECK enum, so an unrecognized future
// Polar status simply reads as non-Pro instead of breaking the webhook write (see
// db/migrations/0017_pro_subscriptions.sql for the rationale). This module imports
// nothing server-only, so it is safe in a client component.
// ---------------------------------------------------------------------------

// Polar SubscriptionStatus values that grant Pro access. `trialing` is included so a
// trial gets Pro; add others here (never in the DB) if Polar's vocabulary changes.
export const PRO_STATUSES = new Set(["active", "trialing"]);

/**
 * Pure predicate: does this subscription row currently grant Pro?
 * Pro = an allow-listed active status AND not past the paid period (a missed/late
 * revoke webhook still can't extend access past current_period_end). `now` is
 * injectable for tests. Accepts the snake_case row shape stored in the DB /
 * returned by PostgREST (status, current_period_end).
 */
export function isActiveSubscription(row, now = Date.now()) {
  if (!row || typeof row !== "object") return false;
  if (!PRO_STATUSES.has(row.status)) return false;
  if (row.current_period_end != null) {
    const end = Date.parse(row.current_period_end);
    // A finite, already-elapsed period end means the entitlement has lapsed. An
    // unparseable value is ignored (status already gated it) rather than trusted.
    if (Number.isFinite(end) && end <= now) return false;
  }
  return true;
}

/**
 * Parse a POLAR_PRODUCT_ID_PRO value into a trimmed, de-duplicated list of product ids.
 * Comma-separated so multiple Pro products (e.g. a monthly + an annual plan) can all map
 * to the same entitlement. Returns [] for empty/unset (the caller then skips the product
 * check entirely — see isProSubscription).
 */
export function parseProductIds(raw) {
  if (typeof raw !== "string") return [];
  return [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
}

/**
 * The full Pro decision: the row is an active subscription (status + period, via
 * isActiveSubscription) AND — when a non-empty allow-list of Pro product ids is supplied
 * — to one of THOSE products.
 *
 * The product check is what stops an active subscription to a DIFFERENT Polar product (a
 * future cheaper/free/legacy tier in the same org) from being mistaken for the paid Pro
 * tier. An empty/omitted allow-list keeps the status-only behavior, which is what the
 * BROWSER uses (it can't read the server-only product id) and what a deployment with no
 * POLAR_PRODUCT_ID_PRO configured falls back to. The authoritative SERVER gate
 * (lib/entitlements.js) always passes the configured allow-list, so the gate that
 * actually unlocks paid features is product-checked.
 */
export function isProSubscription(row, { now = Date.now(), allowedProductIds = null } = {}) {
  if (!isActiveSubscription(row, now)) return false;
  if (allowedProductIds && allowedProductIds.length > 0) {
    return typeof row.product_id === "string" && allowedProductIds.includes(row.product_id);
  }
  return true;
}
