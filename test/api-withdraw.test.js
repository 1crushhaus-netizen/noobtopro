import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// /api/account/withdraw — the EU "Withdraw from contract here" function (CRD Art. 11a).
// Distinct from "cancel": withdrawal terminates IMMEDIATELY and refunds the pro-rata
// remainder within the 14-day window. requireUser, the service-role client, and the Polar
// client are mocked at the boundary so we test the route's gating + money-movement logic.
// ---------------------------------------------------------------------------
const auth = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/adminAuth", () => ({ requireUser: (...a) => auth.requireUser(...a) }));

const storage = vi.hoisted(() => ({ getAdmin: vi.fn(() => null) }));
vi.mock("@/lib/supabaseAdmin", () => ({ getSupabaseAdmin: () => storage.getAdmin() }));

const polar = vi.hoisted(() => ({ getPolar: vi.fn(() => null) }));
vi.mock("@/lib/polar", () => ({ getPolar: (...a) => polar.getPolar(...a) }));

import { POST as withdrawPOST } from "@/app/api/account/withdraw/route";
import { _resetRateLimits } from "@/lib/rateLimit";

const DAY = 24 * 60 * 60 * 1000;
const iso = (ms) => new Date(ms).toISOString();

// Service-role client: subscriptions.maybeSingle()->subRow; billing_audit.maybeSingle()->
// consentRow; billing_audit.insert(row) captured. rpc errors so the durable rate limiter
// fails open to the in-memory limiter (allows within the cap).
function fakeAdmin({ subRow = null, subErr = null, consentRow = null } = {}, captured = []) {
  return {
    from(table) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (table === "subscriptions") return { data: subRow, error: subErr };
          if (table === "billing_audit") return { data: consentRow, error: null };
          return { data: null, error: null };
        },
        insert: async (row) => { captured.push({ table, row }); return { error: null }; },
      };
      return chain;
    },
    rpc: async () => ({ data: null, error: { message: "no durable limiter in test" } }),
  };
}

// Polar client: orders.list -> one page; subscriptions.revoke + refunds.create are spies.
function fakePolar({ orders = [], revoke, refundCreate } = {}) {
  return {
    orders: { list: async () => [{ result: { items: orders } }] },
    subscriptions: { revoke: revoke || vi.fn(async () => ({ id: "sub_1" })) },
    refunds: { create: refundCreate || vi.fn(async () => ({ id: "ref_1" })) },
  };
}

const req = (headers = {}) =>
  new Request("http://test.local/api/account/withdraw", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: "{}",
  });

// An active subscription within the window, with one paid order spanning a 30-day period
// that started 2 days ago (so ~28/30 of the price is refundable).
function activeFixtures(now) {
  const start = now - 2 * DAY;
  return {
    subRow: { status: "active", current_period_end: iso(start + 30 * DAY), polar_subscription_id: "sub_1" },
    consentRow: { created_at: iso(start) },
    order: { id: "ord_1", paid: true, netAmount: 999, refundableAmount: 999, createdAt: iso(start), currency: "eur" },
  };
}

beforeEach(() => {
  _resetRateLimits();
  auth.requireUser.mockReset();
  storage.getAdmin.mockReset().mockReturnValue(null);
  polar.getPolar.mockReset().mockReturnValue(null);
});

