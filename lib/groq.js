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

// Model for the GRADING calls (the hottest, most token-heavy path — the learner's
// reasoning is the bulk of the input). Defaults to openai/gpt-oss-120b: at
// $0.15/M input + $0.60/M output it is ~3.9x cheaper on input and ~1.3x on output
// than llama-3.3-70b-versatile ($0.59/$0.79), with strong reasoning quality. It is
// a reasoning model, so we pin reasoning_effort=low (in rawCall) to keep its
// chain-of-thought — billed as output — minimal. Override/revert with
// GROQ_GRADE_MODEL (e.g. set it to llama-3.3-70b-versatile to roll back instantly).
const GRADE_MODEL = process.env.GROQ_GRADE_MODEL || "openai/gpt-oss-120b";

const SCALE =
  "0–20 absolute beginner, 20–40 foundational, 40–60 intermediate, 60–80 advanced, 80–100 PhD-level.";

// ---- prompts --------------------------------------------------------------

export const DIAG_GEN_SYS = `You are the question engine for noobtopro, a platform that measures real understanding of mathematics, physics, and chemistry — not memorization.
Produce EXACTLY NINE diagnostic questions: for EACH subject (math, physics, chemistry), produce THREE questions at escalating difficulty — one "foundational" (easy), one "intermediate", one "advanced" (hard) — so each subject probes the learner across the range.
Calibrate each question to its difficulty band:
- foundational: accessible to a motivated beginner; tests a core idea with light reasoning.
- intermediate: a solid mid-level problem requiring a multi-step argument.
- advanced: genuinely challenging; rewards deep, well-structured reasoning.
Every question must:
- require the learner to REASON and explain their thinking, not just state a fact;
- be self-contained and answerable with reasoning and basic notation, no external tools.
Never include the solution or any hints. Use exactly the difficulty strings "foundational", "intermediate", "advanced".
Respond with ONLY valid JSON, no markdown, no commentary, exactly (9 objects, 3 per subject):
{"questions":[{"subject":"math","topic":"<short topic>","difficulty":"foundational","question":"<question>"},{"subject":"math","topic":"<short topic>","difficulty":"intermediate","question":"<question>"},{"subject":"math","topic":"<short topic>","difficulty":"advanced","question":"<question>"},{"subject":"physics","topic":"<short topic>","difficulty":"foundational","question":"<question>"},{"subject":"physics","topic":"<short topic>","difficulty":"intermediate","question":"<question>"},{"subject":"physics","topic":"<short topic>","difficulty":"advanced","question":"<question>"},{"subject":"chemistry","topic":"<short topic>","difficulty":"foundational","question":"<question>"},{"subject":"chemistry","topic":"<short topic>","difficulty":"intermediate","question":"<question>"},{"subject":"chemistry","topic":"<short topic>","difficulty":"advanced","question":"<question>"}]}`;

export const DIAG_GRADE_SYS = `You grade ONE diagnostic question for noobtopro. You evaluate the QUALITY OF A LEARNER'S THINKING on THIS question, not merely whether the final answer is correct. A wrong answer with sound, well-explained reasoning scores HIGHER than a correct answer with little or no reasoning. A blank or "I don't know" response scores in the single digits.
The question has a stated difficulty band — judge the reasoning RELATIVE to that band: the bar for a strong answer is higher on an advanced question than on a foundational one (don't over-reward a thin answer just because the question was easy, and don't over-penalize a genuine attempt at a hard one).
Rate the reasoning on this single question on a 0–100 scale: ${SCALE}
Also score the reasoning on this rubric, each dimension 0–4 (a blank response scores 0 across the board):
- conceptual_understanding: did they invoke the right principles?
- logical_structure: is each step justified and coherent?
- strategy: did they choose a sensible approach?
- execution_accuracy: are the manipulations/calculations correct?
- communication: is the reasoning clearly explained?
Keep the rubric CONSISTENT with the 0–100 score (a high score must not have all-zero rubric bars, and vice versa).
Identify the specific concept(s) they are weak on — be precise (e.g. "vector decomposition", "limiting reagents"), not vague (not just "algebra").
Respond with ONLY valid JSON, no markdown:
{"subject":"<subject>","score":<int 0-100>,"rubric":{"conceptual_understanding":<0-4>,"logical_structure":<0-4>,"strategy":<0-4>,"execution_accuracy":<0-4>,"communication":<0-4>},"weakConcepts":["..."],"comment":"<=35 words on what their reasoning showed"}`;

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
Calibrate reasoningScore and newScoreSuggestion to the stated question difficulty band: solid progress on an above-level item is stronger evidence of mastery than the same on a far-below-level item.

