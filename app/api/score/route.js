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
// kind:"diagnostic" → auth-OPTIONAL, the ADAPTIVE placement (RANKS_PLAN §8): a STEP
//                     ({token, reasoning, image}) grades ONE answer against the
//                     HMAC-signed walk state and returns the next ±1-band item (or
//                     the subject's completion token); a FINALIZE ({tokens × 3})
//                     verifies the three signed transcripts and aggregates the
//                     path-weighted baseline with zero Groq. A verified user gets
//                     the baseline persisted; a guest gets it back to store in
//                     localStorage (no account to protect).
//
// Same same-origin + JSON guard + per-IP rate limiting + abuse logging as the other
// routes; diagnostic carries a stricter budget because one request fans out to many
// Groq calls. Real errors are logged server-side; the client gets a generic message.
// ---------------------------------------------------------------------------

import { NextResponse, after } from "next/server";
import { groqJSON, fenceGuard, PRACTICE_GRADE_SYS, DIAG_GRADE_SYS } from "@/lib/groq";
import { verifyQuestionToken, verifyDiagToken, signDiagState } from "@/lib/questionToken";
import { redactUnsafe } from "@/lib/contentSafety";
import {
  ORDER,
  normalizeRubric,
  totalPoints,
  phdIndex,
  defaultDifficultyForBand,
  scoreFromRubric,
  explainRankMove,
  updateAxisRatings,
  diagnosticSeedFromReasoning,
  repeatFactorFromRecent,
  itemDifficultyDelta,
  REPEAT_WINDOW_K,
  attemptVerifies,
} from "@/lib/scoring";
import { normalizeTopic } from "@/lib/taxonomy";
import { BAND_LADDER } from "@/lib/curriculum";
import { diagnosticItemById, pickDiagnosticItem, nextDiagBand, DIAG_STEPS_PER_SUBJECT } from "@/lib/diagnosticBank";
import { isCurriculumConcept } from "@/lib/mastery";
import { preGradeDock, injectionDock } from "@/lib/preGrade";
import { checkRateLimit, clientKey, chargeGlobalGroq, refundGlobalGroq, refundRateLimit } from "@/lib/rateLimit";
import { isCrossSiteRequest, isWrongContentType, readJsonLimited, MAX_BODY_BYTES_IMAGE } from "@/lib/requestGuard";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser, isAgeVerified } from "@/lib/adminAuth";
import { isProUserId } from "@/lib/entitlements";
import { proIsAvailable } from "@/lib/polar";
import { reportInjection, reportRateLimit, shouldDockForInjection } from "@/lib/abuseDetection";
import { capText, normalizeImage, normalizeDifficulty, normalizeWeakConcepts, resolveWeakConcepts, normalizeFeedbackList, capSolution, normalizeErrors, normalizeSolve, normalizeReasoningSurface, reasoningSurfaceContext } from "@/lib/gradeInput";
import { weakConceptPromptBlock } from "@/lib/curriculum";
import { withNumericVerification, makeRegrade } from "@/lib/numericVerify";

export const dynamic = "force-dynamic";
// Bound a hung request explicitly (audit P2-10): the Groq fetch carries a 30s abort,
// and every path here grades AT MOST ONE answer per request (practice, or one
// adaptive-diagnostic step — the old 9-grade batch fan-out is gone), with at most a
// primary + one 429 retry + (rarely) one numeric-verifier corrective re-grade.
// 120s leaves headroom over that 3-call worst case.
export const maxDuration = 120;

const RETRY_DELAY_MS = 700;

const nowIso = () => new Date().toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// (The old hub AUTO-GROW — registering the grader's weak concepts as pending
// catalog stubs via register_concepts — was RETIRED by owner decision
// 2026-06-11: the curated curriculum + written guides superseded the organic
// catalog, so the registrations only refilled the admin approval queue with
// empty stubs. The weakness SIGNAL is unchanged: weak concepts still land on
// the learner's scores row, the dashboard, and the feedback. The DB RPC
// remains defined but uncalled.)

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

