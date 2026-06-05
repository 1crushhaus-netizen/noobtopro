// ---------------------------------------------------------------------------
// Server-only Groq client.
// IMPORTANT: this module must only ever be imported by server code (API route
// handlers). The GROQ_API_KEY lives in the environment and is NEVER sent to the
// browser. Calling Groq from client components would leak the key to anyone who
// opens devtools — that is why the app talks to /api/* instead of Groq directly.
// ---------------------------------------------------------------------------

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Default text model: production-grade, strong reasoning, 131k context.
// Override with GROQ_MODEL. See https://console.groq.com/docs/models for the
// current catalog (model IDs rotate; check the live page before standardizing).
const TEXT_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

// Multimodal model used only when a learner attaches a photo of their work.
// Llama 4 Scout is currently the vision-capable option (preview tier — may
// change at short notice). Override with GROQ_VISION_MODEL.
const VISION_MODEL = process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";

const SCALE =
  "0–20 absolute beginner, 20–40 foundational, 40–60 intermediate, 60–80 advanced, 80–100 PhD-level.";

// ---- prompts --------------------------------------------------------------

export const DIAG_GEN_SYS = `You are the question engine for noobtopro, a platform that measures real understanding of mathematics, physics, and chemistry — not memorization.
Produce exactly ONE diagnostic question per subject (math, physics, chemistry).
Each question must:
- require the learner to REASON and explain their thinking, not just state a fact;
- be open enough that a strong response reveals depth while a weak response reveals gaps (it should place someone anywhere from absolute beginner to PhD level);
- be self-contained and answerable with reasoning and basic notation, with no external tools required.
Never include the solution or any hints.
Respond with ONLY valid JSON, no markdown, no commentary, exactly:
{"questions":[{"subject":"math","topic":"<short topic>","question":"<question>"},{"subject":"physics","topic":"<short topic>","question":"<question>"},{"subject":"chemistry","topic":"<short topic>","question":"<question>"}]}`;

export const DIAG_GRADE_SYS = `You grade for noobtopro. You evaluate the QUALITY OF A LEARNER'S THINKING, not merely whether the final answer is correct. A wrong answer with sound, well-explained reasoning scores HIGHER than a correct answer with little or no reasoning. A blank or "I don't know" response scores in the single digits.
Rate the learner's understanding of the subject on a 0–100 scale: ${SCALE}
Identify the specific concept(s) they are weak on — be precise (e.g. "vector decomposition", "limiting reagents"), not vague (not just "algebra").
Respond with ONLY valid JSON, no markdown:
{"subject":"<subject>","score":<int 0-100>,"weakConcepts":["..."],"comment":"<=35 words on what their reasoning showed"}`;

export const PRACTICE_GEN_SYS = `You are the question engine for noobtopro. Generate ONE question in the requested subject, calibrated to a learner currently at the given score out of 100. Scale: ${SCALE}
Make it appropriately challenging for that level — neither trivial nor impossible. If weak concepts are provided, target the question at strengthening one of them.
The question must require explained reasoning (not recall) and be self-contained. Never include the solution or hints.
Respond with ONLY valid JSON, no markdown:
{"subject":"<subject>","topic":"<short topic>","targetConcept":"<concept this probes>","difficulty":"<beginner|foundational|intermediate|advanced|phd>","question":"<question>"}`;

export const PRACTICE_GRADE_SYS = `You are the grader and coach for noobtopro. Evaluate the QUALITY OF THE LEARNER'S THINKING against this rubric. Score each dimension 0–4:
- conceptual_understanding: did they invoke the right principles?
- logical_structure: is each step justified and coherent?
- strategy: did they choose a sensible approach?
- execution_accuracy: are the manipulations/calculations correct?
- communication: is the reasoning clearly explained?
Reward sound reasoning even when the final answer is wrong. Penalize correct answers that show no reasoning. A blank response scores 0 across the board.

COACHING RULES (critical):
- NEVER reveal the final answer or a full worked solution.
- socraticHint: ONE guiding question that nudges the learner toward THEIR next step (never the answer).
- microLesson: a concise lesson (<=90 words) teaching the underlying CONCEPT they are weak on — the principle in general, NOT the solution to this specific problem.
- correctnessNote: <=25 words on whether their conclusion holds, WITHOUT revealing the correct answer.

Respond with ONLY valid JSON, no markdown:
{"reasoningScore":<int 0-100 for THIS attempt>,"rubric":{"conceptual_understanding":<0-4>,"logical_structure":<0-4>,"strategy":<0-4>,"execution_accuracy":<0-4>,"communication":<0-4>},"correctnessNote":"...","socraticHint":"...","microLesson":"...","weakConcepts":["..."],"newScoreSuggestion":<int 0-100 updated subject level>}`;

// ---- helpers --------------------------------------------------------------

function extractJSON(text) {
  let t = (text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const s = t.indexOf("{");
  const e = t.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("Model did not return JSON");
  return JSON.parse(t.slice(s, e + 1));
}

async function rawCall({ model, system, userContent, jsonMode }) {
  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
    temperature: 0.4,
    max_tokens: 1200,
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Groq ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

/**
 * Send a prompt to Groq and parse a JSON object back.
 * @param {{system:string, user:string, image?:{mime:string, data:string}}} args
 *   image.data is base64 (no data: prefix). When present, a vision-capable model
 *   is used; if that fails, we fall back to grading the text only.
 */
export async function groqJSON({ system, user, image }) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set. Add it to .env.local (see .env.example).");
  }

  let model = TEXT_MODEL;
  let userContent = user;
  if (image && image.data) {
    model = VISION_MODEL;
    userContent = [
      { type: "text", text: user },
      { type: "image_url", image_url: { url: `data:${image.mime || "image/jpeg"};base64,${image.data}` } },
    ];
  }

  // Try JSON mode first, then degrade gracefully:
  //  1) retry without response_format (some models reject it),
  //  2) if a vision call failed, retry text-only on the text model.
  try {
    return extractJSON(await rawCall({ model, system, userContent, jsonMode: true }));
  } catch (e1) {
    try {
      return extractJSON(await rawCall({ model, system, userContent, jsonMode: false }));
    } catch (e2) {
      if (image) {
        return extractJSON(await rawCall({ model: TEXT_MODEL, system, userContent: user, jsonMode: false }));
      }
      throw e2;
    }
  }
}
