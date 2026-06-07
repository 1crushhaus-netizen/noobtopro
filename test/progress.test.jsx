// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import ProgressDashboard from "@/components/ProgressDashboard";

afterEach(cleanup);

const scores = {
  math: { score: 60, weakConcepts: [], comment: "" },
  physics: { score: 30, weakConcepts: [], comment: "" },
  chemistry: { score: 0, weakConcepts: [], comment: "" },
};

// A baseline + two graded attempts → 3 line points, 2 bars.
const history = [
  { type: "baseline", t: "t0", totalAfter: 40, phdAfter: 13 },
  { type: "attempt", t: "t1", subject: "math", delta: 5, newScore: 45, totalAfter: 70, phdAfter: 23 },
  { type: "attempt", t: "t2", subject: "physics", delta: -2, newScore: 28, totalAfter: 90, phdAfter: 30 },
];

function statCard(label) {
  return screen.getByText(label).closest(".np-statcard");
}

describe("ProgressDashboard", () => {
  it("renders the stat summary from scores/history (total, PhD index, problems graded)", () => {
    render(<ProgressDashboard scores={scores} history={history} onPractice={() => {}} />);
    // total = 60+30+0 = 90; phdIndex = round(90/3) = 30; attempts = 2.
    expect(statCard("Total points").querySelector(".np-statnum").textContent).toContain("90");
    expect(statCard("PhD-level intelligence").querySelector(".np-statnum").textContent).toContain("30");
    expect(statCard("Problems graded").querySelector(".np-statnum").textContent).toBe("2");
    // band(30) === "Foundational"
    expect(screen.getByText("Foundational overall")).toBeTruthy();
  });

  it("gives both SVG charts accessible names that encode the data (a11y)", () => {
    render(<ProgressDashboard scores={scores} history={history} onPractice={() => {}} />);
    // LineChart: role=img, label ends "ending at 90 of 300".
    expect(
      screen.getByRole("img", { name: /total points over time.*ending at 90 of 300/i })
    ).toBeTruthy();
    // BarChart: role=img, label names the 2 graded attempts.
    expect(screen.getByRole("img", { name: /across 2 graded attempts/i })).toBeTruthy();
  });

  it("shows empty-state copy (not a chart) before there is enough data", () => {
    // No attempts and a single line point → both charts fall back to their hints.
    render(<ProgressDashboard scores={scores} history={[]} onPractice={() => {}} />);
    expect(screen.getByText(/start the trend line/i)).toBeTruthy();
    expect(screen.getByText(/no graded attempts yet/i)).toBeTruthy();
    expect(screen.queryByRole("img")).toBe(null); // no chart rendered yet
  });
});

describe("ProgressDashboard — reasoning radar + what-to-work-on", () => {
  const scoresWithRubric = {
    math: {
      score: 60,
      weakConcepts: ["chain rule"],
      comment: "",
      rubric: { conceptual_understanding: 3, logical_structure: 1, strategy: 2, execution_accuracy: 4, communication: 3 },
    },
    physics: {
      score: 30,
      weakConcepts: [],
      comment: "",
      rubric: { conceptual_understanding: 2, logical_structure: 2, strategy: 2, execution_accuracy: 2, communication: 2 },
    },
    chemistry: { score: 0, weakConcepts: [], comment: "" }, // no rubric → excluded from the radar
  };

  it("renders the radar with an accessible name covering the subjects that have a profile", () => {
    render(<ProgressDashboard scores={scoresWithRubric} history={history} onPractice={() => {}} />);
    const radar = screen.getByRole("img", { name: /reasoning profile across the five rubric dimensions/i });
    expect(radar.getAttribute("aria-label")).toMatch(/Mathematics/);
    expect(radar.getAttribute("aria-label")).toMatch(/Physics/);
    // chemistry has no rubric, so it is not named in the radar.
    expect(radar.getAttribute("aria-label")).not.toMatch(/Chemistry/);
  });

  it("renders a 'What to work on' panel and links a weak concept to the Learn tab", () => {
    const onLearn = vi.fn();
    render(<ProgressDashboard scores={scoresWithRubric} history={history} onPractice={() => {}} onLearn={onLearn} />);
    expect(screen.getByText(/what to work on/i)).toBeTruthy();
    // Only math has a weak concept among the profiled subjects → exactly one "Learn this".
    fireEvent.click(screen.getByText("Learn this"));
    expect(onLearn).toHaveBeenCalledWith("math", "chain rule");
  });

  it("does NOT render the radar before any subject has a rubric", () => {
    render(<ProgressDashboard scores={scores} history={history} onPractice={() => {}} />);
    expect(screen.queryByRole("img", { name: /reasoning profile/i })).toBe(null);
    expect(screen.getByText(/finish the diagnostic to see your reasoning profile/i)).toBeTruthy();
  });
});
