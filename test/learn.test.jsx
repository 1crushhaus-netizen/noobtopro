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

  it("shows a loading state while fetching", () => {
    render(<LearnTab scores={scores} active={{ subject: "math", concept: "limits" }} content={null} busy={true} error="" onSelect={() => {}} />);
    expect(screen.getByText(/building your guide to limits/i)).toBeTruthy();
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
});
