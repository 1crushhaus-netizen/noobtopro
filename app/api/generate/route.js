import { NextResponse } from "next/server";
import { groqJSON, PRACTICE_GEN_SYS } from "@/lib/groq";
import { ORDER, clampScore } from "@/lib/scoring";
import { topicSlugsFor, normalizeTopic } from "@/lib/taxonomy";
import { pickVariety, varietyDirectiveText, sanitizeRecentQuestions, avoidListText } from "@/lib/questionVariety";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";
import { isCrossSiteRequest, isWrongContentType } from "@/lib/requestGuard";
import { reportInjection, reportRateLimit } from "@/lib/abuseDetection";
import { buildDiagnostic } from "@/lib/diagnosticBank";

export const dynamic = "force-dynamic";

export async function POST(req) {
  // Block forced cross-site requests (CSRF-style cost/quota DoS) and non-JSON bodies.
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  if (isWrongContentType(req)) {
    return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
  }

  const rl = await checkRateLimit(clientKey(req));
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

  const { kind, subject, score, weakConcepts, recentQuestions } = body || {};

  try {
    if (kind === "diagnostic") {
      // The diagnostic is the CURATED, standardized placement bank (lib/diagnosticBank.js):
      // 9 reasoning-rich questions (3 subjects × beginner/intermediate/hard), served with
      // ZERO Groq calls and no pool — everyone gets the same calibrated set.
      return NextResponse.json(buildDiagnostic());
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
    // Recently-shown questions (session ring-buffer from the client) to steer AWAY from,
    // so "regenerate" / a new practice produces a genuinely different problem (count +
    // length bounded — they are echoed into the prompt).
    const recent = sanitizeRecentQuestions(recentQuestions);
    // Flag (don't block) obvious prompt-injection in the client-supplied free text.
    reportInjection({ req, route: "/api/generate", subject, text: [concepts.join(" "), recent.join(" ")].join(" ") });

    // Roll a fresh variation spec per call so the conditioning changes every time —
    // the core defense against the model collapsing onto the canonical exemplar.
    const variety = pickVariety();
    const directive = varietyDirectiveText(variety);
    const avoid = avoidListText(recent);

    const data = await groqJSON({
      system: PRACTICE_GEN_SYS,
      user:
        `Subject: ${subject}\n` +
        `Learner score: ${safeScore}/100\n` +
        `Weak concepts: ${concepts.join(", ") || "none recorded"}\n` +
        `Allowed topics (pick exactly one slug for topicSlug): ${topicSlugsFor(subject)}\n` +
        (directive ? directive + "\n" : "") +
        (avoid ? avoid + "\n" : "") +
        `Generate the question now.`,
      // Higher temperature + a random per-call seed (C) on top of the rolled spec (B)
      // and avoid-list (A): three independent diversity levers against a peaked prior.
      temperature: 0.85,
      seed: Math.floor(Math.random() * 1e9),
    });
    // Normalize the LLM's topicSlug to a real taxonomy slug (or general_<subject>) so
    // the per-(subject,topic,band) difficulty bucket on /api/score is always bounded
    // and FK-valid. The human-readable `topic` is left as-is for display.
    if (data && typeof data === "object") data.topicSlug = normalizeTopic(subject, data.topicSlug);
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
