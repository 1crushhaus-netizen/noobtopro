import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the Supabase client so the DURABLE path can be tested without a real DB.
// createClient returns a fake whose rpc() each test configures.
const supa = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ rpc: (...a) => supa.rpc(...a) }),
}));

import {
  rateLimit,
  clientKey,
  checkRateLimit,
  chargeGlobalGroq,
  refundGlobalGroq,
  _resetRateLimits,
  _resetRateLimitClient,
  _rateLimitSize,
  MAX_TRACKED_KEYS,
} from "@/lib/rateLimit";

const SAVED = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
beforeEach(() => {
  _resetRateLimits();
  _resetRateLimitClient();
  supa.rpc.mockReset();
  // Default: no service-role store -> checkRateLimit falls back to in-memory.
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});
afterEach(() => {
  if (SAVED.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = SAVED.url;
  if (SAVED.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = SAVED.key;
});

describe("rateLimit", () => {
  it("allows up to `max` requests in a window, then blocks", () => {
    const opts = { max: 3, windowMs: 1000, now: 1000 };
    expect(rateLimit("a", opts).ok).toBe(true); // 1
    expect(rateLimit("a", opts).ok).toBe(true); // 2
    const third = rateLimit("a", opts); // 3
    expect(third.ok).toBe(true);
    expect(third.remaining).toBe(0);
    const fourth = rateLimit("a", opts); // 4 -> blocked
    expect(fourth.ok).toBe(false);
    expect(fourth.retryAfter).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    const base = { max: 2, windowMs: 1000 };
    rateLimit("b", { ...base, now: 0 });
    rateLimit("b", { ...base, now: 0 });
    expect(rateLimit("b", { ...base, now: 500 }).ok).toBe(false); // still in window
    expect(rateLimit("b", { ...base, now: 1000 }).ok).toBe(true); // window rolled over
  });

  it("tracks keys independently", () => {
    const opts = { max: 1, windowMs: 1000, now: 0 };
    expect(rateLimit("x", opts).ok).toBe(true);
    expect(rateLimit("x", opts).ok).toBe(false);
    expect(rateLimit("y", opts).ok).toBe(true); // different key unaffected
  });

  it("reports a retryAfter in whole seconds", () => {
    const opts = { max: 1, windowMs: 10_000, now: 0 };
    rateLimit("z", opts);
    const blocked = rateLimit("z", { ...opts, now: 2500 });
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBe(8); // ceil((10000-2500)/1000)
  });

  it("keeps the tracked-key Map bounded under a distinct-key flood (one window)", () => {
    // All keys live in the SAME window, so expired-only pruning frees nothing —
    // this exercises the hard eviction path, not prune().
    const n = MAX_TRACKED_KEYS + 2_000;
    for (let i = 0; i < n; i++) rateLimit(`flood-${i}`, { now: 1000 });
    expect(_rateLimitSize()).toBeLessThanOrEqual(MAX_TRACKED_KEYS);
    expect(_rateLimitSize()).toBeGreaterThan(0);
  });
});

describe("checkRateLimit (durable, with in-memory fallback)", () => {
  it("falls back to the in-memory limiter when no service-role store is configured", async () => {
    // No SUPABASE_SERVICE_ROLE_KEY -> never calls the RPC; behaves like rateLimit().
    const opts = { max: 1, windowMs: 1000, now: 0 };
    expect((await checkRateLimit("k", opts)).ok).toBe(true);
    expect((await checkRateLimit("k", opts)).ok).toBe(false); // in-memory accumulated
    expect(supa.rpc).not.toHaveBeenCalled();
  });

  it("uses the durable rate_limit_hit RPC when the service-role store is configured", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
    _resetRateLimitClient();
    supa.rpc.mockResolvedValue({ data: { allowed: false, remaining: 0, retry_after: 7 }, error: null });

    const res = await checkRateLimit("acct:u1:practice", { max: 45, windowMs: 60_000 });
    expect(res).toMatchObject({ ok: false, retryAfter: 7, durable: true });
    expect(supa.rpc).toHaveBeenCalledWith("rate_limit_hit", {
      p_bucket: "acct:u1:practice",
      p_max: 45,
      p_window_seconds: 60,
    });
  });

  it("falls back to in-memory when the durable RPC errors (still protected)", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
    _resetRateLimitClient();
    supa.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    const opts = { max: 1, windowMs: 1000, now: 0 };
    expect((await checkRateLimit("k", opts)).ok).toBe(true); // first -> in-memory allows
    expect((await checkRateLimit("k", opts)).ok).toBe(false); // second -> in-memory blocks
  });
});

describe("refundGlobalGroq (budget refund on grade failure — audit P2-2)", () => {
  // Drive the GLOBAL groq budget to its (small) cap, then prove a refund frees a slot.
  // No service-role store -> the in-memory global:groq bucket is the budget.
  it("refunds a charged Groq token so an outage doesn't keep the slot consumed", async () => {
    const SMALL = 2;
    process.env.GLOBAL_GROQ_BUDGET_PER_MIN = String(SMALL);
    try {
      // Two charges exhaust the window; a third is denied.
      expect((await chargeGlobalGroq(1)).ok).toBe(true);
      expect((await chargeGlobalGroq(1)).ok).toBe(true);
      expect((await chargeGlobalGroq(1)).ok).toBe(false); // window exhausted

      // The second charge represents a grade that FAILED upstream — refund it.
      await refundGlobalGroq(1);

      // The freed slot is available again (the refund decremented, floored at 0).
      expect((await chargeGlobalGroq(1)).ok).toBe(true);
    } finally {
      delete process.env.GLOBAL_GROQ_BUDGET_PER_MIN;
    }
  });

  it("floors at 0 — over-refunding can't lend extra budget", async () => {
    const SMALL = 1;
    process.env.GLOBAL_GROQ_BUDGET_PER_MIN = String(SMALL);
    try {
      expect((await chargeGlobalGroq(1)).ok).toBe(true);
      // Refund far more than was charged: the count floors at 0, never negative.
      await refundGlobalGroq(10);
      // Exactly ONE slot is available again (not 10) — the cap still binds at SMALL.
      expect((await chargeGlobalGroq(1)).ok).toBe(true);
      expect((await chargeGlobalGroq(1)).ok).toBe(false);
    } finally {
      delete process.env.GLOBAL_GROQ_BUDGET_PER_MIN;
    }
  });

  it("refunds the durable counter via the rate_limit_refund RPC when configured", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
    _resetRateLimitClient();
    supa.rpc.mockResolvedValue({ data: null, error: null });
    await refundGlobalGroq(1, { img: 1 });
    expect(supa.rpc).toHaveBeenCalledWith("rate_limit_refund", { p_bucket: "global:groq", p_n: 1 });
    expect(supa.rpc).toHaveBeenCalledWith("rate_limit_refund", { p_bucket: "global:img", p_n: 1 });
  });
});

describe("clientKey", () => {
  const make = (headers) => ({ headers: { get: (h) => headers[h] ?? null } });

  it("prefers x-real-ip", () => {
    expect(clientKey(make({ "x-real-ip": "1.2.3.4" }))).toBe("1.2.3.4");
  });

  it("falls back to the first x-forwarded-for hop", () => {
    expect(clientKey(make({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
  });

  it("returns 'unknown' when no IP header is present", () => {
    expect(clientKey(make({}))).toBe("unknown");
  });
});
