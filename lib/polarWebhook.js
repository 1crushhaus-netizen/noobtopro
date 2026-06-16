// ---------------------------------------------------------------------------
// Thin, testable wrapper over Polar.sh's Standard-Webhooks signature verification.
//
// The webhook route depends on THIS module (not @polar-sh/sdk/webhooks directly) so the
// SDK is imported in exactly one place and the route stays unit-testable by mocking this
// small surface. Returns the parsed event on a valid signature; throws
// WebhookSignatureError on an invalid one, so the route maps a bad signature to 403
// without coupling to the SDK's own error class.
//
// Server-only: reads the raw request body + headers + the signing secret.
// ---------------------------------------------------------------------------

import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";

export class WebhookSignatureError extends Error {}

export function verifyPolarWebhook(body, headers, secret) {
  try {
    return validateEvent(body, headers, secret);
  } catch (e) {
    if (e instanceof WebhookVerificationError) throw new WebhookSignatureError(e.message || "invalid signature");
    throw e;
  }
}
