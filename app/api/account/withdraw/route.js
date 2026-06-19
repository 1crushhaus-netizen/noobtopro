// ---------------------------------------------------------------------------
// /api/account/withdraw — the EU "Withdraw from contract here" function (CRD Art. 11a,
// applicable 19 June 2026) for the Pro subscription.
//
// Distinct from "cancel" (which the Polar portal handles, and which just stops future
// renewals at period end): WITHDRAWAL is the statutory 14-day right (Art. 16(a)/14(3)) —
// the consumer terminates IMMEDIATELY and is refunded all but a pro-rata amount for the
// part of the service already used.
//
// AUTHENTICATED POST. Identity comes only from the verified JWT. The flow:
//   1. Verify the caller is within the 14-day window (anchored on the recorded Art. 16(a)
//      consent — db/migrations/0025 billing_audit) and currently has an ACTIVE subscription.
//   2. Compute the pro-rata refund from the latest paid Polar order for the subscription.
//   3. REVOKE the Polar subscription immediately (the legally-required termination).
//   4. Issue the pro-rata refund via Polar (best-effort: a refund-API hiccup must not undo
//      the termination — we record it as pending for manual follow-up instead).
//   5. Record the withdrawal in billing_audit (durable-medium audit) and return an
//      on-screen confirmation the client shows + lets the user save/print.
//
// The subscription→inactive entitlement drop is driven by the Polar webhook (the revoke
// fires subscription.revoked); this route does not write the entitlement directly so it
// can't race the webhook's out-of-order guard.
//
// Server-only: service-role client + Polar secrets.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getPolar } from "@/lib/polar";
import { isActiveSubscription } from "@/lib/proStatus";
import { isWithinWithdrawalWindow, proRataRefundMinor, WITHDRAWAL_WINDOW_DAYS } from "@/lib/consent";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";
import { isCrossSiteRequest, isWrongContentType } from "@/lib/requestGuard";
import { reportRateLimit } from "@/lib/abuseDetection";

export const dynamic = "force-dynamic";

// The newest PAID order for a subscription (the current paid period we pro-rate against).
// Reads just the first page of orders.list (newest-first); returns null if none/unavailable.
async function latestPaidOrder(polar, subscriptionId) {
  try {
    const iter = await polar.orders.list({ subscriptionId, sorting: ["-created_at"], limit: 20 });
    for await (const page of iter) {
      const items = (page && page.result && page.result.items) || [];
      const paid = items.filter((o) => o && o.paid);
      if (paid.length) return paid[0];
      break; // first page is newest-first; one page is enough
    }
  } catch (e) {
    console.error("[/api/account/withdraw] orders.list failed", e);
  }
  return null;
}

