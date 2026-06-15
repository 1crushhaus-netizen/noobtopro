import { NextResponse } from "next/server";
import { groqJSON, fenceGuard, DIAG_GRADE_SYS, PRACTICE_GRADE_SYS } from "@/lib/groq";
import { clampSubjectScore, ORDER, normalizeRubric, scoreFromRubric } from "@/lib/scoring";
import { preGradeDock, injectionDock } from "@/lib/preGrade";
import { checkRateLimit, clientKey, chargeGlobalGroq, refundGlobalGroq } from "@/lib/rateLimit";
import { isCrossSiteRequest, isWrongContentType, readJsonLimited, MAX_BODY_BYTES_IMAGE } from "@/lib/requestGuard";
import { proStatusFromRequest } from "@/lib/entitlements";
import { proIsAvailable } from "@/lib/polar";
import { reportInjection, reportRateLimit, shouldDockForInjection } from "@/lib/abuseDetection";
import { capText, normalizeImage, normalizeDifficulty, normalizeWeakConcepts, normalizeFeedbackList, capSolution, normalizeErrors, normalizeSolve, reasoningSurfaceContext } from "@/lib/gradeInput";
import { withNumericVerification, makeRegrade } from "@/lib/numericVerify";

export const dynamic = "force-dynamic";
// Bound a hung request (audit P2-10): the Groq fetch has a 30s abort, and at most
// THREE sequential upstream calls can run (primary + retry/fallback + the rare
// numeric-verifier corrective re-grade) — 120s leaves real headroom over that
// worst case plus handler overhead.
export const maxDuration = 120;

