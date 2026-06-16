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