// Grade one question's reasoning, retrying ONCE on a 429 after a short backoff
// (a transient per-minute 429 shouldn't sink a step). groqJSON re-throws hard
// upstream errors with .status set, so a 429 surfaces here for the retry. We do
// NOT retry IMAGE grades: groqJSON already falls back to a text-only call
// internally on a recoverable vision failure, so re-issuing the whole call would
// fire a SECOND (expensive, multi-MB) vision request — a cost-amplifier.
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

  // Adults-only gate (server-authoritative): graded practice requires a verified 18+
  // account. The flag lives in app_metadata (set only by /api/account/age after a
  // server-side age check), so this can't be self-granted from the client.
  if (!isAgeVerified(auth.user)) {
    return NextResponse.json(
      { error: "Please confirm you are 18 or older to continue.", ageRequired: true },
      { status: 403 }
    );
  }

  // Pro entitlement (Polar.sh): unlocks UNLIMITED graded practice + photo-of-work
  // grading. Resolved once here; deny-by-default — with no entitlement store configured
  // isProUserId is false, so the free caps apply to everyone (nothing over-charges).
  const pro = await isProUserId(uid);

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

  // FREE DAILY PRACTICE CAP — the real lever behind "Pro = unlimited graded practice"
  // (the landing-page promise). A non-Pro account gets FREE_DAILY_PRACTICE_CAP graded
  // practice problems per rolling 24h (durable, per-account); Pro bypasses entirely.
  // 402 (Payment Required) + `upgrade:true` so the client shows an upgrade nudge rather
  // than a generic error. (The one-time diagnostic is NOT capped — only repeated practice.)
  // Only enforced when Pro is actually SELLABLE (proIsAvailable) — a Polar-less deployment
  // never caps free users with no way to upgrade.
  // Tracks whether THIS request consumed a free daily-practice slot, so it can be REFUNDED
  // (audit 02 P1-4) if the request turns out not to be a real graded attempt — a duplicate
  // (replay) or a deterministic dock (empty/"idk"/gibberish). Without the refund those burned
  // the free user's daily quota unfairly.
  const dayCapBucket = `acct:${uid}:practice:day`;
  let chargedDailyCap = false;
  if (!pro && proIsAvailable()) {
    // Honor an explicit 0 (audit 03 P2-11): cap=0 is a deliberate "free practice off"
    // emergency switch, not a value to ignore. Only unset/empty/non-numeric/negative → 5.
    const capRaw = Number(process.env.FREE_DAILY_PRACTICE_CAP);
    const cap = Number.isFinite(capRaw) && capRaw >= 0 ? capRaw : 5;
    const dayRl = cap > 0
      ? await checkRateLimit(dayCapBucket, { max: cap, windowMs: 24 * 60 * 60 * 1000 })
      : { ok: false, retryAfter: 0 }; // cap 0 → no free graded practice at all
    if (!dayRl.ok) {
      return NextResponse.json(
        {
          error: "You've used today's free practice problems. Upgrade to Pro for unlimited graded practice.",
          upgrade: true,
        },
        { status: 402, headers: { "Retry-After": String(dayRl.retryAfter) } }
      );
    }
    chargedDailyCap = true;
  }
  // Give back the daily slot for a request that didn't count as a real graded problem.
  const refundDailyCap = async () => {
    if (chargedDailyCap) {
      chargedDailyCap = false;
      await refundRateLimit(dayCapBucket, 1);
    }
  };

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Scoring is temporarily unavailable." }, { status: 503 });

  const { token, reasoning, image } = body || {};
  // SERVER-ISSUED QUESTION BINDING (audit P1-1). The token is signed by
  // /api/generate at serve time; EVERY rating-relevant
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
  // ACCOUNT BINDING (audit F2): a token signed for one account can't be scored by another
  // (no pooling/sharing one generation across colluding accounts). The bind is enforced
  // only when the token carries a signed uid — tokens issued before this field existed, or
  // by an unauthenticated generate, have none and fall through (backward-compatible).
  if (issued.uid && issued.uid !== uid) {
    return NextResponse.json(
      { error: "This question was issued to a different account — please generate a new question." },
      { status: 400 }
    );
  }
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

  // Capture the scan: a HIGH-confidence injection (audit P2-3) also DOCKS the attempt
  // (below) so a successful injection can't inflate the persisted rating to all-4s.
  const injectionScan = reportInjection({
    req,
    route: "/api/score",
    subject,
    concept: safeConcept !== "(unspecified)" ? safeConcept : null,
    text: `${safeQuestion}\n${work}\n${safeConcept}\n${surfaceCtx}`,
  });

  const img = normalizeImage(image);
  if (!img.ok) return NextResponse.json({ error: img.error }, { status: 400 });
  // PHOTO-OF-WORK GRADING is a Pro feature — gate it server-side (the UI only hides the
  // affordance). 402 + `upgrade:true` so the client nudges instead of erroring. Checked
  // before the image rate-limit slot so a non-Pro photo attempt costs nothing. Only gated
  // when Pro is sellable (otherwise photo grading stays open to everyone, as today).
  if (img.image && !pro && proIsAvailable()) {
    return NextResponse.json(
      { error: "Photo-of-work grading is a Pro feature. Upgrade to Pro to grade a photo of your work.", upgrade: true },
      { status: 402 }
    );
  }
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
  // Optional curriculum concept tag for MASTERY coloring (RANKS_PLAN §12.1). It rides
  // in the SIGNED TOKEN (issued.conceptKey) — a concept-targeted drill (increment 3)
  // signs it at generation; generic practice has none. Allow-listed against
  // lib/curriculum.js, and the mastery QUALITY is the server-computed reasoning score
  // below (never client-supplied), so tagging can only ever color a concept with an
  // honestly-graded attempt — it can't inflate a rating.
  const masteryKey = isCurriculumConcept(subject, issued.conceptKey) ? issued.conceptKey : null;

  // GLOBAL Groq budget refund bookkeeping (audit P2-2 fix): chargeGlobalGroq charges
  // the platform-wide window BEFORE the grade; if the charged Groq call never succeeds
  // (an upstream failure), refund it in the catch so an outage doesn't keep over-
  // throttling everyone for the rest of the window. chargedImg mirrors the image charge.
  let chargedGroq = 0;
  let chargedImg = 0;
  let gradeSucceeded = false;

  try {
    // Cheap PRE-GRADE replay check (review P3): the authoritative jti dedupe lives in
    // save_progress_for (under the advisory lock), but catching the common replay here
    // skips the paid Groq grade and the global-budget charge entirely.
    if (issued.jti) {
      const { data: dupRows } = await sb.from("attempts").select("id").eq("user_id", uid).eq("jti", issued.jti).limit(1);
      if (Array.isArray(dupRows) && dupRows.length) {
        await refundDailyCap(); // a replay isn't a new graded problem — don't burn the daily quota
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
    // bands at or below the learner's level are untouched. (BAND_LADDER is the
    // canonical ascending band order from lib/curriculum.js.)
    const storedBandIdx = Math.min(BAND_LADDER.length - 1, Math.floor(Math.max(0, Number(promptPrevScore) || 0) / 70));
    const tokenBandIdx = Math.max(0, BAND_LADDER.indexOf(tokenBand));
    const bandKey = BAND_LADDER[Math.min(tokenBandIdx, storedBandIdx + 1)];
    const seedDifficulty = defaultDifficultyForBand(bandKey);

    // The calibrated item difficulty for the (clamped) bucket.
    // MIN-ATTEMPTS FLOOR (audit 05 P2-7): a (subject,topic,band) bucket is ONE shared global
    // value, so an early handful of attempts from a single user could drag the difficulty that
    // everyone in that bucket is then rated against. Trust the calibrated value only once the
    // bucket has accumulated enough attempts; until then use the band's seed anchor. The
    // calibration itself keeps accumulating (bump_item_difficulty) — this only gates when it's
    // TRUSTED for rating, so a thin bucket can't be self-skewed before the population corrects it.
    const MIN_BUCKET_ATTEMPTS = 20;
    const diffRes = await sb.from("item_difficulty").select("difficulty, attempts").eq("subject", subject).eq("topic", topicSlug).eq("band", bandKey).maybeSingle();
    const itemDifficulty =
      diffRes && diffRes.data && Number.isFinite(Number(diffRes.data.difficulty)) && Number(diffRes.data.attempts) >= MIN_BUCKET_ATTEMPTS
        ? Number(diffRes.data.difficulty)
        : seedDifficulty;

    // 2) DETERMINISTIC pre-grade dock (no LLM call) on the ORIGINAL answer: empty /
    //    "idk" / off-topic / gibberish → forced low outcome + all-zero rubric. Else grade.
    //    Skip the dock when a photo is attached — preGradeDock only inspects TEXT, so an
    //    image-only answer (worked notes in the photo, empty text box) is a substantive
    //    submission that must reach the vision grader, not be docked to a non-attempt.
    // INJECTION AUTO-DOCK (audit P2-3): a HIGH-confidence injection docks REGARDLESS of
    // an attached image — the injection rides in TEXT, so a photo can't shield it.
    const dock = shouldDockForInjection(injectionScan)
      ? injectionDock()
      : img.image
        ? null
        : preGradeDock(capText(reasoning)); // cap before the dock (bounded regex/Set work)
    // A docked non-attempt (empty/"idk"/gibberish/injection) still persists + drives the
    // rating down, but it isn't a real graded PROBLEM, so refund the free daily-practice slot
    // it consumed (audit 02 P1-4). Self-punishing (rating drops), so this can't be farmed.
    if (dock) await refundDailyCap();
    if (!dock) {
      // GLOBAL Groq budget (audit P2-3): the per-IP/per-account caps are the fairness
      // layer; this platform-wide window bounds total spend under IP rotation. Practice
      // is auth-REQUIRED, so it charges the isolated AUTH pool (Finding 3) — a guest flood
      // on the unauthenticated routes can never throttle a signed-in learner's grade.
      const glob = await chargeGlobalGroq(1, { img: img.image ? 1 : 0, pool: "auth" });
      if (!glob.ok) {
        reportRateLimit({ req, route: "/api/score" });
        return NextResponse.json(
          { error: "Too many requests. Please slow down and try again shortly." },
          { status: 429, headers: { "Retry-After": String(glob.retryAfter) } }
        );
      }
      chargedGroq = 1;
      chargedImg = img.image ? 1 : 0;
    }
    const gradeArgs = {
      system: PRACTICE_GRADE_SYS,
      user:
        `Subject: ${subject}\n` +
        `Question:\n"""${safeQuestion}"""\n` +
        `Concept being probed:\n"""${safeConcept}"""\n` +
        `Question difficulty band: ${safeDifficulty}\n` +
        (surfaceCtx ? surfaceCtx + "\n" : "") +
        `Learner's current level: ${promptPrevScore}/350\n\n` +
        weakConceptPromptBlock(subject) +
        // fenceGuard (audit P2-12): learner text can't fake closing the untrusted block.
        `Learner's reasoning:\n"""${fenceGuard(work)}"""`,
      image: img.image,
      imageRequired: imageOnly, // audit P1-3: never text-grade the placeholder for an image-only answer
      maxTokens: 3000, // room for the grader's solve block + strengths/improvements + typed errors + worked solution
    };
    const data = dock ? dock : await gradeOne(gradeArgs);

    // Grader-output gate (audit P2-1): a parseable response WITHOUT a usable rubric is
    // an upstream failure — fail retryably instead of zero-filling a real attempt and
    // persisting a bogus rating drop.
    if (!dock && (!data || typeof data !== "object" || !data.rubric || typeof data.rubric !== "object")) {
      throw new Error("grader returned no usable rubric");
    }
    // The charged Groq grade produced a usable result — no refund owed even if a later
    // (persist/verify) step fails. Any numeric-verifier re-grade charges its own token.
    gradeSucceeded = true;

    // NUMERIC VERIFICATION (lib/numericVerify.js): sandbox-recompute the grader's
    // own `solve.check` arithmetic. A PROVEN-wrong grade re-grades ONCE via the
    // shared budget-charged makeRegrade (vision never re-fired; a denied budget or
    // failed retry falls back to field-level correction — a learner's successful
    // grade is never 429'd after the fact).
    let graded = data;
    let verification = { status: "skipped", value: null, changed: false };
    if (!dock) {
      const v = await withNumericVerification(data, {
        regrade: makeRegrade({
          image: img.image,
          system: PRACTICE_GRADE_SYS,
          charge: (nn) => chargeGlobalGroq(nn, { pool: "auth" }), // Finding 3: re-grade hits the AUTH pool too
          call: (system) => gradeOne({ ...gradeArgs, system }),
        }),
      });
      graded = v.data;
      verification = v.verification;
    }

    const attemptRubric = normalizeRubric(graded?.rubric);
    // 3) The headline is the TRANSPARENT weighted mean of the rubric axes (process-first,
    //    path-independent — final-answer correctness never enters here). A dock carries its
    //    own forced low score (DOCK_SCORE), so use it directly rather than the all-zero mean.
    const reasoningScore = dock ? graded.reasoningScore : scoreFromRubric(attemptRubric);
    const weakConcepts = resolveWeakConcepts(subject, graded?.weakConcepts);
    // Post-grade feedback: what was good, how to reach 100, the grader's own worked
    // solution (compute-first) used to type the learner's errors, the typed error list,
    // and — only on a SUBSTANTIVE (non-docked) attempt — the full worked solution. A dock
    // returns workedSolution="" and no errors/solve, so a non-attempt can't extract the answer.
    const strengths = normalizeFeedbackList(graded?.strengths);
    const improvements = normalizeFeedbackList(graded?.improvements);
    const workedSolution = dock ? "" : capSolution(graded?.workedSolution);
    const solve = dock ? null : normalizeSolve(graded?.solve);
    const errors = dock ? [] : normalizeErrors(graded?.errors);
    const finalAnswerMatches = dock ? false : graded?.finalAnswerMatches === true;
    const correctnessNote = typeof graded?.correctnessNote === "string" ? graded.correctnessNote.slice(0, 2000) : "";
    const socraticHint = typeof graded?.socraticHint === "string" ? graded.socraticHint.slice(0, 2000) : "";
    const microLesson = typeof graded?.microLesson === "string" ? graded.microLesson.slice(0, 2000) : "";

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
          // Verification gate (audit 05 P1-2): only an AT-OR-NEAR-level attempt advances the
          // leaderboard "verified" counter, so 5 trivial far-below aces can't verify a high
          // placement. A docked non-attempt never verifies either.
          verify: !dock && attemptVerifies(bandKey, newScore),
        },
        // Answer-review detail (persisted atomically with the attempt) so the learner can
        // review this answer later. `answer` is the learner's own reasoning (`work`).
        p_review: {
          question: safeQuestion,
          answer: work,
          target_concept: safeConcept,
          difficulty: safeDifficulty,
          rubric: attemptRubric,
          feedback: { strengths, improvements, workedSolution, correctnessNote, socraticHint, microLesson, solve, errors, finalAnswerMatches, verification },
        },
        p_expected_updated_at: prev ? prev.updatedAt : null,
        p_check_conflict: true,
      });
      if (saveErr) throw saveErr;
      const status = saveRes && saveRes.status;
      if (status === "duplicate") {
        // The same served question was already scored (network retry / replay): no
        // second rating step, no duplicate attempt row.
        await refundDailyCap(); // not a new graded problem — give the daily slot back (P1-4)
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
    // Mastery counters for a concept-tagged attempt (non-blocking). A DOCKED attempt
    // still counts — a skip/"idk" on a concept marks it red by design (§12.1).
    if (masteryKey) bumpConceptMastery(sb, uid, [{ subject, concept_key: masteryKey, quality: reasoningScore }]);

    // PRO GATE (P0-3): the full worked solution + "how to reach 100" (improvements) are a
    // Pro feature. Withhold them from the RESPONSE for a non-Pro caller — but only when Pro
    // is actually sellable (proIsAvailable), so a Polar-less deployment keeps them open.
    // They are still PERSISTED in full above (attempt_reviews, itself Pro-gated), so they
    // appear retroactively the moment the learner upgrades. `solve` is the grader's own
    // (unshown) worked solution; gated for parity. The free caller keeps the rubric,
    // strengths, typed errors, hints, and verification.
    const lockSolutions = proIsAvailable() && !pro;
    return NextResponse.json({
      reasoningScore,
      rubric: attemptRubric, // per-attempt 0–4 bars for the feedback panel
      solve: lockSolutions ? null : solve, // the grader's own worked solution (compute-first; null on a dock)
      errors, // typed error taxonomy (Socratic prompts on reasoning errors)
      finalAnswerMatches, // diagnostic only — did the learner's final answer match the grader's
      verification, // the numeric verifier's verdict on the grader's own arithmetic
      // Screen the model-authored, user-visible free text (audit: output was unscreened) —
      // redactUnsafe only replaces a field that trips the safety blocklist; no-op on STEM.
      strengths: (strengths || []).map((s) => redactUnsafe(s)), // what the answer did well
      improvements: lockSolutions ? [] : (improvements || []).map((s) => redactUnsafe(s)), // (Pro) actionable steps to reach 100
      workedSolution: lockSolutions ? "" : redactUnsafe(workedSolution), // (Pro) full solution, revealed post-grade (empty on a dock)
      workedSolutionLocked: lockSolutions && !dock, // tell the client to show the upgrade nudge
      correctnessNote: redactUnsafe(correctnessNote),
      socraticHint: redactUnsafe(socraticHint),
      microLesson: redactUnsafe(microLesson),
      weakConcepts,
      newScore: saved.newScore,
      delta: saved.delta,
      rationale: saved.rationale,
      docked: !!dock,
      subjectScore: { score: saved.newScore, weakConcepts: saved.newWeak, comment: saved.comment, rubric: saved.newRubric },
      attempt: { type: "attempt", t: saved.t, subject, reasoningScore, delta: saved.delta, newScore: saved.newScore, totalAfter: saved.totalAfter, phdAfter: saved.phdAfter, rationale: saved.rationale },
      // The applied (allow-listed) mastery update, so the client can mirror it in
      // memory without refetching; an empty array when the attempt wasn't concept-tagged.
      masteryUpdates: masteryKey ? [{ subject, conceptKey: masteryKey, quality: reasoningScore }] : [],
    });
  } catch (e) {
    // Refund the pre-charged global Groq budget when the charged grade did NOT
    // succeed (audit P2-2 fix): an upstream outage shouldn't keep the slot consumed
    // for the rest of the window and over-throttle everyone. A grade that succeeded
    // (then a persist/verify failure) keeps its charge — the Groq spend really happened.
    if (!gradeSucceeded && chargedGroq > 0) {
      await refundGlobalGroq(chargedGroq, { img: chargedImg, pool: "auth" }); // Finding 3: refund the AUTH pool
    }
    console.error("[/api/score practice]", e);
    return NextResponse.json({ error: "Grading is temporarily unavailable. Please try again." }, { status: 500 });
  }
}

