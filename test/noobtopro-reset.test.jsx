// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";

// Regression for the "Restart" logo bug: clicking the noob→topro logo blanked a
// signed-in user's scores in memory without reloading them from the DB, so their
// progress appeared to vanish (Profile showed the empty state) until a refresh.

const USER = { id: "u1", email: "1crushhaus@gmail.com", user_metadata: { full_name: "crushhaus" } };
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
}));
vi.mock("@/lib/store", () => store);

const supa = vi.hoisted(() => ({ user: null }));
vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: true,
  getSupabase: () =>
    supa.user
      ? {
          auth: {
            getUser: async () => ({ data: { user: supa.user } }),
            getSession: async () => ({ data: { session: { user: supa.user } } }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
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
  it("signed-in: keeps persisted progress — Profile still shows stats after clicking the logo", async () => {
    supa.user = USER;
    render(<Noobtopro />);

    // Mount hydrate loads the account's scores → dashboard.
    await screen.findByText("Where you stand");
    fireEvent.click(screen.getByRole("button", { name: /^profile$/i }));
    expect(await screen.findByText(/PhD-level intelligence/i)).toBeTruthy(); // stats view

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

    // Re-open Profile: the persisted stats must still be there (pre-fix this showed
    // the "not ranked"/"no diagnostic" empty state because scores were blanked).
    fireEvent.click(screen.getByRole("button", { name: /^profile$/i }));
    expect(await screen.findByText(/PhD-level intelligence/i)).toBeTruthy();
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
