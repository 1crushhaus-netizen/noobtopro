// ---------------------------------------------------------------------------
// Shared input validation/normalization for the grading routes (/api/grade and
// /api/score). Extracted so the two routes bound user input IDENTICALLY — a drift
// between them would be a security gap (one route stricter than the other).
//
// Pure functions only (no secrets, no I/O), but conceptually server-side: these
// guard the free-text / image / difficulty fields before they reach the Groq
// prompt or the vision model.
// ---------------------------------------------------------------------------

// Cap each free-text field injected into the prompt. ~12k chars is far longer than
// any genuine reasoning answer, but bounds the token count (and Groq cost) so a
// multi-megabyte string can't blow past the model's context window.
export const MAX_TEXT_CHARS = 12_000;
export const capText = (s) => (typeof s === "string" ? s.slice(0, MAX_TEXT_CHARS) : "");

// Cap the base64 image at ~3 MB decoded. Kept under Vercel's ~4.5 MB request body
// limit so this check is actually reachable, and bounds the cost of base64 validation.
export const MAX_IMAGE_BASE64_CHARS = 4_000_000;
// Standard base64 alphabet (no data: prefix, no whitespace).
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

// Image formats the Groq vision model accepts. Anything else is rejected so an
// arbitrary MIME string can never reach the upstream call.
const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Sniff the real image type from the decoded leading bytes (magic numbers), so a
// client cannot pass arbitrary bytes under a forged MIME. Returns the detected MIME
// or null if it is not a supported image. Decodes only a short prefix (cheap).
function sniffImageMime(b64) {
  let buf;
  try {
    buf = Buffer.from(b64.slice(0, 32), "base64");
  } catch {
    return null;
  }
  if (buf.length < 4) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "image/gif"; // GIF8
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // RIFF
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50 // WEBP
  ) {
    return "image/webp";
  }
  return null;
}

// Validate an optional attached image. Returns { ok, image } or { ok:false, error }.
export function normalizeImage(image) {
  if (image == null) return { ok: true, image: undefined };
  if (typeof image !== "object" || typeof image.data !== "string") {
    return { ok: false, error: "image must be an object with base64 string data." };
  }
  if (image.data.length > MAX_IMAGE_BASE64_CHARS) {
    return { ok: false, error: "Attached image is too large. Please use a smaller photo." };
  }
  // Reject anything that isn't real base64 before it's spliced into the data: URL
  // sent upstream (length-bounded above, so this regex is cheap).
  if (!BASE64_RE.test(image.data)) {
    return { ok: false, error: "Attached image is not valid base64 data." };
  }
  // A present mime must be on the allowlist...
  const { mime } = image;
  if (mime != null && !ALLOWED_IMAGE_MIME.has(mime)) {
    return { ok: false, error: "Unsupported image type. Use JPEG, PNG, WebP, or GIF." };
  }
  // ...and the actual bytes must be a real image whose signature matches the
  // declared mime (defeats arbitrary-bytes / forged-MIME payloads to the vision
  // model). The DETECTED mime is what we forward upstream.
  const detected = sniffImageMime(image.data);
  if (!detected) {
    return { ok: false, error: "Attached file is not a supported image (JPEG, PNG, WebP, or GIF)." };
  }
  if (mime != null && mime !== detected) {
    return { ok: false, error: "Image contents do not match the declared type." };
  }
  return { ok: true, image: { mime: detected, data: image.data } };
}

// Accepted difficulty bands (must match PRACTICE_GEN_SYS in lib/groq.js and
// DIFFICULTY_ANCHORS in lib/scoring.js). An unknown/missing value normalizes to
// "(unspecified)" so an arbitrary client string never reaches the prompt.
const ALLOWED_DIFFICULTY = new Set(["beginner", "foundational", "intermediate", "advanced", "phd"]);
export function normalizeDifficulty(d) {
  if (typeof d !== "string") return "(unspecified)";
  const key = d.trim().toLowerCase();
  return ALLOWED_DIFFICULTY.has(key) ? key : "(unspecified)";
}

// Coerce the model's weakConcepts to an array of <=8 short strings so the client
// can always safely .map/.slice it (a non-array would otherwise crash rendering).
export function normalizeWeakConcepts(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter((c) => typeof c === "string" && c.trim()).slice(0, 8).map((c) => c.slice(0, 200));
}

// Coerce the grader's strengths / improvements lists (post-grade feedback) to <=4
// short strings each, so the UI can always safely render them and a runaway model
// can't bloat the response / stored review.
export function normalizeFeedbackList(arr, max = 4, len = 600) {
  if (!Array.isArray(arr)) return [];
  return arr.filter((c) => typeof c === "string" && c.trim()).slice(0, max).map((c) => c.slice(0, len));
}

// Cap the post-grade worked solution. Bounded so a long solution can't bloat the
// response or the stored attempt_review row.
export const MAX_SOLUTION_CHARS = 4000;
export const capSolution = (s) => (typeof s === "string" ? s.slice(0, MAX_SOLUTION_CHARS) : "");
