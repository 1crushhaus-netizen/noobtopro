// ---------------------------------------------------------------------------
// /api/portal — open the Polar.sh customer portal for a Pro subscriber.
//
// AUTHENTICATED POST: verify the Supabase JWT, then mint a Polar customer session
// keyed by the VERIFIED externalCustomerId (= auth.uid(), set at checkout) and return
// its { url } (the portal where the user updates payment / cancels / sees invoices).
// The client navigates there. Like /api/checkout, identity comes only from the JWT, so
// one user can never open another's billing portal.
//
// A caller who never subscribed has no Polar customer -> the session create 404s; we
// surface a clean 404 the UI shows as "no subscription to manage".
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/adminAuth";
import { getPolar } from "@/lib/polar";
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

  const rl = await checkRateLimit(`${clientKey(req)}:portal`, { max: 12 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const auth = await requireUser(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const uid = auth.user.id;

  // Durable PER-ACCOUNT cap (audit 02 P1-3): the per-IP limiter + Sec-Fetch-Site guard are
  // bypassable by a non-browser client, so bound Polar customer-session creation per account
  // too (identity is JWT-bound, so this can't be spent on someone else — just rate it).
  const acctRl = await checkRateLimit(`acct:${uid}:portal`, { max: 12 });
  if (!acctRl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(acctRl.retryAfter) } }
    );
  }

  const polar = getPolar();
  if (!polar) {
    return NextResponse.json({ error: "Subscription management is not available right now." }, { status: 503 });
  }

  try {
    const session = await polar.customerSessions.create({ externalCustomerId: uid });
    const url = session && session.customerPortalUrl;
    if (typeof url !== "string") throw new Error("Polar returned no portal URL");
    return NextResponse.json({ url });
  } catch (e) {
    // A 404 from Polar means "no customer for this external id" — i.e. they never
    // subscribed. Surface that distinctly so the UI can say so rather than "try again".
    const status = e && (e.statusCode || e.status);
    if (status === 404) {
      return NextResponse.json({ error: "No subscription to manage yet." }, { status: 404 });
    }
    console.error("[/api/portal]", e);
    return NextResponse.json({ error: "Could not open subscription management. Please try again." }, { status: 502 });
  }
}
