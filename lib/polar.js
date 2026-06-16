// ---------------------------------------------------------------------------
// Server-only Polar.sh client + config (the paid "Pro" tier — monetization).
//
// Centralizes the Polar SDK construction and the POLAR_* env reads so the checkout,
// webhook, and customer-portal routes share ONE configured client and ONE source of
// truth for "is Polar wired up?".
//
// DENY-BY-DEFAULT: with no POLAR_ACCESS_TOKEN (local/dev/CI/tests), getPolar() returns
// null and the checkout/portal routes 503 — nothing breaks, everyone stays Free. Build
// against POLAR_SERVER=sandbox first; flip to "production" only after the full
// purchase -> webhook -> entitlement loop verifies. See MONETIZATION_PLAN.md.
//
// Server-only: reads secrets (POLAR_ACCESS_TOKEN / POLAR_WEBHOOK_SECRET, no
// NEXT_PUBLIC_ prefix). Never import from a client component.
// ---------------------------------------------------------------------------

import { Polar } from "@polar-sh/sdk";

// "sandbox" (default while building) or "production". Anything other than the exact
// string "production" is treated as sandbox so a typo can never accidentally point a
// build at the live Polar org.
export function polarServer() {
  return process.env.POLAR_SERVER === "production" ? "production" : "sandbox";
}

let _polar = null;

// The configured Polar API client, or null when no access token is set (deny-by-default).
// Read env lazily (not at module load) so the client always reflects the current env and
// tests can toggle it.
export function getPolar() {
  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) return null;
  if (!_polar) {
    _polar = new Polar({ accessToken, server: polarServer() });
  }
  return _polar;
}

// The Pro product's Polar ID (Polar -> Products -> Pro). Null when unset (checkout 503s).
export function proProductId() {
  const id = process.env.POLAR_PRODUCT_ID_PRO;
  return id && id.trim() ? id.trim() : null;
}

// Is the paid Pro tier actually SELLABLE right now (token + product configured)? The
// monetization GATES (free daily practice cap, photo-of-work grading) only bite when this
// is true — so a deployment without Polar configured never caps its free users with no
// upgrade path (everything works as it does today until the owner flips POLAR_* on). The
// browser mirrors this with NEXT_PUBLIC_PRO_ENABLED (it can't read these server secrets).
export function proIsAvailable() {
  return Boolean(getPolar() && proProductId());
}

// The absolute URL Polar redirects to after a successful checkout. Prefer the explicit
// POLAR_SUCCESS_URL; otherwise derive `${origin}/?checkout=success` from the request so a
// preview/branch deploy still round-trips without a per-environment env var. `origin` is
// the request's own origin (never client-body-supplied), so this can't be pointed elsewhere.
export function successUrl(origin) {
  const env = process.env.POLAR_SUCCESS_URL;
  // Validate the operator-set env (audit 01/02 P2-3): only accept a well-formed absolute
  // http(s) URL, so a typo'd/garbage value falls back to the safe origin-derived URL instead
  // of being handed to Polar verbatim as a redirect target.
  if (env && env.trim()) {
    try {
      const u = new URL(env.trim());
      if (u.protocol === "https:" || u.protocol === "http:") return u.toString();
    } catch {
      /* malformed — fall through to the origin-derived URL */
    }
  }
  if (origin) return `${origin.replace(/\/$/, "")}/?checkout=success`;
  return undefined; // let the SDK fall back to the product's configured URL
}

// Test-only: drop the cached client so a test can swap env.
export function _resetPolar() {
  _polar = null;
}
