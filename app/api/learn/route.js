import { NextResponse } from "next/server";
import { groqJSON, LEARN_SYS } from "@/lib/groq";
import { ORDER } from "@/lib/scoring";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";
import { isCrossSiteRequest, isWrongContentType } from "@/lib/requestGuard";
import { getSupabaseAdmin, conceptKey } from "@/lib/supabaseAdmin";
import { normalizeTopic, topicSlugsFor } from "@/lib/taxonomy";
import { isConceptSafe } from "@/lib/contentSafety";
import { reportInjection, reportRateLimit } from "@/lib/abuseDetection";

export const dynamic = "force-dynamic";

const cap = (s, n) => (typeof s === "string" ? s.slice(0, n) : "");
const capArr = (a, n, len) =>
  Array.isArray(a)
    ? a.filter((x) => typeof x === "string" && x.trim()).slice(0, n).map((x) => x.slice(0, len))
    : [];

// Difficulty bands the practice UI / score model understand (matches PRACTICE_GEN_SYS
// in lib/groq.js and DIFFICULTY_ANCHORS in lib/scoring.js).
const DIFFICULTY_BANDS = new Set(["beginner", "foundational", "intermediate", "advanced", "phd"]);

// Normalize the cached "try this" practice question into the exact shape the
// practice UI consumes ({question, targetConcept, difficulty}), so the Learn tab
// can drop it straight into a practice attempt with NO /api/generate call. Returns
// null when the guide has no usable question (older cached rows degrade gracefully).
function normalizeTryThisQuestion(raw, concept) {
  const question = cap(raw?.question, 1000).trim();
  if (!question) return null;
  const d = typeof raw?.difficulty === "string" ? raw.difficulty.trim().toLowerCase() : "";
  return {
    question,
    targetConcept: cap(concept, 200),
    difficulty: DIFFICULTY_BANDS.has(d) ? d : "intermediate",
  };
}

// Build the safe, normalized guide shape. Used for BOTH the Groq result and a
// cache hit, so the client always receives well-typed fields (string overview /
// tryThis, array keyIdeas/socraticQuestions/pitfalls, and a practice-ready
// tryThisQuestion) regardless of what is stored — defends against any future
// writer or schema drift.
function normalizeGuide(subject, concept, raw) {
  return {
    subject,
    concept,
    topic: normalizeTopic(subject, raw?.topic), // curated taxonomy slug (validated)
    overview: cap(raw?.overview, 1500),
    keyIdeas: capArr(raw?.keyIdeas, 6, 500),
    // The proof / derivation / mechanism — the depth the Learn tab was missing. A
    // proof can run long, so a generous cap (still bounded so a runaway model output
    // can't bloat the cached row).
    whyItWorks: cap(raw?.whyItWorks, 2500),
    socraticQuestions: capArr(raw?.socraticQuestions, 5, 500),
    pitfalls: capArr(raw?.pitfalls, 5, 500),
    tryThis: cap(raw?.tryThis, 800),
    tryThisQuestion: normalizeTryThisQuestion(raw?.tryThisQuestion, concept),
  };
}

