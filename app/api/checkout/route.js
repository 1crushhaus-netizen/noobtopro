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
import { checkRateLimit, clientKey } from "@/lib/rateLimit";
import { isCrossSiteRequest, isWrongContentType } from "@/lib/requestGuard";

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
