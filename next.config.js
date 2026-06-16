/** @type {import('next').NextConfig} */

// The Content-Security-Policy is now emitted PER-REQUEST with a fresh nonce by
// middleware.js (red-team Finding 5: a nonce-based script-src that drops 'unsafe-inline',
// so an injected inline <script> is blocked). It can't be a static next.config header and
// carry a per-request nonce, so it lives in the middleware; the directive list itself is in
// lib/csp.js (shared with the headers regression test). The OTHER security headers below are
// request-independent, so they stay here and apply to every response (incl. static assets the
// middleware matcher skips).

// Defense-in-depth security headers applied to every response.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // DENY (not SAMEORIGIN) to match the CSP's `frame-ancestors 'none'` on every
  // browser: the app is never framed (OAuth is a full-page redirect, no self-frames),
  // so a modern browser honoring frame-ancestors and a legacy browser honoring only
  // X-Frame-Options should agree on "no framing at all".
  { key: "X-Frame-Options", value: "DENY" },
  // Origin isolation (Lighthouse "Trust & Safety"): put each document in its own
  // browsing-context group so a cross-origin window can't reach it via window.opener
  // (a side-channel for XS-Leaks / Spectre-style attacks). Safe at `same-origin`
  // because the app NEVER opens popups — Google OAuth and Polar checkout are both
  // full-page top-level redirects (window.location), which COOP does not affect — so
  // there is no opener/openee relationship to sever. (COEP is intentionally NOT set:
  // require-corp would block the cross-origin Google avatar images the app loads.)
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Deny every powerful feature the app never uses (it only renders text + reads an
  // optional uploaded photo, which does NOT need the camera API). Shrinks the browser
  // attack surface a compromised script could reach.
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=(), hid=(), midi=(), magnetometer=(), gyroscope=(), accelerometer=(), browsing-topics=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework/version in an `X-Powered-By` response header
  // (defense-in-depth: removes a free fingerprinting signal for attackers).
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
