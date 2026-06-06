// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

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

const DIAGNOSTIC = {
  questions: [
    { subject: "math", topic: "t", question: "MATHQ" },
    { subject: "physics", topic: "t", question: "PHYSQ" },
    { subject: "chemistry", topic: "t", question: "CHEMQ" },
  ],
};

async function attachImageToCurrentComposer(container) {
  const input = container.querySelector('input[type="file"]');
  const file = new File(["work"], "work.png", { type: "image/png" });
  fireEvent.change(input, { target: { files: [file] } });
  // attach is async (FileReader -> base64 -> createObjectURL); wait for the preview.
  await screen.findByAltText("your work");
}

describe("Noobtopro — diagnostic image previews are revoked on completion (leak fix)", () => {
  it("revokes every answer's object URL once the diagnostic finishes and the dashboard shows", async () => {
    vi.stubGlobal("fetch", vi.fn(async (path) => {
      if (path === "/api/generate") return jsonRes(DIAGNOSTIC);
      if (path === "/api/grade") return jsonRes({ score: 55, weakConcepts: [], comment: "ok" });
      return jsonRes({});
    }));

    const { container } = render(<Noobtopro />);
    fireEvent.click(await screen.findByRole("button", { name: /begin diagnostic/i }));

    // Q1 (math): attach an image, advance.
    await screen.findByText("MATHQ");
    await attachImageToCurrentComposer(container);
    fireEvent.click(screen.getByRole("button", { name: /next question/i }));

    // Q2 (physics): attach an image, advance.
    await screen.findByText("PHYSQ");
    await attachImageToCurrentComposer(container);
    fireEvent.click(screen.getByRole("button", { name: /next question/i }));

    // Q3 (chemistry): attach an image, submit for scoring.
    await screen.findByText("CHEMQ");
    await attachImageToCurrentComposer(container);
    fireEvent.click(screen.getByRole("button", { name: /submit for scoring/i }));

    // Lands on the dashboard once grading completes.
    await screen.findByText("Where you stand");

    // Three previews were created; all three must be revoked on completion (no leak).
    expect(URL.createObjectURL).toHaveBeenCalledTimes(3);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:p0");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:p1");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:p2");
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
    await screen.findByRole("button", { name: /begin diagnostic/i }); // back at intro

    // Now let the stale grade resolve — the guard must drop it.
    resolveGrade();
    await Promise.resolve();
    await Promise.resolve();

    // The abandoned grade neither persisted nor repopulated the reset UI.
    expect(store.saveProgress).not.toHaveBeenCalled();
    expect(screen.queryByText(/reasoning quality this attempt/i)).toBe(null);
    expect(screen.getByRole("button", { name: /begin diagnostic/i })).toBeTruthy();
  });
});
