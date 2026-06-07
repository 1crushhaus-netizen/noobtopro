import { NextResponse } from "next/server";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { isCrossSiteRequest, isWrongContentType } from "@/lib/requestGuard";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// Tells the client whether to REVEAL the Admin tab. This is only a UI hint —
// every privileged action re-verifies via requireAdmin on /api/admin/data and
// /api/admin/action, so a tampered isAdmin gains nothing. Always 200; a missing
// token or a non-admin user simply yields { isAdmin: false }.
export async function POST(req) {
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  if (isWrongContentType(req)) {
    return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
  }
  const rl = rateLimit(clientKey(req));
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }
  const auth = await requireAdmin(req);
  return NextResponse.json({ isAdmin: !auth.error, email: (auth.user && auth.user.email) || null });
}
