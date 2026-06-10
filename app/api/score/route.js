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
import { groqJSON, PRACTICE_GRADE_SYS, DIAG_GRADE_SYS } from "@/lib/groq";
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
  diagnosticSeedGlicko,
  repeatFactorFromRecent,
  itemDifficultyDelta,
  REPEAT_WINDOW_K,
} from "@/lib/scoring";
import { normalizeTopic } from "@/lib/taxonomy";
import { diagnosticSurfaceFor, diagnosticConceptFor } from "@/lib/diagnosticBank";
import { isCurriculumConcept } from "@/lib/mastery";
import { preGradeDock } from "@/lib/preGrade";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";
import { isCrossSiteRequest, isWrongContentType, readJsonLimited, MAX_BODY_BYTES_IMAGE } from "@/lib/requestGuard";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/adminAuth";
import { reportInjection, reportRateLimit } from "@/lib/abuseDetection";
import { capText, normalizeImage, normalizeDifficulty, normalizeWeakConcepts, normalizeFeedbackList, capSolution, normalizeErrors, normalizeSolve, reasoningSurfaceContext } from "@/lib/gradeInput";

export const dynamic = "force-dynamic";

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

// Per-concept MASTERY counters (Learn-tab chip coloring, RANKS_PLAN §12.1) — bump
// AFTER the response, best-effort + non-blocking: mastery is derived/repairable
// display data, so a failed bump must never fail or slow the learner's grade (and
// the route keeps working on a DB that predates migration 0010 — the error logs
// and grading proceeds). `entries` carry the SERVER-computed quality only; the
// concept keys are allow-listed against the curriculum before reaching here.
function bumpConceptMastery(sb, uid, entries) {
  if (!sb || !uid || !Array.isArray(entries) || entries.length === 0) return;
  const run = async () => {
    try {
      // supabase-js RESOLVES failures as { error } (it doesn't throw) — check it,
      // or a pre-0010 DB / RPC failure would be fully silent instead of logged.
      const { error } = await sb.rpc("bump_concept_mastery", { p_user: uid, p_entries: entries });
      if (error) console.error("[/api/score] bump_concept_mastery", error);
    } catch (e) {
      console.error("[/api/score] bump_concept_mastery", e); // network-level throw; mastery self-heals on later attempts
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

  const { subject, question, targetConcept, difficulty, reasoning, image, reasoningSurface, trap } = body || {};
  if (typeof subject !== "string" || typeof question !== "string") {
    return NextResponse.json({ error: "subject and question are required." }, { status: 400 });
  }
  if (!ORDER.includes(subject)) {
    return NextResponse.json({ error: `Unknown subject "${subject}".` }, { status: 400 });
  }
  const work =
    typeof reasoning === "string" && reasoning.trim() ? capText(reasoning.trim()) : "(no written reasoning provided)";
  const safeQuestion = capText(question);
  const safeConcept = capText(targetConcept) || "(unspecified)";
  const safeDifficulty = normalizeDifficulty(difficulty);
  // Reasoning-surface calibration context for the grader ("" when absent).
  const surfaceCtx = reasoningSurfaceContext(reasoningSurface, trap);

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
  const bandKey = safeDifficulty !== "(unspecified)" ? safeDifficulty : "intermediate";
  const topicSlug = normalizeTopic(subject, body && body.topicSlug != null ? body.topicSlug : body && body.topic);
  const seedDifficulty = defaultDifficultyForBand(bandKey);
  // Optional curriculum concept tag (a concept-targeted drill threads it; generic
  // practice omits it). ALLOW-LISTED against lib/curriculum.js — an unknown/forged key
  // is dropped, so a client can only ever tag a real concept, and the mastery QUALITY
  // is the server-computed reasoning score below (never client-supplied), so tagging
  // can't inflate anything — at worst it colors a concept with an honestly-graded attempt.
  const masteryKey = isCurriculumConcept(subject, body && body.conceptKey) ? body.conceptKey : null;

  try {
    // ACCEPTED RESIDUAL: the rating is a read-modify-write (read prev → Glicko → write).
    // Two concurrent same-user, same-subject grades could lose one update; single-user
    // and low-stakes (the practiceRun guard + one-question-at-a-time UI make it rare),
    // so it's accepted rather than serialized. (The item-difficulty bump is commutative,
    // so it's safe under concurrency regardless.)
    // 1) Server-authoritative PREV (incl. the per-axis Glicko state) + the learner's recent
    //    attempts in this subject (the last K, for the anti-farm repeat factor) + the
    //    calibrated item difficulty for this bucket — ALL read server-side; the client
    //    supplies none of the values the new rating is computed from.
    const [scoresRes, recentRes, diffRes] = await Promise.all([
      sb.from("scores").select("subject, score, weak_concepts, comment, rubric, glicko").eq("user_id", uid),
      sb.from("attempts").select("topic, band").eq("user_id", uid).eq("subject", subject).eq("type", "attempt").order("created_at", { ascending: false }).limit(REPEAT_WINDOW_K),
      sb.from("item_difficulty").select("difficulty").eq("subject", subject).eq("topic", topicSlug).eq("band", bandKey).maybeSingle(),
    ]);
    if (scoresRes.error) throw scoresRes.error;
    const rows = scoresRes.data;
    const itemDifficulty =
      diffRes && diffRes.data && Number.isFinite(Number(diffRes.data.difficulty))
        ? Number(diffRes.data.difficulty)
        : seedDifficulty;

    const current = {};
    for (const r of rows || []) {
      current[r.subject] = {
        score: r.score,
        weakConcepts: r.weak_concepts || [],
        comment: r.comment || "",
        rubric: r.rubric || null,
        glicko: r.glicko || null,
      };
    }
    const prev = current[subject] || null;
    const prevScore = prev ? prev.score : 0;

    // 2) DETERMINISTIC pre-grade dock (no LLM call) on the ORIGINAL answer: empty /
    //    "idk" / off-topic / gibberish → forced low outcome + all-zero rubric. Else grade.
    //    Skip the dock when a photo is attached — preGradeDock only inspects TEXT, so an
    //    image-only answer (worked notes in the photo, empty text box) is a substantive
    //    submission that must reach the vision grader, not be docked to a non-attempt.
    const dock = img.image ? null : preGradeDock(capText(reasoning)); // cap before the dock (bounded regex/Set work)
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
            `Learner's current level: ${prevScore}/100\n\n` +
            `Learner's reasoning:\n"""${work}"""`,
          image: img.image,
          maxTokens: 3000, // room for the grader's solve block + strengths/improvements + typed errors + worked solution
        });

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
    const correctnessNote = typeof data?.correctnessNote === "string" ? data.correctnessNote : "";
    const socraticHint = typeof data?.socraticHint === "string" ? data.socraticHint : "";
    const microLesson = typeof data?.microLesson === "string" ? data.microLesson : "";

    // 4) UNIFIED GLICKO-2 update: each of the 9 reasoning axes is rated against the item's
    //    calibrated difficulty (the opponent), with that axis's rubric value (/RUBRIC_MAX)
    //    as the outcome. The subject score is the RUBRIC_WEIGHTS-weighted aggregate of the
    //    9 axis ratings (subjectScoreFromGlicko), and the radar is derived from the same
    //    ratings — ONE difficulty-adjusted source of truth. Anti-farm: repeated attempts on
    //    this (subject, topic, band) bucket damp the rating GAIN (not losses). A dock carries
    //    an all-zero rubric → a real low outcome that legitimately drops the axes/score (the
    //    radar IS the rating now, so we no longer special-case the dock). Existing users
    //    lazy-seed from their prior rubric/score (continuity — no rank jump).
    const repeatFactor = repeatFactorFromRecent(recentRes && recentRes.data, topicSlug, bandKey);
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

    // 5) Snapshot totals over the full (updated) map for the attempt-history row.
    const updatedMap = { ...current, [subject]: { score: newScore } };
    const totalAfter = totalPoints(updatedMap);
    const phdAfter = phdIndex(updatedMap);
    const t = nowIso();

    // 6) Persist ONLY the changed subject (+ its attempt, with the rationale) atomically
    //    for the verified uid. Sending one subject avoids clobbering a concurrent
    //    same-user session's progress on the other two.
    const { error: saveErr } = await sb.rpc("save_progress_for", {
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
    });
    if (saveErr) throw saveErr;

    // 7) Calibrate the item-difficulty bucket (non-blocking; only on a real grade — a
    //    docked non-answer carries no signal about the item's difficulty). The nudge is
    //    the aggregate-outcome surprise vs the learner's prior level — a commutative
    //    additive delta (concurrent bumps still commute), same shape as before.
    if (!dock) {
      const diffDelta = itemDifficultyDelta({ prevSubjectScore: prevScore, itemDifficulty, aggregateOutcome: reasoningScore / 100 });
      bumpItemDifficulty(sb, subject, topicSlug, bandKey, diffDelta, seedDifficulty);
    }
    registerWeakConcepts(subject, weakConcepts); // auto-grow the hub (non-blocking)
    // Mastery counters for a concept-tagged attempt (non-blocking). A DOCKED attempt
    // still counts — a skip/"idk" on a concept marks it red by design (§12.1).
    if (masteryKey) bumpConceptMastery(sb, uid, [{ subject, concept_key: masteryKey, quality: reasoningScore }]);

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
      newScore,
      delta,
      rationale,
      docked: !!dock,
      subjectScore: { score: newScore, weakConcepts: newWeak, comment, rubric: newRubric },
      attempt: { type: "attempt", t, subject, reasoningScore, delta, newScore, totalAfter, phdAfter, rationale },
      // The applied (allow-listed) mastery update, so the client can mirror it in
      // memory without refetching; an empty array when the attempt wasn't concept-tagged.
      masteryUpdates: masteryKey ? [{ subject, conceptKey: masteryKey, quality: reasoningScore }] : [],
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
    if (typeof a.question !== "string" || !a.question.trim()) continue;
    const difficulty = DIAGNOSTIC_DIFFICULTIES.includes(a.difficulty) ? a.difficulty : null;
    if (!difficulty) continue;
    const key = `${subject}:${difficulty}`;
    if (seen.has(key)) continue;
    const img = normalizeImage(a.image);
    if (!img.ok) return NextResponse.json({ error: img.error }, { status: 400 });
    seen.add(key);
    // Reasoning-surface context DERIVED SERVER-SIDE from the curated bank by (subject,
    // difficulty) — NOT trusted from the request body — so a crafted answer can't spoof the
    // grader's calibration. "" when the slot has no surface.
    const bankSurface = diagnosticSurfaceFor(subject, difficulty);
    items.push({
      subject,
      difficulty,
      question: capText(a.question),
      surfaceCtx: reasoningSurfaceContext(bankSurface.reasoningSurface, bankSurface.trap),
      reasoning:
        typeof a.reasoning === "string" && a.reasoning.trim()
          ? capText(a.reasoning.trim())
          : "(no written reasoning provided)",
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
              `Learner's reasoning:\n"""${it.reasoning}"""`,
            image: it.image,
            maxTokens: 1800, // room for the grader's solve block + 9-axis rubric + typed errors
          });
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
        comment: typeof data?.comment === "string" ? data.comment : "",
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
      // Seed the per-axis Glicko state by running each tier's per-axis rubric through the
      // engine at its band difficulty (3 difficulty bands place the profile); the subject
      // score + radar are derived from it — one unified, difficulty-aware baseline.
      const seed = diagnosticSeedGlicko(subjectQs);
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

    // Per-concept mastery updates — the diagnostic colors EXACTLY the concepts it
    // tested (direct-only, §12.1). The concept key is derived SERVER-SIDE from the
    // curated bank by (subject, difficulty) — like the reasoning surface, never from
    // the request body — and the quality is the server-computed grade, so a crafted
    // payload can't color (or farm) arbitrary concepts. A docked skip counts: it
    // marks the concept red ("study the foundations first") by design.
    const masteryUpdates = results
      .map((r) => {
        const conceptKey = diagnosticConceptFor(r.subject, r.difficulty);
        return conceptKey ? { subject: r.subject, conceptKey, quality: r.reasoningScore } : null;
      })
      .filter(Boolean);

    if (uid) {
      // sb was resolved and null-checked up front (so we never grade for a user we
      // can't persist for); reuse it here.
      const t = nowIso();
      // Snapshot total/phd over the user's FULL post-write score map: a subject whose
      // grades all failed keeps its EXISTING score (the upsert only writes submitted
      // subjects), so computing over `scores` alone would understate the totals.
      const { data: existingRows } = await sb.from("scores").select("subject, score").eq("user_id", uid);
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
      // Persist the tested concepts' mastery counters (non-blocking, after the save).
      bumpConceptMastery(sb, uid, masteryUpdates.map((u) => ({ subject: u.subject, concept_key: u.conceptKey, quality: u.quality })));
      return NextResponse.json({
        scores,
        persisted: true,
        masteryUpdates,
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

    // Guest: return the graded baseline (+ the server-derived mastery updates) for
    // the client to store locally.
    return NextResponse.json({ scores, persisted: false, attempt: null, masteryUpdates });
  } catch (e) {
    console.error("[/api/score diagnostic]", e);
    return NextResponse.json({ error: "Grading is temporarily unavailable. Please try again." }, { status: 500 });
  }
}
