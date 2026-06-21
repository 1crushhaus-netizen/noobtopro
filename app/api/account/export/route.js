// ---------------------------------------------------------------------------
// /api/account/export — "Download my data" (GDPR Art. 15 access / Art. 20 portability).
//
// AUTHENTICATED POST. Verifies the caller's JWT, then returns EVERYTHING we hold about
// that user — account basics (incl. birth year), scores, attempts, answer reviews, concept
// mastery, subscription status, the billing/consent + withdrawal audit trail (billing_audit),
// and the user's own free-text guide reports (concept_reports) — as one JSON bundle, read via
// the service-role client and scoped to the user's id. Not Pro-gated: the access/portability
// right is universal. Distinct from /api/account/delete (erasure) and "Reset my progress".
//
// Server-only: uses the service-role admin client.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCrossSiteRequest, isWrongContentType } from "@/lib/requestGuard";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";
import { reportRateLimit } from "@/lib/abuseDetection";

export const dynamic = "force-dynamic";

export async function POST(req) {
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  if (isWrongContentType(req)) {
    return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
  }

  // Per-IP gate BEFORE auth (requireUser does an auth round-trip).
  const ipRl = await checkRateLimit(clientKey(req));
  if (!ipRl.ok) {
    reportRateLimit({ req, route: "/api/account/export" });
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(ipRl.retryAfter) } }
    );
  }

  const auth = await requireUser(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const user = auth.user;
  const uid = user.id;

  // An export reads several tables; a tight per-account cap is ample for a manual action.
  const rl = await checkRateLimit(`acct:${uid}:export`, { max: 6, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    return NextResponse.json({ error: "Data export is not available right now." }, { status: 503 });
  }

  // Read the caller's own rows, scoped to the verified uid (service role bypasses RLS so this
  // works for the Pro-gated attempt_reviews too). Each read is independent; surface a failure
  // rather than return a partial export silently.
  try {
    const [scores, attempts, reviews, mastery, subscription, billingAudit, conceptReports] = await Promise.all([
      sb.from("scores").select("*").eq("user_id", uid),
      sb.from("attempts").select("*").eq("user_id", uid).order("created_at", { ascending: true }),
      sb.from("attempt_reviews").select("*").eq("user_id", uid).order("created_at", { ascending: true }),
      sb.from("concept_mastery").select("*").eq("user_id", uid),
      sb.from("subscriptions").select("status, product_id, current_period_end, cancel_at_period_end, updated_at").eq("user_id", uid).maybeSingle(),
      // billing_audit: the user's OWN consent + withdrawal history (CRD Art. 16(a)/11a audit
      // trail). Keyed by user_id; the SELECT-own RLS policy means these are squarely the
      // subject's personal data, so the access right (Art. 15) covers them.
      sb.from("billing_audit").select("*").eq("user_id", uid).order("created_at", { ascending: true }),
      // concept_reports: the user's OWN free-text reports about public guides. Keyed by
      // reporter_id (not user_id), so scope on that column.
      sb.from("concept_reports").select("*").eq("reporter_id", uid).order("created_at", { ascending: true }),
    ]);
    for (const r of [scores, attempts, reviews, mastery, billingAudit, conceptReports]) {
      if (r.error) throw r.error;
    }
    if (subscription.error) throw subscription.error;

    const appMeta = (user.app_metadata && typeof user.app_metadata === "object") ? user.app_metadata : {};
    const userMeta = (user.user_metadata && typeof user.user_metadata === "object") ? user.user_metadata : {};

    const body = {
      exportedAt: new Date().toISOString(),
      notice:
        "This is a copy of the personal data noobtopro holds about your account. It does not include internal security/abuse logs (security_events) — those record bounded snippets of flagged text and IPs for abuse prevention, are kept under our legitimate-interest security basis, and are not reliably linkable to a specific account.",
      account: {
        id: uid,
        email: typeof user.email === "string" ? user.email : null,
        createdAt: user.created_at || null,
        displayName: userMeta.full_name || userMeta.name || null,
        ageVerified: appMeta.age_verified === true,
        ageVerifiedAt: appMeta.age_verified_at || null,
        // Birth year only (data minimisation — we never store the full date of birth).
        birthYear: Number.isInteger(appMeta.birth_year) ? appMeta.birth_year : null,
      },
      scores: scores.data || [],
      attempts: attempts.data || [],
      answerReviews: reviews.data || [],
      conceptMastery: mastery.data || [],
      subscription: subscription.data || null,
      // Consent + withdrawal audit trail and the user's own free-text guide reports.
      billingAudit: billingAudit.data || [],
      conceptReports: conceptReports.data || [],
    };

    // Suggest a download filename; the client also sets one, so this is belt-and-suspenders.
    return NextResponse.json(body, {
      headers: { "Content-Disposition": 'attachment; filename="noobtopro-data-export.json"' },
    });
  } catch (e) {
    console.error("[/api/account/export]", e);
    return NextResponse.json({ error: "Could not prepare your data export. Please try again." }, { status: 500 });
  }
}
