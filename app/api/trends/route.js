// ---------------------------------------------------------------------------
// /api/trends — the Pro-gated read path for "Progress trends" (the trend charts).
//
// F-01 (audit): "Progress trends" is a paid Pro feature, but the chart series lived in
// `attempts`, which was directly client-readable (SELECT-own RLS), so the gate was
// client-only. Direct client SELECT on `attempts` is revoked (db/migrations/0024); this
// route is the SERVER enforcement: it verifies the JWT AND the Pro entitlement
// (requireProUser, incl. the configured Pro product id) before returning the trend series
// via the service-role client. The free attempt data (count + rationale) is served, without
// the cumulative total, by /api/history.
//
// Server-only: reads through the service-role client.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { requireProUser } from "@/lib/entitlements";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCrossSiteRequest, isWrongContentType } from "@/lib/requestGuard";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";
import { reportRateLimit } from "@/lib/abuseDetection";

export const dynamic = "force-dynamic";

// attempt row -> the chart-relevant event the trend LineChart/BarChart render from.
function rowToTrendEvent(r) {
  return {
    type: r.type,
    subject: r.subject,
    delta: r.delta,
    totalAfter: r.total_after,
  };
}

export async function POST(req) {
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  if (isWrongContentType(req)) {
    return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
  }

  // Per-IP gate BEFORE auth (audit P1-7): requireProUser does an auth round-trip + an
  // entitlement read, so gate per-IP first (like /api/reviews and /api/leaderboard).
  const ipRl = await checkRateLimit(clientKey(req));
  if (!ipRl.ok) {
    reportRateLimit({ req, route: "/api/trends" });
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(ipRl.retryAfter) } }
    );
  }

  // Identity + Pro entitlement, server-verified. 401 = not signed in, 402 = signed in but
  // not Pro (Payment Required), 503 = no service-role store configured.
  const gate = await requireProUser(req);
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const uid = gate.user.id;

  const rl = await checkRateLimit(`acct:${uid}:trends`, { max: 30 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const sb = getSupabaseAdmin();
  // requireProUser already requires the service-role store (no store -> nobody is Pro -> 402
  // above), so this is belt-and-suspenders.
  if (!sb) return NextResponse.json({ trends: [] });

  const { data, error } = await sb
    .from("attempts")
    .select("type, subject, delta, total_after, created_at, id")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(500);
  if (error) {
    console.error("[/api/trends]", error);
    return NextResponse.json({ error: "Could not load your trends." }, { status: 500 });
  }
  // Chronological (oldest -> newest) for the time-series charts.
  return NextResponse.json({ trends: (data || []).map(rowToTrendEvent).reverse() });
}
