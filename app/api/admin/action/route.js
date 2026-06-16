import { NextResponse } from "next/server";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";
import { isCrossSiteRequest, isWrongContentType, readJsonLimited, MAX_BODY_BYTES_TEXT } from "@/lib/requestGuard";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { ORDER } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const REVIEW_ACTIONS = new Set(["reviewed", "dismissed"]);

// Privileged admin actions (gated by requireAdmin, executed via service-role):
//  - guide  approve|hide|delete  (approve = the ONLY sanctioned path to publish a
//    guide: visibility=public, status=ready, source=curated — and ONLY for a guide
//    that already has content/status=ready; a pending stub cannot be published)
//  - event/report  reviewed|dismissed  (clear it from the open queue)
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

  let body;
  try {
    // Bounded read (audit 03 P2-3): cap the body size like every other route, instead of
    // raw req.json() with no limit.
    body = await readJsonLimited(req, MAX_BODY_BYTES_TEXT);
  } catch (e) {
    if (e && e.code === "BODY_TOO_LARGE") {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    }
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const { target, action } = body || {};

  try {
    if (target === "guide") {
      const subject = body.subject;
      const conceptKey = typeof body.concept_key === "string" ? body.concept_key.slice(0, 200) : "";
      // ORDER.includes (not a map lookup) so inherited keys can't pass the allowlist.
      if (!ORDER.includes(subject) || !conceptKey) {
        return NextResponse.json({ error: "Invalid guide reference." }, { status: 400 });
      }
      if (action === "approve") {
        // Publish — only a ready guide (content present). A pending stub matches 0 rows.
        const { data, error } = await sb
          .from("concept_guides")
          .update({ visibility: "public", status: "ready", source: "curated", updated_at: new Date().toISOString() })
          .eq("subject", subject)
          .eq("concept_key", conceptKey)
          .eq("status", "ready")
          .select("concept_key");
        if (error) throw error;
        if (!data || data.length === 0) {
          return NextResponse.json({ error: "Only a generated (ready) guide can be approved — this is an empty stub." }, { status: 409 });
        }
        return NextResponse.json({ ok: true, action: "approve" });
      }
      if (action === "hide") {
        const { error } = await sb
          .from("concept_guides")
          .update({ visibility: "hidden", updated_at: new Date().toISOString() })
          .eq("subject", subject)
          .eq("concept_key", conceptKey);
        if (error) throw error;
        return NextResponse.json({ ok: true, action: "hide" });
      }
      if (action === "delete") {
        const { error } = await sb.from("concept_guides").delete().eq("subject", subject).eq("concept_key", conceptKey);
        if (error) throw error;
        return NextResponse.json({ ok: true, action: "delete" });
      }
      return NextResponse.json({ error: "Unknown guide action." }, { status: 400 });
    }

    if (target === "event" || target === "report") {
      const id = Number(body.id);
      if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
      if (!REVIEW_ACTIONS.has(action)) return NextResponse.json({ error: "Unknown action." }, { status: 400 });
      const table = target === "event" ? "security_events" : "concept_reports";
      const { error } = await sb.from(table).update({ status: action }).eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true, action });
    }

    return NextResponse.json({ error: "Unknown target." }, { status: 400 });
  } catch (e) {
    console.error("[/api/admin/action]", e);
    return NextResponse.json({ error: "The action could not be completed." }, { status: 500 });
  }
}
