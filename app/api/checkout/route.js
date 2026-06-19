// ---------------------------------------------------------------------------
// /api/checkout — start a Polar.sh checkout for the paid "Pro" tier.
//
// AUTHENTICATED POST (not the unauthenticated redirect-GET adapter): the signed-in
// user's Supabase JWT is verified, and THE SERVER binds the Polar checkout to that
// VERIFIED uid (externalCustomerId = auth.uid()). The browser never supplies the
// identity — otherwise a caller could pass someone else's uid as the external id and
// have the webhook grant THEM Pro. The client POSTs (with the Bearer token), gets back
// { url }, and navigates there.
//
// Same-origin + JSON guards + per-IP rate limit, like the other routes. Deny-by-default:
// no POLAR_ACCESS_TOKEN / no POLAR_PRODUCT_ID_PRO -> 503 (nothing to buy yet).
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/adminAuth";
import { getPolar, proProductId, successUrl } from "@/lib/polar";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";
import { isCrossSiteRequest, isWrongContentType } from "@/lib/requestGuard";
import { IMMEDIATE_ACCESS_CONSENT_TEXT, IMMEDIATE_ACCESS_CONSENT_VERSION } from "@/lib/consent";

export const dynamic = "force-dynamic";

export async function POST(req) {
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  if (isWrongContentType(req)) {
    return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
  }

  // A checkout creates a Polar API call; rate-limit it per IP so it can't be hammered.
  const rl = await checkRateLimit(`${clientKey(req)}:checkout`, { max: 12 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  // Identity comes ONLY from the verified JWT (never the request body).
  const auth = await requireUser(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const uid = auth.user.id;
  const email = typeof auth.user.email === "string" ? auth.user.email : undefined;

  // CRD Art. 16(a): Pro is a digital SERVICE supplied immediately, so the consumer must
  // EXPRESSLY request that performance begin now and acknowledge they lose the right of
  // withdrawal once fully performed. The checkout dialog captures that as a required,
  // unticked checkbox; refuse to start a sale without it. (body.consentVersion lets the
  // client report exactly which wording it showed; we record our canonical text either way.)
  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if (!body || body.consent !== true) {
    return NextResponse.json(
      { error: "Please confirm you want immediate access to start your subscription." },
      { status: 400 }
    );
  }
  const consentVersion = typeof body.consentVersion === "string" ? body.consentVersion : IMMEDIATE_ACCESS_CONSENT_VERSION;

  // Durable PER-ACCOUNT cap (audit 02 P1-3): the per-IP limiter + Sec-Fetch-Site guard are
  // bypassable by a non-browser client, so bound Polar checkout-session creation per account
  // too (identity is JWT-bound, so this can't start a checkout for someone else — just rate it).
  const acctRl = await checkRateLimit(`acct:${uid}:checkout`, { max: 12 });
  if (!acctRl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(acctRl.retryAfter) } }
    );
  }

  const polar = getPolar();
  const productId = proProductId();
  if (!polar || !productId) {
    return NextResponse.json({ error: "Checkout is not available right now." }, { status: 503 });
  }

  // Origin of THIS request (for the success-URL fallback) — server-derived, not body-supplied.
  let origin;
  try {
    origin = new URL(req.url).origin;
  } catch {
    origin = undefined;
  }

  // Record the Art. 16(a) consent BEFORE creating the session — this row is the durable
  // audit AND the anchor for the 14-day withdrawal window the dashboard offers later. The
  // service-role client bypasses RLS (the table is SELECT-own for the owner, write-revoked).
  // Best-effort: a paying customer must not be blocked by an audit-write hiccup (the consent
  // flag itself already gates the sale), but we log loudly so a failure is followed up.
  const admin = getSupabaseAdmin();
  if (admin) {
    try {
      const { error: auditErr } = await admin
        .from("billing_audit")
        .insert({
          user_id: uid,
          kind: "immediate_access_consent",
          detail: { version: consentVersion, text: IMMEDIATE_ACCESS_CONSENT_TEXT },
        });
      if (auditErr) console.error("[/api/checkout] consent audit write failed", auditErr);
    } catch (e) {
      console.error("[/api/checkout] consent audit write threw", e);
    }
  }

  try {
    const session = await polar.checkouts.create({
      products: [productId],
      // Bind the purchase to the verified Supabase user so the webhook can map the
      // resulting subscription back to this account (data.customer.externalId). The
      // metadata.user_id is a belt-and-suspenders fallback for the webhook resolver.
      externalCustomerId: uid,
      customerEmail: email,
      metadata: { user_id: uid },
      successUrl: successUrl(origin),
    });
    if (!session || typeof session.url !== "string") {
      throw new Error("Polar returned no checkout URL");
    }
    return NextResponse.json({ url: session.url });
  } catch (e) {
    // Log server-side; return a generic message so Polar API detail never leaks.
    console.error("[/api/checkout]", e);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 502 }
    );
  }
}
