// ---------------------------------------------------------------------------
// /api/webhooks/polar — the ENTITLEMENT WRITE PATH for the paid "Pro" tier.
//
// Polar POSTs subscription lifecycle events here. We VERIFY the signature against
// POLAR_WEBHOOK_SECRET (validateEvent uses the Standard Webhooks scheme — the
// webhook-id/webhook-timestamp/webhook-signature headers), then record the latest
// subscription state for the mapped user via the service-role-only upsert_subscription
// RPC (db/schema.sql). The "is Pro" decision is NOT made here — we store the raw status
// and lib/proStatus.js#isActiveSubscription decides, so an unrecognized future Polar
// status can never abort the upsert and silently drop an entitlement.
//
// SECURITY: the signature IS the authentication (no JWT, no same-origin guard — this is
// an external caller). user_id is resolved from the event's customer external-id (the
// verified uid the checkout route set), with the checkout metadata as a fallback; an
// unmappable event is acknowledged-and-skipped (200) rather than retried forever.
//
// Server-only: reads POLAR_WEBHOOK_SECRET + writes through the service-role client.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { verifyPolarWebhook, WebhookSignatureError } from "@/lib/polarWebhook";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// We upsert the entitlement on every subscription.* event uniformly: the row always
// reflects the NEWEST state, and isActiveSubscription (status + current_period_end)
// derives Pro from it. So a "canceled at period end" sub (status still active until the
// period end) keeps Pro until it lapses, and a revoke flips it off immediately.
const SUBSCRIPTION_EVENT = /^subscription\./;

function isoOrNull(d) {
  if (!d) return null;
  // The SDK parses currentPeriodEnd to a Date; tolerate a raw string too.
  if (d instanceof Date) return Number.isNaN(d.getTime()) ? null : d.toISOString();
  const t = Date.parse(d);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

// Resolve our Supabase user_id from a subscription event. The checkout route set
// externalCustomerId = auth.uid() (the reliable mapping); metadata.user_id is the
// belt-and-suspenders fallback.
function resolveUserId(sub) {
  const ext = sub && sub.customer && sub.customer.externalId;
  if (typeof ext === "string" && ext) return ext;
  const meta = sub && sub.metadata && sub.metadata.user_id;
  if (typeof meta === "string" && meta) return meta;
  return null;
}

export async function POST(req) {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) {
    // No secret configured -> the webhook is inert (deny-by-default). 503 so a
    // misconfiguration is visible in Polar's delivery log rather than silently 200'd.
    console.error("[/api/webhooks/polar] POLAR_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  // Standard Webhooks verifies over the RAW body — read it as text, never parsed JSON.
  const body = await req.text();
  const headers = Object.fromEntries(req.headers); // Headers iterate lowercased

  let event;
  try {
    event = verifyPolarWebhook(body, headers, secret);
  } catch (e) {
    if (e instanceof WebhookSignatureError) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 403 });
    }
    console.error("[/api/webhooks/polar] parse error", e);
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  // We only act on subscription lifecycle events; everything else (orders, checkouts,
  // benefits, …) is acknowledged so Polar stops retrying.
  if (!SUBSCRIPTION_EVENT.test(event.type || "")) {
    return NextResponse.json({ received: true, ignored: event.type }, { status: 202 });
  }

  const sub = event.data || {};
  const userId = resolveUserId(sub);
  if (!userId) {
    // Can't map the purchase to an account — log and ACK (a retry won't add a mapping).
    console.error("[/api/webhooks/polar] no user_id on event", event.type, sub && sub.id);
    return NextResponse.json({ received: true, unmapped: true }, { status: 202 });
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    // The entitlement store isn't configured — fail with 500 so Polar RETRIES (this is a
    // transient/ops condition, not a permanent skip; a dropped entitlement locks out a
    // paying customer).
    console.error("[/api/webhooks/polar] no service-role store configured");
    return NextResponse.json({ error: "Entitlement store unavailable." }, { status: 500 });
  }

  try {
    const { error } = await sb.rpc("upsert_subscription", {
      p_user: userId,
      p_status: typeof sub.status === "string" ? sub.status : "inactive",
      p_product_id: typeof sub.productId === "string" ? sub.productId : null,
      p_polar_customer_id: typeof sub.customerId === "string" ? sub.customerId : null,
      p_polar_subscription_id: typeof sub.id === "string" ? sub.id : null,
      p_current_period_end: isoOrNull(sub.currentPeriodEnd),
      p_cancel_at_period_end: sub.cancelAtPeriodEnd === true,
    });
    if (error) throw error;
    return NextResponse.json({ received: true });
  } catch (e) {
    // The user was deleted (account erasure) between the event and now: upsert hits the
    // user_id FK (23503). There's no account to entitle, so ACK (202) instead of 500 —
    // otherwise Polar retries the same doomed delivery for hours against a gone user.
    if (e && e.code === "23503") {
      console.warn("[/api/webhooks/polar] subscription event for a deleted user — acknowledging", userId);
      return NextResponse.json({ received: true, userGone: true }, { status: 202 });
    }
    // 500 -> Polar retries with backoff, so a transient DB hiccup doesn't drop the
    // entitlement update permanently.
    console.error("[/api/webhooks/polar] upsert_subscription failed", e);
    return NextResponse.json({ error: "Could not record subscription." }, { status: 500 });
  }
}
