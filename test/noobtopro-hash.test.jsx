// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

// Regression for the "#pricing shows the Dashboard" report: the app-shell view
// tabs are <button onClick={setView}> and never touched the URL, and nothing read
// it back — so a #pricing left over from the marketing landing's nav persisted
// while the Dashboard view was shown. Noobtopro now syncs the active view to the
// hash (and honors a view hash on load).

const store = vi.hoisted(() => ({
  loadState: vi.fn(),
  resetAll: vi.fn(async () => {}),
  saveProgress: vi.fn(async () => ({ history: [] })),
  migrateGuestToAccount: vi.fn(async () => ({ migrated: false })),
  deleteAllUserData: vi.fn(async () => ({ ok: true })),
  loadReviews: vi.fn(async () => ({ reviews: [] })),
  loadMastery: vi.fn(async () => ({ mastery: {} })),
  hasGuestAgeAck: vi.fn(() => true),
  recordGuestAgeAck: vi.fn(),
  clearGuestAgeAck: vi.fn(),
}));
vi.mock("@/lib/store", () => store);
vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: true,
  getSupabase: () => null, // guest
  signInWithProvider: vi.fn(),
  signOutUser: vi.fn(),
  PROVIDERS: [{ id: "google", label: "Google", enabled: true }],
}));

import Noobtopro from "@/components/Noobtopro";

const SCORES = {
  math: { score: 50, weakConcepts: [], comment: "" },
  physics: { score: 40, weakConcepts: [], comment: "" },
  chemistry: { score: 30, weakConcepts: [], comment: "" },
};

beforeEach(() => {
  store.loadState.mockResolvedValue({ scores: SCORES, history: [] });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Noobtopro — URL hash reflects the active app view", () => {
  it("replaces a stale landing anchor and writes #dashboard when the Dashboard tab opens", async () => {
    // Arrive carrying a leftover marketing anchor from the landing nav.
    window.history.replaceState(null, "", "/#pricing");
    render(<Noobtopro />);

    // Guest with saved scores lands on the dashboard stage; the stale #pricing is
    // replaced by the real view hash instead of pointing at a section that's gone.
    await screen.findByText("Where you stand");
    await waitFor(() => expect(window.location.hash).toBe("#practice"));

    // Opening the Dashboard tab updates the hash to match the view.
    fireEvent.click(screen.getByRole("button", { name: /^dashboard$/i }));
    await waitFor(() => expect(window.location.hash).toBe("#dashboard"));
  });

  it("deep-links straight into the Dashboard when loaded at #dashboard", async () => {
    window.history.replaceState(null, "", "/#dashboard");
    render(<Noobtopro />);
    // The Dashboard view renders (its guest gate), not the score-cards stage.
    expect(await screen.findByText("Sign in to see your Dashboard")).toBeTruthy();
  });
});
