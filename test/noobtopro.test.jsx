// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";

// Mock the data layer + Supabase so the component runs in deterministic guest mode
// with no network/DB. We drive the LLM via a stubbed global fetch.
const store = vi.hoisted(() => ({
  loadState: vi.fn(async () => ({ scores: null, history: [] })),
  saveProgress: vi.fn(async () => ({ history: [] })),
  resetAll: vi.fn(async () => {}),
  migrateGuestToAccount: vi.fn(async () => ({ migrated: false })),
  deleteAllUserData: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/store", () => store);
vi.mock("@/lib/supabase", () => ({
  getSupabase: () => null, // guest mode: no auth listener
  isSupabaseConfigured: false,
  signInWithProvider: vi.fn(async () => ({})),
  signOutUser: vi.fn(async () => {}),
  PROVIDERS: [{ id: "google", label: "Google", enabled: true }],
}));

import Noobtopro from "@/components/Noobtopro";

function jsonRes(obj) {
  return { ok: true, status: 200, json: async () => obj, headers: { get: () => null } };
}

let blobN;
beforeEach(() => {
  blobN = 0;
  store.loadState.mockResolvedValue({ scores: null, history: [] });
  store.saveProgress.mockResolvedValue({ history: [] });
  store.migrateGuestToAccount.mockResolvedValue({ migrated: false });
  store.resetAll.mockResolvedValue(undefined);
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => `blob:p${blobN++}`),
    revokeObjectURL: vi.fn(),
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// The 3-tier diagnostic: every subject × every difficulty (9 questions). Listed
// out of order on purpose — beginDiagnostic re-orders them subject-major, easy→hard.
const DIAGNOSTIC = {
  questions: [
    { subject: "physics", topic: "t", difficulty: "advanced", question: "PHYS-ADV" },
    { subject: "math", topic: "t", difficulty: "foundational", question: "MATH-FND" },
    { subject: "chemistry", topic: "t", difficulty: "intermediate", question: "CHEM-INT" },
    { subject: "math", topic: "t", difficulty: "advanced", question: "MATH-ADV" },
    { subject: "physics", topic: "t", difficulty: "foundational", question: "PHYS-FND" },
    { subject: "chemistry", topic: "t", difficulty: "advanced", question: "CHEM-ADV" },
    { subject: "math", topic: "t", difficulty: "intermediate", question: "MATH-INT" },
    { subject: "physics", topic: "t", difficulty: "intermediate", question: "PHYS-INT" },
    { subject: "chemistry", topic: "t", difficulty: "foundational", question: "CHEM-FND" },
  ],
};

// The order beginDiagnostic presents them in: subject-major (math, physics,
// chemistry), each easy→hard (foundational, intermediate, advanced).
const DIAGNOSTIC_ORDER = [
  "MATH-FND", "MATH-INT", "MATH-ADV",
  "PHYS-FND", "PHYS-INT", "PHYS-ADV",
  "CHEM-FND", "CHEM-INT", "CHEM-ADV",
];

async function attachImageToCurrentComposer(container) {
  const input = container.querySelector('input[type="file"]');
  const file = new File(["work"], "work.png", { type: "image/png" });
  fireEvent.change(input, { target: { files: [file] } });
  // attach is async (FileReader -> base64 -> createObjectURL); wait for the preview.
  await screen.findByAltText("your work");
}

describe("Noobtopro — diagnostic image previews are revoked on completion (leak fix)", () => {
  it("grades the 9 answers in ONE batched /api/score request and revokes every preview", async () => {
    const scoresPayload = {
      math: { score: 55, weakConcepts: [], comment: "", rubric: { conceptual_understanding: 3, logical_structure: 3, strategy: 3, execution_accuracy: 3, communication: 3 } },
      physics: { score: 40, weakConcepts: [], comment: "", rubric: { conceptual_understanding: 2, logical_structure: 2, strategy: 2, execution_accuracy: 2, communication: 2 } },
      chemistry: { score: 30, weakConcepts: [], comment: "", rubric: { conceptual_understanding: 2, logical_structure: 2, strategy: 2, execution_accuracy: 2, communication: 2 } },
    };
    const fetchMock = vi.fn(async (path) => {
      if (path === "/api/generate") return jsonRes(DIAGNOSTIC);
      // Guest diagnostic: server grades + aggregates server-side, returns scores (no persist).
      if (path === "/api/score") return jsonRes({ scores: scoresPayload, persisted: false, attempt: null });
      return jsonRes({});
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<Noobtopro />);
    fireEvent.click(await screen.findByRole("button", { name: /prove it/i }));

    // Step through all 9 questions (subject-major, easy→hard). Attach an image to
    // each so there are 9 previews; "Next question" for Q1–Q8, "Get ranked" for Q9.
    for (let i = 0; i < DIAGNOSTIC_ORDER.length; i++) {
      const isLast = i === DIAGNOSTIC_ORDER.length - 1;
      await screen.findByText(DIAGNOSTIC_ORDER[i]);
      await attachImageToCurrentComposer(container);
      fireEvent.click(
        screen.getByRole("button", { name: isLast ? /get ranked/i : /next question/i })
      );
    }

    // Lands on the dashboard once grading completes.
    await screen.findByText("Where you stand");

    // The fix: grading is ONE batched server request carrying all 9 answers, not the
    // old 9-parallel-call burst that could 429 the whole diagnostic.
    const scoreCalls = fetchMock.mock.calls.filter(([p]) => p === "/api/score");
    expect(scoreCalls).toHaveLength(1);
    const body = JSON.parse(scoreCalls[0][1].body);
    expect(body.kind).toBe("diagnostic");
    expect(body.answers).toHaveLength(9);

    // Each subject ring is self-describing for screen readers (subject in the label).
    expect(screen.getByRole("img", { name: /Mathematics: Score \d+ of 100/ })).toBeTruthy();
    expect(screen.getByRole("img", { name: /Chemistry: Score \d+ of 100/ })).toBeTruthy();

    // Nine previews were created; all nine must be revoked on completion (no leak).
    expect(URL.createObjectURL).toHaveBeenCalledTimes(9);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(9);
    for (let i = 0; i < 9; i++) {
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(`blob:p${i}`);
    }
  });
});

describe("Noobtopro — submitPractice run-token guard (stale grade after Restart)", () => {
  it("does NOT persist or repopulate when the user Restarts mid-grade", async () => {
    // Start already placed so we land on the dashboard.
    store.loadState.mockResolvedValue({
      scores: {
        math: { score: 50, weakConcepts: ["x"], comment: "" },
        physics: { score: 40, weakConcepts: [], comment: "" },
        chemistry: { score: 30, weakConcepts: [], comment: "" },
      },
      history: [],
    });

    // /api/grade is deferred so we can Restart while it is in flight.
    let resolveGrade;
    const gradeGate = new Promise((r) => { resolveGrade = r; });
    vi.stubGlobal("fetch", vi.fn((path) => {
      if (path === "/api/generate") {
        return Promise.resolve(jsonRes({ subject: "math", topic: "t", targetConcept: "x", difficulty: "intermediate", question: "PRACTICEQ" }));
      }
      if (path === "/api/grade") {
        return gradeGate.then(() => jsonRes({
          reasoningScore: 80, rubric: { conceptual_understanding: 4 }, correctnessNote: "n",
          socraticHint: "h", microLesson: "m", weakConcepts: [], newScoreSuggestion: 70,
        }));
      }
      return Promise.resolve(jsonRes({}));
    }));

    render(<Noobtopro />);

    // Dashboard → start a math practice question.
    fireEvent.click(await screen.findByRole("button", { name: /practice mathematics/i }));
    await screen.findByText("PRACTICEQ");

    // Write reasoning and submit (grade is now pending).
    fireEvent.change(screen.getByLabelText("Your reasoning"), { target: { value: "my reasoning" } });
    fireEvent.click(screen.getByRole("button", { name: /submit reasoning/i }));

    // Restart (brand button) while the grade is still in flight.
    fireEvent.click(screen.getByTitle("Restart"));
    await screen.findByRole("button", { name: /prove it/i }); // back at intro

    // Now let the stale grade resolve — the guard must drop it. Flush with a
    // macrotask (setTimeout 0): all queued microtasks — submitPractice's full
    // await chain (fetch → json → return → the guard, then saveProgress/setState
    // if the guard were ABSENT) — drain before the timer fires, so the assertions
    // below run AFTER submitPractice has finished. (Two `await Promise.resolve()`
    // would not reach that far, making the assertions pass trivially.)
    await act(async () => {
      resolveGrade();
      await new Promise((r) => setTimeout(r, 0));
    });

    // The abandoned grade neither persisted nor repopulated the reset UI. (If the
    // run-token guard were removed, saveProgress WOULD have been called by now and
    // the feedback panel would render — so these assertions actually exercise it.)
    expect(global.fetch).toHaveBeenCalledWith("/api/grade", expect.anything()); // the grade DID run + resolve
    expect(store.saveProgress).not.toHaveBeenCalled();
    expect(screen.queryByText(/reasoning quality this attempt/i)).toBe(null);
    expect(screen.getByRole("button", { name: /prove it/i })).toBeTruthy();
  });
});

describe("Noobtopro — beginDiagnostic rejects an incomplete question set", () => {
  it("surfaces an error (and stays on the intro) when /api/generate returns fewer than 9 questions", async () => {
    // Defense-in-depth client guard: even if a partial set slips through, beginDiagnostic
    // must not enter the diagnostic with a short set — it errors instead.
    const partial = { questions: DIAGNOSTIC.questions.slice(0, 8) }; // 8 of 9
    vi.stubGlobal("fetch", vi.fn(async (path) => {
      if (path === "/api/generate") return jsonRes(partial);
      return jsonRes({});
    }));

    render(<Noobtopro />);
    fireEvent.click(await screen.findByRole("button", { name: /prove it/i }));

    expect(await screen.findByText(/could not generate a full diagnostic/i)).toBeTruthy();
    // Did NOT advance into the diagnostic (no question rendered).
    expect(screen.queryByText(DIAGNOSTIC.questions[0].question)).toBe(null);
  });
});
