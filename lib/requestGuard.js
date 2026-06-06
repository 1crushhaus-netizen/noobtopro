// ---------------------------------------------------------------------------
// Same-origin + content-type gate for the cost-incurring, state-changing API
// routes (/api/generate, /api/grade, /api/learn). These routes are
// unauthenticated and trigger paid Groq calls + writes to the shared concept hub,
// so a malicious page can try to drive them from victims' browsers (forced
// cross-site requests = CSRF-style cost/quota DoS + catalog flooding).
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
