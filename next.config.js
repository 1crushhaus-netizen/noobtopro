/** @type {import('next').NextConfig} */

// Defense-in-depth security headers applied to every response. We deliberately
// omit a strict Content-Security-Policy for now: Next.js injects inline runtime
// scripts and the app uses inline style objects, so a correct CSP needs nonces
// and per-route testing — tracked as a follow-up. The headers below are safe and
// require no per-page changes.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
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
