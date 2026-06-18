// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

// Focused coverage for the EU-withdrawal data layer: loadSubscription's withdrawal-window
// computation (from the latest recorded consent) and withdrawFromContract's server call.
// A tailored Supabase mock (the shared store.test.js builder has no maybeSingle).
const mocks = vi.hoisted(() => ({ session: null, db: {} }));
vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: true,
  getSupabase: () => ({
    auth: { getSession: async () => mocks.session },
    from: (table) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () =>
          table === "subscriptions"
            ? mocks.db.sub ?? { data: null, error: null }
            : mocks.db.consent ?? { data: null, error: null },
      };
      return chain;
    },
  }),
}));

import { loadSubscription, withdrawFromContract } from "@/lib/store";
import { WITHDRAWAL_WINDOW_DAYS } from "@/lib/consent";

const DAY = 24 * 60 * 60 * 1000;
const signedIn = { data: { session: { user: { id: "u1" }, access_token: "tok-1" } } };

beforeEach(() => {
  mocks.session = signedIn;
  mocks.db = {};
  vi.unstubAllGlobals();
});

describe("loadSubscription (+ 14-day withdrawal window)", () => {
  it("returns the subscription and a withdrawalUntil 14 days after the latest consent", async () => {
    const consentAt = new Date(Date.now() - 2 * DAY).toISOString();
    mocks.db.sub = { data: { status: "active", current_period_end: null }, error: null };
    mocks.db.consent = { data: { created_at: consentAt }, error: null };
    const res = await loadSubscription();
    expect(res.subscription.status).toBe("active");
    const expected = new Date(new Date(consentAt).getTime() + WITHDRAWAL_WINDOW_DAYS * DAY).toISOString();
    expect(res.withdrawalUntil).toBe(expected);
  });

  it("withdrawalUntil is null when there is no recorded consent (e.g. a grandfathered sub)", async () => {
    mocks.db.sub = { data: { status: "active" }, error: null };
    mocks.db.consent = { data: null, error: null };
    const res = await loadSubscription();
    expect(res.subscription.status).toBe("active");
    expect(res.withdrawalUntil).toBe(null);
  });

  it("guest → no subscription and no window", async () => {
    mocks.session = { data: { session: null } };
    expect(await loadSubscription()).toEqual({ subscription: null, withdrawalUntil: null });
  });
});

describe("withdrawFromContract", () => {
  it("POSTs /api/account/withdraw with the bearer token and returns the confirmation", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, withdrawnAt: "2026-06-18T00:00:00Z", refund: { status: "issued", amountMinor: 900, currency: "eur" } }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await withdrawFromContract();
    expect(res).toMatchObject({ ok: true, refund: { status: "issued", amountMinor: 900 } });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/withdraw",
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer tok-1" }) })
    );
  });

  it("throws the server's message on a non-OK response (e.g. the window has closed)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 409, json: async () => ({ error: "Your 14-day withdrawal period has ended." }) }))
    );
    await expect(withdrawFromContract()).rejects.toThrow(/14-day withdrawal period/i);
  });
});
