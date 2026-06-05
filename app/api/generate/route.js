import { NextResponse } from "next/server";
import { groqJSON, DIAG_GEN_SYS, PRACTICE_GEN_SYS } from "@/lib/groq";
import { ORDER, clampScore } from "@/lib/scoring";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

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

  const { kind, subject, score, weakConcepts } = body || {};

  try {
    if (kind === "diagnostic") {
      const data = await groqJSON({
        system: DIAG_GEN_SYS,
        user: "Generate the three diagnostic questions now.",
      });
      return NextResponse.json(data);
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

    const data = await groqJSON({
      system: PRACTICE_GEN_SYS,
      user:
        `Subject: ${subject}\n` +
        `Learner score: ${safeScore}/100\n` +
        `Weak concepts: ${concepts.join(", ") || "none recorded"}\n` +
        `Generate the question now.`,
    });
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
