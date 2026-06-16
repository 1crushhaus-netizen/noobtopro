import { describe, it, expect } from "vitest";
import { Webhook } from "standardwebhooks";

// ---------------------------------------------------------------------------
// P0-5: the REAL Polar webhook signature verifier. Every test in
// api-webhook-polar.test.js mocks verifyPolarWebhook, so a forgery or
// error-mapping bug in the actual verifier (the ONLY authentication on the
// entitlement WRITE path) could never surface. This suite imports the real
// module (no mock) and drives @polar-sh/sdk's validateEvent through it so a
// regression that accepts a forged signature, or stops mapping a verification
// failure to WebhookSignatureError, FAILS the build.
// ---------------------------------------------------------------------------
import { verifyPolarWebhook, WebhookSignatureError } from "@/lib/polarWebhook";

const SECRET = "whsec_test_secret_value";

// Reproduce exactly how Polar's validateEvent derives the signing key: it takes the
// secret string, base64-encodes the UTF-8 bytes, and hands THAT to standardwebhooks
// (which base64-decodes it back). Signing with the same derivation produces a signature
// the route's verifier will accept for the right secret — and reject for any tampering.
function signedHeaders(secret, payload, { msgId = "msg_1", date = new Date() } = {}) {
  const wh = new Webhook(Buffer.from(secret, "utf-8").toString("base64"));
  return {
    "webhook-id": msgId,
    "webhook-timestamp": String(Math.floor(date.getTime() / 1000)),
    "webhook-signature": wh.sign(msgId, date, payload),
  };
}

const PAYLOAD = JSON.stringify({ type: "subscription.active", data: { id: "sub_1" } });

describe("verifyPolarWebhook — real signature verification (P0-5)", () => {
  it("rejects a tampered signature with WebhookSignatureError", () => {
    const headers = signedHeaders(SECRET, PAYLOAD);
    headers["webhook-signature"] = "v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    expect(() => verifyPolarWebhook(PAYLOAD, headers, SECRET)).toThrow(WebhookSignatureError);
  });

  it("rejects a valid signature verified against the WRONG secret", () => {
    const headers = signedHeaders(SECRET, PAYLOAD);
    expect(() => verifyPolarWebhook(PAYLOAD, headers, "whsec_a_totally_different_secret")).toThrow(
      WebhookSignatureError
    );
  });

  it("rejects a body modified AFTER signing (the core forgery case)", () => {
    const headers = signedHeaders(SECRET, PAYLOAD);
    const forged = JSON.stringify({ type: "subscription.active", data: { id: "sub_FORGED" } });
    expect(() => verifyPolarWebhook(forged, headers, SECRET)).toThrow(WebhookSignatureError);
  });

  it("rejects a stale timestamp outside the tolerance window (replay defense)", () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000); // > 5-min Standard Webhooks tolerance
    const headers = signedHeaders(SECRET, PAYLOAD, { date: tenMinAgo });
    expect(() => verifyPolarWebhook(PAYLOAD, headers, SECRET)).toThrow(WebhookSignatureError);
  });

  it("rejects missing signature headers", () => {
    expect(() => verifyPolarWebhook(PAYLOAD, {}, SECRET)).toThrow(WebhookSignatureError);
  });

  it("ACCEPTS a correctly-signed payload (proves the HMAC actually runs — not a no-op verifier)", () => {
    const headers = signedHeaders(SECRET, PAYLOAD);
    let err;
    try {
      verifyPolarWebhook(PAYLOAD, headers, SECRET);
    } catch (e) {
      err = e;
    }
    // The signature stage passed. Any error reaching here is the SDK's downstream Zod
    // parse of our minimal stub event payload — NEVER a signature rejection. The point:
    // a valid signature is accepted, so the verifier isn't trivially always-throwing.
    expect(err).not.toBeInstanceOf(WebhookSignatureError);
  });
});
