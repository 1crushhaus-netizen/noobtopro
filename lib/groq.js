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
Produce EXACTLY SIX diagnostic questions: for EACH subject (math, physics, chemistry), produce TWO questions — one "foundational" (easy) and one "advanced" (hard) — so each subject probes the learner at both the low and high end of the range.
Calibrate each question to its difficulty band:
- foundational: accessible to a motivated beginner; tests a core idea with light reasoning.
- advanced: genuinely challenging; rewards deep, well-structured reasoning.
Every question must:
- require the learner to REASON and explain their thinking, not just state a fact;
- be self-contained and answerable with reasoning and basic notation, no external tools.
Never include the solution or any hints. Use exactly the difficulty strings "foundational" and "advanced".
Respond with ONLY valid JSON, no markdown, no commentary, exactly (6 objects, 2 per subject):
{"questions":[{"subject":"math","topic":"<short topic>","difficulty":"foundational","question":"<question>"},{"subject":"math","topic":"<short topic>","difficulty":"advanced","question":"<question>"},{"subject":"physics","topic":"<short topic>","difficulty":"foundational","question":"<question>"},{"subject":"physics","topic":"<short topic>","difficulty":"advanced","question":"<question>"},{"subject":"chemistry","topic":"<short topic>","difficulty":"foundational","question":"<question>"},{"subject":"chemistry","topic":"<short topic>","difficulty":"advanced","question":"<question>"}]}`;

export const DIAG_GRADE_SYS = `You grade ONE diagnostic question for noobtopro — the QUALITY OF THE LEARNER'S THINKING on THIS question, not merely whether the final answer is correct. Be EXTREMELY CONSISTENT: the same answer must always earn the same score. Reason FIRST, then commit to numbers. A wrong answer with sound, well-explained reasoning scores HIGHER than a correct answer with little or no reasoning. A blank / "I don't know" / off-topic response scores in the single digits with an all-zero rubric.
Judge RELATIVE to the stated difficulty band: the bar for a strong answer is higher on an advanced question than on a foundational one (don't over-reward a thin answer just because the question was easy, and don't over-penalize a genuine attempt at a hard one).
Score each rubric dimension 0–4 using these anchors:
- conceptual_understanding — 0: no relevant principle, or a wrong one; 2: names the right principle but applies it loosely; 4: identifies and correctly uses the governing principle(s).
- logical_structure — 0: no steps, or steps that don't connect; 2: a partial chain with a gap or an unjustified jump; 4: each step follows from and justifies the last.
- strategy — 0: no plan or a dead end; 2: a workable approach pursued only partially; 4: an efficient plan well-suited to the problem.
- execution_accuracy — 0: work is wrong or absent; 2: mostly right with a slip; 4: manipulations/calculations correct throughout.
- communication — 0: unintelligible or unexplained; 2: followable but terse or partly unclear; 4: clear, well-explained reasoning.
The 0–100 score must be CONSISTENT with the rubric — about 25 × (mean of the five dimensions). ${SCALE}
ANTI-GAMING — penalize, never reward: buzzword-stuffing or name-dropping principles without USING them; unsupported jargon/formulas with no justification; padding or restating the question. LENGTH MUST NEVER RAISE THE SCORE — judge content, not word count; a short, correct, well-justified answer beats a long, vague one.
Identify the specific concept(s) they are weak on — precise (e.g. "vector decomposition", "limiting reagents"), not vague (not just "algebra").
NEVER reveal the correct answer or a worked solution in the comment — describe only what their reasoning showed (the comment is shown to the learner).
Respond with ONLY valid JSON, no markdown, with "rationale" FIRST so you reason before scoring:
{"rationale":"<1 sentence: what the reasoning showed, justifying the scores below>","subject":"<subject>","rubric":{"conceptual_understanding":<0-4>,"logical_structure":<0-4>,"strategy":<0-4>,"execution_accuracy":<0-4>,"communication":<0-4>},"score":<int 0-100 consistent with the rubric>,"weakConcepts":["..."],"comment":"<=35 words on what their reasoning showed"}`;

export const PRACTICE_GEN_SYS = `You are the question engine for noobtopro. Generate ONE question in the requested subject, calibrated to a learner currently at the given score out of 100. Scale: ${SCALE}
Make it appropriately challenging for that level — neither trivial nor impossible. If weak concepts are provided, target the question at strengthening one of them.
The question must require explained reasoning (not recall) and be self-contained. Never include the solution or hints.
Also classify the question into ONE topicSlug — choose the single best-fit slug from the "Allowed topics" list in the user message (use exactly one of those slugs; if none fit, use the general_<subject> one). This slug calibrates the question's difficulty against the user population, so pick the most specific fit.
Respond with ONLY valid JSON, no markdown:
{"subject":"<subject>","topic":"<short human-readable topic>","topicSlug":"<one slug from the Allowed topics list>","targetConcept":"<concept this probes>","difficulty":"<beginner|foundational|intermediate|advanced|phd>","question":"<question>"}`;

export const PRACTICE_GRADE_SYS = `You are the grader and coach for noobtopro. Grade the QUALITY OF THE LEARNER'S THINKING — not whether the final answer is correct. Be EXTREMELY CONSISTENT: the same answer must always earn the same score. Reason FIRST, then commit to numbers (rationale before scores).
Score each rubric dimension 0–4 using these anchors:
- conceptual_understanding — 0: no relevant principle, or a wrong one; 2: names the right principle but applies it loosely; 4: identifies and correctly uses the governing principle(s).
- logical_structure — 0: no steps, or steps that don't connect; 2: a partial chain with a gap or an unjustified jump; 4: each step follows from and justifies the last.
- strategy — 0: no plan or a dead end; 2: a workable approach pursued only partially; 4: an efficient plan well-suited to the problem.
- execution_accuracy — 0: work is wrong or absent; 2: mostly right with a slip; 4: manipulations/calculations correct throughout.
- communication — 0: unintelligible or unexplained; 2: followable but terse or partly unclear; 4: clear, well-explained reasoning.
reasoningScore (0–100) must be CONSISTENT with the rubric — about 25 × (mean of the five dimensions). ${SCALE}
Reward sound reasoning even when the final answer is wrong; penalize a correct answer shown with no reasoning. A blank / "I don't know" / off-topic response scores in the single digits with an all-zero rubric.
Calibrate reasoningScore and newScoreSuggestion to the stated difficulty band: solid progress on an above-level item is stronger evidence of mastery than the same on a far-below-level item.
ANTI-GAMING — penalize, never reward: buzzword-stuffing or name-dropping principles without USING them (→ low conceptual_understanding & strategy); unsupported jargon/formulas with no derivation (→ low logical_structure & execution_accuracy); padding or restating the question. LENGTH MUST NEVER RAISE THE SCORE — judge content, not word count; a short, correct, well-justified answer beats a long, vague one.

