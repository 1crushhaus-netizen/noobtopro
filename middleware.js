// ---------------------------------------------------------------------------
// Per-request nonce + Content-Security-Policy (red-team Finding 5).
//
// Mints a fresh nonce per request and emits a nonce-based CSP (lib/csp.js), replacing the
// old static `script-src 'unsafe-inline'`. The nonce is set on BOTH:
//   - the REQUEST headers (content-security-policy + x-nonce): Next reads the nonce from the
//     request CSP via getScriptNonceFromHeader and stamps it onto its own inline hydration/
//     streaming scripts; app/layout.js reads x-nonce to stamp the inline theme-init script.
//   - the RESPONSE header (Content-Security-Policy): what the browser actually enforces.
//
// The OTHER security headers (X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy,
// X-Content-Type-Options, X-DNS-Prefetch-Control) remain static in next.config.js — only the
// CSP needs to be per-request, so only it moved here.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { buildContentSecurityPolicy } from "@/lib/csp";

export function middleware(request) {
  // 16 random bytes, base64 — a fresh, unpredictable nonce per request.
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
  const csp = buildContentSecurityPolicy(nonce);

  // Make the nonce visible to the renderer: Next derives the script nonce from the request's
  // content-security-policy header; layout reads x-nonce for its own inline script.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  // Enforce it on the response the browser receives.
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Run on documents + API routes; skip Next's static internals and the static asset files
  // (they neither execute inline scripts nor need a per-request nonce, and skipping keeps
  // the middleware off the hot static path). Prefetch requests are excluded so a prefetch
  // can't be served a stale nonce.
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
