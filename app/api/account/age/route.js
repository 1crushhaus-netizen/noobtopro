// ---------------------------------------------------------------------------
// /api/account/age — server-authoritative 18+ age verification.
//
// noobtopro is an adults-only service. The client AgeGate collects a self-declared
// date of birth, but the client cannot be trusted to enforce the threshold (and
// `user_metadata` is user-editable via the Supabase client SDK). So the REAL gate
// lives here: this route re-computes the age from the submitted DOB SERVER-SIDE,
// rejects anyone under 18, and — only on success — records `age_verified` in the
// account's `app_metadata` via the service-role Admin API. `app_metadata` is NOT
// writable by `supabase.auth.updateUser`, so a user cannot self-grant the flag.
// The practice/generation routes then refuse to serve an account that isn't
// age-verified (see lib/adminAuth#isAgeVerified).
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

const MIN_AGE = 18;

// Server-authoritative age computation. Mirrors components/AgeGate.jsx but is the
// AUTHORITATIVE check — the client value is never trusted. UTC throughout so the
// result doesn't drift with the server's timezone.
function ageFromISO(iso) {
  if (typeof iso !== "string") return null;
  const dob = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
}

export async function POST(req) {
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  if (isWrongContentType(req)) {
    return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
  }

  // Per-IP gate BEFORE auth: requireUser does a Supabase auth.getUser network round-trip,
  // so a per-IP ceiling keeps an unauthenticated flood from burning the Auth quota.
  const ipRl = await checkRateLimit(clientKey(req));
  if (!ipRl.ok) {
    reportRateLimit({ req, route: "/api/account/age" });
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(ipRl.retryAfter) } }
    );
  }

  // Identity comes ONLY from the verified JWT.
  const auth = await requireUser(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const uid = auth.user.id;

  // Durable per-account cap: age confirmation is a one-shot action.
  const rl = await checkRateLimit(`acct:${uid}:age`, { max: 10, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const age = ageFromISO(body && body.dob);
  if (age == null || age < 0 || age > 120) {
    return NextResponse.json({ error: "Please provide a valid date of birth." }, { status: 400 });
  }
  if (age < MIN_AGE) {
    // Do NOT set the flag — block adults-only access. The client signs the user out.
    return NextResponse.json(
      { error: "noobtopro is an adults-only service for ages 18 and over.", ageVerified: false },
      { status: 403 }
    );
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    return NextResponse.json({ error: "Age verification is not available right now." }, { status: 503 });
  }

  // Record the verdict in app_metadata (server-only; user cannot edit it). We store the
  // boolean + the verification timestamp + birth year (year only — data minimisation: we
  // do NOT persist the full date of birth). Merge with any existing app_metadata.
  const birthYear = new Date(body.dob + "T00:00:00Z").getUTCFullYear();
  const { error } = await sb.auth.admin.updateUserById(uid, {
    app_metadata: {
      ...(auth.user.app_metadata || {}),
      age_verified: true,
      age_verified_at: new Date().toISOString(),
      birth_year: birthYear,
    },
  });
  if (error) {
    console.error("[/api/account/age] updateUserById failed", error);
    return NextResponse.json({ error: "Could not save that. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ageVerified: true });
}
