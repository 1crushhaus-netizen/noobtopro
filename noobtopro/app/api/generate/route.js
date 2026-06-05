import { NextResponse } from "next/server";
import { groqJSON, DIAG_GEN_SYS, PRACTICE_GEN_SYS } from "@/lib/groq";
import { SUBJECTS, clampScore } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export async function POST(req) {
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

    // practice
    if (!SUBJECTS[subject]) {
      return NextResponse.json(
        { error: `Unknown subject "${subject}".` },
        { status: 400 }
      );
    }
    const safeScore = clampScore(score) ?? 0;
    const concepts = Array.isArray(weakConcepts)
      ? weakConcepts.filter((c) => typeof c === "string")
      : [];

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
    return NextResponse.json({ error: e.message || "Generation failed" }, { status: 500 });
  }
}
