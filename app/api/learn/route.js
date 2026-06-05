import { NextResponse } from "next/server";
import { groqJSON, LEARN_SYS } from "@/lib/groq";
import { ORDER, clampScore } from "@/lib/scoring";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { getSupabaseAdmin, conceptKey } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const cap = (s, n) => (typeof s === "string" ? s.slice(0, n) : "");
const capArr = (a, n, len) =>
  Array.isArray(a)
    ? a.filter((x) => typeof x === "string" && x.trim()).slice(0, n).map((x) => x.slice(0, len))
    : [];

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

  const { subject, concept, score } = body || {};
  if (!ORDER.includes(subject)) {
    return NextResponse.json({ error: `Unknown subject "${subject}".` }, { status: 400 });
  }
  if (typeof concept !== "string" || !concept.trim()) {
    return NextResponse.json({ error: "concept is required." }, { status: 400 });
  }
  const safeConcept = cap(concept.trim(), 200);
  const safeScore = clampScore(score) ?? 0;
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
        return NextResponse.json({ ...row.content, cached: true });
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
        `Learner's current level: ${safeScore}/100\n\n` +
        `Teach this concept now — guide, don't solve.`,
    });
    guide = {
      subject,
      concept: safeConcept,
      overview: cap(data?.overview, 1500),
      keyIdeas: capArr(data?.keyIdeas, 6, 500),
      socraticQuestions: capArr(data?.socraticQuestions, 5, 500),
      pitfalls: capArr(data?.pitfalls, 5, 500),
      tryThis: cap(data?.tryThis, 800),
    };
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
