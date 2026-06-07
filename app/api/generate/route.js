import { NextResponse } from "next/server";
import { groqJSON, DIAG_GEN_SYS, PRACTICE_GEN_SYS } from "@/lib/groq";
import { ORDER, clampScore, DIAGNOSTIC_DIFFICULTIES } from "@/lib/scoring";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { isCrossSiteRequest, isWrongContentType } from "@/lib/requestGuard";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { reportInjection, reportRateLimit } from "@/lib/abuseDetection";

export const dynamic = "force-dynamic";

// Diagnostic pool: the diagnostic is a static, level-neutral baseline (no per-user
// input), so it is safe to standardize across users — the same philosophy the app
// already uses for shared concept guides. We pool a handful of distinct sets, then
// serve them randomly with NO Groq call; below the target the pool self-fills.
const DIAG_POOL_TARGET = 12;

// A diagnostic is only usable if it has, for EVERY subject, one question at EACH
// difficulty tier (foundational/intermediate/advanced) — 9 valid questions, 3 per
// subject. Never serve or store a partial set. ORDER.includes is prototype-safe.
function isValidDiagnostic(content) {
  if (!content || !Array.isArray(content.questions)) return false;
  const seen = new Set(); // "subject:difficulty" pairs with a non-empty question
  for (const q of content.questions) {
    if (
      q &&
      ORDER.includes(q.subject) &&
      DIAGNOSTIC_DIFFICULTIES.includes(q.difficulty) &&
      typeof q.question === "string" &&
      q.question.trim()
    ) {
      seen.add(`${q.subject}:${q.difficulty}`);
    }
  }
  return ORDER.every((s) => DIAGNOSTIC_DIFFICULTIES.every((d) => seen.has(`${s}:${d}`)));
}

export async function POST(req) {
  // Block forced cross-site requests (CSRF-style cost/quota DoS) and non-JSON bodies.
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  if (isWrongContentType(req)) {
    return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
  }

  const rl = rateLimit(clientKey(req));
  if (!rl.ok) {
    reportRateLimit({ req, route: "/api/generate" });
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const { kind, subject, score, weakConcepts } = body || {};

  try {
    if (kind === "diagnostic") {
      const sb = getSupabaseAdmin(); // null when SUPABASE_SERVICE_ROLE_KEY isn't set -> always generate

      // 1) Serve from the shared pool once it's warm — zero Groq tokens.
      if (sb) {
        try {
          const { count } = await sb.from("diagnostic_pool").select("id", { count: "exact", head: true });
          if (typeof count === "number" && count >= DIAG_POOL_TARGET) {
            const offset = Math.floor(Math.random() * count);
            const { data: row } = await sb
              .from("diagnostic_pool")
              .select("content")
              .order("id", { ascending: true })
              .range(offset, offset)
              .maybeSingle();
            if (row && isValidDiagnostic(row.content)) {
              return NextResponse.json({ ...row.content, pooled: true });
            }
          }
        } catch (e) {
          console.error("[/api/generate] pool read", e); // fall through to generation
        }
      }

      // 2) Cold/insufficient pool -> generate fresh. NINE multi-step questions are
      //    well over the shared 1200-token default, so give the model more room
      //    (mirrors /api/learn) — at 1200 a verbose set truncates mid-JSON and the
      //    diagnostic fails, and since a truncated set never fills the pool, every
      //    request would hit the same wall.
      const data = await groqJSON({
        system: DIAG_GEN_SYS,
        user: "Generate the three diagnostic questions now.",
        maxTokens: 3000,
      });

      // Don't hand the client a partial/invalid set (truncation, missing tier):
      // surface a retryable error instead, matching the pool-read gate below.
      if (!isValidDiagnostic(data)) {
        return NextResponse.json(
          { error: "Question generation is temporarily unavailable. Please try again." },
          { status: 500 }
        );
      }

      // 3) Self-fill the pool (best-effort) via an atomic, advisory-locked,
      //    count-gated insert (try_add_diagnostic) — only valid full 3-subject
      //    sets, and concurrent cold-start fills can't overshoot DIAG_POOL_TARGET
      //    (the cap is enforced inside one serialized DB statement).
      if (sb) {
        try {
          await sb.rpc("try_add_diagnostic", { p_content: data, p_target: DIAG_POOL_TARGET });
        } catch (e) {
          console.error("[/api/generate] pool write", e); // non-fatal
        }
      }

      return NextResponse.json(data);
    }

    if (kind !== "practice") {
      return NextResponse.json(
        { error: 'kind must be "diagnostic" or "practice".' },
        { status: 400 }
      );
    }

    // practice — use ORDER.includes (not SUBJECTS[subject]) so inherited keys
    // like "constructor"/"__proto__" can't pass the allowlist.
    if (!ORDER.includes(subject)) {
      return NextResponse.json(
        { error: `Unknown subject "${subject}".` },
        { status: 400 }
      );
    }
    const safeScore = clampScore(score) ?? 0;
    // Bound the concept list (count + per-item length) before it enters the
    // prompt, mirroring the free-text caps on /api/grade.
    const concepts = (Array.isArray(weakConcepts) ? weakConcepts : [])
      .filter((c) => typeof c === "string")
      .slice(0, 10)
      .map((c) => c.slice(0, 200));
    // Flag (don't block) obvious prompt-injection in the client-supplied concepts.
    reportInjection({ req, route: "/api/generate", subject, text: concepts.join(" ") });

    const data = await groqJSON({
      system: PRACTICE_GEN_SYS,
      user:
        `Subject: ${subject}\n` +
        `Learner score: ${safeScore}/100\n` +
        `Weak concepts: ${concepts.join(", ") || "none recorded"}\n` +
        `Generate the question now.`,
    });
    return NextResponse.json(data);
  } catch (e) {
    // Log the real cause server-side; return a generic message so upstream Groq
    // status/body detail never leaks to the client.
    console.error("[/api/generate]", e);
    return NextResponse.json(
      { error: "Question generation is temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}
