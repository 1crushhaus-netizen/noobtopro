/** @type {import('next').NextConfig} */

// Baseline Content-Security-Policy. This is a defense-in-depth allow-list, not a
// strictly nonce-based policy: Next.js injects inline hydration/streaming scripts
// and the app sets inline style objects, so script-src/style-src keep
// 'unsafe-inline' (a nonce-based script-src via middleware is the documented next
// step). What it DOES lock down meaningfully: object-src 'none', base-uri 'self',
// form-action 'self', frame-ancestors 'none' (defeats clickjacking even where
// X-Frame-Options can't), and tight default/connect/img/font/style source lists.
// Origins allow-listed for actual app dependencies:
//   - style/font: Google Fonts (@import in app/globals.css)
//   - connect: Supabase (REST/auth) + Vercel Speed Insights beacon
//   - img: data:/blob: (diagnostic photo previews) + https: (OAuth avatars)
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com",
].join("; ");

// Defense-in-depth security headers applied to every response.
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // DENY (not SAMEORIGIN) to match the CSP's `frame-ancestors 'none'` on every
  // browser: the app is never framed (OAuth is a full-page redirect, no self-frames),
  // so a modern browser honoring frame-ancestors and a legacy browser honoring only
  // X-Frame-Options should agree on "no framing at all".
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
