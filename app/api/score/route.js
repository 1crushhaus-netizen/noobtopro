// ---------------------------------------------------------------------------
// /api/score — SERVER-AUTHORITATIVE scoring for signed-in users.
//
// The trust boundary the rest of the app leans on. For a SIGNED-IN user the score
// is GRADED, COMPUTED, and PERSISTED entirely server-side:
//   1. the caller's Supabase JWT is verified (requireUser → supabase.auth.getUser),
//   2. the reasoning is graded by Groq,
//   3. the new score is computed from the user's STORED per-axis Glicko-2 state (read
//      here, never client-supplied) — the difficulty-adjusted aggregate of the 9 axes, and
//   4. it is written for the verified auth.uid() via the service-role-only
//      save_progress_for RPC.
// Because scores/attempts are SELECT-only under RLS, the client can no longer
// self-assert a score by any path.
//
// kind:"practice"   → REQUIRES a verified user (it persists). Grades one question,
//                     returns the coaching feedback + the trusted new score.
// kind:"diagnostic" → auth-OPTIONAL. Grades the (≤9) answers server-side with
//                     bounded concurrency + retry-once-on-429 + allSettled (so the
//                     old per-question parallel client burst can't 429 the whole set). A verified
//                     user gets the baseline persisted; a guest gets it back to
//                     store in localStorage (no account to protect).
//
// Same same-origin + JSON guard + per-IP rate limiting + abuse logging as the other
// routes; diagnostic carries a stricter budget because one request fans out to many
// Groq calls. Real errors are logged server-side; the client gets a generic message.
// ---------------------------------------------------------------------------

import { NextResponse, after } from "next/server";
import { groqJSON, fenceGuard, PRACTICE_GRADE_SYS, DIAG_GRADE_SYS } from "@/lib/groq";
import { verifyQuestionToken } from "@/lib/questionToken";
import {
  ORDER,
  normalizeRubric,
  totalPoints,
  phdIndex,
  DIAGNOSTIC_DIFFICULTIES,
  defaultDifficultyForBand,
  scoreFromRubric,
  explainRankMove,
  updateAxisRatings,
  diagnosticSeedFromReasoning,
  repeatFactorFromRecent,
  itemDifficultyDelta,
  REPEAT_WINDOW_K,
} from "@/lib/scoring";
import { normalizeTopic } from "@/lib/taxonomy";
import { diagnosticSurfaceFor, diagnosticQuestionFor } from "@/lib/diagnosticBank";
import { preGradeDock } from "@/lib/preGrade";
import { checkRateLimit, clientKey, chargeGlobalGroq } from "@/lib/rateLimit";
import { isCrossSiteRequest, isWrongContentType, readJsonLimited, MAX_BODY_BYTES_IMAGE } from "@/lib/requestGuard";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/adminAuth";
import { reportInjection, reportRateLimit } from "@/lib/abuseDetection";
import { capText, normalizeImage, normalizeDifficulty, normalizeWeakConcepts, normalizeFeedbackList, capSolution, normalizeErrors, normalizeSolve, normalizeReasoningSurface, reasoningSurfaceContext } from "@/lib/gradeInput";

export const dynamic = "force-dynamic";
// Bound a hung request explicitly (audit P2-10): the Groq fetch carries a 30s abort,
// and the diagnostic fans out up to 9 grades at concurrency 3, so the worst case
// needs real headroom. 300s = the Fluid-compute maximum on the current (Hobby) plan —
// revisit if the plan changes (Vercel rejects over-plan values at deploy time).
export const maxDuration = 300;

const GRADE_CONCURRENCY = 3; // simultaneous Groq grade calls per diagnostic
const MAX_DIAGNOSTIC_ANSWERS = ORDER.length * DIAGNOSTIC_DIFFICULTIES.length; // 9 (3 subjects × 3 tiers)
const RETRY_DELAY_MS = 700;

const nowIso = () => new Date().toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Auto-grow the concept hub: register the grader's (server-normalized) weak concepts
// as PENDING catalog stubs, AFTER the response (no added grading latency). Mirrors
// /api/grade so signed-in users feed the hub too. No-op without the service-role key.
function registerWeakConcepts(subject, weakConcepts) {
  if (!ORDER.includes(subject) || !Array.isArray(weakConcepts) || weakConcepts.length === 0) return;
  const task = async () => {
    try {
      const sb = getSupabaseAdmin();
      if (sb) await sb.rpc("register_concepts", { p_subject: subject, p_concepts: weakConcepts });
    } catch (e) {
      console.error("[/api/score] register_concepts", e); // best-effort; self-heals next grade
    }
  };
  try {
    after(task);
  } catch {
    void task();
  }
}