describe("POST /api/account/withdraw — EU 14-day withdrawal (CRD Art. 11a)", () => {
  it("403s a cross-site request before any auth work", async () => {
    expect((await withdrawPOST(req({ "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect(auth.requireUser).not.toHaveBeenCalled();
  });

  it("415s a non-JSON content type", async () => {
    expect((await withdrawPOST(req({ "Content-Type": "text/plain" }))).status).toBe(415);
  });

  it("401s a guest (no/invalid token)", async () => {
    auth.requireUser.mockResolvedValue({ error: "Authentication required.", status: 401 });
    expect((await withdrawPOST(req())).status).toBe(401);
  });

  it("503s when no service-role store or Polar client is configured", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    storage.getAdmin.mockReturnValue(null);
    polar.getPolar.mockReturnValue(null);
    expect((await withdrawPOST(req())).status).toBe(503);
  });

  it("409s when the caller has no active subscription", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    storage.getAdmin.mockReturnValue(fakeAdmin({ subRow: { status: "canceled", polar_subscription_id: "sub_1" } }));
    polar.getPolar.mockReturnValue(fakePolar());
    expect((await withdrawPOST(req())).status).toBe(409);
  });

  it("409s (window_closed) when the 14-day window has elapsed — and does NOT revoke", async () => {
    const now = Date.now();
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const revoke = vi.fn(async () => ({}));
    storage.getAdmin.mockReturnValue(
      fakeAdmin({
        subRow: { status: "active", current_period_end: iso(now + 10 * DAY), polar_subscription_id: "sub_1" },
        consentRow: { created_at: iso(now - 20 * DAY) }, // 20 days ago → closed
      })
    );
    polar.getPolar.mockReturnValue(fakePolar({ revoke }));
    const res = await withdrawPOST(req());
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("window_closed");
    expect(revoke).not.toHaveBeenCalled();
  });

  it("falls back to the FIRST paid order date as the window anchor when the consent row is missing (a checkout audit-write hiccup must not void the statutory right)", async () => {
    const now = Date.now();
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const revoke = vi.fn(async () => ({ id: "sub_1" }));
    const refundCreate = vi.fn(async () => ({ id: "ref_1" }));
    storage.getAdmin.mockReturnValue(
      fakeAdmin({
        subRow: { status: "active", current_period_end: iso(now + 28 * DAY), polar_subscription_id: "sub_1" },
        consentRow: null, // audit write failed at checkout → no consent anchor
      }, [])
    );
    const order = { id: "ord_1", paid: true, netAmount: 999, refundableAmount: 999, createdAt: iso(now - 2 * DAY), currency: "eur" };
    polar.getPolar.mockReturnValue(fakePolar({ orders: [order], revoke, refundCreate }));
    const res = await withdrawPOST(req());
    expect(res.status).toBe(200); // anchored on the order date (2 days ago) → still in-window
    expect(revoke).toHaveBeenCalledWith({ id: "sub_1" });
  });

  it("still closes the window via the order-date fallback when the consent row is missing AND the order is old", async () => {
    const now = Date.now();
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const revoke = vi.fn(async () => ({}));
    storage.getAdmin.mockReturnValue(
      fakeAdmin({
        subRow: { status: "active", current_period_end: iso(now + 10 * DAY), polar_subscription_id: "sub_1" },
        consentRow: null,
      })
    );
    const order = { id: "ord_1", paid: true, netAmount: 999, refundableAmount: 999, createdAt: iso(now - 20 * DAY), currency: "eur" };
    polar.getPolar.mockReturnValue(fakePolar({ orders: [order], revoke, refundCreate: vi.fn() }));
    const res = await withdrawPOST(req());
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("window_closed");
    expect(revoke).not.toHaveBeenCalled();
  });

  it("happy path: revokes immediately, issues the pro-rata refund, records the audit, returns the confirmation", async () => {
    const now = Date.now();
    const fx = activeFixtures(now);
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const captured = [];
    storage.getAdmin.mockReturnValue(fakeAdmin({ subRow: fx.subRow, consentRow: fx.consentRow }, captured));
    const revoke = vi.fn(async () => ({ id: "sub_1" }));
    const refundCreate = vi.fn(async () => ({ id: "ref_9" }));
    polar.getPolar.mockReturnValue(fakePolar({ orders: [fx.order], revoke, refundCreate }));

    const res = await withdrawPOST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, terminated: true });
    expect(typeof body.withdrawnAt).toBe("string");

    // Terminated immediately (revoke), then refunded the unused remainder of a 30-day period.
    expect(revoke).toHaveBeenCalledWith({ id: "sub_1" });
    expect(refundCreate).toHaveBeenCalledTimes(1);
    const refundArg = refundCreate.mock.calls[0][0];
    expect(refundArg).toMatchObject({ orderId: "ord_1", reason: "customer_request", revokeBenefits: false });
    expect(refundArg.amount).toBeGreaterThan(900); // ~28/30 of 999
    expect(refundArg.amount).toBeLessThanOrEqual(999);
    expect(body.refund.status).toBe("issued");
    expect(body.refund.amountMinor).toBe(refundArg.amount);

    // Durable audit row written.
    const audit = captured.find((c) => c.row.kind === "withdrawal");
    expect(audit).toBeTruthy();
    expect(audit.row).toMatchObject({ user_id: "u1", kind: "withdrawal" });
    expect(audit.row.detail.polarSubscriptionId).toBe("sub_1");
  });

  it("a refund-API failure does NOT undo the termination — withdrawal still succeeds, refund pending", async () => {
    const now = Date.now();
    const fx = activeFixtures(now);
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const captured = [];
    storage.getAdmin.mockReturnValue(fakeAdmin({ subRow: fx.subRow, consentRow: fx.consentRow }, captured));
    const revoke = vi.fn(async () => ({ id: "sub_1" }));
    const refundCreate = vi.fn(async () => { throw new Error("polar refund 500"); });
    polar.getPolar.mockReturnValue(fakePolar({ orders: [fx.order], revoke, refundCreate }));

    const res = await withdrawPOST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.terminated).toBe(true); // the subscription WAS revoked
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(body.refund.status).toBe("pending_manual"); // flagged for manual follow-up
    expect(captured.some((c) => c.row.kind === "withdrawal")).toBe(true);
  });

  it("502s and does NOT refund when the immediate revoke fails", async () => {
    const now = Date.now();
    const fx = activeFixtures(now);
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    storage.getAdmin.mockReturnValue(fakeAdmin({ subRow: fx.subRow, consentRow: fx.consentRow }));
    const revoke = vi.fn(async () => { throw new Error("polar revoke 500"); });
    const refundCreate = vi.fn(async () => ({ id: "ref_x" }));
    polar.getPolar.mockReturnValue(fakePolar({ orders: [fx.order], revoke, refundCreate }));

    const res = await withdrawPOST(req());
    expect(res.status).toBe(502);
    expect(refundCreate).not.toHaveBeenCalled(); // never refund a sub we couldn't terminate
  });
});

describe("POST /api/account/withdraw — Art 11a acknowledgement", () => {
  it("returns the durable-medium acknowledgement text in the response", async () => {
    const now = Date.now();
    const fx = activeFixtures(now);
    auth.requireUser.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    storage.getAdmin.mockReturnValue(fakeAdmin({ subRow: fx.subRow, consentRow: fx.consentRow }, []));
    polar.getPolar.mockReturnValue(fakePolar({ orders: [fx.order], revoke: vi.fn(async () => ({ id: "sub_1" })), refundCreate: vi.fn(async () => ({ id: "ref_9" })) }));
    const res = await withdrawPOST(req());
    const body = await res.json();
    expect(typeof body.acknowledgement).toBe("string");
    expect(body.acknowledgement).toContain("Acknowledgement of withdrawal");
    expect(body.acknowledgement).toMatch(/Art\.?\s*11a/);
  });
});
