// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import Dashboard from "@/components/Dashboard";
import { conceptsFor } from "@/lib/curriculum";

afterEach(cleanup);

const user = { email: "ada@example.com", user_metadata: { full_name: "Ada Lovelace", age_ack_year: 2000 } };

const scores = {
  math: { score: 210, weakConcepts: [], comment: "" },
  physics: { score: 105, weakConcepts: [], comment: "" },
  chemistry: { score: 0, weakConcepts: [], comment: "" },
};

const ALL_RANKS = ["elementary", "middle", "high", "university", "doctorate"];
const GREEN = { attempts: 2, greenHits: 2, lastQuality: 85, bestQuality: 90 };
// Every concept of every subject green → coverage 1, so the mastery-blended score
// (depth × coverage) equals the raw depth (the fixture for "full mastery = full rank").
function fullCoverageAll() {
  const m = {};
  for (const subject of ["math", "physics", "chemistry"]) {
    const subj = {};
    for (const rank of ALL_RANKS) for (const c of conceptsFor(subject, rank)) subj[c.key] = { ...GREEN };
    m[subject] = subj;
  }
  return m;
}
const totalConcepts = (subject) => ALL_RANKS.reduce((a, r) => a + conceptsFor(subject, r).length, 0);

// A baseline + two graded attempts → 3 line points, 2 bars, 2 rationales.
const history = [
  { type: "baseline", t: "t0", totalAfter: 40, phdAfter: 13 },
  { type: "attempt", t: "t1", subject: "math", delta: 5, newScore: 45, totalAfter: 70, phdAfter: 23, rationale: "Sound derivation." },
  { type: "attempt", t: "t2", subject: "physics", delta: -2, newScore: 28, totalAfter: 90, phdAfter: 30, rationale: "Missed a force." },
];

const scoresWithRubric = {
  math: {
    // Legacy free-text weak concept (pre-key grader). The dashboard must resolve it
    // to a real curriculum concept and deep-link there — not pass the raw phrase.
    score: 210,
    weakConcepts: ["isolating variable in linear equations"],
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
    // The KPIs are MASTERY-BLENDED (depth × coverage). With the curriculum fully
    // mastered the blend is the identity, so the totals equal the raw depth.
    render(<Dashboard user={user} scores={scores} mastery={fullCoverageAll()} history={history} onPractice={() => {}} />);
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

  it("shows per-subject rank band chips reflecting the mastery-blended score", () => {
    // physics depth 105, fully mastered → blended 105 → "Middle" on its by-subject chip.
    render(<Dashboard user={user} scores={scores} mastery={fullCoverageAll()} history={history} onPractice={() => {}} />);
    expect(screen.getAllByText(/Middle/i).length).toBeGreaterThan(0);
  });
});

