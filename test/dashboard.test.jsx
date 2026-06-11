// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import Dashboard from "@/components/Dashboard";
import { conceptsFor } from "@/lib/curriculum";

afterEach(cleanup);

const user = { email: "ada@example.com", user_metadata: { full_name: "Ada Lovelace" } };

const scores = {
  math: { score: 210, weakConcepts: [], comment: "" },
  physics: { score: 105, weakConcepts: [], comment: "" },
  chemistry: { score: 0, weakConcepts: [], comment: "" },
};

// A baseline + two graded attempts → 3 line points, 2 bars, 2 rationales.
const history = [
  { type: "baseline", t: "t0", totalAfter: 40, phdAfter: 13 },
  { type: "attempt", t: "t1", subject: "math", delta: 5, newScore: 45, totalAfter: 70, phdAfter: 23, rationale: "Sound derivation." },
  { type: "attempt", t: "t2", subject: "physics", delta: -2, newScore: 28, totalAfter: 90, phdAfter: 30, rationale: "Missed a force." },
];

const scoresWithRubric = {
  math: {
    score: 210,
    weakConcepts: ["chain rule"],
    comment: "",
    rubric: { comprehension: 3, principle: 1, justification: 2, strategy: 2, logic: 2, execution_method: 3, computation: 4, verification: 1, communication: 3 },
  },
  physics: {
    score: 105,
    weakConcepts: [],
    comment: "",
    rubric: { comprehension: 2, principle: 2, justification: 2, strategy: 2, logic: 2, execution_method: 2, computation: 2, verification: 2, communication: 2 },
  },
  chemistry: { score: 0, weakConcepts: [], comment: "" }, // no rubric → excluded from the radar
};

function statCard(label) {
  return screen.getByText(label).closest(".np-statcard");
}

describe("Dashboard — signed-in identity + KPIs + by-subject", () => {
  it("does NOT duplicate identity in the bento (it lives in the app sidebar); the not-ranked empty state still shows it", () => {
    // Ranked: the bento's top row is purely KPIs — no name/email bar.
    render(<Dashboard user={user} scores={scores} history={history} onPractice={() => {}} />);
    expect(screen.queryByText("Ada Lovelace")).toBe(null);
    expect(screen.queryByText("ada@example.com")).toBe(null);
    cleanup();
    // Not ranked yet: there's no sidebar context worth scanning, so the empty
    // state keeps the identity card.
    render(<Dashboard user={user} scores={null} history={[]} onPractice={() => {}} />);
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("ada@example.com")).toBeTruthy();
  });

  it("renders ONE deduped KPI cluster (total, PhD index, problems graded)", () => {
    render(<Dashboard user={user} scores={scores} history={history} onPractice={() => {}} />);
    // total = 210+105+0 = 315; phdIndex = round(315/3) = 105; attempts = 2.
    expect(statCard("Total points").querySelector(".np-statnum").textContent).toContain("315");
    expect(statCard("Doctorate index").querySelector(".np-statnum").textContent).toContain("105");
    expect(statCard("Problems graded").querySelector(".np-statnum").textContent).toBe("2");
    // Each KPI label appears exactly once (one deduped cluster, no duplicate block).
    expect(screen.getAllByText(/Total points/i).length).toBe(1);
    expect(screen.getAllByText(/Doctorate index/i).length).toBe(1);
    expect(screen.getAllByText(/Problems graded/i).length).toBe(1);
  });

  it("renders the by-subject breakdown with all three subjects", () => {
    render(<Dashboard user={user} scores={scores} history={history} onPractice={() => {}} />);
    expect(screen.getByText("Mathematics")).toBeTruthy();
    expect(screen.getByText("Physics")).toBeTruthy();
    expect(screen.getByText("Chemistry")).toBeTruthy();
  });

  it("shows per-subject rank band chips (the overall rank chip moved to the sidebar identity)", () => {
    render(<Dashboard user={user} scores={scores} history={history} onPractice={() => {}} />);
    // physics 105 → "Middle" on its by-subject band chip.
    expect(screen.getAllByText(/Middle/i).length).toBeGreaterThan(0);
  });
});