// Teach a concept the learner is weak on — Socratically, without giving answers.
export async function POST(req) {
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  if (isWrongContentType(req)) {
    return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
  }

  // Generation is the most expensive route (a fresh concept = a full Groq guide
  // call). Apply a tighter per-IP budget than the default.
  // Own bucket (":learn") so this expensive route's tighter 15/min is an INDEPENDENT
  // budget, not shared with the 30/min generate/grade/score buckets (mirrors :diag/:img).
  const rl = await checkRateLimit(`${clientKey(req)}:learn`, { max: 15 });
  if (!rl.ok) {
    reportRateLimit({ req, route: "/api/learn" });
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

  const { subject, concept } = body || {};
  if (!ORDER.includes(subject)) {
    return NextResponse.json({ error: `Unknown subject "${subject}".` }, { status: 400 });
  }
  if (typeof concept !== "string" || !concept.trim()) {
    return NextResponse.json({ error: "concept is required." }, { status: 400 });
  }
  const safeConcept = cap(concept.trim(), 200);
  const key = conceptKey(safeConcept);
  // Flag (don't block) obvious prompt-injection in the user-supplied concept.
  reportInjection({ req, route: "/api/learn", subject, concept: safeConcept, text: safeConcept });
  const sb = getSupabaseAdmin(); // null when SUPABASE_SERVICE_ROLE_KEY isn't set

  // 1) Shared cache hit → return the standardized guide without calling Groq, UNLESS
  //    it's a STALE auto-grown guide (a non-curated `ready` row whose content predates
  //    the PR 5 `whyItWorks` proof field). Those fall through to regenerate + overwrite
  //    (refresh_guide) so the depth fix reaches already-cached guides — at most once
  //    each (once healed it has whyItWorks → no longer stale). Curated guides are
  //    author-vetted and served as-is (refreshed only by the seed).
  let staleRefresh = false;
  if (sb) {
    try {
      const { data: row } = await sb
        .from("concept_guides")
        .select("content, source")
        .eq("subject", subject)
        .eq("concept_key", key)
        .maybeSingle();
      if (row && row.content && typeof row.content === "object") {
        const c = row.content;
        // "Stale" = the whyItWorks KEY is ABSENT (a pre-PR-5 guide). We gate on the
        // key's PRESENCE, not on non-empty content, so a regenerated guide always heals
        // EXACTLY ONCE: normalizeGuide always sets whyItWorks (to "" if the model omits
        // it), so after one refresh the key is present → never stale again. (Gating on
        // non-empty could loop forever, rate-limit-bounded, if the model kept omitting it.)
        const hasProofField = c.whyItWorks !== undefined && c.whyItWorks !== null;
        if (row.source === "curated" || hasProofField) {
          // Re-normalize the stored row so the served shape is always safe to render.
          return NextResponse.json({ ...normalizeGuide(subject, cap(c.concept, 200) || safeConcept, c), cached: true });
        }
        staleRefresh = true; // non-curated + no whyItWorks key → regenerate + overwrite below
      }
    } catch (e) {
      console.error("[/api/learn] cache read", e); // fall through to generation
    }
  }

  // 2) Miss → generate with Groq, normalize for safe rendering.
  let guide;
  try {
    const data = await groqJSON({
      system: LEARN_SYS,
      user:
        `Subject: ${subject}\n` +
        `Concept to teach: ${safeConcept}\n` +
        `Allowed topics (pick exactly one slug for the "topic" field): ${topicSlugsFor(subject)}\n\n` +
        `Write the one standard, level-neutral guide for this concept now — teach, don't solve.`,
      // A full concept guide (overview + key ideas + Socratic questions + pitfalls
      // + try-this) is the longest response we ask Groq for; give it more room than
      // the shared 1200-token default so a verbose guide can't be truncated mid-JSON.
      maxTokens: 3000,
    });
    guide = normalizeGuide(subject, safeConcept, data);
  } catch (e) {
    console.error("[/api/learn]", e);
    return NextResponse.json(
      { error: "The concept tutor is temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }

  // 3) Store for everyone (best-effort). Promote a pending (grader-registered)
  // stub into a ready, browsable guide — made PUBLIC only if the concept passes
  // the safety gate — or insert a fresh user-originated guide kept PRIVATE
  // (hidden) until vetted. Never overwrites an existing ready guide (first-writer-
  // wins is enforced inside the RPC). conceptKey/_concept_key parity means a
  // grader-registered stub collides on the same key and is promoted, not duplicated.
  // Only PERSIST guides for concepts that pass the safety gate: an unsafe concept
  // (URL/email/markup/blocklist/symbol-heavy) is still generated and returned to the
  // opener, but is NEVER written to the shared cache, so it can't be served to
  // anyone else. Stored guides are always hidden (curation-only) and never publicly
  // browsable — the public hub shows only curated rows (see promote_or_insert_guide).
  if (sb && guide.overview && isConceptSafe(safeConcept)) {
    try {
      if (staleRefresh) {
        // Overwrite the existing stale NON-CURATED guide in place (preserves its
        // hidden visibility); refresh_guide is a no-op on a curated row.
        await sb.rpc("refresh_guide", {
          p_subject: subject,
          p_concept: safeConcept,
          p_content: guide,
          p_topic: guide.topic,
          p_level: guide.tryThisQuestion ? guide.tryThisQuestion.difficulty : null,
        });
      } else {
        await sb.rpc("promote_or_insert_guide", {
          p_subject: subject,
          p_concept: safeConcept,
          p_content: guide,
          p_topic: guide.topic,
          p_level: guide.tryThisQuestion ? guide.tryThisQuestion.difficulty : null,
          p_safe: true,
        });
      }
    } catch (e) {
      console.error("[/api/learn] cache write", e); // non-fatal
    }
  }

  return NextResponse.json({ ...guide, cached: false });
}
