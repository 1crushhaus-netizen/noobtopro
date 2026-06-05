import { NextResponse } from "next/server";
import { groqJSON, DIAG_GRADE_SYS, PRACTICE_GRADE_SYS } from "@/lib/groq";
import { clampScore, SUBJECTS } from "@/lib/scoring";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Base64 inflates bytes ~33%, so this caps the decoded upload near ~5.5 MB.
// Guards the route (and our Groq bill) against arbitrarily large image payloads.
const MAX_IMAGE_BASE64_CHARS = 7_500_000;

// Cap each free-text field injected into the prompt. ~12k chars is far longer
// than any genuine reasoning answer, but bounds the token count (and Groq cost)
// so a multi-megabyte string can't blow past the model's context window.
const MAX_TEXT_CHARS = 12_000;
const capText = (s) => (typeof s === "string" ? s.slice(0, MAX_TEXT_CHARS) : "");

// Image formats the Groq vision model accepts. Anything else is rejected so an
// arbitrary MIME string can never reach the upstream call.
const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// The five rubric dimensions the practice grader scores 0–4 each.
const RUBRIC_KEYS = [
  "conceptual_understanding",
  "logical_structure",
  "strategy",
  "execution_accuracy",
  "communication",
];

// Validate an optional attached image. Returns { ok, image } or { ok:false, error }.
function normalizeImage(image) {
  if (image == null) return { ok: true, image: undefined };
  if (typeof image !== "object" || typeof image.data !== "string") {
    return { ok: false, error: "image must be an object with base64 string data." };
  }
  if (image.data.length > MAX_IMAGE_BASE64_CHARS) {
    return { ok: false, error: "Attached image is too large. Please use a smaller photo." };
  }
  // A missing mime is fine (the Groq client defaults it); a present one must be
  // on the allowlist so an arbitrary string never reaches the upstream call.
  const { mime } = image;
  if (mime != null && !ALLOWED_IMAGE_MIME.has(mime)) {
    return { ok: false, error: "Unsupported image type. Use JPEG, PNG, WebP, or GIF." };
  }
  return { ok: true, image: { mime: mime || undefined, data: image.data } };
}

// Clamp each rubric dimension to an integer in [0, 4]; default missing ones to 0.
function normalizeRubric(rubric) {
  const out = {};
  for (const k of RUBRIC_KEYS) {
    const n = Number(rubric?.[k]);
    out[k] = Number.isFinite(n) ? Math.max(0, Math.min(4, Math.round(n))) : 0;
  }
  return out;
}

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

  const { kind, subject, question, targetConcept, score, reasoning, image } = body || {};
  const work = reasoning && reasoning.trim() ? capText(reasoning.trim()) : "(no written reasoning provided)";
  const safeQuestion = capText(question);
  const safeConcept = capText(targetConcept) || "(unspecified)";

  if (kind !== "diagnostic" && kind !== "practice") {
    return NextResponse.json(
      { error: 'kind must be "diagnostic" or "practice".' },
      { status: 400 }
    );
  }
  if (typeof subject !== "string" || typeof question !== "string") {
    return NextResponse.json(
      { error: "subject and question are required." },
      { status: 400 }
    );
  }
  // Bound subject to the known set (matches /api/generate) so an arbitrary
  // string can't be injected into the grading prompt.
  if (!SUBJECTS[subject]) {
    return NextResponse.json({ error: `Unknown subject "${subject}".` }, { status: 400 });
  }

  const img = normalizeImage(image);
  if (!img.ok) return NextResponse.json({ error: img.error }, { status: 400 });

  try {
    if (kind === "diagnostic") {
      const data = await groqJSON({
        system: DIAG_GRADE_SYS,
        user: `Subject: ${subject}\nQuestion: ${safeQuestion}\n\nLearner's reasoning:\n"""${work}"""`,
        image: img.image,
      });
      // Clamp the model's score before it reaches the client/UI.
      const clamped = clampScore(data?.score);
      return NextResponse.json({ ...data, score: clamped ?? 0 });
    }

    // practice
    const safeScore = clampScore(score) ?? 0;
    const data = await groqJSON({
      system: PRACTICE_GRADE_SYS,
      user:
        `Subject: ${subject}\n` +
        `Question: ${safeQuestion}\n` +
        `Concept being probed: ${safeConcept}\n` +
        `Learner's current level: ${safeScore}/100\n\n` +
        `Learner's reasoning:\n"""${work}"""`,
      image: img.image,
    });
    // Normalize every score the UI renders so malformed model output can't show
    // NaN or out-of-range values. reasoningScore -> /100 display; rubric -> 0–4
    // bars; newScoreSuggestion -> blend() (null is handled there as "no change").
    return NextResponse.json({
      ...data,
      reasoningScore: clampScore(data?.reasoningScore) ?? 0,
      newScoreSuggestion: clampScore(data?.newScoreSuggestion),
      rubric: normalizeRubric(data?.rubric),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Grading failed" }, { status: 500 });
  }
}
