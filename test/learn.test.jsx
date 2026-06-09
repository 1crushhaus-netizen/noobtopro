// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import LearnTab from "@/components/LearnTab";
import { RANK_LABELS } from "@/lib/curriculum";

afterEach(cleanup);

describe("LearnTab — curriculum listing", () => {
  it("renders concepts from the database as clickable buttons, grouped by rank", () => {
    render(<LearnTab />);
    expect(screen.getByRole("button", { name: "Place value & the base-ten system" })).toBeTruthy(); // math · elementary
    expect(screen.getByRole("button", { name: "Stoichiometry" })).toBeTruthy(); // chemistry · high
    for (const label of Object.values(RANK_LABELS)) {
      expect(screen.getAllByText(label).length).toBe(3); // once per subject
    }
  });

  it("greys out the empty Doctorate rank with the WIP note (no chips)", () => {
    render(<LearnTab />);
    expect(screen.getAllByText(/in development/i).length).toBe(3); // one per subject
  });
});

describe("LearnTab — concept page + root navigation", () => {
  it("opening a concept shows its dedicated page (title + Back)", () => {
    render(<LearnTab />);
    fireEvent.click(screen.getByRole("button", { name: "Quadratic functions & equations" }));
    expect(screen.getByRole("heading", { name: "Quadratic functions & equations" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /back to concepts/i })).toBeTruthy();
  });

  it("shows the root concepts and navigates when one is clicked (branched path)", () => {
    render(<LearnTab />);
    fireEvent.click(screen.getByRole("button", { name: "Quadratic functions & equations" }));
    // quadratics' roots include Algebraic expressions (a lower-rank prerequisite)
    fireEvent.click(screen.getByRole("button", { name: "Algebraic expressions" }));
    expect(screen.getByRole("heading", { name: "Algebraic expressions" })).toBeTruthy();
  });

  it("a foundational (elementary) concept shows no prerequisites", () => {
    render(<LearnTab />);
    fireEvent.click(screen.getByRole("button", { name: "Place value & the base-ten system" }));
    expect(screen.getByText(/foundational concept/i)).toBeTruthy();
    expect(screen.queryByText(/understand these first/i)).toBeNull();
  });

  it("Back returns to the full curriculum listing", () => {
    render(<LearnTab />);
    fireEvent.click(screen.getByRole("button", { name: "Stoichiometry" }));
    expect(screen.getByRole("heading", { name: "Stoichiometry" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /back to concepts/i }));
    expect(screen.getByRole("heading", { name: "Learn" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Place value & the base-ten system" })).toBeTruthy();
  });
});
