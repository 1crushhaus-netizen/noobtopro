// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";

// Regression for the "Restart" logo bug: clicking the noob→topro logo blanked a
// signed-in user's scores in memory without reloading them from the DB, so their
// progress appeared to vanish (Profile showed the empty state) until a refresh.

const USER = { id: "u1", email: "1crushhaus@gmail.com", user_metadata: { full_name: "crushhaus", age_ack_year: 2000 } };
const SCORES = {
  math: { score: 50, weakConcepts: ["x"], comment: "" },
  physics: { score: 40, weakConcepts: [], comment: "" },
  chemistry: { score: 30, weakConcepts: [], comment: "" },
};

const store = vi.hoisted(() => ({
  loadState: vi.fn(),
  resetAll: vi.fn(async () => {}),
  saveProgress: vi.fn(async () => ({ history: [] })),
  migrateGuestToAccount: vi.fn(async () => ({ migrated: false })),
  deleteAllUserData: vi.fn(async () => ({ ok: true })),
  loadReviews: vi.fn(async () => ({ reviews: [] })),
  loadMastery: vi.fn(async () => ({ mastery: {} })),
  loadSubscription: vi.fn(async () => ({ subscription: null })),
}));
vi.mock("@/lib/store", () => store);

// `supa.authCb` captures the onAuthStateChange listener so a test can fire a
// SIGNED_OUT event and assert the component's reaction.
const supa = vi.hoisted(() => ({ user: null, authCb: null }));
vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: true,
  getSupabase: () =>
    supa.user
      ? {
          auth: {
            getUser: async () => ({ data: { user: supa.user } }),
            getSession: async () => ({ data: { session: { user: supa.user } } }),
            onAuthStateChange: (cb) => {
              supa.authCb = cb;
              return { data: { subscription: { unsubscribe() {} } } };
            },
            signOut: async () => {},
          },
        }
      : null,
  signInWithProvider: vi.fn(async () => ({})),
  signOutUser: vi.fn(async () => {}),
  PROVIDERS: [{ id: "google", label: "Google", enabled: true }],
}));

import Noobtopro from "@/components/Noobtopro";

beforeEach(() => {
  store.loadState.mockResolvedValue({
    scores: SCORES,
    history: [{ type: "baseline", t: "t0", totalAfter: 120, phdAfter: 40 }],
  });
  store.resetAll.mockResolvedValue(undefined);
  store.migrateGuestToAccount.mockResolvedValue({ migrated: false });
  store.deleteAllUserData.mockResolvedValue({ ok: true });
  supa.authCb = null;
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("Restart logo (reset)", () => {
  it("signed-in: keeps persisted progress — Dashboard still shows stats after clicking the logo", async () => {
    supa.user = USER;
    render(<Noobtopro />);

    // Mount hydrate loads the account's scores → dashboard.
    await screen.findByText("Where you stand");
    fireEvent.click(screen.getByRole("button", { name: /^dashboard$/i }));
    expect(await screen.findByText(/Doctorate index/i)).toBeTruthy(); // stats view

    // Click the Restart logo, then let the re-hydrate settle.
    fireEvent.click(screen.getByTitle("Restart"));
    await flush();

    // Neither destructive path ran for a signed-in user: the DB delete
    // (deleteAllUserData) nor the local-session wipe (resetAll). Asserting resetAll
    // too matters because hydrate() re-fetches SCORES from the mock regardless, so
    // without this a regression that wiped localStorage on the signed-in path would
    // still pass on the Profile-visible check alone.
    expect(store.deleteAllUserData).not.toHaveBeenCalled();
    expect(store.resetAll).not.toHaveBeenCalled();

    // Re-open Dashboard: the persisted stats must still be there (pre-fix this showed
    // the "not ranked"/"no diagnostic" empty state because scores were blanked).
    fireEvent.click(screen.getByRole("button", { name: /^dashboard$/i }));
    expect(await screen.findByText(/Doctorate index/i)).toBeTruthy();
    expect(screen.getByText(/Total points/i)).toBeTruthy();
  });

  it("guest: Restart clears the local session back to the intro", async () => {
    supa.user = null; // guest (getSupabase → null)
    render(<Noobtopro />);

    // Guest with local scores → dashboard.
    await screen.findByText("Where you stand");

    fireEvent.click(screen.getByTitle("Restart"));
    await flush();

    // Local session cleared and returned to the intro; the dashboard is gone.
    expect(store.resetAll).toHaveBeenCalled();
    expect(screen.queryByText("Where you stand")).toBe(null);
  });
});

describe("Sign-out (shared-device safety)", () => {
  it("clears the prior user's in-memory scores synchronously, before the async re-hydrate", async () => {
    supa.user = USER;
    render(<Noobtopro />);

    // Signed-in mount hydrates the account's scores → dashboard.
    await screen.findByText("Where you stand");

    // The next person on the device signs out. Make the post-sign-out re-hydrate
    // resolve to NO data, but DELAY it — so if the synchronous in-memory clear were
    // missing, "Where you stand" (gated on scores && stage==="dashboard") would still
    // be on screen during this gap. Firing SIGNED_OUT must blank scores immediately.
    let releaseHydrate;
    store.loadState.mockReturnValueOnce(new Promise((res) => { releaseHydrate = res; }));

    await act(async () => {
      supa.authCb && supa.authCb("SIGNED_OUT", null);
    });

    // The dashboard is gone even though the re-hydrate hasn't resolved yet: scores
    // were dropped from memory synchronously (stage also reset to "intro").
    expect(screen.queryByText("Where you stand")).toBe(null);

    // Let the (empty) re-hydrate settle; still no stale dashboard.
    await act(async () => { releaseHydrate({ scores: null, history: [] }); });
    await flush();
    expect(screen.queryByText("Where you stand")).toBe(null);
  });
});

describe("Reset my progress — confirmation modal", () => {
  it("confirms via a dimmed dialog (No cancels; Yes deletes + toasts) instead of window.confirm", async () => {
    supa.user = USER;
    render(<Noobtopro />);
    await screen.findByText("Where you stand");
    fireEvent.click(screen.getByRole("button", { name: /^dashboard$/i }));

    // Opening the dialog does NOT delete anything yet.
    fireEvent.click(await screen.findByRole("button", { name: /reset my progress/i }));
    expect(await screen.findByRole("dialog", { name: /are you sure/i })).toBeTruthy();
    expect(screen.getByText(/permanently deletes all your scores/i)).toBeTruthy();
    expect(store.deleteAllUserData).not.toHaveBeenCalled();

    // "No" cancels — dialog closes, nothing deleted.
    fireEvent.click(screen.getByRole("button", { name: /^no$/i }));
    await flush();
    expect(screen.queryByRole("dialog", { name: /are you sure/i })).toBeNull();
    expect(store.deleteAllUserData).not.toHaveBeenCalled();

    // Reopen and confirm with "Yes" → the delete runs and a success toast appears.
    fireEvent.click(screen.getByRole("button", { name: /reset my progress/i }));
    await screen.findByRole("dialog", { name: /are you sure/i });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^yes$/i }));
    });
    await flush();
    expect(store.deleteAllUserData).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/your progress was reset/i)).toBeTruthy();
    // The destructive action returned the learner to the intro (dashboard stats gone).
    expect(screen.queryByText("Where you stand")).toBe(null);
  });
});
