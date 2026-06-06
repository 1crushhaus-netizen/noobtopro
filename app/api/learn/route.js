import { NextResponse } from "next/server";
import { groqJSON, LEARN_SYS } from "@/lib/groq";
import { ORDER } from "@/lib/scoring";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { getSupabaseAdmin, conceptKey } from "@/lib/supabaseAdmin";

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
    overview: cap(raw?.overview, 1500),
    keyIdeas: capArr(raw?.keyIdeas, 6, 500),
    socraticQuestions: capArr(raw?.socraticQuestions, 5, 500),
    pitfalls: capArr(raw?.pitfalls, 5, 500),
    tryThis: cap(raw?.tryThis, 800),
    tryThisQuestion: normalizeTryThisQuestion(raw?.tryThisQuestion, concept),
  };
}

// Teach a concept the learner is weak on — Socratically, without giving answers.
export async function POST(req) {
  const rl = rateLimit(clientKey(req));
  if (!rl.ok) {
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
  const sb = getSupabaseAdmin(); // null when SUPABASE_SERVICE_ROLE_KEY isn't set

  // 1) Shared cache hit → return the standardized guide without calling Groq.
  if (sb) {
    try {
      const { data: row } = await sb
        .from("concept_guides")
        .select("content")
        .eq("subject", subject)
        .eq("concept_key", key)
        .maybeSingle();
      if (row && row.content && typeof row.content === "object") {
        // Re-normalize the stored row so the served shape is always safe to render.
        const c = row.content;
        return NextResponse.json({ ...normalizeGuide(subject, cap(c.concept, 200) || safeConcept, c), cached: true });
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
        `Concept to teach: ${safeConcept}\n\n` +
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

  // 3) Store for everyone (best-effort, first-writer-wins). Only worth caching a
  // guide with real content.
  if (sb && guide.overview) {
    try {
      await sb
        .from("concept_guides")
        .upsert(
          { subject, concept_key: key, concept: safeConcept, content: guide },
          { onConflict: "subject,concept_key", ignoreDuplicates: true }
        );
    } catch (e) {
      console.error("[/api/learn] cache write", e); // non-fatal
    }
  }

  return NextResponse.json({ ...guide, cached: false });
}