COACHING RULES (critical):
- NEVER reveal the final answer or a full worked solution.
- socraticHint: ONE guiding question that nudges the learner toward THEIR next step (never the answer).
- microLesson: a concise lesson (<=90 words) teaching the underlying CONCEPT they are weak on — the principle in general, NOT the solution to this specific problem.
- correctnessNote: <=25 words on whether their conclusion holds, WITHOUT revealing the correct answer.

Respond with ONLY valid JSON, no markdown, with "rationale" FIRST so you reason before scoring:
{"rationale":"<1-2 sentences: what the reasoning showed, justifying the scores below>","rubric":{"conceptual_understanding":<0-4>,"logical_structure":<0-4>,"strategy":<0-4>,"execution_accuracy":<0-4>,"communication":<0-4>},"reasoningScore":<int 0-100 consistent with the rubric>,"correctnessNote":"...","socraticHint":"...","microLesson":"...","weakConcepts":["..."],"newScoreSuggestion":<int 0-100 updated subject level>}`;

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
  const raw = (text || "").trim();
  // Fast path #1: parse the RAW text first (before stripping ``` fences), so a
  // backtick that appears inside a JSON string VALUE is preserved rather than
  // corrupted by the fence strip. Clean JSON-mode output (incl. top-level arrays)
  // lands here.
  try {
    return JSON.parse(raw);
  } catch {
    /* not clean JSON — try de-fencing, then a balanced-brace scan */
  }
  // Fast path #2: strip markdown code fences and retry (```json ... ``` wrapping).
  const t = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  if (t !== raw) {
    try {
      return JSON.parse(t);
    } catch {
      /* fall through to the balanced-brace scan */
    }
  }
  // Balanced-brace scan for prose-wrapped JSON. Brace tracking is string-aware
  // (braces inside string values are ignored). Unlike the old "first balanced
  // block wins", we collect EVERY top-level balanced block that parses and return
  // the LARGEST — so the real envelope beats a stray/empty leading object (e.g.
  // "{} {real}") or an inner fragment (e.g. a rubric sub-object). AND if the first
  // "{" never balances, the outer object is TRUNCATED: we throw rather than return
  // a misleading sub-fragment (which would otherwise persist a silent score of 0).
  const firstBrace = t.indexOf("{");
  let firstBraceBalanced = false;
  let best = null; // { value, len }
  for (let start = firstBrace; start !== -1; start = t.indexOf("{", start + 1)) {
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
          if (start === firstBrace) firstBraceBalanced = true;
          const slice = t.slice(start, i + 1);
          try {
            const value = JSON.parse(slice);
            if (!best || slice.length > best.len) best = { value, len: slice.length };
          } catch {
            /* this candidate isn't valid JSON — keep scanning later "{" */
          }
          break; // move to the next top-level "{" candidate
        }
      }
    }
  }
  // A present-but-never-balanced outer object => truncated response. Don't hand back
  // an inner fragment; surface the failure so the caller retries / returns an error.
  if (firstBrace !== -1 && !firstBraceBalanced) {
    throw new Error("Model did not return JSON (response truncated)");
  }
  if (best) return best.value;
  throw new Error("Model did not return JSON");
}

async function rawCall({ model, system, userContent, jsonMode, maxTokens, temperature }) {
  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
    // Grading passes temperature 0 for DETERMINISM (same answer → same score, the
    // consistency the rating engine depends on); generation keeps the default 0.4 for
    // question variety. `== null` (not `||`) so an explicit 0 is honored, not replaced.
    temperature: temperature == null ? 0.4 : temperature,
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
  // Deterministic grading: temperature 0 on every grade call (incl. the vision and
  // text-only fallback paths below). undefined for generation → rawCall's 0.4 default.
  const temperature = grade ? 0 : undefined;
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
    return extractJSON(await rawCall({ model, system, userContent, jsonMode: true, maxTokens, temperature }));
  } catch (e1) {
    const hardError = e1 && typeof e1.status === "number" && e1.status !== 400;
    if (image) {
      // One vision attempt only. Fall back to a text-only grade unless the failure
      // is a shared-key 401/403 (any further call is pointless).
      if (hardError && (e1.status === 401 || e1.status === 403)) throw e1;
      return extractJSON(await rawCall({ model: TEXT_MODEL, system, userContent: user, jsonMode: false, maxTokens, temperature }));
    }
    // No image: a hard upstream error can't be retried away.
    if (hardError) throw e1;
    // Parse failure / 400 → retry once without response_format on the same model.
    return extractJSON(await rawCall({ model, system, userContent, jsonMode: false, maxTokens, temperature }));
  }
}