// Calibrate the item-difficulty bucket for (subject, topic, band) AFTER the response —
// an atomic, clamped nudge by the aggregate-outcome difficulty delta. Best-effort + non-blocking:
// a calibration write must never fail or slow the learner's grade. No-op without the
// service-role key (sb null). The seed lands a brand-new bucket at the band midpoint.
function bumpItemDifficulty(sb, subject, topic, band, delta, seed) {
  if (!sb || !Number.isFinite(Number(delta))) return;
  const run = async () => {
    try {
      await sb.rpc("bump_item_difficulty", {
        p_subject: subject, p_topic: topic, p_band: band, p_delta: delta, p_seed: seed,
      });
    } catch (e) {
      console.error("[/api/score] bump_item_difficulty", e); // self-heals next attempt
    }
  };
  try {
    after(run);
  } catch {
    void run();
  }
}

// Grade one question's reasoning, retrying ONCE on a 429 after a short backoff. The
// diagnostic fans out several grades; a transient per-minute 429 shouldn't sink an
// answer. groqJSON re-throws hard upstream errors with .status set, so a 429 surfaces
// here for the retry. We do NOT retry IMAGE grades: groqJSON already falls back to a
// text-only call internally on a recoverable vision failure, so re-issuing the whole
// call would fire a SECOND (expensive, multi-MB) vision request — a cost-amplifier.
async function gradeOne(args) {
  try {
    return await groqJSON({ ...args, grade: true });
  } catch (e) {
    if (e && e.status === 429 && !args.image) {
      await sleep(RETRY_DELAY_MS);
      return await groqJSON({ ...args, grade: true });
    }
    throw e;
  }
}

// Bounded-concurrency map that NEVER rejects: each item resolves to
// { ok:true, value } or { ok:false, error } (Promise.allSettled semantics), so one
// failed grade can't fail the whole diagnostic. At most `limit` run at once.
async function settledPool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        out[i] = { ok: true, value: await fn(items[i], i) };
      } catch (e) {
        out[i] = { ok: false, error: e };
      }
    }
  }
  const workers = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workers }, worker));
  return out;
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
    reportRateLimit({ req, route: "/api/score" });
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

  const kind = body && body.kind;
  if (kind === "practice") return handlePractice(req, body);
  if (kind === "diagnostic") return handleDiagnostic(req, body);
  return NextResponse.json({ error: 'kind must be "practice" or "diagnostic".' }, { status: 400 });
}

