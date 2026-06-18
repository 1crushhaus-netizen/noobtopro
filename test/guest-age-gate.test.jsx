// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

// Guest 18+ gate: noobtopro is adults-only. A guest (no account) must confirm they are 18+
// once, client-side, before entering the service — but the public landing stays open. Drives
// the real component in guest mode with hasGuestAgeAck() forced false.
const store = vi.hoisted(() => ({
  loadState: vi.fn(async () => ({ scores: null, history: [] })),
  saveProgress: vi.fn(async () => ({ history: [] })),
  resetAll: vi.fn(async () => {}),
  migrateGuestToAccount: vi.fn(async () => ({ migrated: false })),
  deleteAllUserData: vi.fn(async () => ({ ok: true })),
  loadMastery: vi.fn(async () => ({ mastery: {} })),
  loadReviews: vi.fn(async () => ({ reviews: [] })),
  loadSubscription: vi.fn(async () => ({ subscription: null })),
  hasGuestAgeAck: vi.fn(() => false),
  recordGuestAgeAck: vi.fn(),
  clearGuestAgeAck: vi.fn(),
}));
vi.mock("@/lib/store", () => store);
vi.mock("@/lib/supabase", () => ({
  getSupabase: () => null, // guest mode: no auth
  isSupabaseConfigured: false,
  signInWithProvider: vi.fn(),
  signOutUser: vi.fn(),
  PROVIDERS: [{ id: "google", label: "Google", enabled: true }],
}));

import Noobtopro from "@/components/Noobtopro";

const jsonRes = (obj) => ({ ok: true, status: 200, json: async () => obj, headers: { get: () => null } });

// The adaptive diagnostic needs a starter per subject (math first); mirrors the shape in
// test/noobtopro.test.jsx so the first question (MATH-Q1) renders.
const DIAG_STARTERS = {
  adaptive: true,
  stepsPerSubject: 3,
  curated: true,
  questions: ["math", "physics", "chemistry"].map((s) => ({
    subject: s,
    topic: "t",
    difficulty: "intermediate",
    question: `${s.toUpperCase()}-Q1`,
    stepNo: 1,
    stepsTotal: 3,
    token: `tok-${s}-1`,
  })),
};

// An ISO date-of-birth for a person `years` old today (UTC, matching AgeGate's math).
function dobForAge(years) {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

beforeEach(() => {
  store.loadState.mockResolvedValue({ scores: null, history: [] });
  store.hasGuestAgeAck.mockReturnValue(false);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("Guest 18+ gate", () => {
  it("leaves the public landing open, but 'Prove it' shows the age gate and does NOT start the diagnostic", async () => {
    const fetchMock = vi.fn(async () => jsonRes({}));
    vi.stubGlobal("fetch", fetchMock);
    render(<Noobtopro />);
    // The marketing landing renders (no age prompt yet) — it stays crawlable/open.
    const proveIt = await screen.findByRole("button", { name: /prove it/i });
    expect(screen.queryByLabelText(/date of birth/i)).toBe(null);

    fireEvent.click(proveIt);
    // The 18+ gate appears INSTEAD of starting the diagnostic…
    expect(await screen.findByLabelText(/date of birth/i)).toBeTruthy();
    // …and no generation request fired for the unconfirmed guest.
    expect(fetchMock.mock.calls.some(([p]) => p === "/api/generate")).toBe(false);
  });

  it("confirming 18+ records the client-side ack and runs the deferred diagnostic", async () => {
    const fetchMock = vi.fn(async (path) => {
      if (path === "/api/generate") return jsonRes(DIAG_STARTERS);
      return jsonRes({});
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<Noobtopro />);
    fireEvent.click(await screen.findByRole("button", { name: /prove it/i }));

    fireEvent.change(await screen.findByLabelText(/date of birth/i), { target: { value: dobForAge(25) } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => expect(store.recordGuestAgeAck).toHaveBeenCalledTimes(1));
    // The deferred diagnostic now actually starts.
    expect(await screen.findByText("MATH-Q1")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([p]) => p === "/api/generate")).toBe(true);
  });

  it("blocks an under-18 date of birth and never records the ack or starts the diagnostic", async () => {
    const fetchMock = vi.fn(async () => jsonRes({}));
    vi.stubGlobal("fetch", fetchMock);
    render(<Noobtopro />);
    fireEvent.click(await screen.findByRole("button", { name: /prove it/i }));

    fireEvent.change(await screen.findByLabelText(/date of birth/i), { target: { value: dobForAge(15) } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(await screen.findByRole("heading", { name: /for ages 18 and over/i })).toBeTruthy();
    expect(store.recordGuestAgeAck).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([p]) => p === "/api/generate")).toBe(false);
  });

  it("gates a RETURNING guest with saved progress before the dashboard until they confirm", async () => {
    store.loadState.mockResolvedValue({ scores: { math: { score: 50, weakConcepts: [], comment: "" } }, history: [] });
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({})));
    render(<Noobtopro />);
    // The age gate stands in front of the saved-progress dashboard.
    expect(await screen.findByLabelText(/date of birth/i)).toBeTruthy();
    expect(screen.queryByText("Where you stand")).toBe(null);
  });

  it("an already-acked guest is NOT gated and can start the diagnostic directly", async () => {
    store.hasGuestAgeAck.mockReturnValue(true);
    const fetchMock = vi.fn(async (path) => {
      if (path === "/api/generate") return jsonRes(DIAG_STARTERS);
      return jsonRes({});
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<Noobtopro />);
    fireEvent.click(await screen.findByRole("button", { name: /prove it/i }));
    // Straight into the diagnostic — no age prompt.
    expect(await screen.findByText("MATH-Q1")).toBeTruthy();
    expect(screen.queryByLabelText(/date of birth/i)).toBe(null);
  });
});