// (The old hub AUTO-GROW — registering weak concepts as pending catalog stubs —
// was RETIRED by owner decision 2026-06-11; see the note in /api/score. Weak
// concepts still ship in the response for the learner's own feedback.)

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
    body = await readJsonLimited(req, MAX_BODY_BYTES_IMAGE);
  } catch (e) {
    if (e && e.code === "BODY_TOO_LARGE") {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    }
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const { kind, subject, question, targetConcept, score, reasoning, image, difficulty, reasoningSurface, trap } = body || {};
  // typeof guard: a non-string `reasoning` (object/number) would throw on .trim()
  // before validation and 500 the route.
  const work = typeof reasoning === "string" && reasoning.trim() ? capText(reasoning.trim()) : "(no written reasoning provided)";
  const safeQuestion = capText(question);
  const safeConcept = capText(targetConcept) || "(unspecified)";
  const safeDifficulty = normalizeDifficulty(difficulty);
  // Reasoning-surface context (multi-step | branch | trap + the naive wrong path) — what
  // the question is designed to test; threaded to the grader as rubric calibration. "" when absent.
  const surfaceCtx = reasoningSurfaceContext(reasoningSurface, trap);

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
  // Capture the scan: a HIGH-confidence injection (audit P2-3) also DOCKS the attempt
  // (below) — logging alone let a successful injection inflate the rubric to all-4s.
  const injectionScan = reportInjection({
    req,
    route: "/api/grade",
    subject,
    concept: safeConcept !== "(unspecified)" ? safeConcept : null,
    text: `${safeQuestion}\n${work}\n${safeConcept}\n${surfaceCtx}`,
  });

  const img = normalizeImage(image);
  if (!img.ok) return NextResponse.json({ error: img.error }, { status: 400 });

  // PHOTO-OF-WORK GRADING is a Pro feature. /api/grade is the GUEST practice path, so the
  // caller is effectively never Pro — but resolve it properly (proStatusFromRequest: a
  // guest with no token resolves to not-Pro WITHOUT a DB hit) so an authenticated Pro
  // caller is never wrongly blocked. Only practice photo grades are gated; the one-time
  // diagnostic stays open. 402 + `upgrade:true` so the client nudges to sign in & upgrade.
  // Only gated when Pro is sellable (otherwise photo grading stays open to everyone).
  if (kind === "practice" && img.image && proIsAvailable()) {
    const { isPro } = await proStatusFromRequest(req);
    if (!isPro) {
      return NextResponse.json(
        { error: "Photo-of-work grading is a Pro feature. Sign in and upgrade to Pro to grade a photo of your work.", upgrade: true },
        { status: 402 }
      );
    }
  }

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
  // same Glicko update locally). Identical anti-gaming lever as /api/score. Skip the dock
  // when a photo is attached — preGradeDock only inspects TEXT, so an image-only answer
  // (worked notes in the photo, empty text box) must reach the vision grader.
  // Cap before the dock so its regex/Set work is bounded even on a large body (the
  // dock's verdict is unchanged — 12k chars is far more than any blank/idk/gibberish test needs).
  // INJECTION AUTO-DOCK (audit P2-3): a HIGH-confidence injection docks REGARDLESS of an
  // attached image — the injection rides in TEXT (reasoning/question/concept), so a photo
  // can't shield it; skipping the LLM grade is exactly what neutralizes the inflation.
  const dock = shouldDockForInjection(injectionScan)
    ? injectionDock()
    : img.image
      ? null
      : preGradeDock(capText(reasoning));

  // Image-only submission: the photo IS the answer — a vision failure must fail
  // retryably rather than text-grade the placeholder string (audit P1-3).
  const imageOnly = !!img.image && !(typeof reasoning === "string" && reasoning.trim());

  // GLOBAL Groq budget (audit P2-3): the per-IP cap is rotation-defeatable on this
  // unauthenticated route; the platform-wide window bounds total spend. Docked
  // answers cost nothing and skip the charge.
  // Refund bookkeeping (audit P2-2 fix): if the charged grade never succeeds (an
  // upstream outage), refund the slot in the catch so an outage doesn't keep
  // over-throttling everyone for the rest of the window.
  let chargedGroq = 0;
  let chargedImg = 0;
  let gradeSucceeded = false;
  if (!dock) {
    const glob = await chargeGlobalGroq(1, { img: img.image ? 1 : 0 });
    if (!glob.ok) {
      reportRateLimit({ req, route: "/api/grade" });
      return NextResponse.json(
        { error: "Too many requests. Please slow down and try again shortly." },
        { status: 429, headers: { "Retry-After": String(glob.retryAfter) } }
      );
    }
    chargedGroq = 1;
    chargedImg = img.image ? 1 : 0;
  }

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
          // No grade ran, so there is nothing to verify — same shape as /api/score.
          verification: { status: "skipped", value: null, changed: false },
        });
      }
      const gradeArgs = {
        system: DIAG_GRADE_SYS,
        user:
          `Subject: ${subject}\n` +
          `Question difficulty band: ${safeDifficulty}\n` +
          (surfaceCtx ? surfaceCtx + "\n" : "") +
          `Question:\n"""${fenceGuard(safeQuestion)}"""\n\n` +
          // fenceGuard (audit P2-12): learner text can't fake closing the untrusted block.
          `Learner's reasoning:\n"""${fenceGuard(work)}"""`,
        image: img.image,
        imageRequired: imageOnly, // audit P1-3: never text-grade the placeholder for an image-only answer
        grade: true, // route to the cheaper grading model
      };
      const data = await groqJSON(gradeArgs);
      // Grader-output gate (audit P2-1): a parseable response WITHOUT a usable rubric is
      // an upstream failure — fail retryably instead of zero-filling a genuine attempt.
      if (!data || typeof data !== "object" || !data.rubric || typeof data.rubric !== "object") {
        throw new Error("grader returned no usable rubric");
      }
      gradeSucceeded = true; // the charged grade produced a usable result — no refund owed
      // NUMERIC VERIFICATION (lib/numericVerify.js): sandbox-recompute the grader's
      // own arithmetic; a proven-wrong grade re-grades once via the shared
      // budget-charged makeRegrade (vision never re-fired; every failure falls open).
      const { data: graded, verification } = await withNumericVerification(data, {
        regrade: makeRegrade({
          image: img.image,
          system: DIAG_GRADE_SYS,
          charge: chargeGlobalGroq,
          call: (system) => groqJSON({ ...gradeArgs, system }),
        }),
      });
      const rubric = normalizeRubric(graded.rubric);
      const weakConcepts = normalizeWeakConcepts(graded.weakConcepts);
      // EXPLICIT response (audit P2-2): never spread raw model JSON to the client — a
      // model-emitted `error` key made the client discard a successful grade, and an
      // object-typed note field crashed the feedback panel as a React child.
      return NextResponse.json({
        subject,
        // The headline is the TRANSPARENT weighted mean of the rubric axes — the grader no
        // longer emits a score, so there's nothing to reconcile (path-independent).
        score: scoreFromRubric(rubric),
        rubric,
        solve: normalizeSolve(graded.solve),
        errors: normalizeErrors(graded.errors),
        finalAnswerMatches: graded.finalAnswerMatches === true,
        verification,
        weakConcepts,
        comment: typeof graded.comment === "string" ? graded.comment.slice(0, 2000) : "",
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
        solve: null,
        errors: [],
        finalAnswerMatches: false,
        // No grade ran, so there is nothing to verify — same shape as /api/score.
        verification: { status: "skipped", value: null, changed: false },
        docked: true,
      });
    }
    const safeScore = clampSubjectScore(score) ?? 0;
    const gradeArgs = {
      system: PRACTICE_GRADE_SYS,
      user:
        `Subject: ${subject}\n` +
        `Question:\n"""${fenceGuard(safeQuestion)}"""\n` +
        `Concept being probed:\n"""${fenceGuard(safeConcept)}"""\n` +
        `Question difficulty band: ${safeDifficulty}\n` +
        (surfaceCtx ? surfaceCtx + "\n" : "") +
        `Learner's current level: ${safeScore}/350\n\n` +
        // fenceGuard (audit P2-12): learner text can't fake closing the untrusted block.
        `Learner's reasoning:\n"""${fenceGuard(work)}"""`,
      image: img.image,
      imageRequired: imageOnly, // audit P1-3: never text-grade the placeholder for an image-only answer
      grade: true, // route to the cheaper grading model
      maxTokens: 3000, // room for the grader's solve block + strengths/improvements + typed errors + worked solution
    };
    const data = await groqJSON(gradeArgs);
    // Grader-output gate (audit P2-1): a parseable response WITHOUT a usable rubric is
    // an upstream failure — fail retryably instead of zero-filling a genuine attempt
    // (the all-zero "grade" silently corrupted the guest's local rating).
    if (!data || typeof data !== "object" || !data.rubric || typeof data.rubric !== "object") {
      throw new Error("grader returned no usable rubric");
    }
    gradeSucceeded = true; // the charged grade produced a usable result — no refund owed
    // NUMERIC VERIFICATION (lib/numericVerify.js): sandbox-recompute the grader's
    // own arithmetic; a proven-wrong grade re-grades once via the shared
    // budget-charged makeRegrade (vision never re-fired; every failure falls open).
    const { data: graded, verification } = await withNumericVerification(data, {
      regrade: makeRegrade({
        image: img.image,
        system: PRACTICE_GRADE_SYS,
        charge: chargeGlobalGroq,
        call: (system) => groqJSON({ ...gradeArgs, system }),
      }),
    });
    // Normalize EVERY field the UI renders — and build an EXPLICIT response (audit
    // P2-2): the old `...data` spread passed un-normalized model output to the client
    // (an object-typed socraticHint crashed the app as a React child; a model-emitted
    // `error` key made the client discard a successful, Groq-billed grade).
    const rubric = normalizeRubric(graded.rubric);
    const weakConcepts = normalizeWeakConcepts(graded.weakConcepts);
    const reasoningScore = scoreFromRubric(rubric); // transparent weighted mean of the axes
    return NextResponse.json({
      reasoningScore,
      newScoreSuggestion: reasoningScore, // the guest's local Glicko target = the same axis-derived score
      rubric,
      solve: normalizeSolve(graded.solve),
      errors: normalizeErrors(graded.errors),
      finalAnswerMatches: graded.finalAnswerMatches === true,
      verification,
      strengths: normalizeFeedbackList(graded.strengths),
      improvements: normalizeFeedbackList(graded.improvements),
      workedSolution: capSolution(graded.workedSolution),
      correctnessNote: typeof graded.correctnessNote === "string" ? graded.correctnessNote.slice(0, 2000) : "",
      socraticHint: typeof graded.socraticHint === "string" ? graded.socraticHint.slice(0, 2000) : "",
      microLesson: typeof graded.microLesson === "string" ? graded.microLesson.slice(0, 2000) : "",
      weakConcepts,
    });
  } catch (e) {
    // Refund the pre-charged global Groq budget when the charged grade did NOT succeed
    // (audit P2-2 fix): an upstream outage shouldn't keep the slot consumed for the rest
    // of the window and over-throttle everyone. A grade that succeeded then failed
    // downstream keeps its charge — the Groq spend really happened.
    if (!gradeSucceeded && chargedGroq > 0) {
      await refundGlobalGroq(chargedGroq, { img: chargedImg });
    }
    // Log server-side; return a generic message so upstream Groq status/body
    // detail (keys, quota state, model IDs) never leaks to the client.
    console.error("[/api/grade]", e);
    return NextResponse.json(
      { error: "Grading is temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}