describe("Dashboard — §7 curriculum breadth gate (by-subject, display-layer)", () => {
  // Every math elementary concept green (≥2 hits at ≥70 — lib/mastery.js).
  function elementaryMathGreens() {
    const subj = {};
    for (const c of conceptsFor("math", "elementary")) {
      subj[c.key] = { attempts: 2, greenHits: 2, lastQuality: 85, bestQuality: 90 };
    }
    return { math: subj };
  }

  it("with no mastery data, a scored subject is GATED: first-band chip + lock explanation; the score is untouched", () => {
    render(<Dashboard user={user} scores={scores} history={history} onPractice={() => {}} />);
    // math score 210 → depth says University, but nothing is mastered → chip gated down.
    expect(screen.getAllByText("Elementary").length).toBeGreaterThan(0);
    expect(screen.getByText(/Score at University — master the 21 remaining Elementary concepts in Learn to advance/)).toBeTruthy();
    // The score itself is NOT capped (§11.3 Option B — label gating only).
    expect(screen.getAllByText("210").length).toBeGreaterThan(0);
  });

  it("loads mastery via the injected loader and UNGATES bands whose lower curricula are covered", async () => {
    const loadMastery = vi.fn(async () => ({ mastery: elementaryMathGreens() }));
    // math depth = Middle; physics/chemistry at 0 so no OTHER subject is gated.
    const s = {
      math: { score: 105, weakConcepts: [], comment: "" },
      physics: { score: 0, weakConcepts: [], comment: "" },
      chemistry: { score: 0, weakConcepts: [], comment: "" },
    };
    render(<Dashboard user={user} scores={s} history={history} onPractice={() => {}} loadMastery={loadMastery} />);
    await waitFor(() => expect(loadMastery).toHaveBeenCalledTimes(1));
    // Elementary fully covered → Foundational holds ungated; the next gate is Middle's set.
    await waitFor(() => expect(screen.getByText(/Middle curriculum: 0\/23 mastered/)).toBeTruthy());
    expect(screen.queryByText(/Score at Middle/)).toBeNull(); // no lock line for math
  });

  it("an ungated bottom-band subject shows its own rank's coverage progress (the nudge, not a lock)", () => {
    render(<Dashboard user={user} scores={scores} history={history} onPractice={() => {}} />);
    // chemistry score 0 → Elementary, ungated → progress toward Middle.
    expect(screen.getByText(/Elementary curriculum: 0\/9 mastered/)).toBeTruthy();
  });

  it("the guest gate never calls loadMastery (no data fetches for guests)", () => {
    const loadMastery = vi.fn();
    render(<Dashboard user={null} scores={null} history={[]} loadMastery={loadMastery} onSignIn={() => {}} />);
    expect(loadMastery).not.toHaveBeenCalled();
  });
});

describe("Dashboard — reasoning radar + what-to-work-on", () => {
  it("renders the radar with an accessible name covering the profiled subjects", () => {
    render(<Dashboard user={user} scores={scoresWithRubric} history={history} onPractice={() => {}} />);
    const radar = screen.getByRole("img", { name: /reasoning profile across the \d+ rubric dimensions/i });
    expect(radar.getAttribute("aria-label")).toMatch(/Mathematics/);
    expect(radar.getAttribute("aria-label")).toMatch(/Physics/);
    expect(radar.getAttribute("aria-label")).not.toMatch(/Chemistry/);
  });

  it("links a weak concept to the Learn tab from 'what to work on'", () => {
    const onLearn = vi.fn();
    render(<Dashboard user={user} scores={scoresWithRubric} history={history} onPractice={() => {}} onLearn={onLearn} />);
    // Only math has a weak concept among the profiled subjects → exactly one "Learn this".
    fireEvent.click(screen.getByText("Learn this"));
    expect(onLearn).toHaveBeenCalledWith("math", "chain rule");
  });

  it("does NOT render the radar before any subject has a rubric", () => {
    render(<Dashboard user={user} scores={scores} history={history} onPractice={() => {}} />);
    expect(screen.queryByRole("img", { name: /reasoning profile/i })).toBe(null);
    expect(screen.getByText(/finish the diagnostic to see your reasoning profile/i)).toBeTruthy();
  });
});

describe("Dashboard — leaderboard, reset, empty state", () => {
  it("renders the anonymous-tiers leaderboard (distribution + own position, NO identities)", async () => {
    const tiers = {
      overall: { counts: [3, 2, 1, 0, 0], total: 6, you: { band: 1, score: 30, above: 3 } },
      math: { counts: [1, 1, 2, 1, 1], total: 6, you: { band: 3, score: 60, above: 2 } },
      physics: { counts: [4, 1, 1, 0, 0], total: 6, you: { band: 0, score: 10, above: 5 } },
      chemistry: { counts: [0, 1, 2, 2, 1], total: 6, you: { band: 4, score: 90, above: 0 } },
    };
    const loadLeaderboard = vi.fn(async () => ({ tiers }));
    render(<Dashboard user={user} scores={scores} history={history} loadLeaderboard={loadLeaderboard} onPractice={() => {}} />);
    expect(screen.getByText("Leaderboard")).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText(/You're/i).length).toBeGreaterThan(0));
    expect(loadLeaderboard).toHaveBeenCalled();
    expect(screen.getAllByText(/ranked/i).length).toBeGreaterThan(0);
  });

  it("does NOT render a duplicate Sign out (it lives once in the global header)", () => {
    render(<Dashboard user={user} scores={scores} history={history} onSignOut={vi.fn()} onPractice={() => {}} />);
    // Sign out is rendered by the app header (Noobtopro), not the Dashboard, so the
    // signed-in dashboard must not show a second Sign out control.
    expect(screen.queryByRole("button", { name: /sign out/i })).toBeNull();
  });

  it("fires onReset only after confirmation", () => {
    const onReset = vi.fn();
    render(<Dashboard user={user} scores={scores} history={history} onReset={onReset} onPractice={() => {}} />);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: /reset my progress/i }));
    expect(onReset).not.toHaveBeenCalled();
    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: /reset my progress/i }));
    expect(onReset).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("shows the 'Not ranked yet' empty state + 'Prove it' CTA when there are no scores", () => {
    const onStartDiagnostic = vi.fn();
    render(<Dashboard user={user} scores={null} history={[]} onStartDiagnostic={onStartDiagnostic} />);
    expect(screen.getByText(/not ranked yet/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /prove it/i }));
    expect(onStartDiagnostic).toHaveBeenCalled();
  });
});