// --- practice: auth-REQUIRED, server-authoritative single-question scoring -------
async function handlePractice(req, body) {
  const auth = await requireUser(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const uid = auth.user.id;

  // Durable PER-ACCOUNT cap (follows the user across IPs/devices, shared across
  // instances) on top of the pre-auth per-IP gate — a single account can't burn the
  // Groq budget by rotating IPs.
  const acctRl = await checkRateLimit(`acct:${uid}:practice`, { max: 45 });
  if (!acctRl.ok) {
    reportRateLimit({ req, route: "/api/score" });
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(acctRl.retryAfter) } }
    );
  }

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Scoring is temporarily unavailable." }, { status: 503 });

  const { token, reasoning, image } = body || {};
  // SERVER-ISSUED QUESTION BINDING (audit P1-1). The token is signed by
  // /api/generate (or /api/learn's "try this") at serve time; EVERY rating-relevant
  // field — subject, question text, difficulty band, topic bucket, reasoning
  // surface/trap — comes from the VERIFIED payload, never the request body. Before
  // this, a signed-in user could self-author an easy question labeled `phd` and
  // inflate their rating, rotate the claimed (topic, band) to dodge the anti-farm
  // damper, and poison the shared item_difficulty calibration. The token's `jti`
  // also dedupes the attempt (replay protection — save_progress_for, audit P2-5).
  // A pre-deploy client submits the OLD body shape (loose subject/question fields, no
  // token) — and its in-memory regenerate path can never mint one, so "generate a new
  // question" would dead-end it. Tell that client the one thing that actually works.
  if (!token && body && typeof body.subject === "string" && typeof body.question === "string") {
    return NextResponse.json(
      { error: "A new version of the app is available — refresh the page, then try again." },
      { status: 400 }
    );
  }
  const tok = verifyQuestionToken(token);
  if (!tok.ok) return NextResponse.json({ error: tok.error }, { status: 400 });
  const issued = tok.q;
  const subject = issued.subject;
  if (!ORDER.includes(subject)) {
    return NextResponse.json({ error: "Unknown subject." }, { status: 400 });
  }
  const safeQuestion = capText(issued.question || "");
  if (!safeQuestion.trim()) {
    return NextResponse.json(
      { error: "This question could not be verified — please generate a new question." },
      { status: 400 }
    );
  }
  const work =
    typeof reasoning === "string" && reasoning.trim() ? capText(reasoning.trim()) : "(no written reasoning provided)";
  const safeConcept = capText(issued.targetConcept) || "(unspecified)";
  const safeDifficulty = normalizeDifficulty(issued.difficulty);
  // Reasoning-surface calibration context for the grader ("" when absent) — from the
  // SERVER-issued payload (re-normalized defensively), not the client.
  const surfaceCtx = reasoningSurfaceContext(normalizeReasoningSurface(issued.reasoningSurface), issued.trap);

  reportInjection({
    req,
    route: "/api/score",
    subject,
    concept: safeConcept !== "(unspecified)" ? safeConcept : null,
    text: `${safeQuestion}\n${work}\n${safeConcept}\n${surfaceCtx}`,
  });

  const img = normalizeImage(image);
  if (!img.ok) return NextResponse.json({ error: img.error }, { status: 400 });
  if (img.image) {
    const imgRl = await checkRateLimit(`${clientKey(req)}:img`, { max: 10 });
    if (!imgRl.ok) {
      reportRateLimit({ req, route: "/api/score" });
      return NextResponse.json(
        { error: "Too many image grades. Please slow down and try again shortly." },
        { status: 429, headers: { "Retry-After": String(imgRl.retryAfter) } }
      );
    }
  }

  // The difficulty band + the calibration bucket key (subject, taxonomy slug, band).
  // safeDifficulty is allow-listed; "(unspecified)" → intermediate so the rating math
  // always has a real band. normalizeTopic bounds the topic to a real slug or
  // general_<subject>, so the bucket key space is bounded + FK-valid.
  const tokenBand = safeDifficulty !== "(unspecified)" ? safeDifficulty : "intermediate";
  const topicSlug = normalizeTopic(subject, issued.topicSlug);
  // Image-only submission: the photo IS the answer, so a vision failure must fail
  // retryably rather than text-grade the placeholder string (audit P1-3).
  const imageOnly = !!img.image && !(typeof reasoning === "string" && reasoning.trim());

  try {
    // Cheap PRE-GRADE replay check (review P3): the authoritative jti dedupe lives in
    // save_progress_for (under the advisory lock), but catching the common replay here
    // skips the paid Groq grade and the global-budget charge entirely.
    if (issued.jti) {
      const { data: dupRows } = await sb.from("attempts").select("id").eq("user_id", uid).eq("jti", issued.jti).limit(1);
      if (Array.isArray(dupRows) && dupRows.length) {
        return NextResponse.json(
          { error: "This answer has already been graded — generate a new question to keep practicing." },
          { status: 409 }
        );
      }
    }

    // 1) PRE-GRADE context reads: the learner's level (for the grader prompt + the
    //    band clamp below), and their recent attempts in this subject (the last K, for
    //    the anti-farm repeat factor) — ALL read server-side; the client supplies none
    //    of the values the new rating is computed from. The RATING-bearing scores read
    //    happens fresh inside the persist loop below (audit P2-4: the old pre-grade
    //    read made the rating a multi-second read-modify-write that lost one of two
    //    concurrent updates).
    const [scoresRes, recentRes] = await Promise.all([
      sb.from("scores").select("subject, score, weak_concepts, comment, rubric, glicko, updated_at").eq("user_id", uid),
      sb.from("attempts").select("topic, band").eq("user_id", uid).eq("subject", subject).eq("type", "attempt").order("created_at", { ascending: false }).limit(REPEAT_WINDOW_K),
    ]);
    if (scoresRes.error) throw scoresRes.error;

    const rowsToMap = (rows) => {
      const m = {};
      for (const r of rows || []) {
        m[r.subject] = {
          score: r.score,
          weakConcepts: r.weak_concepts || [],
          comment: r.comment || "",
          rubric: r.rubric || null,
          glicko: r.glicko || null,
          updatedAt: r.updated_at || null,
        };
      }
      return m;
    };
    const promptMap = rowsToMap(scoresRes.data);
    const promptPrevScore = promptMap[subject] ? promptMap[subject].score : 0;

    // BAND CLAMP (review of audit P1-1 — the injection-mint residual): the token's
    // band is signed but originates from MODEL output whose prompt embeds client text
    // on an unauthenticated route, so a successful generator injection could mint a
    // "phd"-band trivial question. The opponent band a learner faces is therefore
    // capped at ONE band above their server-stored level ("at-rating by selection" —
    // the generator already targets their level, so honest flows are unaffected; a
    // minted phd label on a 30-score account grades as intermediate). Deflate-only:
    // bands at or below the learner's level are untouched.
    const BAND_LADDER = ["beginner", "foundational", "intermediate", "advanced", "phd"];
    const storedBandIdx = Math.min(BAND_LADDER.length - 1, Math.floor(Math.max(0, Number(promptPrevScore) || 0) / 20));
    const tokenBandIdx = Math.max(0, BAND_LADDER.indexOf(tokenBand));
    const bandKey = BAND_LADDER[Math.min(tokenBandIdx, storedBandIdx + 1)];
    const seedDifficulty = defaultDifficultyForBand(bandKey);

    // The calibrated item difficulty for the (clamped) bucket.
    const diffRes = await sb.from("item_difficulty").select("difficulty").eq("subject", subject).eq("topic", topicSlug).eq("band", bandKey).maybeSingle();
    const itemDifficulty =
      diffRes && diffRes.data && Number.isFinite(Number(diffRes.data.difficulty))
        ? Number(diffRes.data.difficulty)
        : seedDifficulty;

    // 2) DETERMINISTIC pre-grade dock (no LLM call) on the ORIGINAL answer: empty /
    //    "idk" / off-topic / gibberish → forced low outcome + all-zero rubric. Else grade.
    //    Skip the dock when a photo is attached — preGradeDock only inspects TEXT, so an
    //    image-only answer (worked notes in the photo, empty text box) is a substantive
    //    submission that must reach the vision grader, not be docked to a non-attempt.
    const dock = img.image ? null : preGradeDock(capText(reasoning)); // cap before the dock (bounded regex/Set work)
    if (!dock) {
      // GLOBAL Groq budget (audit P2-3): the per-IP/per-account caps are the fairness
      // layer; this platform-wide window bounds total spend under IP rotation.
      const glob = await chargeGlobalGroq(1, { img: img.image ? 1 : 0 });
      if (!glob.ok) {
        reportRateLimit({ req, route: "/api/score" });
        return NextResponse.json(
          { error: "Too many requests. Please slow down and try again shortly." },
          { status: 429, headers: { "Retry-After": String(glob.retryAfter) } }
        );
      }
    }
    const data = dock
      ? dock
      : await gradeOne({
          system: PRACTICE_GRADE_SYS,
          user:
            `Subject: ${subject}\n` +
            `Question:\n"""${safeQuestion}"""\n` +
            `Concept being probed:\n"""${safeConcept}"""\n` +
            `Question difficulty band: ${safeDifficulty}\n` +
            (surfaceCtx ? surfaceCtx + "\n" : "") +
            `Learner's current level: ${promptPrevScore}/100\n\n` +
            // fenceGuard (audit P2-12): learner text can't fake closing the untrusted block.
            `Learner's reasoning:\n"""${fenceGuard(work)}"""`,
          image: img.image,
          imageRequired: imageOnly, // audit P1-3: never text-grade the placeholder for an image-only answer
          maxTokens: 3000, // room for the grader's solve block + strengths/improvements + typed errors + worked solution
        });

    // Grader-output gate (audit P2-1): a parseable response WITHOUT a usable rubric is
    // an upstream failure — fail retryably instead of zero-filling a real attempt and
    // persisting a bogus rating drop.
    if (!dock && (!data || typeof data !== "object" || !data.rubric || typeof data.rubric !== "object")) {
      throw new Error("grader returned no usable rubric");
    }

    const attemptRubric = normalizeRubric(data?.rubric);
    // 3) The headline is the TRANSPARENT weighted mean of the rubric axes (process-first,
    //    path-independent — final-answer correctness never enters here). A dock carries its
    //    own forced low score (DOCK_SCORE), so use it directly rather than the all-zero mean.
    const reasoningScore = dock ? data.reasoningScore : scoreFromRubric(attemptRubric);
    const weakConcepts = normalizeWeakConcepts(data?.weakConcepts);
    // Post-grade feedback: what was good, how to reach 100, the grader's own worked
    // solution (compute-first) used to type the learner's errors, the typed error list,
    // and — only on a SUBSTANTIVE (non-docked) attempt — the full worked solution. A dock
    // returns workedSolution="" and no errors/solve, so a non-attempt can't extract the answer.
    const strengths = normalizeFeedbackList(data?.strengths);
    const improvements = normalizeFeedbackList(data?.improvements);
    const workedSolution = dock ? "" : capSolution(data?.workedSolution);
    const solve = dock ? null : normalizeSolve(data?.solve);
    const errors = dock ? [] : normalizeErrors(data?.errors);
    const finalAnswerMatches = dock ? false : data?.finalAnswerMatches === true;
    const correctnessNote = typeof data?.correctnessNote === "string" ? data.correctnessNote.slice(0, 2000) : "";
    const socraticHint = typeof data?.socraticHint === "string" ? data.socraticHint.slice(0, 2000) : "";
    const microLesson = typeof data?.microLesson === "string" ? data.microLesson.slice(0, 2000) : "";

    // 4-6) UNIFIED GLICKO-2 update + persist, under OPTIMISTIC CONCURRENCY (audit
    //    P2-4/P2-5/P2-7). Each pass reads the user's scores FRESH (post-grade), computes
    //    the rating from that exact state, and asks save_progress_for to commit ONLY if
    //    the row is still at the observed updated_at (p_check_conflict). A concurrent
    //    same-subject grade or a "Reset my progress" between read and write surfaces as
    //    status:"conflict" → recompute once from the new state (so neither update is
    //    lost and a reset is never resurrected from pre-delete state). The token's jti
    //    rides on the attempt: a replayed/duplicate-delivered request gets
    //    status:"duplicate" and NO second rating step. The rating math itself is
    //    unchanged: 9 axes vs the calibrated item difficulty, anti-farm damping on
    //    repeats, dock = a real low outcome, lazy-seed continuity.
    let recentRows = recentRes && recentRes.data;
    let saved = null;
    for (let pass = 0; pass < 2 && !saved; pass++) {
      if (pass > 0) {
        // The conflicting concurrent attempt also appended an attempts row — refresh
        // the anti-farm window so the recompute damps it correctly (review P3).
        const freshRecent = await sb.from("attempts").select("topic, band").eq("user_id", uid).eq("subject", subject).eq("type", "attempt").order("created_at", { ascending: false }).limit(REPEAT_WINDOW_K);
        if (!freshRecent.error) recentRows = freshRecent.data;
      }
      const repeatFactor = repeatFactorFromRecent(recentRows, topicSlug, bandKey);
      const freshRes = await sb.from("scores").select("subject, score, weak_concepts, comment, rubric, glicko, updated_at").eq("user_id", uid);
      if (freshRes.error) throw freshRes.error;
      const current = rowsToMap(freshRes.data);
      const prev = current[subject] || null;
      const prevScore = prev ? prev.score : 0;

      const { glicko: newGlicko, rubric: newRubric, score: newScore, expected } = updateAxisRatings({
        prevGlicko: prev ? prev.glicko : null,
        prevRubric: prev ? prev.rubric : null,
        prevScore,
        attemptRubric,
        difficulty: itemDifficulty,
        repeatFactor,
      });
      const newWeak = weakConcepts.length ? weakConcepts : prev ? prev.weakConcepts : [];
      const comment = prev ? prev.comment : "";
      const delta = newScore - prevScore;
      const rationale = explainRankMove({ delta, reasoningScore, expected, difficultyBand: bandKey, docked: !!dock });
      const updatedMap = { ...current, [subject]: { score: newScore } };
      const totalAfter = totalPoints(updatedMap);
      const phdAfter = phdIndex(updatedMap);
      const t = nowIso();

      const { data: saveRes, error: saveErr } = await sb.rpc("save_progress_for", {
        p_user: uid,
        p_scores: [
          { subject, score: newScore, weak_concepts: (newWeak || []).slice(0, 64), comment, rubric: newRubric, glicko: newGlicko },
        ],
        p_attempt: {
          type: "attempt",
          subject,
          reasoning_score: reasoningScore,
          delta,
          new_score: newScore,
          total_after: totalAfter,
          phd_after: phdAfter,
          created_at: t,
          rationale,
          topic: topicSlug,
          band: bandKey,
          jti: issued.jti, // replay/duplicate-delivery dedupe (audit P2-5)
        },
        // Answer-review detail (persisted atomically with the attempt) so the learner can
        // review this answer later. `answer` is the learner's own reasoning (`work`).
        p_review: {
          question: safeQuestion,
          answer: work,
          target_concept: safeConcept,
          difficulty: safeDifficulty,
          rubric: attemptRubric,
          feedback: { strengths, improvements, workedSolution, correctnessNote, socraticHint, microLesson, solve, errors, finalAnswerMatches },
        },
        p_expected_updated_at: prev ? prev.updatedAt : null,
        p_check_conflict: true,
      });
      if (saveErr) throw saveErr;
      const status = saveRes && saveRes.status;
      if (status === "duplicate") {
        // The same served question was already scored (network retry / replay): no
        // second rating step, no duplicate attempt row.
        return NextResponse.json(
          { error: "This answer has already been graded — generate a new question to keep practicing." },
          { status: 409 }
        );
      }
      if (status === "conflict") continue; // state moved under us — recompute from fresh
      saved = { prevScore, newGlicko, newRubric, newScore, newWeak, comment, delta, rationale, totalAfter, phdAfter, t };
    }
    if (!saved) {
      return NextResponse.json(
        { error: "Your progress changed while this was being graded — please try again." },
        { status: 409 }
      );
    }

    // 7) Calibrate the item-difficulty bucket (non-blocking; only on a real grade — a
    //    docked non-answer carries no signal about the item's difficulty). The nudge is
    //    the aggregate-outcome surprise vs the learner's prior level — a commutative
    //    additive delta (concurrent bumps still commute), same shape as before.
    if (!dock) {
      const diffDelta = itemDifficultyDelta({ prevSubjectScore: saved.prevScore, itemDifficulty, aggregateOutcome: reasoningScore / 100 });
      bumpItemDifficulty(sb, subject, topicSlug, bandKey, diffDelta, seedDifficulty);
    }
    registerWeakConcepts(subject, weakConcepts); // auto-grow the hub (non-blocking)

    return NextResponse.json({
      reasoningScore,
      rubric: attemptRubric, // per-attempt 0–4 bars for the feedback panel
      solve, // the grader's own worked solution (compute-first; null on a dock)
      errors, // typed error taxonomy (Socratic prompts on reasoning errors)
      finalAnswerMatches, // diagnostic only — did the learner's final answer match the grader's
      strengths, // what the answer did well
      improvements, // specific, actionable steps to reach 100
      workedSolution, // full solution, revealed post-grade (empty on a dock)
      correctnessNote,
      socraticHint,
      microLesson,
      weakConcepts,
      newScore: saved.newScore,
      delta: saved.delta,
      rationale: saved.rationale,
      docked: !!dock,
      subjectScore: { score: saved.newScore, weakConcepts: saved.newWeak, comment: saved.comment, rubric: saved.newRubric },
      attempt: { type: "attempt", t: saved.t, subject, reasoningScore, delta: saved.delta, newScore: saved.newScore, totalAfter: saved.totalAfter, phdAfter: saved.phdAfter, rationale: saved.rationale },
    });
  } catch (e) {
    console.error("[/api/score practice]", e);
    return NextResponse.json({ error: "Grading is temporarily unavailable. Please try again." }, { status: 500 });
  }
}

