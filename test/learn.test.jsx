// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import LearnTab from "@/components/LearnTab";
import { CURRICULUM, RANK_LABELS, RANKS } from "@/lib/curriculum";

afterEach(cleanup);

describe("LearnTab — fixed concept curriculum", () => {
  it("renders concepts from the curriculum database", () => {
    render(<LearnTab />);
    // unique labels spanning subjects & ranks
    expect(screen.getByText("Place value & the base-ten system")).toBeTruthy(); // math · elementary
    expect(screen.getByText("Stoichiometry")).toBeTruthy(); // chemistry · high
    expect(screen.getByText("Eigenvalues & eigenvectors")).toBeTruthy(); // math · university
  });

  it("lists concepts as NON-interactive chips (spans, not buttons)", () => {
    render(<LearnTab />);
    const chip = screen.getByText("Place value & the base-ten system");
    expect(chip.tagName.toLowerCase()).toBe("span");
    expect(chip.className).toMatch(/np-concepttag/);
    expect(chip.className).toMatch(/np-concepttag--static/);
    // no clickable button carries a concept label
    expect(screen.queryByRole("button", { name: "Place value & the base-ten system" })).toBeNull();
  });

  it("organizes the listing by rank (every rank label appears, once per subject)", () => {
    render(<LearnTab />);
    for (const label of Object.values(RANK_LABELS)) {
      expect(screen.getAllByText(label).length).toBe(3); // math + physics + chemistry
    }
  });

  it("greys out the empty Doctorate rank with the WIP note instead of chips", () => {
    render(<LearnTab />);
    // Doctorate is empty for every subject → the WIP note shows three times
    expect(screen.getAllByText(/in development/i).length).toBe(3);
  });

  it("renders every populated concept in the database", () => {
    render(<LearnTab />);
    for (const subject of Object.keys(CURRICULUM)) {
      for (const rank of RANKS) {
        for (const c of CURRICULUM[subject][rank]) {
          // some labels recur across subjects (e.g. "States of matter…"), so use getAllByText
          expect(screen.getAllByText(c.label).length).toBeGreaterThan(0);
        }
      }
    }
  });
});
