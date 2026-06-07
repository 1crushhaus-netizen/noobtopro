import { NextResponse, after } from "next/server";
import { groqJSON, DIAG_GRADE_SYS, PRACTICE_GRADE_SYS } from "@/lib/groq";
import { clampScore, ORDER, normalizeRubric, reconcileReasoningScore } from "@/lib/scoring";
import { preGradeDock } from "@/lib/preGrade";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";
import { isCrossSiteRequest, isWrongContentType } from "@/lib/requestGuard";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { reportInjection, reportRateLimit } from "@/lib/abuseDetection";
import { capText, normalizeImage, normalizeDifficulty, normalizeWeakConcepts, normalizeFeedbackList, capSolution } from "@/lib/gradeInput";

export const dynamic = "force-dynamic";

// Auto-grow the concept hub: register the grader's (server-normalized, capped)
// weak concepts as PENDING catalog stubs, AFTER the response so grading latency
// is untouched. Runs only when the service-role key is set; falls back to
// fire-and-forget outside a request scope (e.g. unit tests) so it never throws
// into the grade path.
function registerWeakConcepts(subject, weakConcepts) {
  if (!ORDER.includes(subject) || !Array.isArray(weakConcepts) || weakConcepts.length === 0) return;
  const task = async () => {
    try {
      const sb = getSupabaseAdmin();
      if (sb) await sb.rpc("register_concepts", { p_subject: subject, p_concepts: weakConcepts });
    } catch (e) {
      console.error("[/api/grade] register_concepts", e); // best-effort; self-heals next grade
    }
  };
  try {
    after(task);
  } catch {
    void task();
  }
}

