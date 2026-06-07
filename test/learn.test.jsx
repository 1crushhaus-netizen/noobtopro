// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import LearnTab from "@/components/LearnTab";

afterEach(cleanup);

const scores = {
  math: { score: 0, weakConcepts: ["removable discontinuities", "function modification"] },
  physics: { score: 0, weakConcepts: ["energy transformation"] },
  chemistry: { score: 0, weakConcepts: [] },
};

describe("LearnTab", () => {
  it("shows an empty state when there are no weak concepts", () => {
    render(<LearnTab scores={{ math: { score: 0, weakConcepts: [] } }} active={null} content={null} busy={false} error="" onSelect={() => {}} />);
    expect(screen.getByText(/no concepts to learn yet/i)).toBeTruthy();
  });

  it("renders a clickable chip per weak concept and calls onSelect with subject + concept", () => {
    const onSelect = vi.fn();
    render(<LearnTab scores={scores} active={null} content={null} busy={false} error="" onSelect={onSelect} />);
    const chip = screen.getByRole("button", { name: "removable discontinuities" });
    fireEvent.click(chip);
    expect(onSelect).toHaveBeenCalledWith("math", "removable discontinuities");
    // a concept from another subject is also present
    expect(screen.getByRole("button", { name: "energy transformation" })).toBeTruthy();
  });

  it("shows a loading state while fetching, announced to screen readers (role=status)", () => {
    render(<LearnTab scores={scores} active={{ subject: "math", concept: "limits" }} content={null} busy={true} error="" onSelect={() => {}} />);
    expect(screen.getByText(/building your guide to limits/i)).toBeTruthy();
    // The async loading state must live in a polite live region so AT users hear it.
    expect(screen.getByRole("status").textContent).toMatch(/building your guide to limits/i);
  });

  it("announces an async error to screen readers (role=alert)", () => {
    render(<LearnTab scores={scores} active={{ subject: "math", concept: "limits" }} content={null} busy={false} error="Could not load the concept guide." onSelect={() => {}} />);
    expect(screen.getByRole("alert").textContent).toMatch(/could not load the concept guide/i);
  });

  it("renders the guidance sections (no answer, just teaching)", () => {
    const content = {
      subject: "math",
      concept: "removable discontinuities",
      overview: "A hole you can patch.",
      keyIdeas: ["the limit exists", "the value is missing or wrong"],
      socraticQuestions: ["What makes a discontinuity removable?"],
      pitfalls: ["confusing with a jump"],
      tryThis: "Factor and cancel, then check the limit.",
    };
    const onPractice = vi.fn();
    render(<LearnTab scores={scores} active={{ subject: "math", concept: "removable discontinuities" }} content={content} busy={false} error="" onSelect={() => {}} onPractice={onPractice} />);
    expect(screen.getByText("A hole you can patch.")).toBeTruthy();
    expect(screen.getByText(/key ideas/i)).toBeTruthy();
    expect(screen.getByText("the limit exists")).toBeTruthy();
    expect(screen.getByText(/questions to think through/i)).toBeTruthy();
    expect(screen.getByText(/common pitfalls/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /practice mathematics/i }));
    expect(onPractice).toHaveBeenCalledWith("math");
  });

  it("renders the 'Why it works' proof/derivation section when present (PR 5 depth)", () => {
    const content = {
      subject: "math", concept: "the pythagorean theorem", overview: "o", keyIdeas: ["k"],
      whyItWorks: "Arrange four copies of the triangle in a square of side (a+b); equate areas to get a^2 + b^2 = c^2.",
      socraticQuestions: [], pitfalls: [], tryThis: "",
    };
    render(<LearnTab scores={scores} active={{ subject: "math", concept: "the pythagorean theorem" }} content={content} busy={false} error="" onSelect={() => {}} onPractice={() => {}} />);
    expect(screen.getByText(/why it works/i)).toBeTruthy();
    expect(screen.getByText(/equate areas to get/i)).toBeTruthy();
  });

  const guide = { subject: "physics", concept: "energy transformation", overview: "o", keyIdeas: [], socraticQuestions: [], pitfalls: [], tryThis: "think about conservation" };

  it("shows the cached 'try this' problem and practices it WITHOUT generating a new question", () => {
    const onPracticeQuestion = vi.fn();
    const onPractice = vi.fn();
    const q = { question: "A 2kg block slides down a ramp — trace the energy flow.", targetConcept: "energy transformation", difficulty: "advanced" };
    render(
      <LearnTab scores={scores} active={{ subject: "physics", concept: "energy transformation" }} content={guide} busy={false} error=""
        question={q} onSelect={() => {}} onPractice={onPractice} onPracticeQuestion={onPracticeQuestion} onRegenerate={() => {}} />
    );
    expect(screen.getByText(/2kg block slides/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /practice this problem/i }));
    expect(onPracticeQuestion).toHaveBeenCalledWith("physics", q);
    expect(onPractice).not.toHaveBeenCalled(); // reused the cached question — no fresh generation
  });

  it("regenerate calls onRegenerate, and the button is disabled while regenerating", () => {
    const onRegenerate = vi.fn();
    const q = { question: "Q?", targetConcept: "energy transformation", difficulty: "intermediate" };
    const { rerender } = render(
      <LearnTab scores={scores} active={{ subject: "physics", concept: "energy transformation" }} content={guide} busy={false} error=""
        question={q} regenerating={false} onSelect={() => {}} onRegenerate={onRegenerate} onPracticeQuestion={() => {}} />
    );
    fireEvent.click(screen.getByRole("button", { name: /regenerate question/i }));
    expect(onRegenerate).toHaveBeenCalled();
    rerender(
      <LearnTab scores={scores} active={{ subject: "physics", concept: "energy transformation" }} content={guide} busy={false} error=""
        question={q} regenerating={true} onSelect={() => {}} onRegenerate={onRegenerate} onPracticeQuestion={() => {}} />
    );
    expect(screen.getByRole("button", { name: /generating a new one/i }).disabled).toBe(true);
  });

  it("falls back to a fresh 'Practice <subject>' button when a guide has no cached question", () => {
    const onPractice = vi.fn();
    render(
      <LearnTab scores={scores} active={{ subject: "math", concept: "limits" }} content={{ subject: "math", concept: "limits", overview: "o", keyIdeas: [], socraticQuestions: [], pitfalls: [], tryThis: "" }} busy={false} error=""
        question={null} onSelect={() => {}} onPractice={onPractice} onPracticeQuestion={() => {}} onRegenerate={() => {}} />
    );
    fireEvent.click(screen.getByRole("button", { name: /practice mathematics/i }));
    expect(onPractice).toHaveBeenCalledWith("math");
  });
});
