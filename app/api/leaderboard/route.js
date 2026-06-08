// ---------------------------------------------------------------------------
// /api/leaderboard — ANONYMOUS rank-tier distribution (the Profile leaderboard).
//
// Returns ONLY aggregate counts across the 5 fixed ranks (per subject + 'overall')
// plus the CALLER's own band/score and how many ranked users sit above them — NO
// names, NO email, NO per-attempt rows, no other user's identity in any form. The
// cross-user aggregate is computed by the service-role-only `leaderboard_tiers` RPC,
// invoked here with the JWT-VERIFIED uid (requireUser), so the server never trusts a
// client-supplied identity. Auth is REQUIRED — the leaderboard is a signed-in surface
// (guests have no persisted rank). Same same-origin + JSON guard + rate limiting as the
// other routes; this is a read, so it's cheap, but it still exposes cross-user shape and
// is treated as a security-sensitive surface (reviewed like /api/score).
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { isCrossSiteRequest, isWrongContentType, isBodyTooLarge, MAX_BODY_BYTES_TEXT } from "@/lib/requestGuard";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/adminAuth";
import { reportRateLimit } from "@/lib/abuseDetection";

export const dynamic = "force-dynamic";

export async function POST(req) {
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  if (isWrongContentType(req)) {
    return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
  }
  // This route ignores the request body (the rank tiers are derived from the
  // JWT-verified uid), so just reject an oversized one outright rather than buffer it.
  if (isBodyTooLarge(req, MAX_BODY_BYTES_TEXT)) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }

  const rl = await checkRateLimit(clientKey(req));
  if (!rl.ok) {
    reportRateLimit({ req, route: "/api/leaderboard" });
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const auth = await requireUser(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Leaderboard is temporarily unavailable." }, { status: 503 });

  try {
    // p_uid is the JWT-verified caller — used ONLY to compute the caller's own position;
    // the RPC returns no row-level identity for anyone.
    const { data, error } = await sb.rpc("leaderboard_tiers", { p_uid: auth.user.id });
    if (error) throw error;
    return NextResponse.json({ tiers: data || {} });
  } catch (e) {
    console.error("[/api/leaderboard]", e);
    return NextResponse.json({ error: "Leaderboard is temporarily unavailable." }, { status: 500 });
  }
}
