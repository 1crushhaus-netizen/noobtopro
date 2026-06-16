// ---------------------------------------------------------------------------
// /api/reviews — the Pro-gated read path for "answer history" (attempt_reviews).
//
// P0-2: "Progress trends + answer history" is a paid Pro feature, but attempt_reviews
// rows used to be readable directly by any signed-in user via PostgREST (SELECT-own RLS),
// so the gate was client-only. This route is the SERVER enforcement: it verifies the JWT,
// checks the Pro entitlement (requireProUser — incl. the Pro product id), and only then
// returns the caller's own review rows via the service-role client. Direct client SELECT
// on attempt_reviews is revoked (db/migrations/0018), so this is the sole read path.
//
// Server-only: reads through the service-role client.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { requireProUser } from "@/lib/entitlements";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCrossSiteRequest, isWrongContentType } from "@/lib/requestGuard";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// attempt_reviews row (snake_case) -> the camelCase review item the Review UI renders.
// Mirrors lib/store.js#reviewRowToItem (kept here so the server route has no client import).
function reviewRowToItem(r) {
  return {
    subject: r.subject,
    t: r.created_at,
    question: r.question || "",
    answer: r.answer || "",
    targetConcept: r.target_concept || "",
    difficulty: r.difficulty || "",
    reasoningScore: r.reasoning_score,
    delta: r.delta,
    rubric: r.rubric || null,
    feedback: r.feedback && typeof r.feedback === "object" ? r.feedback : {},
  };
}

export async function POST(req) {
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  if (isWrongContentType(req)) {
    return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
  }

  // Identity + Pro entitlement, server-verified. 401 = not signed in, 402 = signed in but
  // not Pro (Payment Required), 503 = no service-role store configured.
  const gate = await requireProUser(req);
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const uid = gate.user.id;

  // Durable per-account read cap (cheap defense against hammering the history endpoint).
  const rl = await checkRateLimit(`acct:${uid}:reviews`, { max: 30 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const sb = getSupabaseAdmin();
  // requireProUser already requires the service-role store (no store -> nobody is Pro ->
  // 402 above), so this is belt-and-suspenders.
  if (!sb) return NextResponse.json({ reviews: [] });

  const { data, error } = await sb
    .from("attempt_reviews")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("[/api/reviews]", error);
    return NextResponse.json({ error: "Could not load your answers." }, { status: 500 });
  }
  return NextResponse.json({ reviews: (data || []).map(reviewRowToItem) });
}