export async function POST(req) {
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  if (isWrongContentType(req)) {
    return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
  }

  const rl = await checkRateLimit(clientKey(req));
  if (!rl.ok) {
    reportRateLimit({ req, route: "/api/grade" });
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

  const { kind, subject, question, targetConcept, score, reasoning, image, difficulty } = body || {};
  // typeof guard: a non-string `reasoning` (object/number) would throw on .trim()
  // before validation and 500 the route.
  const work = typeof reasoning === "string" && reasoning.trim() ? capText(reasoning.trim()) : "(no written reasoning provided)";
  const safeQuestion = capText(question);
  const safeConcept = capText(targetConcept) || "(unspecified)";
  const safeDifficulty = normalizeDifficulty(difficulty);

  if (kind !== "diagnostic" && kind !== "practice") {
    return NextResponse.json(
      { error: 'kind must be "diagnostic" or "practice".' },
      { status: 400 }
    );
  }
  if (typeof subject !== "string" || typeof question !== "string") {
    return NextResponse.json(
      { error: "subject and question are required." },
      { status: 400 }
    );
  }
  // Bound subject to the known set (matches /api/generate). ORDER.includes — not
  // SUBJECTS[subject] — so inherited keys ("constructor"/"__proto__") can't pass.
  if (!ORDER.includes(subject)) {
    return NextResponse.json({ error: `Unknown subject "${subject}".` }, { status: 400 });
  }

  // Flag (don't block) obvious prompt-injection in the learner's reasoning/concept.
  reportInjection({
    req,
    route: "/api/grade",
    subject,
    concept: safeConcept !== "(unspecified)" ? safeConcept : null,
    text: `${safeQuestion}\n${work}\n${safeConcept}`,
  });

  const img = normalizeImage(image);
  if (!img.ok) return NextResponse.json({ error: img.error }, { status: 400 });

  // Image (vision-model) grades are far more expensive than text grades — a single
  // request can fan out to multiple multimodal calls each carrying ~3 MB. Apply a
  // separate, stricter per-IP budget on top of the general limit.
  if (img.image) {
    const imgRl = await checkRateLimit(`${clientKey(req)}:img`, { max: 10 });
    if (!imgRl.ok) {
      reportRateLimit({ req, route: "/api/grade" });
      return NextResponse.json(
        { error: "Too many image grades. Please slow down and try again shortly." },
        { status: 429, headers: { "Retry-After": String(imgRl.retryAfter) } }
      );
    }
  }

  // DETERMINISTIC pre-grade dock (no LLM call): empty / "idk" / off-topic / gibberish
  // → forced low score + all-zero rubric, for guests too (the client then runs the
  // same Elo update locally). Identical anti-gaming lever as /api/score.
  const dock = preGradeDock(reasoning);

  try {
    if (kind === "diagnostic") {
      if (dock) {
        return NextResponse.json({
          subject,
          score: dock.reasoningScore,
          rubric: dock.rubric,
          weakConcepts: dock.weakConcepts,
          comment: dock.comment,
          docked: true,
        });
      }
      const data = await groqJSON({
        system: DIAG_GRADE_SYS,
        user:
          `Subject: ${subject}\n` +
          `Question difficulty band: ${safeDifficulty}\n` +
          `Question: ${safeQuestion}\n\n` +
          `Learner's reasoning:\n"""${work}"""`,
        image: img.image,
        grade: true, // route to the cheaper grading model
      });
      const rubric = normalizeRubric(data?.rubric);
      const weakConcepts = normalizeWeakConcepts(data?.weakConcepts);
      registerWeakConcepts(subject, weakConcepts); // auto-grow the hub (non-blocking)
      return NextResponse.json({
        ...data,
        // Reconcile the score against the rubric so it can't contradict the bars.
        score: reconcileReasoningScore(data?.score, rubric),
        rubric,
        weakConcepts,
      });
    }

    // practice
    if (dock) {
      return NextResponse.json({
        reasoningScore: dock.reasoningScore,
        rubric: dock.rubric,
        strengths: dock.strengths, // []
        improvements: dock.improvements, // "attempt it first" nudge
        workedSolution: "", // never revealed for a non-attempt
        correctnessNote: dock.correctnessNote,
        socraticHint: dock.socraticHint,
        microLesson: dock.microLesson,
        weakConcepts: dock.weakConcepts,
        newScoreSuggestion: dock.reasoningScore,
        docked: true,
      });
    }
    const safeScore = clampScore(score) ?? 0;
    const data = await groqJSON({
      system: PRACTICE_GRADE_SYS,
      user:
        `Subject: ${subject}\n` +
        `Question: ${safeQuestion}\n` +
        `Concept being probed: ${safeConcept}\n` +
        `Question difficulty band: ${safeDifficulty}\n` +
        `Learner's current level: ${safeScore}/100\n\n` +
        `Learner's reasoning:\n"""${work}"""`,
      image: img.image,
      grade: true, // route to the cheaper grading model
      maxTokens: 2000, // room for strengths + improvements + the worked solution
    });
    // Normalize every field the UI renders so malformed model output can't show NaN or
    // out-of-range values. reasoningScore is reconciled against the rubric; rubric -> 0–4
    // bars; newScoreSuggestion -> the client's local Elo update (null = no change). The
    // worked solution is revealed post-grade (this path is a genuine attempt, not docked).
    const rubric = normalizeRubric(data?.rubric);
    const weakConcepts = normalizeWeakConcepts(data?.weakConcepts);
    registerWeakConcepts(subject, weakConcepts); // auto-grow the hub (non-blocking)
    return NextResponse.json({
      ...data,
      reasoningScore: reconcileReasoningScore(data?.reasoningScore, rubric),
      newScoreSuggestion: clampScore(data?.newScoreSuggestion),
      rubric,
      strengths: normalizeFeedbackList(data?.strengths),
      improvements: normalizeFeedbackList(data?.improvements),
      workedSolution: capSolution(data?.workedSolution),
      weakConcepts,
    });
  } catch (e) {
    // Log server-side; return a generic message so upstream Groq status/body
    // detail (keys, quota state, model IDs) never leaks to the client.
    console.error("[/api/grade]", e);
    return NextResponse.json(
      { error: "Grading is temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}
