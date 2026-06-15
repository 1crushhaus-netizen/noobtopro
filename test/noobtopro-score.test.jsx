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
  // weak_concepts are CURRICULUM KEYS now (the grader reports keys) — a real,
  // guided concept so opening it lands on its prepared library page.
  math: { score: 50, weakConcepts: ["multiplication_division"], comment: "", rubric: { conceptual_understanding: 2, logical_structure: 2, strategy: 2, execution_accuracy: 2, communication: 2 } },
  physics: { score: 40, weakConcepts: [], comment: "", rubric: null },
  chemistry: { score: 30, weakConcepts: [], comment: "", rubric: null },
};

const store = vi.hoisted(() => ({
  loadState: vi.fn(),
  resetAll: vi.fn(async () => {}),
  saveProgress: vi.fn(async () => ({ history: [] })),
  migrateGuestToAccount: vi.fn(async () => ({ migrated: false })),
  deleteAllUserData: vi.fn(async () => ({ ok: true })),
  loadMastery: vi.fn(async () => ({ mastery: {} })),
  loadReviews: vi.fn(async () => ({ reviews: [] })),
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

describe("Noobtopro — sidebar identity", () => {
  it("shows the signed-in user's name, email, and overall rank in the sidebar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({ isAdmin: false })));
    render(<Noobtopro />);
    // Identity lives ONLY in the sidebar footer (the Dashboard bento has no
    // identity bar): name + email + the rankFor(phdIndex) chip.
    expect(await screen.findByText("u@example.com")).toBeTruthy();
    // "U" appears as both the avatar-fallback initial and the name line.
    expect(screen.getAllByText("U").length).toBeGreaterThan(0);
    expect(screen.getByTitle("Your overall rank")).toBeTruthy();
  });
});

describe("Noobtopro — signed-in practice is server-authoritative", () => {
  it("submits to /api/score with the Bearer token, renders the server's trusted result, and never calls /api/grade or saveProgress", async () => {
    const fetchMock = vi.fn(async (path) => {
      if (path === "/api/admin/me") return jsonRes({ isAdmin: false });
      if (path === "/api/generate") return jsonRes({ subject: "math", topic: "t", targetConcept: "x", difficulty: "intermediate", question: "PRACTICEQ", token: "tok-q1" });
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
    // 88 renders in the headline AND as the breakdown total — both are the server's score.
    expect(screen.getAllByText("88").length).toBeGreaterThan(0);

    // It went to /api/score WITH the Bearer token...
    const scoreCall = fetchMock.mock.calls.find(([p]) => p === "/api/score");
    expect(scoreCall).toBeTruthy();
    expect(scoreCall[1].headers.Authorization).toBe("Bearer tok-123");
    const body = JSON.parse(scoreCall[1].body);
    // The signed question token (audit P1-1) — the server derives subject/question/
    // band/topic from it; the client asserts no rating-relevant field anymore.
    expect(body).toMatchObject({ kind: "practice", token: "tok-q1" });
    expect(body.subject).toBeUndefined();
    expect(body.difficulty).toBeUndefined();
    // ...and NOT to the grade-only route, and NOT to the local (guest) save path.
    expect(fetchMock.mock.calls.some(([p]) => p === "/api/grade")).toBe(false);
    expect(store.saveProgress).not.toHaveBeenCalled();
  });
});

describe("Noobtopro — 'Learn this' opens the prepared library concept (draws from the curriculum)", () => {
  it("opens the resolved concept's PREPARED page (label + 'Practice this concept'), never the old generator", async () => {
    const fetchMock = vi.fn(async (path) => {
      if (path === "/api/admin/me") return jsonRes({ isAdmin: false });
      return jsonRes({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Noobtopro />);
    fireEvent.click(await screen.findByRole("button", { name: /^Dashboard$/i }));
    // The radar panel surfaces the weak concept with a "Learn this" action.
    fireEvent.click(await screen.findByRole("button", { name: /learn this/i }));

    // It lands on the LIBRARY concept page for the resolved curriculum key — the
    // concept's label heading + its "Practice this concept" action — NOT a generated guide.
    expect(await screen.findByRole("heading", { name: "Multiplication & division" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /practice this concept/i })).toBeTruthy();
    // The retired generation endpoint is NEVER called.
    expect(fetchMock.mock.calls.some(([p]) => p === "/api/learn")).toBe(false);
  });

  it("'Back to concepts' returns to the curriculum browser", async () => {
    const fetchMock = vi.fn(async (path) => {
      if (path === "/api/admin/me") return jsonRes({ isAdmin: false });
      return jsonRes({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Noobtopro />);
    fireEvent.click(await screen.findByRole("button", { name: /^Dashboard$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /learn this/i }));
    await screen.findByRole("heading", { name: "Multiplication & division" });
    fireEvent.click(screen.getByRole("button", { name: /back to concepts/i }));
    // Now the curriculum browser is shown (its search box appears).
    expect(await screen.findByRole("searchbox", { name: /search concepts/i })).toBeTruthy();
  });
});

describe("Noobtopro — re-baseline confirmation (FIX 6)", () => {
  it("a signed-in user WITH scores must confirm before re-taking (cancel does nothing)", async () => {
    // SCORES is loaded in beforeEach → the user lands on the ranked Dashboard.
    const fetchMock = vi.fn(async (path) => {
      if (path === "/api/admin/me") return jsonRes({ isAdmin: false });
      if (path === "/api/generate") throw new Error("diagnostic must not start on cancel");
      return jsonRes({});
    });
    vi.stubGlobal("fetch", fetchMock);
    const confirmSpy = vi.fn(() => false); // user CANCELS
    vi.stubGlobal("confirm", confirmSpy);

    render(<Noobtopro />);
    // Open the Dashboard tab (the ranked home base) where the re-take action lives.
    fireEvent.click(await screen.findByRole("button", { name: /^Dashboard$/i }));
    const retake = await screen.findByRole("button", { name: /re-take diagnostic/i });
    fireEvent.click(retake);

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][0]).toMatch(/replace your current scores/i);
    // Cancel → no diagnostic generation, still on the dashboard.
    expect(fetchMock.mock.calls.some(([p]) => p === "/api/generate")).toBe(false);
    expect(screen.getByText("Where you stand")).toBeTruthy();
  });

  it("confirming proceeds to start the diagnostic", async () => {
    const fetchMock = vi.fn(async (path) => {
      if (path === "/api/admin/me") return jsonRes({ isAdmin: false });
      if (path === "/api/generate") {
        return jsonRes({ adaptive: true, stepsPerSubject: 3, curated: true, questions: ["math", "physics", "chemistry"].map((s) => ({ subject: s, topic: "t", difficulty: "intermediate", question: `${s.toUpperCase()}-Q1`, stepNo: 1, stepsTotal: 3, token: `tok-${s}-1` })) });
      }
      return jsonRes({});
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn(() => true)); // user CONFIRMS

    render(<Noobtopro />);
    fireEvent.click(await screen.findByRole("button", { name: /^Dashboard$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /re-take diagnostic/i }));
    // The diagnostic started — its first question is on screen.
    await screen.findByText("MATH-Q1");
    expect(fetchMock.mock.calls.some(([p]) => p === "/api/generate")).toBe(true);
  });
});

describe("Noobtopro — signed-in adaptive diagnostic is server-persisted", () => {
  // Adaptive-server stub (mirrors the route contract): tokened starters, per-step
  // next questions, done-tokens after 3 steps, finalize on { tokens }.
  const SUBJECTS3 = ["math", "physics", "chemistry"];
  const STEPS = 3;
  const diagQ = (subject, stepNo) => ({
    subject, topic: "t", difficulty: "intermediate",
    question: `${subject.toUpperCase()}-Q${stepNo}`, stepNo, stepsTotal: STEPS, token: `tok-${subject}-${stepNo}`,
  });
  const PRESENTED = [];
  for (let step = 1; step <= STEPS; step++) for (const s of SUBJECTS3) PRESENTED.push(`${s.toUpperCase()}-Q${step}`);

  it("walks the signed steps with the Bearer token and persists via the finalize (no saveProgress)", async () => {
    // Signed-in but no scores yet → starts at the intro so we can run the diagnostic.
    store.loadState.mockResolvedValue({ scores: null, history: [] });
    const persisted = {
      math: { score: 55, weakConcepts: [], comment: "", rubric: { conceptual_understanding: 3, logical_structure: 3, strategy: 3, execution_accuracy: 3, communication: 3 } },
      physics: { score: 40, weakConcepts: [], comment: "", rubric: { conceptual_understanding: 2, logical_structure: 2, strategy: 2, execution_accuracy: 2, communication: 2 } },
      chemistry: { score: 30, weakConcepts: [], comment: "", rubric: { conceptual_understanding: 2, logical_structure: 2, strategy: 2, execution_accuracy: 2, communication: 2 } },
    };
    const fetchMock = vi.fn(async (path, init) => {
      if (path === "/api/admin/me") return jsonRes({ isAdmin: false });
      if (path === "/api/generate") {
        return jsonRes({ adaptive: true, stepsPerSubject: STEPS, curated: true, questions: SUBJECTS3.map((s) => diagQ(s, 1)) });
      }
      if (path === "/api/score") {
        const body = JSON.parse(init.body);
        if (Array.isArray(body.tokens)) {
          return jsonRes({
            scores: persisted,
            persisted: true,
            attempt: { type: "baseline", t: "t1", subject: null, totalAfter: 125, phdAfter: 42 },
          });
        }
        const [, subject, stepStr] = String(body.token).split("-");
        const stepNo = Number(stepStr);
        const graded = { subject, difficulty: "intermediate", reasoningScore: 60 };
        if (stepNo >= STEPS) return jsonRes({ graded, subjectComplete: true, finalToken: `final-${subject}` });
        return jsonRes({ graded, next: diagQ(subject, stepNo + 1) });
      }
      return jsonRes({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Noobtopro />);
    fireEvent.click(await screen.findByRole("button", { name: /prove it/i }));
    for (let i = 0; i < PRESENTED.length; i++) {
      const isLast = i === PRESENTED.length - 1;
      await screen.findByText(PRESENTED[i]);
      fireEvent.change(screen.getByLabelText("Your reasoning"), { target: { value: `answer ${i}` } });
      fireEvent.click(screen.getByRole("button", { name: isLast ? /get ranked/i : /next question/i }));
    }

    await screen.findByText("Where you stand");

    // 9 signed step calls + 1 finalize, EVERY one carrying the Bearer token.
    const scoreCalls = fetchMock.mock.calls.filter(([p]) => p === "/api/score");
    expect(scoreCalls).toHaveLength(PRESENTED.length + 1);
    for (const [, init] of scoreCalls) expect(init.headers.Authorization).toBe("Bearer tok-123");
    const finalize = JSON.parse(scoreCalls[scoreCalls.length - 1][1].body);
    expect(finalize.kind).toBe("diagnostic");
    expect(finalize.tokens).toEqual(SUBJECTS3.map((s) => `final-${s}`));
    // Server persisted it — the client never writes locally.
    expect(store.saveProgress).not.toHaveBeenCalled();
  });
});
