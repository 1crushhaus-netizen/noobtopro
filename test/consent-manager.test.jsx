// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import ConsentManager, { OPEN_CONSENT_EVENT } from "@/components/ConsentManager";
import { CONSENT_VERSION } from "@/lib/analytics";

// A consent record written against the CURRENT disclosure version (the modern stored shape).
const currentRecord = (choice) =>
  JSON.stringify({ choice, ts: new Date().toISOString(), version: CONSENT_VERSION });

// The Vercel analytics components self-inject scripts; stub them with markers so we can
// assert they mount ONLY after an explicit opt-in.
vi.mock("@vercel/analytics/next", () => ({ Analytics: () => <div data-testid="va-analytics" /> }));
vi.mock("@vercel/speed-insights/next", () => ({ SpeedInsights: () => <div data-testid="va-speed" /> }));

const KEY = "noobtopro:consent";

function setGPC(value) {
  Object.defineProperty(navigator, "globalPrivacyControl", { value, configurable: true });
}

beforeEach(() => {
  window.localStorage.clear();
  // Clear any leftover Ahrefs tag + GPC flag between tests.
  document.querySelectorAll("script[data-noobtopro-ahrefs]").forEach((s) => s.remove());
  try { delete navigator.globalPrivacyControl; } catch { /* ignore */ }
});
afterEach(cleanup);

const analyticsLoaded = () => screen.queryByTestId("va-analytics") !== null;
const ahrefsTag = () => document.querySelector("script[data-noobtopro-ahrefs]");

describe("ConsentManager — ePrivacy prior-consent gate", () => {
  it("shows the banner and loads NO analytics before a choice is made", async () => {
    render(<ConsentManager ahrefsKey="K1" />);
    expect(await screen.findByRole("dialog", { name: /cookies & analytics/i })).toBeTruthy();
    expect(analyticsLoaded()).toBe(false);
    expect(ahrefsTag()).toBe(null);
  });

  it("Accept → persists the choice, hides the banner, and loads all three trackers", async () => {
    render(<ConsentManager ahrefsKey="K1" />);
    fireEvent.click(await screen.findByRole("button", { name: /^accept$/i }));
    await waitFor(() => expect(analyticsLoaded()).toBe(true));
    expect(screen.getByTestId("va-speed")).toBeTruthy();
    const tag = ahrefsTag();
    expect(tag).toBeTruthy();
    expect(tag.getAttribute("data-key")).toBe("K1");
    expect(tag.src).toContain("analytics.ahrefs.com");
    expect(JSON.parse(window.localStorage.getItem(KEY)).choice).toBe("granted"); // auditable {choice,ts,version} record
    expect(screen.queryByRole("dialog", { name: /cookies & analytics/i })).toBe(null);
  });

  it("Reject → persists 'denied', hides the banner, loads nothing", async () => {
    render(<ConsentManager ahrefsKey="K1" />);
    fireEvent.click(await screen.findByRole("button", { name: /^reject$/i }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /cookies & analytics/i })).toBe(null));
    expect(analyticsLoaded()).toBe(false);
    expect(ahrefsTag()).toBe(null);
    expect(JSON.parse(window.localStorage.getItem(KEY)).choice).toBe("denied"); // auditable {choice,ts,version} record
  });

  it("a stored CURRENT-version 'granted' loads analytics immediately with no banner", async () => {
    window.localStorage.setItem(KEY, currentRecord("granted"));
    render(<ConsentManager ahrefsKey="K1" />);
    await waitFor(() => expect(analyticsLoaded()).toBe(true));
    expect(screen.queryByRole("dialog", { name: /cookies & analytics/i })).toBe(null);
  });

  it("re-asks (shows the banner, loads nothing) when the stored choice predates the current disclosure version", async () => {
    // A grant recorded against an OLDER disclosure version must NOT be silently honored —
    // ConsentManager re-asks, and no analytics load until a fresh opt-in.
    window.localStorage.setItem(KEY, JSON.stringify({ choice: "granted", ts: "2020-01-01T00:00:00.000Z", version: "2000-01-01" }));
    render(<ConsentManager ahrefsKey="K1" />);
    expect(await screen.findByRole("dialog", { name: /cookies & analytics/i })).toBeTruthy();
    expect(analyticsLoaded()).toBe(false);
    expect(ahrefsTag()).toBe(null);
  });

  it("re-asks for a legacy unversioned record (written before consent records were versioned)", async () => {
    window.localStorage.setItem(KEY, "granted"); // legacy bare string, no policy version
    render(<ConsentManager ahrefsKey="K1" />);
    expect(await screen.findByRole("dialog", { name: /cookies & analytics/i })).toBeTruthy();
    expect(analyticsLoaded()).toBe(false);
  });

  it("Global Privacy Control is respected as an opt-out: no banner, no analytics", async () => {
    setGPC(true);
    render(<ConsentManager ahrefsKey="K1" />);
    // Let the mount effect resolve, then assert nothing tracking-related appears.
    await act(async () => {});
    expect(screen.queryByRole("dialog", { name: /cookies & analytics/i })).toBe(null);
    expect(analyticsLoaded()).toBe(false);
    expect(ahrefsTag()).toBe(null);
  });

  it("the 'Cookie preferences' event reopens the banner so a prior choice can be changed", async () => {
    window.localStorage.setItem(KEY, currentRecord("denied"));
    render(<ConsentManager ahrefsKey="K1" />);
    await act(async () => {}); // resolve initial (current-version denied → no banner)
    expect(screen.queryByRole("dialog", { name: /cookies & analytics/i })).toBe(null);

    await act(async () => { window.dispatchEvent(new Event(OPEN_CONSENT_EVENT)); });
    expect(await screen.findByRole("dialog", { name: /cookies & analytics/i })).toBeTruthy();

    // Switching to Accept now loads the trackers.
    fireEvent.click(screen.getByRole("button", { name: /^accept$/i }));
    await waitFor(() => expect(analyticsLoaded()).toBe(true));
    expect(JSON.parse(window.localStorage.getItem(KEY)).choice).toBe("granted"); // auditable {choice,ts,version} record
  });
});
