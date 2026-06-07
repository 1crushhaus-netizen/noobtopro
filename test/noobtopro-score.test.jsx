// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// The signed-in flows are SERVER-AUTHORITATIVE: submitPractice/submitDiagnostic must
// route through /api/score with the user's Bearer token (so the server grades +
// computes + persists), and must NOT call /api/grade or the local saveProgress (the
// browser can no longer write scores). This drives the real component against a
// signed-in Supabase mock whose session carries an access_token.

const USER = { id: "u1", email: "u@example.com", user_metadata: { full_name: "U" } };
const SCORES = {
  math: { score: 50, weakConcepts: ["x"], comment: "", rubric: { conceptual_understanding: 2, logical_structure: 2, strategy: 2, execution_accuracy: 2, communication: 2 } },
  physics: { score: 40, weakConcepts: [], comment: "", rubric: null },
  chemistry: { score: 30, weakConcepts: [], comment: "", rubric: null },
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
            getSession: async () => ({ data: { session: { user: supa.user, access_token: "tok-123" } } }),
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

function jsonRes(obj) {
  return { ok: true, status: 200, json: async () => obj, headers: { get: () => null } };
}

beforeEach(() => {
  supa.user = USER;
  store.loadState.mockResolvedValue({ scores: SCORES, history: [{ type: "baseline", t: "t0", totalAfter: 120, phdAfter: 40 }] });
  store.migrateGuestToAccount.mockResolvedValue({ migrated: false });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("Noobtopro — signed-in practice is server-authoritative", () => {
  it("submits to /api/score with the Bearer token, renders the server's trusted result, and never calls /api/grade or saveProgress", async () => {
    const fetchMock = vi.fn(async (path) => {
      if (path === "/api/admin/me") return jsonRes({ isAdmin: false });
      if (path === "/api/generate") return jsonRes({ subject: "math", topic: "t", targetConcept: "x", difficulty: "intermediate", question: "PRACTICEQ" });
      if (path === "/api/score")
        return jsonRes({
          reasoningScore: 88,
          rubric: { conceptual_understanding: 4, logical_structure: 4, strategy: 3, execution_accuracy: 3, communication: 4 },
          correctnessNote: "Good reasoning.",
          socraticHint: "Why does that hold at the boundary?",
          microLesson: "The principle in general terms.",
          weakConcepts: ["x"],
          newScore: 58,
          delta: 8,
          subjectScore: { score: 58, weakConcepts: ["x"], comment: "", rubric: { conceptual_understanding: 3, logical_structure: 3, strategy: 3, execution_accuracy: 3, communication: 3 } },
          attempt: { type: "attempt", t: "t1", subject: "math", reasoningScore: 88, delta: 8, newScore: 58, totalAfter: 128, phdAfter: 43 },
        });
      if (path === "/api/grade") throw new Error("signed-in practice must NOT call /api/grade");
      return jsonRes({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Noobtopro />);

    // Dashboard → start a math practice question.
    fireEvent.click(await screen.findByRole("button", { name: /practice mathematics/i }));
    await screen.findByText("PRACTICEQ");

    fireEvent.change(screen.getByLabelText("Your reasoning"), { target: { value: "my reasoning" } });
    fireEvent.click(screen.getByRole("button", { name: /submit reasoning/i }));

    // The feedback panel renders the SERVER's reasoning score (88) — proof the client
    // rendered the trusted server result, not a client-computed one.
    await screen.findByText(/reasoning quality this attempt/i);
    expect(screen.getByText("88")).toBeTruthy();

    // It went to /api/score WITH the Bearer token...
    const scoreCall = fetchMock.mock.calls.find(([p]) => p === "/api/score");
    expect(scoreCall).toBeTruthy();
    expect(scoreCall[1].headers.Authorization).toBe("Bearer tok-123");
    const body = JSON.parse(scoreCall[1].body);
    expect(body).toMatchObject({ kind: "practice", subject: "math" });
    // ...and NOT to the grade-only route, and NOT to the local (guest) save path.
    expect(fetchMock.mock.calls.some(([p]) => p === "/api/grade")).toBe(false);
    expect(store.saveProgress).not.toHaveBeenCalled();
  });
});
