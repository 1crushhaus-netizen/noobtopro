import { NextResponse } from "next/server";
import { groqJSON, DIAG_GRADE_SYS, PRACTICE_GRADE_SYS } from "@/lib/groq";
import { clampScore, ORDER } from "@/lib/scoring";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Cap the base64 image at ~3 MB decoded. Kept under Vercel's ~4.5 MB request
// body limit so this check is actually reachable (the platform would otherwise
// reject the request first), and bounds the cost of the base64 validation below.
const MAX_IMAGE_BASE64_CHARS = 4_000_000;
// Standard base64 alphabet (no data: prefix, no whitespace).
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

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
  // Reject anything that isn't real base64 before it's spliced into the data:
  // URL sent upstream (length-bounded above, so this regex is cheap).
  if (!BASE64_RE.test(image.data)) {
    return { ok: false, error: "Attached image is not valid base64 data." };
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

// Coerce the model's weakConcepts to an array of <=8 short strings so the client
// can always safely .map/.slice it (a non-array would otherwise crash rendering).
function normalizeWeakConcepts(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter((c) => typeof c === "string" && c.trim()).slice(0, 8).map((c) => c.slice(0, 200));
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
  // Bound subject to the known set (matches /api/generate). ORDER.includes — not
  // SUBJECTS[subject] — so inherited keys ("constructor"/"__proto__") can't pass.
  if (!ORDER.includes(subject)) {
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
      return NextResponse.json({
        ...data,
        score: clamped ?? 0,
        weakConcepts: normalizeWeakConcepts(data?.weakConcepts),
      });
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
      weakConcepts: normalizeWeakConcepts(data?.weakConcepts),
    });
  } catch (e) {
    // Log server-side; return a generic message so upstream Groq status/body
    // detail (keys, quota state, model IDs) never leaks to the client.
    console.error("[/api/grade]", e);
    return NextResponse.json(
      { error: "Grading is temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}