describe("Dashboard — mastery-blended score (by-subject, display-layer)", () => {
  // Every math elementary concept green (≥2 hits at ≥70 — lib/mastery.js).
  function elementaryMathGreens() {
    const subj = {};
    for (const c of conceptsFor("math", "elementary")) {
      subj[c.key] = { ...GREEN };
    }
    return { math: subj };
  }

  it("with no mastery, a high-depth subject is FLOORED at its earned band (keeps University, not Elementary)", () => {
    render(<Dashboard user={user} scores={scores} history={history} onPractice={() => {}} />);
    // math depth 210 (University band floor), 0 concepts mastered → the blend is floored at
    // 210 so the learner KEEPS University rather than cratering to Elementary (the rollout fix).
    expect(screen.getAllByText("University").length).toBeGreaterThan(0);
    // The floored headline (210) is shown, and the row still tells them what's left to master.
    expect(
      screen.getByText(/Reasoning depth 210.*0\/\d+ mastered.*master \d+ more concepts in Learn to raise your score/)
    ).toBeTruthy();
    expect(screen.getAllByText("210").length).toBeGreaterThan(0);
  });

  it("loads mastery via the injected loader and the blended score reflects the new coverage", async () => {
    const eCount = conceptsFor("math", "elementary").length;
    const total = totalConcepts("math");
    const loadMastery = vi.fn(async () => ({ mastery: elementaryMathGreens() }));
    const s = {
      math: { score: 105, weakConcepts: [], comment: "" },
      physics: { score: 0, weakConcepts: [], comment: "" },
      chemistry: { score: 0, weakConcepts: [], comment: "" },
    };
    render(<Dashboard user={user} scores={s} history={history} onPractice={() => {}} loadMastery={loadMastery} />);
    await waitFor(() => expect(loadMastery).toHaveBeenCalledTimes(1));
    // The math row now reports its mastered elementary concepts toward total coverage.
    await waitFor(() =>
      expect(screen.getByText(new RegExp(`Reasoning depth 105.*${eCount}\\/${total} mastered`))).toBeTruthy()
    );
  });

  it("an un-mastered subject surfaces its reasoning depth and how much is left to master", () => {
    render(<Dashboard user={user} scores={scores} history={history} onPractice={() => {}} />);
    const total = totalConcepts("chemistry");
    // chemistry depth 0, nothing mastered → "Reasoning depth 0 · 0/<total> mastered".
    expect(screen.getByText(new RegExp(`Reasoning depth 0.*0\\/${total} mastered`))).toBeTruthy();
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
    // The legacy free-text phrase resolves to its curriculum key so Learn can deep-link.
    fireEvent.click(screen.getByText("Learn this"));
    expect(onLearn).toHaveBeenCalledWith("math", "linear_equations_two_var");
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

  it("FIX 8: an UNVERIFIED caller sees a PROVISIONAL placement (no rank) with attempts remaining", async () => {
    // The server marks the caller's own row provisional (a freshly-migrated guest score):
    // it carries band/score for visibility but NO `above`, plus `needed` graded attempts.
    const tiers = {
      overall: { counts: [2, 1, 0, 0, 0], total: 3, you: { band: 3, score: 250, provisional: true, needed: 5 } },
      math: { counts: [1, 1, 1, 0, 0], total: 3, you: { band: 3, score: 250, provisional: true, needed: 5 } },
    };
    const loadLeaderboard = vi.fn(async () => ({ tiers }));
    render(<Dashboard user={user} scores={scores} history={history} loadLeaderboard={loadLeaderboard} onPractice={() => {}} />);
    await waitFor(() => expect(screen.getByText(/provisional/i)).toBeTruthy());
    expect(screen.getByText(/5 more graded attempts/i)).toBeTruthy();
    // No real rank caption for a provisional user.
    expect(screen.queryByText(/You're/i)).toBeNull();
    expect(screen.queryByText(/top \d+%/i)).toBeNull();
  });

  it("does NOT render a duplicate Sign out (it lives once in the global header)", () => {
    render(<Dashboard user={user} scores={scores} history={history} onSignOut={vi.fn()} onPractice={() => {}} />);
    // Sign out is rendered by the app header (Noobtopro), not the Dashboard, so the
    // signed-in dashboard must not show a second Sign out control.
    expect(screen.queryByRole("button", { name: /sign out/i })).toBeNull();
  });

  it("fires onReset only after confirming in the dialog (open + No never call it; Yes does)", async () => {
    const onReset = vi.fn();
    render(<Dashboard user={user} scores={scores} history={history} onReset={onReset} onPractice={() => {}} />);
    // Opening the confirm dialog must NOT delete anything.
    fireEvent.click(screen.getByRole("button", { name: /reset my progress/i }));
    expect(screen.getByRole("dialog", { name: /are you sure/i })).toBeTruthy();
    expect(onReset).not.toHaveBeenCalled();
    // "No" cancels.
    fireEvent.click(screen.getByRole("button", { name: /^no$/i }));
    expect(screen.queryByRole("dialog", { name: /are you sure/i })).toBeNull();
    expect(onReset).not.toHaveBeenCalled();
    // Reopen + "Yes" confirms.
    fireEvent.click(screen.getByRole("button", { name: /reset my progress/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^yes$/i }));
    });
    expect(onReset).toHaveBeenCalledTimes(1);
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
  it("keeps trend charts in a drawer: hidden until 'See trends' opens it, fetched lazily, Escape closes", async () => {
    // "Progress trends" is Pro: the chart series is fetched on open via loadTrends() ->
    // /api/trends (db/migrations/0024), NOT from the free in-memory history. The trend
    // events carry the cumulative totalAfter the line chart plots.
    const trends = [
      { type: "baseline", subject: null, delta: 0, totalAfter: 40 },
      { type: "attempt", subject: "math", delta: 5, totalAfter: 70 },
      { type: "attempt", subject: "physics", delta: -2, totalAfter: 90 },
    ];
    const loadTrends = vi.fn(async () => ({ trends }));
    render(<Dashboard user={user} scores={scores} history={history} isPro loadTrends={loadTrends} onPractice={() => {}} />);
    // Closed by default — the line/bar charts are not in the tree, and the fetch is lazy.
    expect(screen.queryByRole("img", { name: /total points over time/i })).toBe(null);
    expect(screen.queryByRole("img", { name: /across 2 graded attempts/i })).toBe(null);
    expect(loadTrends).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /see trends/i }));
    const dialog = await screen.findByRole("dialog", { name: /trends over time/i });
    expect(dialog).toBeTruthy();
    // Charts appear only after the Pro-gated fetch resolves.
    expect(await screen.findByRole("img", { name: /total points over time.*ending at 90 of 1050/i })).toBeTruthy();
    expect(screen.getByRole("img", { name: /across 2 graded attempts/i })).toBeTruthy();
    expect(loadTrends).toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /trends over time/i })).toBe(null));
  });

  it("loads answer reviews LAZILY — only after the Review drawer is opened", async () => {
    const loadReviews = vi.fn(async () => ({ reviews: [] }));
    render(<Dashboard user={user} scores={scores} history={history} isPro loadReviews={loadReviews} onPractice={() => {}} />);
    // Not called on mount.
    expect(loadReviews).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /review your answers/i }));
    await screen.findByRole("dialog", { name: /review your answers/i });
    await waitFor(() => expect(loadReviews).toHaveBeenCalled());
  });

  it("moves focus into the drawer on open (close button focused)", async () => {
    render(<Dashboard user={user} scores={scores} history={history} isPro onPractice={() => {}} />);
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
    render(<Dashboard user={user} scores={scores} history={history} isPro loadReviews={loadReviews} onPractice={() => {}} onLearn={() => {}} />);
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
    render(<Dashboard user={user} scores={scores} history={history} isPro onPractice={() => {}} />);
    const trigger = screen.getByRole("button", { name: /see trends/i });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole("dialog", { name: /trends over time/i });
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});

