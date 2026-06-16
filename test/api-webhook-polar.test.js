import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// /api/webhooks/polar — the entitlement WRITE path. The signature verdict
// (validateEvent) and the service-role store (getSupabaseAdmin) are mocked so we test
// the route's mapping + status logic: verify → resolve user → upsert_subscription.
// ---------------------------------------------------------------------------
const hooks = vi.hoisted(() => {
  class WebhookSignatureError extends Error {}
  return { verify: vi.fn(), WebhookSignatureError };
});
vi.mock("@/lib/polarWebhook", () => ({
  verifyPolarWebhook: (...a) => hooks.verify(...a),
  WebhookSignatureError: hooks.WebhookSignatureError,
}));

const admin = vi.hoisted(() => ({ getAdmin: vi.fn(() => null) }));
vi.mock("@/lib/supabaseAdmin", () => ({ getSupabaseAdmin: () => admin.getAdmin() }));

import { POST as webhookPOST } from "@/app/api/webhooks/polar/route";
const WebhookSignatureError = hooks.WebhookSignatureError;

const OLD = process.env.POLAR_WEBHOOK_SECRET;
beforeEach(() => {
  hooks.verify.mockReset();
  admin.getAdmin.mockReset().mockReturnValue(null);
  process.env.POLAR_WEBHOOK_SECRET = "whsec_test";
});
afterEach(() => {
  if (OLD === undefined) delete process.env.POLAR_WEBHOOK_SECRET;
  else process.env.POLAR_WEBHOOK_SECRET = OLD;
});

function hookReq(raw = "{}") {
  return new Request("http://test.local/api/webhooks/polar", {
    method: "POST",
    headers: { "webhook-id": "1", "webhook-timestamp": "1", "webhook-signature": "v1,x" },
    body: raw,
  });
}

describe("POST /api/webhooks/polar", () => {
  it("503s when no webhook secret is configured", async () => {
    delete process.env.POLAR_WEBHOOK_SECRET;
    expect((await webhookPOST(hookReq())).status).toBe(503);
  });

  it("403s an invalid signature", async () => {
    hooks.verify.mockImplementation(() => { throw new WebhookSignatureError("bad sig"); });
    expect((await webhookPOST(hookReq())).status).toBe(403);
  });

  it("202s (ignored) a non-subscription event without touching the store", async () => {
    hooks.verify.mockReturnValue({ type: "order.created", data: { id: "ord_1" } });
    const res = await webhookPOST(hookReq());
    expect(res.status).toBe(202);
    expect(admin.getAdmin).not.toHaveBeenCalled();
  });

  it("upserts the entitlement for the mapped user on subscription.active", async () => {
    hooks.verify.mockReturnValue({
      type: "subscription.active",
      data: {
        id: "sub_1", status: "active", productId: "prod_pro", customerId: "cus_1",
        currentPeriodEnd: new Date("2026-12-31T00:00:00Z"), cancelAtPeriodEnd: false,
        customer: { externalId: "u1", email: "a@b.com" },
      },
    });
    const rpc = vi.fn(async () => ({ error: null }));
    admin.getAdmin.mockReturnValue({ rpc });
    const res = await webhookPOST(hookReq());
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("upsert_subscription", expect.objectContaining({
      p_user: "u1",
      p_status: "active",
      p_product_id: "prod_pro",
      p_polar_customer_id: "cus_1",
      p_polar_subscription_id: "sub_1",
      p_current_period_end: "2026-12-31T00:00:00.000Z",
      p_cancel_at_period_end: false,
    }));
  });

  it("forwards the event's modified time as p_event_modified_at (ordering guard input)", async () => {
    hooks.verify.mockReturnValue({
      type: "subscription.updated",
      data: {
        id: "sub_1", status: "active", productId: "prod_pro", customerId: "cus_1",
        currentPeriodEnd: new Date("2026-12-31T00:00:00Z"),
        modifiedAt: new Date("2026-06-10T12:00:00Z"),
        cancelAtPeriodEnd: false, customer: { externalId: "u1" },
      },
    });
    const rpc = vi.fn(async () => ({ error: null }));
    admin.getAdmin.mockReturnValue({ rpc });
    expect((await webhookPOST(hookReq())).status).toBe(200);
    expect(rpc.mock.calls[0][1].p_event_modified_at).toBe("2026-06-10T12:00:00.000Z");
  });

  it("falls back to metadata.user_id when there is no customer external id", async () => {
    hooks.verify.mockReturnValue({
      type: "subscription.updated",
      data: { id: "sub_1", status: "canceled", customer: {}, metadata: { user_id: "u9" } },
    });
    const rpc = vi.fn(async () => ({ error: null }));
    admin.getAdmin.mockReturnValue({ rpc });
    const res = await webhookPOST(hookReq());
    expect(res.status).toBe(200);
    expect(rpc.mock.calls[0][1].p_user).toBe("u9");
    expect(rpc.mock.calls[0][1].p_status).toBe("canceled");
  });

  it("202s (skips) a subscription event with no resolvable user", async () => {
    hooks.verify.mockReturnValue({ type: "subscription.active", data: { id: "sub_1", customer: {} } });
    admin.getAdmin.mockReturnValue({ rpc: vi.fn() });
    expect((await webhookPOST(hookReq())).status).toBe(202);
  });

  it("500s (so Polar retries) when the upsert RPC errors", async () => {
    hooks.verify.mockReturnValue({
      type: "subscription.active",
      data: { id: "sub_1", status: "active", customer: { externalId: "u1" } },
    });
    admin.getAdmin.mockReturnValue({ rpc: vi.fn(async () => ({ error: { message: "db down" } })) });
    expect((await webhookPOST(hookReq())).status).toBe(500);
  });

  it("500s (so Polar retries) when the service-role store is unavailable", async () => {
    hooks.verify.mockReturnValue({
      type: "subscription.active",
      data: { id: "sub_1", status: "active", customer: { externalId: "u1" } },
    });
    admin.getAdmin.mockReturnValue(null);
    expect((await webhookPOST(hookReq())).status).toBe(500);
  });
});
