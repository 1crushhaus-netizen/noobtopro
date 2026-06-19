// ---------------------------------------------------------------------------
// /api/history — the FREE signed-in read path for attempt-derived data.
//
// F-01 (audit): "Progress trends" is a paid Pro feature, but `attempts` rows used to be
// readable directly by any signed-in user via PostgREST (SELECT-own RLS), so the gate was
// client-only. Direct client SELECT on `attempts` is now revoked (db/migrations/0024), so
// all reads go through the server. This route serves the ALWAYS-VISIBLE (free) attempt data:
// the "problems graded" count and the "why your reasoning moved" rationale list. It returns
// the free fields ONLY — crucially NOT the cumulative `total_after` — so the trend charts
// cannot be reconstructed from it. The Pro trend chart series lives behind /api/trends.
//
// Server-only: reads through the service-role client.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCrossSiteRequest, isWrongContentType } from "@/lib/requestGuard";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";
import { reportRateLimit } from "@/lib/abuseDetection";

export const dynamic = "force-dynamic";

// attempt row -> the FREE event the KPI count + "why your reasoning moved" list need.
// Deliberately omits total_after / new_score / phd_after (the cumulative trend-chart
// fields) — those are Pro-only and served by /api/trends.
function rowToFreeEvent(r) {
  return {
    type: r.type,
    t: r.created_at,
    subject: r.subject,
    delta: r.delta,
    rationale: r.rationale || null,
  };
}

export async function POST(req) {
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  if (isWrongContentType(req)) {
    return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
  }

  // Per-IP gate BEFORE auth (audit P1-7): requireUser does a Supabase auth.getUser network
  // round-trip, so a per-IP ceiling keeps an unauthenticated flood from burning the Auth quota.
  const ipRl = await checkRateLimit(clientKey(req));
  if (!ipRl.ok) {
    reportRateLimit({ req, route: "/api/history" });
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(ipRl.retryAfter) } }
    );
  }

  const auth = await requireUser(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const uid = auth.user.id;

  const rl = await checkRateLimit(`acct:${uid}:history`, { max: 30 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const sb = getSupabaseAdmin();
  // No service-role store -> can't read attempts; return an empty (not errored) history so
  // the dashboard renders its zero-state rather than bouncing the user to the intro screen.
  if (!sb) return NextResponse.json({ history: [] });

  const { data, error } = await sb
    .from("attempts")
    .select("type, subject, delta, rationale, created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(500);
  if (error) {
    console.error("[/api/history]", error);
    return NextResponse.json({ error: "Could not load your history." }, { status: 500 });
  }
  // Chronological (oldest -> newest), matching the old client-side loadState order.
  return NextResponse.json({ history: (data || []).map(rowToFreeEvent).reverse() });
}
