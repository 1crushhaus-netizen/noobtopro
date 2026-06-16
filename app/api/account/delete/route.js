// ---------------------------------------------------------------------------
// /api/account/delete — permanent account deletion (GDPR/CCPA right to erasure).
//
// P0-11: distinct from "Reset my progress" (delete_user_data, which keeps the account).
// This verifies the caller's JWT, best-effort CANCELS any Polar subscription (so a deleted
// account isn't left being billed), then HARD-DELETES the auth user via the service-role
// Admin API. Every user table FKs auth.users ON DELETE CASCADE (scores, attempts,
// attempt_reviews, concept_mastery, concept_reports, subscriptions), so the user's data is
// fully erased.
//
// Server-only: uses the service-role admin client + the Polar client.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCrossSiteRequest } from "@/lib/requestGuard";
import { getPolar } from "@/lib/polar";

export const dynamic = "force-dynamic";

export async function POST(req) {
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }

  // Identity comes ONLY from the verified JWT.
  const auth = await requireUser(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const uid = auth.user.id;

  const sb = getSupabaseAdmin();
  if (!sb) {
    // No service-role store — we can't perform a real deletion. Surface it rather than
    // pretend success (a silent no-op would violate the erasure promise).
    return NextResponse.json({ error: "Account deletion is not available right now." }, { status: 503 });
  }

  // Best-effort: cancel any Polar subscription FIRST so a deleted account is never left
  // being billed. Never block the deletion on a Polar error — the user's right to erasure
  // takes precedence; a stuck subscription is followed up out-of-band.
  try {
    const polar = getPolar();
    if (polar) {
      const { data: sub } = await sb
        .from("subscriptions")
        .select("polar_subscription_id")
        .eq("user_id", uid)
        .maybeSingle();
      const subId = sub && sub.polar_subscription_id;
      if (subId) await polar.subscriptions.revoke({ id: subId });
    }
  } catch (e) {
    console.error("[/api/account/delete] Polar revoke failed (continuing with deletion)", e);
  }

  // Hard-delete the auth user; FK ON DELETE CASCADE erases all of their rows.
  const { error } = await sb.auth.admin.deleteUser(uid);
  if (error) {
    console.error("[/api/account/delete] deleteUser failed", error);
    return NextResponse.json({ error: "Could not delete your account. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
