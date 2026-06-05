import { NextResponse } from "next/server";
import { groqJSON, DIAG_GRADE_SYS, PRACTICE_GRADE_SYS } from "@/lib/groq";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { kind, subject, question, targetConcept, score, reasoning, image } = await req.json();
    const work = reasoning && reasoning.trim() ? reasoning.trim() : "(no written reasoning provided)";

    if (kind === "diagnostic") {
      const data = await groqJSON({
        system: DIAG_GRADE_SYS,
        user: `Subject: ${subject}\nQuestion: ${question}\n\nLearner's reasoning:\n"""${work}"""`,
        image,
      });
      return NextResponse.json(data);
    }

    // practice
    const data = await groqJSON({
      system: PRACTICE_GRADE_SYS,
      user:
        `Subject: ${subject}\n` +
        `Question: ${question}\n` +
        `Concept being probed: ${targetConcept}\n` +
        `Learner's current level: ${score}/100\n\n` +
        `Learner's reasoning:\n"""${work}"""`,
      image,
    });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e.message || "Grading failed" }, { status: 500 });
  }
}