COACHING RULES (critical):
- NEVER reveal the final answer or a full worked solution.
- socraticHint: ONE guiding question that nudges the learner toward THEIR next step (never the answer).
- microLesson: a concise lesson (<=90 words) teaching the underlying CONCEPT they are weak on — the principle in general, NOT the solution to this specific problem.
- correctnessNote: <=25 words on whether their conclusion holds, WITHOUT revealing the correct answer.

Respond with ONLY valid JSON, no markdown:
{"reasoningScore":<int 0-100 for THIS attempt>,"rubric":{"conceptual_understanding":<0-4>,"logical_structure":<0-4>,"strategy":<0-4>,"execution_accuracy":<0-4>,"communication":<0-4>},"correctnessNote":"...","socraticHint":"...","microLesson":"...","weakConcepts":["..."],"newScoreSuggestion":<int 0-100 updated subject level>}`;

export const LEARN_SYS = `You are the concept tutor for noobtopro. The learner is weak on a specific CONCEPT in mathematics, physics, or chemistry. TEACH the concept: build genuine intuition and explain the underlying principle clearly and rigorously.
Write ONE standard, level-neutral explanation that serves a motivated learner meeting the concept fresh and is still worthwhile for someone more advanced — start from intuition and build up. (This guide is shared across all learners, so do not tailor it to one skill level.)
CRITICAL — this is teaching, not solving:
- Do NOT solve any specific problem, and never give a final numeric/closed-form answer to a worked example.
- Teach the IDEA and the METHOD in general terms, and use Socratic questions to provoke the learner's OWN reasoning.
- Be accurate and concrete; prefer plain language and small illustrative (un-solved) setups over heavy formalism.
Also include ONE concrete "try this" PRACTICE PROBLEM (\`tryThisQuestion\`) on this concept: self-contained, answerable with explained reasoning and basic notation, and calibrated to the difficulty band you choose — but NEVER include its solution or final answer. This single problem is stored with the guide and reused, so make it a good, representative exercise.
Also classify the concept into ONE \`topic\` — choose the single best-fit slug from the "Allowed topics" list given in the user message (use exactly one of those slugs; if none fit, use the general_<subject> one).
Respond with ONLY valid JSON, no markdown:
{"topic":"<one slug from the Allowed topics list>","overview":"<2-4 sentence intuition: what this concept is and why it matters>","keyIdeas":["<core principle to internalize>","<another>","..."],"socraticQuestions":["<question that prompts the learner's own thinking>","..."],"pitfalls":["<common mistake or misconception>","..."],"tryThis":"<a brief general approach to problems involving this concept — a nudge, NOT an answer>","tryThisQuestion":{"question":"<a concrete, self-contained practice problem on this concept; require explained reasoning; NO solution or final answer>","difficulty":"<beginner|foundational|intermediate|advanced|phd>"}}`;

// ---- helpers --------------------------------------------------------------

function extractJSON(text) {
  let t = (text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  // Fast path: the de-fenced text is already valid JSON (incl. top-level arrays).
  try {
    return JSON.parse(t);
  } catch {
    /* fall through to balanced-brace extraction for prose-wrapped JSON */
  }
  // Try each "{" as a candidate start and return the first BALANCED {...} block
  // that parses. Brace tracking is string-aware (braces inside string values are
  // ignored), so this is correct even when prose before or after the object
  // contains stray "{" / "}" — unlike a naive first-"{"/last-"}" slice.
  for (let start = t.indexOf("{"); start !== -1; start = t.indexOf("{", start + 1)) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < t.length; i++) {
      const c = t[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') {
        inStr = true;
      } else if (c === "{") {
        depth++;
      } else if (c === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(t.slice(start, i + 1));
          } catch {
            break; // this candidate isn't valid JSON — try the next "{"
          }
        }
      }
    }
  }
  throw new Error("Model did not return JSON");
}

