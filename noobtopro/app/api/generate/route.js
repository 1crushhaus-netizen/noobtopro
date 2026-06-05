import { NextResponse } from "next/server";
import { groqJSON, DIAG_GEN_SYS, PRACTICE_GEN_SYS } from "@/lib/groq";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { kind, subject, score, weakConcepts } = await req.json();

    if (kind === "diagnostic") {
      const data = await groqJSON({
        system: DIAG_GEN_SYS,
        user: "Generate the three diagnostic questions now.",
      });
      return NextResponse.json(data);
    }

    // practice
    const data = await groqJSON({
      system: PRACTICE_GEN_SYS,
      user:
        `Subject: ${subject}\n` +
        `Learner score: ${score}/100\n` +
        `Weak concepts: ${(weakConcepts || []).join(", ") || "none recorded"}\n` +
        `Generate the question now.`,
    });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e.message || "Generation failed" }, { status: 500 });
  }
}
