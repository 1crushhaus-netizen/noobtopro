import { describe, it, expect } from "vitest";
import {
  WITHDRAWAL_WINDOW_DAYS,
  withdrawalWindowEnd,
  isWithinWithdrawalWindow,
  proRataRefundMinor,
} from "@/lib/consent";

const DAY = 24 * 60 * 60 * 1000;

describe("withdrawalWindowEnd", () => {
  it("is the anchor + 14 days", () => {
    const start = new Date("2026-06-01T00:00:00Z");
    expect(withdrawalWindowEnd(start).toISOString()).toBe(new Date(start.getTime() + WITHDRAWAL_WINDOW_DAYS * DAY).toISOString());
  });
  it("accepts an ISO string anchor", () => {
    expect(withdrawalWindowEnd("2026-06-01T00:00:00Z").toISOString()).toBe("2026-06-15T00:00:00.000Z");
  });
  it("returns null for a missing/garbage anchor", () => {
    expect(withdrawalWindowEnd(null)).toBe(null);
    expect(withdrawalWindowEnd("not-a-date")).toBe(null);
  });
});

describe("isWithinWithdrawalWindow", () => {
  const anchor = "2026-06-01T00:00:00Z";
  it("is true on day 1 and at the 14-day boundary", () => {
    expect(isWithinWithdrawalWindow(anchor, new Date("2026-06-01T12:00:00Z"))).toBe(true);
    expect(isWithinWithdrawalWindow(anchor, new Date("2026-06-15T00:00:00Z"))).toBe(true);
  });
  it("is false just past the window", () => {
    expect(isWithinWithdrawalWindow(anchor, new Date("2026-06-15T00:00:01Z"))).toBe(false);
  });
  it("is false with no anchor (e.g. a grandfathered subscription with no recorded consent)", () => {
    expect(isWithinWithdrawalWindow(null, new Date("2026-06-02T00:00:00Z"))).toBe(false);
  });
});

describe("proRataRefundMinor (Art. 14(3) — pay only for the part used)", () => {
  const start = new Date("2026-06-01T00:00:00Z");
  const end = new Date("2026-07-01T00:00:00Z"); // a 30-day period
  it("refunds (almost) the whole amount on day 0", () => {
    expect(proRataRefundMinor(999, start, end, start)).toBe(999);
  });
  it("refunds the unused fraction at the midpoint", () => {
    const mid = new Date("2026-06-16T00:00:00Z"); // 15/30 used
    expect(proRataRefundMinor(1000, start, end, mid)).toBe(500);
  });
  it("refunds a large remainder when withdrawing 2 days into the month", () => {
    const day2 = new Date("2026-06-03T00:00:00Z"); // 2/30 used
    // 999 * (1 - 2/30) = 27972/30 = 932.4 → 932
    expect(proRataRefundMinor(999, start, end, day2)).toBe(932);
  });
  it("refunds nothing once the period is fully elapsed", () => {
    expect(proRataRefundMinor(1000, start, end, new Date("2026-07-02T00:00:00Z"))).toBe(0);
  });
  it("never returns more than the net amount or less than zero", () => {
    expect(proRataRefundMinor(1000, start, end, new Date("2026-05-01T00:00:00Z"))).toBe(1000); // before start → all
    expect(proRataRefundMinor(0, start, end, start)).toBe(0);
  });
  it("refunds the whole net amount when the period is unusable (end <= start)", () => {
    expect(proRataRefundMinor(1000, end, start)).toBe(1000);
  });
});