// --- diagnostic: auth-OPTIONAL batch baseline grading ---------------------------
async function handleDiagnostic(req, body) {
  // Stricter budget FIRST: one diagnostic request fans out to up to 6 Groq grades, so
  // reject an over-budget request before any auth round-trip or grading.
  const diagRl = await checkRateLimit(`${clientKey(req)}:diag`, { max: 4 });
  if (!diagRl.ok) {
    reportRateLimit({ req, route: "/api/score" });
    return NextResponse.json(
      { error: "Too many diagnostics. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(diagRl.retryAfter) } }
    );
  }

  // Auth is OPTIONAL: a valid token persists the baseline; a guest gets it back. An
  // INVALID token is still rejected — don't silently downgrade a bad token to guest.
  let uid = null;
  let sb = null;
  if (req.headers.get("authorization")) {
    const auth = await requireUser(req);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    uid = auth.user.id;
    // Durable PER-ACCOUNT diagnostic cap (across IPs/instances), on top of the per-IP
    // :diag budget above.
    const acctRl = await checkRateLimit(`acct:${uid}:diag`, { max: 6 });
    if (!acctRl.ok) {
      reportRateLimit({ req, route: "/api/score" });
      return NextResponse.json(
        { error: "Too many diagnostics. Please slow down and try again shortly." },
        { status: 429, headers: { "Retry-After": String(acctRl.retryAfter) } }
      );
    }
    // Resolve the service-role client UP FRONT: if persistence is impossible, fail
    // before spending Groq tokens on a baseline we couldn't save.
    sb = getSupabaseAdmin();
    if (!sb) return NextResponse.json({ error: "Scoring is temporarily unavailable." }, { status: 503 });
  }

  const rawAnswers = body && Array.isArray(body.answers) ? body.answers : null;
  if (!rawAnswers || rawAnswers.length === 0) {
    return NextResponse.json({ error: "answers must be a non-empty array." }, { status: 400 });
  }
  if (rawAnswers.length > MAX_DIAGNOSTIC_ANSWERS) {
    return NextResponse.json({ error: "Too many answers." }, { status: 400 });
  }

  // Validate + DEDUPE by subject:difficulty so a client can't multiply the Groq
  // fan-out by sending the same slot many times.
  const seen = new Set();
  const items = [];
  for (const a of rawAnswers) {
    if (!a || typeof a !== "object") continue;
    const subject = a.subject;
    if (!ORDER.includes(subject)) continue;
    const difficulty = DIAGNOSTIC_DIFFICULTIES.includes(a.difficulty) ? a.difficulty : null;
    if (!difficulty) continue;
    const key = `${subject}:${difficulty}`;
    if (seen.has(key)) continue;
    // The GRADED question text comes from the curated bank by slot — never from the
    // request body (audit P1-1 family): the diagnostic is the standardized placement,
    // so a client substituting its own easier question must not earn the slot's
    // baseline credit. (The bank covers every (subject, difficulty) slot; a missing
    // lookup means a forged slot → skip.)
    const bankQuestion = diagnosticQuestionFor(subject, difficulty);
    if (!bankQuestion) continue;
    // Serve/submit consistency (review P2): the client echoes the question it actually
    // DISPLAYED; if the bank was edited between serve and submit (a deploy mid-
    // diagnostic), grading the new text against an answer to the old text would
    // silently persist a wrong baseline. Reject retryably instead — restarting the
    // (free, zero-Groq) diagnostic is cheap; a corrupted Glicko seed is not.
    if (typeof a.question === "string" && a.question.trim() && capText(a.question.trim()) !== capText(bankQuestion)) {
      return NextResponse.json(
        { error: "The placement questions were updated while you were answering — please restart the diagnostic." },
        { status: 409 }
      );
    }
    const img = normalizeImage(a.image);
    if (!img.ok) return NextResponse.json({ error: img.error }, { status: 400 });
    seen.add(key);
    const hasText = typeof a.reasoning === "string" && !!a.reasoning.trim();
    // Reasoning-surface context DERIVED SERVER-SIDE from the curated bank by (subject,
    // difficulty) — NOT trusted from the request body — so a crafted answer can't spoof the
    // grader's calibration. "" when the slot has no surface.
    const bankSurface = diagnosticSurfaceFor(subject, difficulty);
    items.push({
      subject,
      difficulty,
      question: capText(bankQuestion),
      surfaceCtx: reasoningSurfaceContext(bankSurface.reasoningSurface, bankSurface.trap),
      reasoning: hasText ? capText(a.reasoning.trim()) : "(no written reasoning provided)",
      // Image-only answer: the photo IS the answer — a vision failure must fail this
      // grade (allSettled drops the tier) rather than text-grade the placeholder
      // (audit P1-3).
      imageOnly: !!img.image && !hasText,
      // Deterministic dock on the RAW answer (before the placeholder substitution
      // above), so a blank / "idk" / off-topic diagnostic answer is graded low with no
      // LLM call, just like practice. Skip the dock when a photo is attached — an
      // image-only answer must reach the vision grader (preGradeDock only sees text).
      dock: img.image ? null : preGradeDock(capText(a.reasoning)), // cap before the dock (bounded regex/Set work)
      image: img.image,
    });
  }
  if (items.length === 0) {
    return NextResponse.json({ error: "No valid answers to grade." }, { status: 400 });
  }

  // Charge the per-IP IMAGE budget for the diagnostic's vision grades — one token per
  // image-bearing answer — so the costliest Groq path (multimodal, multi-MB) is bounded
  // identically to the practice route. Without this, a diagnostic could drive up to 6
  // vision calls/request entirely outside the :img cap.
  const imgCount = items.filter((i) => i.image).length;
  if (imgCount) {
    let imgRl;
    // Charge one :img token per image-bearing answer, but stop as soon as the budget is
    // exceeded — no point spending further durable-RPC round-trips once we'll reject.
    for (let i = 0; i < imgCount; i++) {
      imgRl = await checkRateLimit(`${clientKey(req)}:img`, { max: 10 });
      if (!imgRl.ok) break;
    }
    if (!imgRl.ok) {
      reportRateLimit({ req, route: "/api/score" });
      return NextResponse.json(
        { error: "Too many image grades. Please slow down and try again shortly." },
        { status: 429, headers: { "Retry-After": String(imgRl.retryAfter) } }
      );
    }
  }

  // GLOBAL Groq budget (audit P2-3): charge one token per LIVE grade (docked answers
  // cost nothing) so platform-wide spend stays bounded under IP rotation.
  const liveGrades = items.filter((i) => !i.dock).length;
  if (liveGrades) {
    const glob = await chargeGlobalGroq(liveGrades, { img: imgCount });
    if (!glob.ok) {
      reportRateLimit({ req, route: "/api/score" });
      return NextResponse.json(
        { error: "Too many requests. Please slow down and try again shortly." },
        { status: 429, headers: { "Retry-After": String(glob.retryAfter) } }
      );
    }
  }

  reportInjection({ req, route: "/api/score", text: items.map((i) => i.reasoning).join("\n") });

  try {
    const graded = await settledPool(items, GRADE_CONCURRENCY, async (it) => {
      const data = it.dock
        ? it.dock
        : await gradeOne({
            system: DIAG_GRADE_SYS,
            user:
              `Subject: ${it.subject}\n` +
              `Question difficulty band: ${it.difficulty}\n` +
              (it.surfaceCtx ? it.surfaceCtx + "\n" : "") +
              `Question:\n"""${it.question}"""\n\n` +
              // fenceGuard (audit P2-12): learner text can't fake closing the untrusted block.
              `Learner's reasoning:\n"""${fenceGuard(it.reasoning)}"""`,
            image: it.image,
            imageRequired: it.imageOnly, // audit P1-3: never text-grade the placeholder for an image-only answer
            maxTokens: 1800, // room for the grader's solve block + 9-axis rubric + typed errors
          });
      // Grader-output gate (audit P2-1): no usable rubric → this grade is a settled
      // FAILURE (the tier drops out; retry-once already happened), not a zero baseline.
      if (!it.dock && (!data || typeof data !== "object" || !data.rubric || typeof data.rubric !== "object")) {
        throw new Error("grader returned no usable rubric");
      }
      const rubric = normalizeRubric(data?.rubric);
      // The dock carries its own forced low reasoningScore; the live grade's headline is
      // the TRANSPARENT weighted mean of the rubric axes (path-independent — the grader no
      // longer emits a score). Baseline aggregation (diagnosticSubjectScore) uses these.
      const reasoningScore = it.dock ? data.reasoningScore : scoreFromRubric(rubric);
      return {
        subject: it.subject,
        difficulty: it.difficulty,
        reasoningScore,
        rubric,
        weakConcepts: normalizeWeakConcepts(data?.weakConcepts),
        comment: typeof data?.comment === "string" ? data.comment.slice(0, 2000) : "",
      };
    });

    const results = graded.filter((g) => g.ok).map((g) => g.value);
    if (results.length === 0) {
      // Every grade failed (sustained 429 / outage) — retryable error, don't persist
      // an all-zero baseline.
      return NextResponse.json(
        { error: "Grading is temporarily unavailable. Please try again." },
        { status: 503 }
      );
    }

    // Aggregate each subject's graded answers into a difficulty-weighted baseline
    // (score + rubric profile), mirroring the prior client logic. ACCEPTED RESIDUALS:
    // (a) a subject whose answers PARTIALLY failed grading is re-weighted from the
    //     survivors (a missing hard tier slightly inflates that subject) — preferred
    //     over discarding the subject for one transient failure; retry-once covers most;
    // (b) the diagnostic is a re-baseline: re-taking it overwrites accumulated scores
    //     (upsert), the same destructive semantics the client had before.
    const scores = {};
    for (const s of ORDER) {
      const subjectQs = results.filter((r) => r.subject === s);
      if (subjectQs.length === 0) continue;
      // Seed the per-axis Glicko state by ANCHORING the aggregate on the difficulty-weighted
      // reasoning score (full 0–100 placement range; a blank/idk test lands at the dock floor,
      // a flawless one ≈ 100) with the radar shape from the per-tier rubrics, at full RD so
      // practice then refines it — one unified, difficulty-aware baseline.
      const seed = diagnosticSeedFromReasoning(subjectQs);
      const weakConcepts = Array.from(
        new Set(subjectQs.flatMap((r) => r.weakConcepts).filter((c) => typeof c === "string" && c.trim()))
      ).slice(0, 8);
      const hardest = [...subjectQs].sort(
        (a, b) => DIAGNOSTIC_DIFFICULTIES.indexOf(b.difficulty) - DIAGNOSTIC_DIFFICULTIES.indexOf(a.difficulty)
      )[0];
      scores[s] = { score: seed.score, weakConcepts, comment: (hardest && hardest.comment) || "", rubric: seed.rubric, glicko: seed.glicko };
    }

    // Auto-grow the concept hub from the baseline's weak concepts (non-blocking).
    for (const s of ORDER) {
      if (scores[s] && scores[s].weakConcepts.length) registerWeakConcepts(s, scores[s].weakConcepts);
    }

    if (uid) {
      // sb was resolved and null-checked up front (so we never grade for a user we
      // can't persist for); reuse it here.
      const t = nowIso();
      // Snapshot total/phd over the user's FULL post-write score map: a subject whose
      // grades all failed keeps its EXISTING score (the upsert only writes submitted
      // subjects), so computing over `scores` alone would understate the totals.
      const { data: existingRows, error: existingErr } = await sb.from("scores").select("subject, score").eq("user_id", uid);
      if (existingErr) throw existingErr; // a silent miss would understate total_after/phd_after on the baseline row
      const merged = {};
      for (const r of existingRows || []) merged[r.subject] = { score: r.score };
      for (const s of ORDER) if (scores[s]) merged[s] = { score: scores[s].score };
      const totalAfter = totalPoints(merged);
      const phdAfter = phdIndex(merged);
      const p_scores = ORDER.filter((s) => scores[s]).map((s) => ({
        subject: s,
        score: scores[s].score,
        weak_concepts: (scores[s].weakConcepts || []).slice(0, 64),
        comment: scores[s].comment || "",
        rubric: scores[s].rubric,
        glicko: scores[s].glicko,
      }));
      const { error: saveErr } = await sb.rpc("save_progress_for", {
        p_user: uid,
        p_scores,
        p_attempt: { type: "baseline", total_after: totalAfter, phd_after: phdAfter, created_at: t },
      });
      if (saveErr) throw saveErr;
      return NextResponse.json({
        scores,
        persisted: true,
        attempt: {
          type: "baseline",
          t,
          subject: null,
          reasoningScore: null,
          delta: null,
          newScore: null,
          totalAfter,
          phdAfter,
        },
      });
    }

    // Guest: return the graded baseline for the client to store locally.
    return NextResponse.json({ scores, persisted: false, attempt: null });
  } catch (e) {
    console.error("[/api/score diagnostic]", e);
    return NextResponse.json({ error: "Grading is temporarily unavailable. Please try again." }, { status: 500 });
  }
}
