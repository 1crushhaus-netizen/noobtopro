// ---------------------------------------------------------------------------
// Same-origin + content-type gate for the cost-incurring, state-changing API
// routes (/api/generate, /api/grade). These routes are unauthenticated and
// trigger paid Groq calls, so a malicious page can try to drive them from
// victims' browsers (forced cross-site requests = CSRF-style cost/quota DoS).
//
// Defense:
//  1) `Sec-Fetch-Site`: browsers ALWAYS attach this on requests and web content
//     cannot forge it. A genuine in-app call is 'same-origin'; a direct
//     navigation / non-browser client omits it ('none'/absent). Anything else
//     ('cross-site' / 'same-site') is a foreign page driving the request -> block.
//     (We deliberately do NOT compare the Origin header to a request-derived
//     origin: behind a CDN/proxy that comparison can misfire and reject legit
//     traffic. Sec-Fetch-Site is the reliable signal.)
//  2) Require Content-Type: application/json. The legitimate client always sends
//     it; requiring it removes the CORS "simple request" (text/plain) bypass, so
//     a cross-site POST needs a preflight that this app never grants.
//
// This is defense-in-depth on top of the rate limiter — not a substitute for a
// durable, per-account limiter (see README §17).
// ---------------------------------------------------------------------------

// True when the request is a foreign-origin (cross-site/same-site) browser
// request that should be rejected. Same-origin, direct-nav ('none'), and
// non-browser (header absent) requests are allowed.
export function isCrossSiteRequest(req) {
  const sfs = (req.headers.get("sec-fetch-site") || "").toLowerCase();
  return sfs !== "" && sfs !== "same-origin" && sfs !== "none";
}

// True when the body is not declared as JSON (the only content type the client
// sends, and the only one these routes consume).
export function isWrongContentType(req) {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  return !ct.includes("application/json");
}

// ---------------------------------------------------------------------------
// Hard request-body byte ceilings, enforced BEFORE the body is buffered/parsed so
// an oversized payload can't exhaust function memory ahead of the per-field caps
// (which only run AFTER the whole body is already in memory). Next.js 15 App-Router
// route handlers apply NO body-size limit of their own, so this is the gate.
//
//  - IMAGE routes (/api/grade, /api/score) allow a ~4 MB base64 photo + JSON
//    envelope (and, for a multi-photo diagnostic, several of them), so the ceiling
//    is generous; the precise per-image cap still lives in lib/gradeInput.js.
//  - TEXT routes (/api/generate, /api/leaderboard) carry only small
//    JSON, so they get a much tighter ceiling.
// ---------------------------------------------------------------------------
export const MAX_BODY_BYTES_IMAGE = 10_000_000; // grade/score (photo-bearing)
export const MAX_BODY_BYTES_TEXT = 64_000; // generate/learn/leaderboard

function bodyTooLarge() {
  const e = new Error("Request body too large");
  e.code = "BODY_TOO_LARGE";
  return e;
}

// Cheap pre-check on the DECLARED Content-Length. Advisory/spoofable, so it's a
// fast reject for honest oversized requests; readJsonLimited re-checks the real bytes.
export function isBodyTooLarge(req, maxBytes = MAX_BODY_BYTES_IMAGE) {
  const len = Number(req.headers.get("content-length"));
  return Number.isFinite(len) && len > maxBytes;
}

// Read and JSON-parse a request body with a HARD byte ceiling, streaming the body
// and aborting as soon as the cap is crossed so at most `maxBytes` is ever buffered
// (Content-Length can be absent or spoofed, so we can't trust it alone).
//   - throws an error with .code === "BODY_TOO_LARGE" when the body exceeds maxBytes
//     (caller → 413),
//   - throws a SyntaxError on invalid JSON (caller → 400).
export async function readJsonLimited(req, maxBytes = MAX_BODY_BYTES_IMAGE) {
  if (isBodyTooLarge(req, maxBytes)) throw bodyTooLarge();

  const reader = req.body && typeof req.body.getReader === "function" ? req.body.getReader() : null;
  let bytes;
  if (reader) {
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        try { await reader.cancel(); } catch { /* best-effort */ }
        throw bodyTooLarge();
      }
      chunks.push(value);
    }
    bytes = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { bytes.set(c, off); off += c.byteLength; }
  } else {
    // No readable stream available (some runtimes/tests) — fall back to a single
    // buffered read, then enforce the cap on the materialized bytes.
    const buf = await req.arrayBuffer();
    if (buf.byteLength > maxBytes) throw bodyTooLarge();
    bytes = new Uint8Array(buf);
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