// --- diagnostic: the ADAPTIVE placement (RANKS_PLAN §8) ----------------------
// kind:"diagnostic" carries either ONE signed step token + the learner's answer
// (grade it server-side, fold the grade into the signed chain, return the next
// curated item on the ±1-band walk) or the three completed-subject tokens
// (aggregate + persist the baseline — zero Groq). The signed chain is what makes
// the walk server-authoritative with no DB: every band faced, item asked, and
// grade earned rides in HMAC-signed state the client can only echo back — it can
// neither forge a grade, skip a step, nor pick its own band. A stale
// (pre-adaptive) client posting the old batch `answers` shape gets a retryable
// restart error.
async function handleDiagnostic(req, body) {
  if (Array.isArray(body && body.tokens)) return handleDiagnosticFinalize(req, body);
  if (typeof (body && body.token) === "string") return handleDiagnosticStep(req, body);
  return NextResponse.json(
    { error: "The placement flow was updated — please restart the diagnostic." },
    { status: 400 }
  );
}

// Optional auth shared by both diagnostic sub-paths: a PRESENTED token must be
// valid (never silently downgrade a bad token to guest); absent → guest.
async function optionalDiagAuth(req) {
  if (!req.headers.get("authorization")) return { uid: null };
  const auth = await requireUser(req);
  if (auth.error) return { error: auth.error, status: auth.status };
  return { uid: auth.user.id };
}

