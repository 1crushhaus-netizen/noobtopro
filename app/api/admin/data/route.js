import { NextResponse } from "next/server";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";
import { isCrossSiteRequest, isWrongContentType } from "@/lib/requestGuard";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const LIMIT = 200;

// Read-only snapshot for the admin dashboard: the curation queue (guides that are
// NOT yet public+ready), open security warnings, and open user reports. All reads
// use the service-role client (bypasses RLS); access is gated by requireAdmin.
export async function POST(req) {
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  if (isWrongContentType(req)) {
    return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
  }
  const rl = await checkRateLimit(clientKey(req));
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }
  const auth = await requireAdmin(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Admin storage is not configured." }, { status: 503 });

  // Opportunistic retention prune (audit 04 P2-8): admins load this infrequently, so it's a
  // natural low-frequency hook to age out old PII-bearing security_events/concept_reports.
  // Best-effort — never block or fail the dashboard load on it.
  try {
    await sb.rpc("prune_security_data", { p_days: 90 });
  } catch {
    /* prune is best-effort; ignore */
  }

  try {
    const [guidesRes, eventsRes, reportsRes] = await Promise.all([
      // Curation queue: anything not already public+ready (hidden guides + pending stubs).
      sb
        .from("concept_guides")
        .select("subject, concept_key, concept, topic, status, visibility, source, level_band, content, created_at, updated_at")
        .or("visibility.neq.public,status.neq.ready")
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      sb.from("security_events").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(LIMIT),
      sb.from("concept_reports").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(LIMIT),
    ]);

    if (guidesRes.error || eventsRes.error || reportsRes.error) {
      console.error("[/api/admin/data]", guidesRes.error || eventsRes.error || reportsRes.error);
      return NextResponse.json({ error: "Could not load admin data." }, { status: 500 });
    }

    // Ship a content PREVIEW, not the full guide payload (keeps the response light;
    // the admin can still judge quality from the overview).
    const pendingGuides = (guidesRes.data || []).map((g) => ({
      subject: g.subject,
      concept_key: g.concept_key,
      concept: g.concept,
      topic: g.topic,
      status: g.status,
      visibility: g.visibility,
      source: g.source,
      level_band: g.level_band,
      created_at: g.created_at,
      overview: g.content && typeof g.content === "object" ? String(g.content.overview || "").slice(0, 400) : null,
    }));
    const events = eventsRes.data || [];
    const reports = reportsRes.data || [];

    return NextResponse.json({
      counts: { pendingGuides: pendingGuides.length, events: events.length, reports: reports.length },
      pendingGuides,
      events,
      reports,
    });
  } catch (e) {
    console.error("[/api/admin/data]", e);
    return NextResponse.json({ error: "Could not load admin data." }, { status: 500 });
  }
}