async function rawCall({ model, system, userContent, jsonMode, maxTokens }) {
  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
    temperature: 0.4,
    // Per-call override (|| not a default param, so a stray 0 still falls back).
    // Lets a longer generation (e.g. the Learn concept guide) ask for more room
    // without inflating the budget — and cost — of every grade/generate call.
    max_tokens: maxTokens || 1200,
  };
  if (jsonMode) body.response_format = { type: "json_object" };
  // gpt-oss are reasoning models whose chain-of-thought bills as OUTPUT tokens;
  // pin it low for our structured rubric task so the cheaper price isn't eaten by
  // reasoning tokens. Ignored (and not sent) for non-reasoning models like llama.
  if (/gpt-oss/i.test(model)) body.reasoning_effort = "low";

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
    // Tag the HTTP status so the caller can tell a retryable parse failure from a
    // hard upstream error (401/403/429/5xx) that retrying would only worsen.
    const err = new Error(`Groq ${res.status}: ${detail.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  // Lightweight per-call cost observability: model + token usage to the server log
  // (Vercel runtime logs). No secrets; helps watch Groq spend and compare models.
  if (data && data.usage) {
    console.log(`[groq] ${model} in=${data.usage.prompt_tokens} out=${data.usage.completion_tokens}`);
  }
  return data?.choices?.[0]?.message?.content || "";
}

/**
 * Send a prompt to Groq and parse a JSON object back.
 * @param {{system:string, user:string, image?:{mime:string, data:string}, maxTokens?:number, grade?:boolean}} args
 *   image.data is base64 (no data: prefix). When present, a vision-capable model
 *   is used; if that fails, we fall back to grading the text only.
 *   grade:true routes to GRADE_MODEL (the cheaper grader); default is TEXT_MODEL.
 */
export async function groqJSON({ system, user, image, maxTokens, grade }) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set. Add it to .env.local (see .env.example).");
  }

  let model = grade ? GRADE_MODEL : TEXT_MODEL;
  let userContent = user;
  if (image && image.data) {
    // A photo of work needs the multimodal model regardless of the grade flag.
    model = VISION_MODEL;
    userContent = [
      { type: "text", text: user },
      { type: "image_url", image_url: { url: `data:${image.mime || "image/jpeg"};base64,${image.data}` } },
    ];
  }

  // Try JSON mode first, then degrade gracefully. A retry only helps a PARSE
  // failure or an HTTP 400 (model rejected response_format); a hard upstream error
  // (401/403/429/5xx) won't be fixed by retrying and would just double Groq cost /
  // 429 pressure — so re-throw it.
  //
  // COST CAP: when an image is attached, NEVER call the (expensive, multi-MB)
  // vision model a second time. The vision model is tried exactly once; on any
  // recoverable failure we fall back to a SINGLE text-only grade on TEXT_MODEL.
  // So an image request makes at most 2 upstream calls, only one of which carries
  // the image (was up to 3 calls / 2 image calls — a cost-amplification vector).
  try {
    return extractJSON(await rawCall({ model, system, userContent, jsonMode: true, maxTokens }));
  } catch (e1) {
    const hardError = e1 && typeof e1.status === "number" && e1.status !== 400;
    if (image) {
      // One vision attempt only. Fall back to a text-only grade unless the failure
      // is a shared-key 401/403 (any further call is pointless).
      if (hardError && (e1.status === 401 || e1.status === 403)) throw e1;
      return extractJSON(await rawCall({ model: TEXT_MODEL, system, userContent: user, jsonMode: false, maxTokens }));
    }
    // No image: a hard upstream error can't be retried away.
    if (hardError) throw e1;
    // Parse failure / 400 → retry once without response_format on the same model.
    return extractJSON(await rawCall({ model, system, userContent, jsonMode: false, maxTokens }));
  }
}