describe("Dashboard — drawers (trends + answer review)", () => {
  it("keeps trend charts in a drawer: hidden until 'See trends' opens it, Escape closes", async () => {
    render(<Dashboard user={user} scores={scores} history={history} onPractice={() => {}} />);
    // Closed by default — the line/bar charts are not in the tree.
    expect(screen.queryByRole("img", { name: /total points over time/i })).toBe(null);
    expect(screen.queryByRole("img", { name: /across 2 graded attempts/i })).toBe(null);

    fireEvent.click(screen.getByRole("button", { name: /see trends/i }));
    const dialog = await screen.findByRole("dialog", { name: /trends over time/i });
    expect(dialog).toBeTruthy();
    expect(screen.getByRole("img", { name: /total points over time.*ending at 90 of 1050/i })).toBeTruthy();
    expect(screen.getByRole("img", { name: /across 2 graded attempts/i })).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /trends over time/i })).toBe(null));
  });

  it("loads answer reviews LAZILY — only after the Review drawer is opened", async () => {
    const loadReviews = vi.fn(async () => ({ reviews: [] }));
    render(<Dashboard user={user} scores={scores} history={history} loadReviews={loadReviews} onPractice={() => {}} />);
    // Not called on mount.
    expect(loadReviews).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /review your answers/i }));
    await screen.findByRole("dialog", { name: /review your answers/i });
    await waitFor(() => expect(loadReviews).toHaveBeenCalled());
  });

  it("moves focus into the drawer on open (close button focused)", async () => {
    render(<Dashboard user={user} scores={scores} history={history} onPractice={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /see trends/i }));
    await screen.findByRole("dialog", { name: /trends over time/i });
    const close = screen.getByRole("button", { name: /close/i });
    await waitFor(() => expect(document.activeElement).toBe(close));
  });

  it("traps Tab focus inside an open drawer (wraps last↔first — WCAG 2.4.3)", async () => {
    const reviews = [
      { subject: "math", question: "Evaluate the limit.", answer: "By L'Hôpital…", targetConcept: "limits", reasoningScore: 80, delta: 2, rubric: null, feedback: {} },
    ];
    const loadReviews = vi.fn(async () => ({ reviews }));
    render(<Dashboard user={user} scores={scores} history={history} loadReviews={loadReviews} onPractice={() => {}} onLearn={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /review your answers/i }));
    const dialog = await screen.findByRole("dialog", { name: /review your answers/i });
    await screen.findByText(/limits/i); // reviews loaded → action buttons present

    const SEL = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
    const focusables = dialog.querySelectorAll(SEL);
    expect(focusables.length).toBeGreaterThan(1);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    last.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(first); // Tab on last wraps to first

    first.focus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last); // Shift+Tab on first wraps to last
  });

  it("restores focus to the trigger after the drawer closes", async () => {
    render(<Dashboard user={user} scores={scores} history={history} onPractice={() => {}} />);
    const trigger = screen.getByRole("button", { name: /see trends/i });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole("dialog", { name: /trends over time/i });
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});

describe("Dashboard — guest gate", () => {
  it("gates guests behind a sign-in prompt and fires NO auth-only fetches", () => {
    const loadLeaderboard = vi.fn(async () => ({ tiers: {} }));
    const loadReviews = vi.fn(async () => ({ reviews: [] }));
    const onSignIn = vi.fn();
    render(
      <Dashboard
        user={null}
        scores={scores}
        history={history}
        loadLeaderboard={loadLeaderboard}
        loadReviews={loadReviews}
        onSignIn={onSignIn}
        onPractice={() => {}}
      />
    );
    // The sign-in prompt is shown.
    expect(screen.getByText(/sign in to see your dashboard/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    expect(onSignIn).toHaveBeenCalled();

    // The real dashboard never mounts for a guest → no leaderboard, no review fetch.
    expect(screen.queryByText("Leaderboard")).toBe(null);
    expect(loadLeaderboard).not.toHaveBeenCalled();
    expect(loadReviews).not.toHaveBeenCalled();
  });
});
