// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the real Vercel tracker so we can assert whether the consent gate let an event through.
const va = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@vercel/analytics", () => ({ track: (...a) => va.track(...a) }));

import { track, hasAnalyticsConsent, CONSENT_STORAGE_KEY } from "@/lib/analytics";

beforeEach(() => {
  va.track.mockReset();
  window.localStorage.clear();
});

describe("lib/analytics — ePrivacy consent gate on track()", () => {
  it("does NOT track when consent is undecided (deny by default)", () => {
    track("checkout_started");
    expect(va.track).not.toHaveBeenCalled();
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("does NOT track when consent is explicitly denied", () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, "denied");
    track("diagnostic_started", { signedIn: true });
    expect(va.track).not.toHaveBeenCalled();
  });

  it("tracks (forwarding name + props) once consent is granted", () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, "granted");
    track("checkout_success");
    track("sign_in_started", { provider: "google" });
    expect(va.track).toHaveBeenCalledTimes(2);
    expect(va.track).toHaveBeenCalledWith("checkout_success");
    expect(va.track).toHaveBeenCalledWith("sign_in_started", { provider: "google" });
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it("never throws if the underlying tracker throws", () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, "granted");
    va.track.mockImplementation(() => { throw new Error("boom"); });
    expect(() => track("x")).not.toThrow();
  });
});