const tooManyDiag = (req, retryAfter) => {
  reportRateLimit({ req, route: "/api/score" });
  return NextResponse.json(
    { error: "Too many placement steps. Please slow down and try again shortly." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
};

// One adaptive step: verify the chain, grade THIS answer (dock or one Groq
// call), and return either the next signed item or the subject's completion
// token. Failures leave the presented token valid — the step can be resubmitted.
async function handleDiagnosticStep(req, body) {
  // Per-IP step budget: a full sitting is 9 graded steps; 40/min leaves retry
  // headroom while bounding a burst. (The old per-request :diag cap of 4 guarded
  // 9-grade fan-outs; a step grades exactly ONE answer.)
  const diagRl = await checkRateLimit(`${clientKey(req)}:diag`, { max: 40 });
  if (!diagRl.ok) return tooManyDiag(req, diagRl.retryAfter);

  const who = await optionalDiagAuth(req);
  if (who.error) return NextResponse.json({ error: who.error }, { status: who.status });
  if (who.uid) {
    // Durable PER-ACCOUNT step cap (across IPs/instances) on top of the IP gate.
    const acctRl = await checkRateLimit(`acct:${who.uid}:diag`, { max: 60 });
    if (!acctRl.ok) return tooManyDiag(req, acctRl.retryAfter);
  }

  const v = verifyDiagToken(body.token);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 401 });
  const st = v.state;
  // The walk state must be coherent: a mid-run token (never a completed one),
  // a real in-range step, an item that exists in the bank under this subject,
  // and exactly step−1 prior grades in the chain.
  const step = Number(st.step);
  const item =
    !st.done && ORDER.includes(st.subject) && Number.isInteger(step) && step >= 1 && step <= DIAG_STEPS_PER_SUBJECT
      ? diagnosticItemById(st.itemId)
      : null;
  if (!item || item.subject !== st.subject || !Array.isArray(st.transcript) || st.transcript.length !== step - 1) {
    return NextResponse.json(
      { error: "This placement step could not be verified — please restart the diagnostic." },
      { status: 400 }
    );
  }

  const img = normalizeImage(body.image);
  if (!img.ok) return NextResponse.json({ error: img.error }, { status: 400 });
  const hasText = typeof body.reasoning === "string" && !!body.reasoning.trim();
  const reasoning = hasText ? capText(body.reasoning.trim()) : "(no written reasoning provided)";
  // Image-only answer: the photo IS the answer — a vision failure must fail the
  // step (retryable) rather than text-grade the placeholder (audit P1-3).
  const imageOnly = !!img.image && !hasText;
  // Flag (+ capture) prompt-injection in the step's reasoning. A HIGH-confidence
  // injection (audit P2-3) DOCKS the step — a successful injection here could otherwise
  // inflate the placement quality and mis-route the band walk upward.
  const injectionScan = reportInjection({ req, route: "/api/score", subject: item.subject, text: hasText ? reasoning : "" });
  // Deterministic dock on the RAW answer — a blank / "idk" / off-topic step is
  // graded low with NO Groq call (the §8 walk then descends a band, by design). A
  // HIGH-confidence injection docks regardless of an attached image (it rides in text).
  const dock = shouldDockForInjection(injectionScan)
    ? injectionDock()
    : img.image
      ? null
      : preGradeDock(capText(body.reasoning));

  if (img.image) {
    // The costliest Groq path (multimodal) stays under the same :img budget as
    // practice — one token per image-bearing step.
    const imgRl = await checkRateLimit(`${clientKey(req)}:img`, { max: 10 });
    if (!imgRl.ok) return tooManyDiag(req, imgRl.retryAfter);
  }
  // GLOBAL Groq budget refund bookkeeping (audit P2-2 fix): refund the pre-charged
  // token if the charged grade never succeeds (an upstream outage).
  let chargedGroq = 0;
  let chargedImg = 0;
  let gradeSucceeded = false;
  // Split pool (Finding 3): a SIGNED-IN diagnostic charges the isolated AUTH window; a guest
  // step uses the shared guest window — so a guest flood can't 429 a signed-in placement.
  const groqPool = who.uid ? "auth" : "guest";
  if (!dock) {
    // GLOBAL Groq budget (audit P2-3): one token per LIVE grade; docks are free.
    const glob = await chargeGlobalGroq(1, { img: img.image ? 1 : 0, pool: groqPool });
    if (!glob.ok) return tooManyDiag(req, glob.retryAfter);
    chargedGroq = 1;
    chargedImg = img.image ? 1 : 0;
  }

  try {
    // Reasoning-surface context resolved SERVER-SIDE from the bank by the signed
    // item id — like every other grading fact here, never from the request body.
    const surfaceCtx = reasoningSurfaceContext(item.reasoningSurface || null, item.trap || "");
    const gradeArgs = {
      system: DIAG_GRADE_SYS,
      user:
        `Subject: ${item.subject}\n` +
        `Question difficulty band: ${item.band}\n` +
        (surfaceCtx ? surfaceCtx + "\n" : "") +
        weakConceptPromptBlock(item.subject) +
        `Question:\n"""${capText(item.question)}"""\n\n` +
        // fenceGuard (audit P2-12): learner text can't fake closing the block.
        `Learner's reasoning:\n"""${fenceGuard(reasoning)}"""`,
      image: img.image,
      imageRequired: imageOnly,
      maxTokens: 1800, // grader's solve block + 9-axis rubric + typed errors
    };
    const data = dock ? dock : await gradeOne(gradeArgs);
    // Grader-output gate (audit P2-1): no usable rubric → retryable failure, never
    // a zero entry in the signed chain.
    if (!dock && (!data || typeof data !== "object" || !data.rubric || typeof data.rubric !== "object")) {
      throw new Error("grader returned no usable rubric");
    }
    gradeSucceeded = true; // the charged grade produced a usable result — no refund owed

    // NUMERIC VERIFICATION (lib/numericVerify.js): same sandbox check as practice —
    // the diagnostic's computation axis feeds the placement score and band routing,
    // so a grader arithmetic error here mis-routes the walk. Same budget/vision
    // guards via the shared makeRegrade.
    let checked = data;
    if (!dock) {
      const v = await withNumericVerification(data, {
        regrade: makeRegrade({
          image: img.image,
          system: DIAG_GRADE_SYS,
          charge: (nn) => chargeGlobalGroq(nn, { pool: groqPool }), // Finding 3: re-grade hits the same pool
          call: (system) => gradeOne({ ...gradeArgs, system }),
        }),
      });
      checked = v.data;
    }
    const rubric = normalizeRubric(checked?.rubric);
    const reasoningScore = dock ? checked.reasoningScore : scoreFromRubric(rubric);

    // Fold the SERVER-graded entry into the signed chain. Compact keys + capped
    // strings bound the token: 3 entries stay far under the 16 KB verify cap.
    const entry = {
      i: item.id,
      d: item.band,
      s: reasoningScore,
      r: rubric,
      w: resolveWeakConcepts(item.subject, checked?.weakConcepts),
      // Safety-screen the model-authored "what your reasoning showed" comment AT THE SOURCE,
      // before it's folded into the signed transcript → persisted → shown (and carried forward
      // to later practice). The feedback fields are already redacted; the subject comment was
      // the remaining unscreened model output (content-safety: expanded lexicon).
      c: redactUnsafe(typeof checked?.comment === "string" ? checked.comment.slice(0, 280) : ""),
    };
    const transcript = [...st.transcript, entry];
    const graded = { subject: item.subject, difficulty: item.band, reasoningScore };

    if (step >= DIAG_STEPS_PER_SUBJECT) {
      // Subject complete: a done-token carrying the full graded walk — finalize
      // verifies one per subject and aggregates.
      const finalToken = signDiagState({ subject: item.subject, done: true, transcript });
      return NextResponse.json({ graded, subjectComplete: true, finalToken });
    }
    const nextBand = nextDiagBand(item.band, reasoningScore);
    const asked = Array.isArray(st.asked) ? st.asked : [];
    const nextItem = pickDiagnosticItem(item.subject, nextBand, asked);
    const token = signDiagState({
      subject: item.subject,
      step: step + 1,
      itemId: nextItem.id,
      asked: [...asked, nextItem.id],
      transcript,
    });
    return NextResponse.json({
      graded,
      next: {
        subject: item.subject,
        difficulty: nextItem.band,
        topic: nextItem.topic,
        question: nextItem.question,
        stepNo: step + 1,
        stepsTotal: DIAG_STEPS_PER_SUBJECT,
        token,
      },
    });
  } catch (e) {
    // Refund the pre-charged global budget when the charged grade never succeeded
    // (audit P2-2 fix) — an outage shouldn't keep throttling the whole platform.
    if (!gradeSucceeded && chargedGroq > 0) {
      await refundGlobalGroq(chargedGroq, { img: chargedImg, pool: groqPool }); // Finding 3: refund the same pool
    }
    console.error("[/api/score diagnostic step]", e);
    return NextResponse.json({ error: "Grading is temporarily unavailable. Please try again." }, { status: 500 });
  }
}

