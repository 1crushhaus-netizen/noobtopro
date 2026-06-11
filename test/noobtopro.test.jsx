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
  loadMastery: vi.fn(async () => ({ mastery: {} })),
  loadReviews: vi.fn(async () => ({ reviews: [] })),
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

// ---- the ADAPTIVE diagnostic (RANKS_PLAN §8): stateful fetch-stub server ----
// /api/generate returns one signed starter per subject; each /api/score STEP
// returns that subject's next question (token encodes subject+step so the stub
// stays stateless); the 4th step completes the subject; the finalize call
// (tokens[]) returns the canned scores payload. Mirrors the real route contract
// pinned in test/api-score.test.js.
const DIAG_SUBJECTS = ["math", "physics", "chemistry"];
const DIAG_STEPS = 4;
const diagQ = (subject, stepNo) => ({
  subject,
  topic: "t",
  difficulty: "intermediate",
  question: `${subject.toUpperCase()}-Q${stepNo}`,
  stepNo,
  stepsTotal: DIAG_STEPS,
  token: `tok-${subject}-${stepNo}`,
});
function mockAdaptiveServer({ scoresPayload = {}, masteryUpdates = [], persisted = false, attempt = null } = {}) {
  const fetchMock = vi.fn(async (path, init) => {
    if (path === "/api/generate") {
      return jsonRes({ adaptive: true, stepsPerSubject: DIAG_STEPS, curated: true, questions: DIAG_SUBJECTS.map((s) => diagQ(s, 1)) });
    }
    if (path === "/api/score") {
      const body = JSON.parse(init.body);
      if (Array.isArray(body.tokens)) {
        return jsonRes({ scores: scoresPayload, persisted, attempt, masteryUpdates });
      }
      const [, subject, stepStr] = String(body.token).split("-");
      const stepNo = Number(stepStr);
      const graded = { subject, difficulty: "intermediate", reasoningScore: 60 };
      if (stepNo >= DIAG_STEPS) {
        return jsonRes({ graded, subjectComplete: true, finalToken: `final-${subject}` });
      }
      return jsonRes({ graded, next: diagQ(subject, stepNo + 1) });
    }
    return jsonRes({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// The order the adaptive flow presents questions in: the three starters, then
// each subject's next step as its grade lands (round-robin by construction).
const DIAGNOSTIC_ORDER = [];
for (let step = 1; step <= DIAG_STEPS; step++) {
  for (const s of DIAG_SUBJECTS) DIAGNOSTIC_ORDER.push(`${s.toUpperCase()}-Q${step}`);
}

async function attachImageToCurrentComposer(container) {
  const input = container.querySelector('input[type="file"]');
  const file = new File(["work"], "work.png", { type: "image/png" });
  fireEvent.change(input, { target: { files: [file] } });
  // attach is async (FileReader -> base64 -> createObjectURL); wait for the preview.
  await screen.findByAltText("your work");
}

describe("Noobtopro — adaptive diagnostic flow (steps + finalize) & preview leak fix", () => {
  it("walks all 12 steps (one grade each), finalizes once, and revokes every preview", async () => {
    // The server-derived mastery updates the guest path must hand to saveProgress —
    // this seam (Noobtopro -> store) is the feature's ONLY guest activation path.
    const MASTERY_UPDATES = [
      { subject: "math", conceptKey: "ratios_unit_rates", quality: 55 },
      { subject: "physics", conceptKey: "balanced_unbalanced_forces", quality: 40 },
    ];
    const scoresPayload = {
      math: { score: 55, weakConcepts: [], comment: "", rubric: { conceptual_understanding: 3, logical_structure: 3, strategy: 3, execution_accuracy: 3, communication: 3 } },
      physics: { score: 40, weakConcepts: [], comment: "", rubric: { conceptual_understanding: 2, logical_structure: 2, strategy: 2, execution_accuracy: 2, communication: 2 } },
      chemistry: { score: 30, weakConcepts: [], comment: "", rubric: { conceptual_understanding: 2, logical_structure: 2, strategy: 2, execution_accuracy: 2, communication: 2 } },
    };
    const fetchMock = mockAdaptiveServer({ scoresPayload, masteryUpdates: MASTERY_UPDATES });

    const { container } = render(<Noobtopro />);
    fireEvent.click(await screen.findByRole("button", { name: /prove it/i }));

    // Walk all 12 steps (3 starters, then each subject's next as its grade lands).
    // Attach an image to each so there are 12 previews; "Get ranked" on the last.
    for (let i = 0; i < DIAGNOSTIC_ORDER.length; i++) {
      const isLast = i === DIAGNOSTIC_ORDER.length - 1;
      await screen.findByText(DIAGNOSTIC_ORDER[i]);
      await attachImageToCurrentComposer(container);
      fireEvent.click(
        screen.getByRole("button", { name: isLast ? /get ranked/i : /next question/i })
      );
    }

    // Lands on the dashboard once the finalize completes.
    await screen.findByText("Where you stand");

    // 12 per-step grade calls + ONE zero-Groq finalize carrying the 3 done-tokens.
    const scoreCalls = fetchMock.mock.calls.filter(([p]) => p === "/api/score");
    expect(scoreCalls).toHaveLength(DIAGNOSTIC_ORDER.length + 1);
    const finalize = JSON.parse(scoreCalls[scoreCalls.length - 1][1].body);
    expect(finalize.kind).toBe("diagnostic");
    expect(finalize.tokens).toEqual(["final-math", "final-physics", "final-chemistry"]);
    // Every step call carried its signed token, never a raw question/difficulty.
    for (const [, init] of scoreCalls.slice(0, -1)) {
      const b = JSON.parse(init.body);
      expect(typeof b.token).toBe("string");
      expect(b.question).toBeUndefined();
      expect(b.difficulty).toBeUndefined();
    }

    // The server's masteryUpdates rode through to the guest store write (third arg) —
    // the chip-coloring seam between /api/score and lib/store.
    expect(store.saveProgress).toHaveBeenCalledTimes(1);
    expect(store.saveProgress.mock.calls[0][2]).toEqual(MASTERY_UPDATES);

    // Each subject ring is self-describing for screen readers (subject in the label).
    expect(screen.getByRole("img", { name: /Mathematics: Score \d+ of 100/ })).toBeTruthy();
    expect(screen.getByRole("img", { name: /Chemistry: Score \d+ of 100/ })).toBeTruthy();

    // Twelve previews were created; all twelve must be revoked on completion (no leak).
    expect(URL.createObjectURL).toHaveBeenCalledTimes(DIAGNOSTIC_ORDER.length);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(DIAGNOSTIC_ORDER.length);
    for (let i = 0; i < DIAGNOSTIC_ORDER.length; i++) {
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

describe("Noobtopro — beginDiagnostic rejects an incomplete adaptive start", () => {
  it("surfaces an error (and stays on the intro) when the start is missing a subject's signed starter", async () => {
    // Defense-in-depth client guard: even if a partial/legacy payload slips through,
    // beginDiagnostic must not enter the flow without one tokened starter per subject.
    const partial = { adaptive: true, stepsPerSubject: DIAG_STEPS, questions: [diagQ("math", 1), diagQ("physics", 1)] };
    vi.stubGlobal("fetch", vi.fn(async (path) => {
      if (path === "/api/generate") return jsonRes(partial);
      return jsonRes({});
    }));

    render(<Noobtopro />);
    fireEvent.click(await screen.findByRole("button", { name: /prove it/i }));

    expect(await screen.findByText(/could not start the diagnostic/i)).toBeTruthy();
    // Did NOT advance into the diagnostic (no question rendered).
    expect(screen.queryByText("MATH-Q1")).toBe(null);
  });

  it("rejects a tokenless (legacy batch) payload the same way", async () => {
    const legacy = { questions: DIAG_SUBJECTS.map((s) => ({ subject: s, difficulty: "beginner", question: `${s}-OLD` })) };
    vi.stubGlobal("fetch", vi.fn(async (path) => (path === "/api/generate" ? jsonRes(legacy) : jsonRes({}))));
    render(<Noobtopro />);
    fireEvent.click(await screen.findByRole("button", { name: /prove it/i }));
    expect(await screen.findByText(/could not start the diagnostic/i)).toBeTruthy();
  });
});

describe("Noobtopro — time-locked 'I don't know' skip", () => {
  it("locks the skip for 10s, then advances and submits the skip as ONE empty signed step (server docks it — no Groq)", async () => {
    vi.useFakeTimers();
    const fetchMock = mockAdaptiveServer({});

    await act(async () => { render(<Noobtopro />); await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /prove it/i })); await vi.advanceTimersByTimeAsync(0); });

    // The math starter is shown first.
    expect(screen.getByText("MATH-Q1")).toBeTruthy();
    // You can't advance an EMPTY answer via the normal button (it's disabled)...
    expect(screen.getByRole("button", { name: /next question/i }).disabled).toBe(true);
    // ...and the "I don't know" skip is LOCKED for the first 10 seconds.
    const skip = () => screen.getByRole("button", { name: /i don't know/i });
    expect(skip().disabled).toBe(true);

    // After the 10-second lock it unlocks.
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(skip().disabled).toBe(false);

    // Clicking it advances straight to the next subject's starter (interleaving),
    // firing exactly ONE step call whose answer is EMPTY — the server's
    // deterministic dock grades it with no Groq call (and walks the band down).
    await act(async () => { fireEvent.click(skip()); await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText("PHYSICS-Q1")).toBeTruthy();
    const stepCalls = fetchMock.mock.calls.filter(([p]) => p === "/api/score");
    expect(stepCalls).toHaveLength(1);
    const body = JSON.parse(stepCalls[0][1].body);
    expect(body.token).toBe("tok-math-1");
    expect(body.reasoning).toBe("");

    vi.useRealTimers();
  });
});

// ---- review round: skip-lock keystroke immunity + prepareImage guards ----------
describe("Noobtopro — skip-lock is immune to keystrokes (audit P2-15)", () => {
  it("typing mid-countdown does NOT restart the 10s lock — it is 10s per QUESTION, not per keystroke", async () => {
    vi.useFakeTimers();
    mockAdaptiveServer({});
    await act(async () => { render(<Noobtopro />); await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /prove it/i })); await vi.advanceTimersByTimeAsync(0); });
    const skip = () => screen.getByRole("button", { name: /i don't know/i });
    expect(skip().disabled).toBe(true);

    // 9 seconds in, the learner types (parent state changes → AnswerComposer re-renders
    // with a FRESH onSkip identity — the pre-fix effect dep that reset the timer).
    await act(async () => { await vi.advanceTimersByTimeAsync(9000); });
    fireEvent.change(screen.getByLabelText("Your reasoning"), { target: { value: "hmm, maybe I" } });
    // One more second completes the ORIGINAL 10s window; pre-fix this was a fresh 10s.
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(skip().disabled).toBe(false);

    vi.useRealTimers();
  });
});

describe("Noobtopro — attach-time image preparation (audit P1-2)", () => {
  async function startDiagnostic() {
    mockAdaptiveServer({});
    const utils = render(<Noobtopro />);
    fireEvent.click(await screen.findByRole("button", { name: /prove it/i }));
    await screen.findByText(DIAGNOSTIC_ORDER[0]);
    return utils;
  }

  it("rejects a non-image file type AT ATTACH TIME with a clear message (no preview, no crash later)", async () => {
    const { container } = await startDiagnostic();
    const input = container.querySelector('input[type="file"]');
    const file = new File(["not an image"], "notes.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });
    await screen.findByText(/isn't supported/i);
    expect(screen.queryByAltText("your work")).toBeNull();
  });

  it("rejects an oversized original when the canvas path is unavailable (jsdom) — the diagnostic can never 413", async () => {
    const { container } = await startDiagnostic();
    const input = container.querySelector('input[type="file"]');
    // jsdom has no 2D canvas, so prepareImage takes the size-capped fallback; a >2.5MB
    // original must be refused at attach (pre-fix it shipped and 413'd the whole submit).
    const big = new File([new Uint8Array(2_600_000)], "photo.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [big] } });
    await screen.findByText(/too large to grade/i);
    expect(screen.queryByAltText("your work")).toBeNull();
  });

  it("accepts a small image via the fallback path (preview appears)", async () => {
    const { container } = await startDiagnostic();
    await attachImageToCurrentComposer(container);
    expect(screen.getByAltText("your work")).toBeTruthy();
  });
});

describe("Noobtopro — AI concept-practice drill flow (increment 3)", () => {
  it("the Learn-tab concept page's 'Practice this concept' button generates a concept-targeted question and enters practice", async () => {
    // A diagnosed learner (scores present) so the Learn tab is reachable.
    store.loadState.mockResolvedValue({
      scores: {
        math: { score: 50, weakConcepts: [], comment: "", rubric: null, glicko: null },
        physics: { score: 40, weakConcepts: [], comment: "", rubric: null, glicko: null },
        chemistry: { score: 30, weakConcepts: [], comment: "", rubric: null, glicko: null },
      },
      history: [],
    });
    const fetchMock = vi.fn(async (path, opts) => {
      if (path === "/api/generate") {
        const body = JSON.parse(opts.body);
        // Echo back a concept-tagged, token-bearing question the way the real route would.
        return jsonRes({
          subject: body.subject, topic: "Algebra", topicSlug: "algebra",
          targetConcept: "Quadratic functions & equations", difficulty: "intermediate",
          reasoningSurface: "multi-step", question: "DRILL-Q: solve x^2-5x+6=0, explain.",
          conceptKey: body.conceptKey, token: "tok-drill",
        });
      }
      return jsonRes({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Noobtopro />);
    // Go to the Learn tab.
    fireEvent.click(await screen.findByRole("button", { name: /^Learn$/ }));
    // Open the Quadratics concept page.
    fireEvent.click(await screen.findByRole("button", { name: "Quadratic functions & equations" }));
    // Click the drill button.
    fireEvent.click(await screen.findByRole("button", { name: /practice this concept/i }));

    // It generated a CONCEPT-TARGETED question (the conceptKey is sent)...
    const genCall = await waitFor(() => {
      const c = fetchMock.mock.calls.find(([p]) => p === "/api/generate");
      expect(c).toBeTruthy();
      return c;
    });
    expect(JSON.parse(genCall[1].body)).toMatchObject({ kind: "practice", subject: "math", conceptKey: "quadratics" });
    // ...and entered the practice flow with the server's question.
    expect(await screen.findByText(/DRILL-Q/)).toBeTruthy();
  });
});

describe("Noobtopro — guest concept-drill updates mastery end-to-end (increment 3)", () => {
  it("a guest who drills a concept and submits sends the conceptKey mastery update to saveProgress (3rd arg)", async () => {
    store.loadState.mockResolvedValue({
      scores: {
        math: { score: 50, weakConcepts: [], comment: "", rubric: null, glicko: null },
        physics: { score: 40, weakConcepts: [], comment: "", rubric: null, glicko: null },
        chemistry: { score: 30, weakConcepts: [], comment: "", rubric: null, glicko: null },
      },
      history: [],
    });
    store.saveProgress.mockResolvedValue({ history: [] });
    const RUBRIC = { comprehension: 3, principle: 3, justification: 3, strategy: 3, logic: 3, execution_method: 3, computation: 3, verification: 3, communication: 3 };
    const fetchMock = vi.fn(async (path, opts) => {
      if (path === "/api/generate") {
        const body = JSON.parse(opts.body);
        return jsonRes({
          subject: body.subject, topic: "Algebra", topicSlug: "algebra",
          targetConcept: "Quadratic functions & equations", difficulty: "intermediate",
          reasoningSurface: "multi-step", question: "DRILL-Q2: solve x^2-1=0.",
          conceptKey: body.conceptKey, token: "tok-drill2",
        });
      }
      if (path === "/api/grade") {
        return jsonRes({ reasoningScore: 75, rubric: RUBRIC, weakConcepts: [], strengths: [], improvements: [], correctnessNote: "", socraticHint: "", microLesson: "", solve: null, errors: [], finalAnswerMatches: false });
      }
      return jsonRes({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Noobtopro />);
    fireEvent.click(await screen.findByRole("button", { name: /^Learn$/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Quadratic functions & equations" }));
    fireEvent.click(await screen.findByRole("button", { name: /practice this concept/i }));
    await screen.findByText(/DRILL-Q2/);

    fireEvent.change(screen.getByLabelText("Your reasoning"), { target: { value: "x = ±1 because x^2 = 1; I factored (x-1)(x+1)." } });
    fireEvent.click(screen.getByRole("button", { name: /submit reasoning/i }));

    // Guest grading goes through /api/grade (NOT /api/score), and saveProgress receives
    // the concept's mastery update as its third arg — the conceptKey came from the
    // drill's /api/generate response (the increment-3 guest activation path).
    await waitFor(() => expect(store.saveProgress).toHaveBeenCalled());
    const call = store.saveProgress.mock.calls.find((c) => Array.isArray(c[2]) && c[2].length);
    expect(call).toBeTruthy();
    expect(call[2]).toEqual([{ subject: "math", conceptKey: "quadratics", quality: 75 }]);
    expect(fetchMock.mock.calls.some(([p]) => p === "/api/score")).toBe(false); // guest path
  });
});
