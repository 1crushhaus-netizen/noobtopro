import { NextResponse } from "next/server";
import { groqJSON, PRACTICE_GEN_SYS } from "@/lib/groq";
import { ORDER, clampScore } from "@/lib/scoring";
import { topicSlugsFor, normalizeTopic } from "@/lib/taxonomy";
import { conceptByKey, bandForRank } from "@/lib/curriculum";
import { pickVariety, varietyDirectiveText, sanitizeRecentQuestions, avoidListText } from "@/lib/questionVariety";
import { normalizeReasoningSurface, capTrap, capText, normalizeDifficulty } from "@/lib/gradeInput";
import { signQuestion } from "@/lib/questionToken";
import { checkRateLimit, clientKey, chargeGlobalGroq } from "@/lib/rateLimit";
import { isCrossSiteRequest, isWrongContentType, readJsonLimited, MAX_BODY_BYTES_TEXT } from "@/lib/requestGuard";
import { reportInjection, reportRateLimit } from "@/lib/abuseDetection";
import { buildDiagnostic } from "@/lib/diagnosticBank";

export const dynamic = "force-dynamic";
// Bound a hung request (audit P2-10): the Groq fetch has a 30s abort, and at most
// TWO sequential upstream calls can run (primary + retry/fallback) — 90s leaves real
// headroom over that 60s worst case plus handler overhead.
export const maxDuration = 90;

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
    body = await readJsonLimited(req, MAX_BODY_BYTES_TEXT);
  } catch (e) {
    if (e && e.code === "BODY_TOO_LARGE") {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    }
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const { kind, subject, score, weakConcepts, recentQuestions, conceptKey } = body || {};

  try {
    if (kind === "diagnostic") {
      // The diagnostic is the CURATED, standardized placement bank (lib/diagnosticBank.js):
      // 9 reasoning-rich questions (3 subjects × beginner/intermediate/hard), served with
      // ZERO Groq calls and no pool — everyone gets the same calibrated set.
      // STRIP the grader-internal trap/reasoningSurface metadata (audit P2-9): the trap
      // text states the naive wrong path for the standardized placement, so shipping it
      // let a devtools reader dodge every trap and inflate their baseline. The grader
      // derives both server-side from the bank (diagnosticSurfaceFor) — the client never
      // needed them.
      const diag = buildDiagnostic();
      diag.questions = diag.questions.map(({ trap, reasoningSurface, ...q }) => q);
      return NextResponse.json(diag);
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
    // CONCEPT DRILL (increment 3, RANKS_PLAN §12.3): when the request names a
    // curriculum `conceptKey`, generate a question TARGETING that concept, framed at
    // its rank's level. The key is allow-listed SERVER-SIDE via conceptByKey (so a
    // drill can only ever target a real concept), and the resulting question is tagged
    // with `conceptKey` + the rank-derived band — both signed into the token, so
    // /api/score reads them from the verified token and updates that concept's mastery.
    // An unknown/forged conceptKey is simply ignored → ordinary level-based practice.
    const drill = typeof conceptKey === "string" ? conceptByKey(subject, conceptKey) : null;
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
    // GLOBAL Groq budget (audit P2-3): the per-IP cap is rotation-defeatable on this
    // unauthenticated route; the platform-wide window bounds total spend.
    const glob = await chargeGlobalGroq(1);
    if (!glob.ok) {
      reportRateLimit({ req, route: "/api/generate" });
      return NextResponse.json(
        { error: "Too many requests. Please slow down and try again shortly." },
        { status: 429, headers: { "Retry-After": String(glob.retryAfter) } }
      );
    }

    const variety = pickVariety();
    const directive = varietyDirectiveText(variety);
    const avoid = avoidListText(recent);
    // For a concept drill, instruct the model to target the named concept at its rank
    // level. fenceGuard isn't needed — the label/strand are server-curated (from
    // lib/curriculum.js), not user free-text.
    const drillDirective = drill
      ? `Target this SPECIFIC concept and nothing else: "${drill.label}" (strand: ${drill.strand || "core"}). ` +
        `Frame the question at the ${drill.rank} real-world level. The question must genuinely exercise this concept's reasoning.`
      : "";

    const data = await groqJSON({
      system: PRACTICE_GEN_SYS,
      user:
        `Subject: ${subject}\n` +
        `Learner score: ${safeScore}/100\n` +
        (drillDirective ? drillDirective + "\n" : `Weak concepts: ${concepts.join(", ") || "none recorded"}\n`) +
        `Allowed topics (pick exactly one slug for topicSlug): ${topicSlugsFor(subject)}\n` +
        (directive ? directive + "\n" : "") +
        (avoid ? avoid + "\n" : "") +
        `Generate the question now.`,
      // Higher temperature + a random per-call seed (C) on top of the rolled spec (B)
      // and avoid-list (A): three independent diversity levers against a peaked prior.
      temperature: 0.85,
      seed: Math.floor(Math.random() * 1e9),
    });
    // A generation without a usable question is an upstream failure, not a 200.
    if (!data || typeof data !== "object" || typeof data.question !== "string" || !data.question.trim()) {
      throw new Error("generator returned no question");
    }
    // Build an EXPLICIT response (audit P2-2 class: never spread raw model JSON to the
    // client — a stray `error` key or object-typed field would break the UI). topicSlug
    // is normalized to a real taxonomy slug (bounded, FK-valid bucket key); the
    // reasoning surface is allow-listed and the trap kept only on a trap (deflate-only
    // grader calibration; the guest /api/grade path still receives them as plaintext
    // by design — they can only ever LOCATE errors, never award credit).
    const reasoningSurface = normalizeReasoningSurface(data.reasoningSurface);
    const normalizedDifficulty = normalizeDifficulty(data.difficulty);
    const question = {
      subject,
      topic: typeof data.topic === "string" ? data.topic.slice(0, 200) : "",
      topicSlug: normalizeTopic(subject, data.topicSlug),
      targetConcept: typeof data.targetConcept === "string" ? data.targetConcept.slice(0, 200) : "",
      reasoningSurface,
      trap: reasoningSurface === "trap" ? capTrap(data.trap) : "",
      difficulty: normalizedDifficulty !== "(unspecified)" ? normalizedDifficulty : "intermediate",
      question: capText(data.question.trim()),
    };
    // A concept drill overrides the model's free choices with the SERVER-authoritative
    // curriculum facts: the difficulty is the concept's rank band (not the model's
    // guess), targetConcept is the concept label, and `conceptKey` is set so it gets
    // signed into the token → /api/score updates that concept's mastery. The grader's
    // band-clamp (≤1 above the learner's stored level) still applies downstream.
    if (drill) {
      question.conceptKey = drill.key;
      question.difficulty = bandForRank(drill.rank);
      question.targetConcept = drill.label.slice(0, 200);
    }
    // SIGN the served question (audit P1-1): /api/score practice only accepts a valid
    // token and derives every rating-relevant field from it, so a client can no longer
    // forge the difficulty band / topic bucket (rating inflation, anti-farm rotation,
    // item_difficulty poisoning). token is null without a signing key — guest-only
    // deployments never reach /api/score practice anyway (503 there).
    return NextResponse.json({ ...question, token: signQuestion(question) });
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