describe("Dashboard — Pro gating (trends + answer history)", () => {
  it("with Pro LIVE, a non-Pro user's 'See trends' opens the upgrade flow (no drawer) and never fetches reviews", async () => {
    const onUpgrade = vi.fn();
    const loadReviews = vi.fn(async () => ({ reviews: [] }));
    render(
      <Dashboard user={user} scores={scores} history={history} proEnabled isPro={false} onUpgrade={onUpgrade} loadReviews={loadReviews} onPractice={() => {}} />
    );
    fireEvent.click(screen.getByRole("button", { name: /see trends/i }));
    fireEvent.click(screen.getByRole("button", { name: /review your answers/i }));
    // Upgrade flow fired; no drawer mounted; the Pro-only review data was never loaded.
    expect(onUpgrade).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog", { name: /trends over time/i })).toBe(null);
    expect(loadReviews).not.toHaveBeenCalled();
  });

  it("with Pro LIVE, a non-Pro user sees an 'Upgrade to Pro' CTA wired to onUpgrade; no Pro badge", () => {
    const onUpgrade = vi.fn();
    render(<Dashboard user={user} scores={scores} history={history} proEnabled isPro={false} onUpgrade={onUpgrade} onPractice={() => {}} />);
    const cta = screen.getByRole("button", { name: /upgrade to pro/i });
    fireEvent.click(cta);
    expect(onUpgrade).toHaveBeenCalled();
    expect(screen.queryByText(/^Pro$/)).toBe(null); // no Pro badge for a free user
    expect(screen.queryByRole("button", { name: /manage subscription/i })).toBe(null);
  });

  it("a Pro user gets the Pro badge + 'Manage subscription' (wired to onManageSubscription), and the drawers open", async () => {
    const onManage = vi.fn();
    render(<Dashboard user={user} scores={scores} history={history} proEnabled isPro onManageSubscription={onManage} onPractice={() => {}} />);
    // Pro badge present; no upgrade CTA.
    expect(screen.getByText(/^Pro$/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /upgrade to pro/i })).toBe(null);
    fireEvent.click(screen.getByRole("button", { name: /manage subscription/i }));
    expect(onManage).toHaveBeenCalled();
    // The trends drawer actually opens for a Pro user.
    fireEvent.click(screen.getByRole("button", { name: /see trends/i }));
    expect(await screen.findByRole("dialog", { name: /trends over time/i })).toBeTruthy();
  });

  it("when Pro is NOT sold (proEnabled=false), nothing is gated: 'See trends' opens the drawer and there's no upgrade CTA", async () => {
    const onUpgrade = vi.fn();
    render(<Dashboard user={user} scores={scores} history={history} isPro={false} onUpgrade={onUpgrade} onPractice={() => {}} />);
    expect(screen.queryByRole("button", { name: /upgrade to pro/i })).toBe(null);
    expect(screen.queryByText(/^Pro$/)).toBe(null);
    fireEvent.click(screen.getByRole("button", { name: /see trends/i }));
    expect(await screen.findByRole("dialog", { name: /trends over time/i })).toBeTruthy();
    expect(onUpgrade).not.toHaveBeenCalled();
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

describe("Dashboard — EU withdrawal control (CRD Art. 11a)", () => {
  const DAY = 24 * 60 * 60 * 1000;

  it("offers 'Withdraw from contract here' to an in-window Pro user; confirming calls onWithdraw and shows the durable confirmation", async () => {
    const onWithdraw = vi.fn(async () => ({
      ok: true,
      withdrawnAt: "2026-06-18T10:00:00Z",
      refund: { status: "issued", amountMinor: 933, currency: "eur" },
    }));
    const withdrawalUntil = new Date(Date.now() + 5 * DAY).toISOString();
    render(
      <Dashboard
        user={user}
        scores={scores}
        history={history}
        isPro
        proEnabled
        onWithdraw={onWithdraw}
        withdrawalUntil={withdrawalUntil}
        onManageSubscription={() => {}}
        onPractice={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /withdraw from contract here/i }));
    // The confirm dialog explains withdraw ≠ cancel; confirming runs the withdrawal.
    await screen.findByRole("dialog", { name: /withdraw from your subscription/i });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm withdrawal/i }));
    });
    await waitFor(() => expect(onWithdraw).toHaveBeenCalledTimes(1));
    // On-screen durable confirmation with the pro-rata refund amount.
    expect(await screen.findByText(/withdrawal confirmed/i)).toBeTruthy();
    expect(screen.getByText(/9\.33 EUR/i)).toBeTruthy();
  });

  it("hides the withdrawal control once the 14-day window has closed", () => {
    const withdrawalUntil = new Date(Date.now() - 1000).toISOString();
    render(
      <Dashboard
        user={user}
        scores={scores}
        history={history}
        isPro
        proEnabled
        onWithdraw={vi.fn()}
        withdrawalUntil={withdrawalUntil}
        onManageSubscription={() => {}}
        onPractice={() => {}}
      />
    );
    expect(screen.queryByRole("button", { name: /withdraw from contract here/i })).toBe(null);
  });

  it("does not offer withdrawal to a non-Pro user even if a stale window is passed", () => {
    render(
      <Dashboard
        user={user}
        scores={scores}
        history={history}
        proEnabled
        onWithdraw={vi.fn()}
        withdrawalUntil={new Date(Date.now() + 5 * DAY).toISOString()}
        onPractice={() => {}}
      />
    );
    expect(screen.queryByRole("button", { name: /withdraw from contract here/i })).toBe(null);
  });
});

describe("Dashboard — Download my data (GDPR access/portability)", () => {
  it("renders the button, calls onExport, and shows a busy state until it resolves", async () => {
    let resolve;
    const onExport = vi.fn(() => new Promise((r) => { resolve = r; }));
    render(<Dashboard user={user} scores={scores} history={history} onExport={onExport} onPractice={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /download my data/i }));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: /preparing/i })).toBeTruthy();
    await act(async () => { resolve(true); });
    await waitFor(() => expect(screen.getByRole("button", { name: /download my data/i })).toBeTruthy());
  });

  it("omits the button when onExport is not provided", () => {
    render(<Dashboard user={user} scores={scores} history={history} onPractice={() => {}} />);
    expect(screen.queryByRole("button", { name: /download my data/i })).toBe(null);
  });
});