// Aggregate the three completed-subject chains into the baseline and persist it
// for a signed-in caller (guest gets it back to store locally). ZERO Groq —
// every grade already rides, server-signed, in the transcripts.
async function handleDiagnosticFinalize(req, body) {
  const diagRl = await checkRateLimit(`${clientKey(req)}:diag`, { max: 40 });
  if (!diagRl.ok) return tooManyDiag(req, diagRl.retryAfter);

  const who = await optionalDiagAuth(req);
  if (who.error) return NextResponse.json({ error: who.error }, { status: who.status });
  const uid = who.uid;
  let sb = null;
  if (uid) {
    // Durable PER-ACCOUNT cap (audit): the step path caps acct:<uid>:diag but finalize
    // did not, so a re-baseline could be replayed across IPs. Share the steps' bucket.
    const acctRl = await checkRateLimit(`acct:${uid}:diag`, { max: 60 });
    if (!acctRl.ok) return tooManyDiag(req, acctRl.retryAfter);
    // Resolve persistence UP FRONT: if saving is impossible, fail before touching
    // anything (same rule the batch path had).
    sb = getSupabaseAdmin();
    if (!sb) return NextResponse.json({ error: "Scoring is temporarily unavailable." }, { status: 503 });
  }

  const restart = () =>
    NextResponse.json(
      { error: "This placement could not be verified — please restart the diagnostic." },
      { status: 400 }
    );
  if (body.tokens.length !== ORDER.length) return restart();
  const bySubject = {};
  for (const t of body.tokens) {
    const v = verifyDiagToken(t);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 401 });
    const st = v.state;
    // Exactly one COMPLETED chain per subject, each with the full 3-step walk.
    if (!st.done || !ORDER.includes(st.subject) || bySubject[st.subject]) return restart();
    if (!Array.isArray(st.transcript) || st.transcript.length !== DIAG_STEPS_PER_SUBJECT) return restart();
    bySubject[st.subject] = st.transcript;
  }

  // Rehydrate the graded rows from the signed transcripts; every entry's item
  // must still resolve in the bank under the right subject and band (a deploy
  // that edits the bank mid-sitting fails closed into a free restart).
  const results = [];
  for (const s of ORDER) {
    for (const e of bySubject[s]) {
      const item = e && diagnosticItemById(e.i);
      if (!item || item.subject !== s || item.band !== e.d) return restart();
      const score = Math.max(0, Math.min(100, Math.round(Number(e.s) || 0)));
      results.push({
        subject: s,
        difficulty: item.band,
        reasoningScore: score,
        rubric: e.r,
        weakConcepts: normalizeWeakConcepts(e.w),
        comment: typeof e.c === "string" ? e.c.slice(0, 280) : "",
        conceptKey: item.conceptKey,
      });
    }
  }

  try {
    // Per-subject baseline: PATH-weighted aggregate over the walk the learner
    // actually faced (diagnosticPathScore — the signed chain already forced every
    // step, so the batch path's full-weight anti-gaming floor is unnecessary and
    // would punish a legitimately-descending walk).
    const scores = {};
    for (const s of ORDER) {
      const subjectQs = results.filter((r) => r.subject === s);
      const seed = diagnosticSeedFromReasoning(subjectQs, { pathWeighted: true });
      const weakConcepts = Array.from(
        new Set(subjectQs.flatMap((r) => r.weakConcepts).filter((c) => typeof c === "string" && c.trim()))
      ).slice(0, 8);
      const hardest = [...subjectQs].sort(
        (a, b) => BAND_LADDER.indexOf(b.difficulty) - BAND_LADDER.indexOf(a.difficulty)
      )[0];
      scores[s] = { score: seed.score, weakConcepts, comment: (hardest && hardest.comment) || "", rubric: seed.rubric, glicko: seed.glicko };
    }

    // Per-concept mastery — the walk colors EXACTLY the concepts it tested
    // (direct-only, §12.1): concept keys come from the bank items the signed
    // chain names; qualities are the server-computed step grades. A docked skip
    // counts (it marks the concept red by design).
    const masteryUpdates = results
      .filter((r) => isCurriculumConcept(r.subject, r.conceptKey))
      .map((r) => ({ subject: r.subject, conceptKey: r.conceptKey, quality: r.reasoningScore }));

    if (uid) {
      const t = nowIso();
      // Snapshot total/phd over the FULL post-write score map (the adaptive flow
      // always writes all three subjects, but keep the merge for safety/parity).
      const { data: existingRows, error: existingErr } = await sb.from("scores").select("subject, score").eq("user_id", uid);
      if (existingErr) throw existingErr;
      const merged = {};
      for (const r of existingRows || []) merged[r.subject] = { score: r.score };
      for (const s of ORDER) merged[s] = { score: scores[s].score };
      const totalAfter = totalPoints(merged);
      const phdAfter = phdIndex(merged);
      const p_scores = ORDER.map((s) => ({
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

    // Guest: return the graded baseline (+ the server-derived mastery updates)
    // for the client to store locally.
    return NextResponse.json({ scores, persisted: false, attempt: null, masteryUpdates });
  } catch (e) {
    console.error("[/api/score diagnostic]", e);
    return NextResponse.json({ error: "Grading is temporarily unavailable. Please try again." }, { status: 500 });
  }
}