export async function POST(req) {
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  if (isWrongContentType(req)) {
    return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
  }

  // Per-IP gate BEFORE auth (requireUser does an auth round-trip).
  const ipRl = await checkRateLimit(`${clientKey(req)}:withdraw`, { max: 8 });
  if (!ipRl.ok) {
    reportRateLimit({ req, route: "/api/account/withdraw" });
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(ipRl.retryAfter) } }
    );
  }

  const auth = await requireUser(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const uid = auth.user.id;

  const acctRl = await checkRateLimit(`acct:${uid}:withdraw`, { max: 8 });
  if (!acctRl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(acctRl.retryAfter) } }
    );
  }

  const admin = getSupabaseAdmin();
  const polar = getPolar();
  if (!admin || !polar) {
    return NextResponse.json({ error: "Withdrawal is not available right now." }, { status: 503 });
  }

  // The subscription to terminate (service-role read; bypasses the SELECT-own RLS).
  const { data: subRow, error: subErr } = await admin
    .from("subscriptions")
    .select("status, product_id, polar_subscription_id, polar_customer_id, current_period_end")
    .eq("user_id", uid)
    .maybeSingle();
  if (subErr) {
    console.error("[/api/account/withdraw] subscription read failed", subErr);
    return NextResponse.json({ error: "Could not process your withdrawal. Please try again." }, { status: 500 });
  }
  if (!subRow || !isActiveSubscription(subRow) || !subRow.polar_subscription_id) {
    return NextResponse.json(
      { error: "You don't have an active Pro subscription to withdraw from." },
      { status: 409 }
    );
  }

  // The 14-day window, anchored on the latest recorded Art. 16(a) consent (= contract start).
  const { data: consentRow } = await admin
    .from("billing_audit")
    .select("created_at")
    .eq("user_id", uid)
    .eq("kind", "immediate_access_consent")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const anchor = consentRow && consentRow.created_at;
  if (!isWithinWithdrawalWindow(anchor)) {
    return NextResponse.json(
      {
        error: `Your ${WITHDRAWAL_WINDOW_DAYS}-day withdrawal period has ended. You can still cancel future renewals from “Manage subscription.”`,
        code: "window_closed",
      },
      { status: 409 }
    );
  }

  const subId = subRow.polar_subscription_id;
  const now = new Date();

  // Compute the pro-rata refund from the latest paid order BEFORE revoking (revoking
  // doesn't change past orders, but we want the amount even if revoke is the failure point).
  const order = await latestPaidOrder(polar, subId);
  let refundMinor = 0;
  let currency = null;
  if (order) {
    currency = order.currency || null;
    const periodEnd = subRow.current_period_end || new Date(new Date(order.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000);
    const computed = proRataRefundMinor(order.netAmount, order.createdAt, periodEnd, now);
    // Never ask Polar to refund more than it says is still refundable on this order.
    const cap = Number.isFinite(order.refundableAmount) ? order.refundableAmount : computed;
    refundMinor = Math.max(0, Math.min(computed, cap));
  }

  // 1) TERMINATE immediately — the legally-required step. If this fails we have NOT
  //    refunded, so the user is unchanged; surface a retryable error.
  try {
    await polar.subscriptions.revoke({ id: subId });
  } catch (e) {
    console.error("[/api/account/withdraw] subscription revoke failed", e);
    return NextResponse.json({ error: "Could not complete your withdrawal. Please try again." }, { status: 502 });
  }

  // 2) Refund the pro-rata remainder (best-effort — termination already succeeded, so a
  //    refund-API error must not 500 the whole withdrawal; record it as pending for follow-up).
  let refund;
  if (order && refundMinor > 0) {
    try {
      const created = await polar.refunds.create({
        orderId: order.id,
        reason: "customer_request",
        amount: refundMinor,
        revokeBenefits: false, // the subscription revoke above already removes benefits
        comment: `EU 14-day right of withdrawal (CRD Art. 16(a)/14(3)) — pro-rata of order ${order.id}.`,
      });
      refund = { status: "issued", amountMinor: refundMinor, currency, refundId: (created && created.id) || null };
    } catch (e) {
      console.error("[/api/account/withdraw] refund.create failed", e);
      refund = { status: "pending_manual", amountMinor: refundMinor, currency };
    }
  } else if (order) {
    // Within the window but the period is (essentially) fully used → no remainder to refund.
    refund = { status: "none", amountMinor: 0, currency };
  } else {
    // No paid order found to refund against → flag for manual review.
    refund = { status: "pending_manual", amountMinor: 0, currency };
  }

  const withdrawnAt = now.toISOString();

  // 3) Durable-medium audit record (always written, even if the refund is pending).
  try {
    const { error: auditErr } = await admin.from("billing_audit").insert({
      user_id: uid,
      kind: "withdrawal",
      detail: {
        polarSubscriptionId: subId,
        polarOrderId: order ? order.id : null,
        refund,
        windowAnchor: anchor || null,
        withinDays: WITHDRAWAL_WINDOW_DAYS,
      },
    });
    if (auditErr) console.error("[/api/account/withdraw] withdrawal audit write failed", auditErr);
  } catch (e) {
    console.error("[/api/account/withdraw] withdrawal audit write threw", e);
  }

  // On-screen confirmation the client renders + lets the user save/print (the Art. 8(7)
  // durable-medium confirmation; Polar's Merchant-of-Record emails cover the billing side).
  return NextResponse.json({
    ok: true,
    withdrawnAt,
    terminated: true,
    refund,
  });
}
