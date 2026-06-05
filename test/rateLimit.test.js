import { describe, it, expect, beforeEach } from "vitest";
import {
  rateLimit,
  clientKey,
  _resetRateLimits,
  _rateLimitSize,
  MAX_TRACKED_KEYS,
} from "@/lib/rateLimit";

beforeEach(() => {
  _resetRateLimits();
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
