// ---------------------------------------------------------------------------
// Content-Security-Policy builder (red-team Finding 5).
//
// The CSP used to live in next.config.js with `script-src 'self' 'unsafe-inline'`,
// because Next injects inline hydration/streaming scripts and the app ships one inline
// theme-init script. `'unsafe-inline'` means the CSP provides NO containment for an
// injected inline <script> — it only allow-lists connect/img/frame-ancestors.
//
// This builder produces a PER-REQUEST, NONCE-based policy instead: `script-src 'self'
// 'nonce-<n>' …`. When a nonce is present, browsers IGNORE `'unsafe-inline'`, so only
// scripts that carry the request's nonce (Next attaches it to its own inline scripts via
// `getScriptNonceFromHeader`; app/layout.js attaches it to the theme script) — or load
// from an allow-listed host — execute. An attacker-injected inline <script> has no valid
// nonce and is blocked. middleware.js mints the nonce and calls this; the value is also
// exported to tests so the locked-down directives stay under regression guard.
//
// NOTE: we deliberately do NOT use `'strict-dynamic'` — it makes browsers ignore host
// allow-lists, which would break the same-origin/host-loaded Vercel Speed Insights +
// Analytics scripts. Keeping explicit host sources + a nonce is the safe combination.
// style-src keeps 'unsafe-inline' (React inline style objects have no nonce path); that
// is a separate, lower-risk surface the audit did not flag.
// ---------------------------------------------------------------------------

// Pin connect-src to THIS project's Supabase host when the env is known, instead of a
// platform-wide *.supabase.co wildcard. Falls back to the wildcard when the env isn't set
// (e.g. CI/build with empty secrets, or tests), so the policy is never empty/broken.
function supabaseConnectSrc() {
  try {
    const h = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host;
    if (h) return `https://${h} wss://${h}`;
  } catch {
    /* unset/malformed → wildcard fallback below */
  }
  return "https://*.supabase.co wss://*.supabase.co";
}

/**
 * Build the Content-Security-Policy header value for one request.
 * @param {string} [nonce] base64 nonce for this request's inline scripts. When omitted
 *   (or empty) the script-src falls back to 'unsafe-inline' so a non-nonce context (e.g.
 *   a defensive caller that couldn't mint a nonce) still renders rather than white-screens.
 * @returns {string}
 */
export function buildContentSecurityPolicy(nonce) {
  // With a nonce, 'unsafe-inline' is ignored by the browser, so omit it. Without one,
  // keep 'unsafe-inline' as a safe fallback (no worse than the previous static policy).
  const scriptSrc = nonce
    ? `script-src 'self' 'nonce-${nonce}' https://va.vercel-scripts.com`
    : "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com";

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "upgrade-insecure-requests",
    "img-src 'self' data: blob: https://*.googleusercontent.com https://avatars.githubusercontent.com https://cdn.discordapp.com",
    "font-src 'self' https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    scriptSrc,
    `connect-src 'self' ${supabaseConnectSrc()} https://vitals.vercel-insights.com`,
  ].join("; ");
}
