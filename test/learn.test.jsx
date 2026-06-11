// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";

// LearnTab loads the per-concept mastery map on mount; tests install the map they need.
const mocks = vi.hoisted(() => ({ loadMastery: vi.fn(async () => ({ mastery: {} })) }));
vi.mock("@/lib/store", () => ({ loadMastery: (...a) => mocks.loadMastery(...a) }));

import LearnTab from "@/components/LearnTab";
import { RANK_LABELS } from "@/lib/curriculum";

beforeEach(() => {
  mocks.loadMastery.mockReset();
  mocks.loadMastery.mockResolvedValue({ mastery: {} });
});
afterEach(cleanup);

// Render and flush the mount-time loadMastery resolution so state updates land
// inside act() (avoids races between assertions and the async setMastery).
async function renderTab() {
  let utils;
  await act(async () => {
    utils = render(<LearnTab />);
  });
  return utils;
}

describe("LearnTab — curriculum listing", () => {
  it("renders concepts from the database as clickable buttons, grouped by rank", async () => {
    await renderTab();
    expect(screen.getByRole("button", { name: "Place value & the base-ten system" })).toBeTruthy(); // math · elementary
    expect(screen.getByRole("button", { name: "Stoichiometry" })).toBeTruthy(); // chemistry · high
    for (const label of Object.values(RANK_LABELS)) {
      expect(screen.getAllByText(label).length).toBe(3); // once per subject
    }
  });

  it("greys out the empty Doctorate rank with the WIP note (no chips)", async () => {
    await renderTab();
    expect(screen.getAllByText(/in development/i).length).toBe(3); // one per subject
  });
});

describe("LearnTab — concept page + root navigation", () => {
  it("opening a concept shows its dedicated page (title + Back)", async () => {
    await renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Quadratic functions & equations" }));
    expect(screen.getByRole("heading", { name: "Quadratic functions & equations" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /back to concepts/i })).toBeTruthy();
  });

  it("shows the root concepts and navigates when one is clicked (branched path)", async () => {
    await renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Quadratic functions & equations" }));
    // quadratics' roots include Algebraic expressions (a lower-rank prerequisite)
    fireEvent.click(screen.getByRole("button", { name: "Algebraic expressions" }));
    expect(screen.getByRole("heading", { name: "Algebraic expressions" })).toBeTruthy();
  });

  it("a foundational (elementary) concept shows no prerequisites", async () => {
    await renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Place value & the base-ten system" }));
    expect(screen.getByText(/foundational concept/i)).toBeTruthy();
    expect(screen.queryByText(/understand these first/i)).toBeNull();
  });

  it("Back returns to the full curriculum listing", async () => {
    await renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Stoichiometry" }));
    expect(screen.getByRole("heading", { name: "Stoichiometry" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /back to concepts/i }));
    expect(screen.getByRole("heading", { name: "Learn" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Place value & the base-ten system" })).toBeTruthy();
  });
});

describe("LearnTab — mastery coloring (RANKS_PLAN §12.1)", () => {
  // Counter records for each state: green (2 hits), yellow (1 good attempt),
  // red (last attempt failed). Keys are real curriculum concepts.
  const MASTERY = {
    math: {
      quadratics: { attempts: 2, greenHits: 2, lastQuality: 85, bestQuality: 90 }, // green
      algebraic_expressions: { attempts: 1, greenHits: 1, lastQuality: 80, bestQuality: 80 }, // yellow
      ratios_unit_rates: { attempts: 1, greenHits: 0, lastQuality: 5, bestQuality: 5 }, // red
    },
  };

  it("colors chips by state with the state in the accessible name; untouched chips stay plain", async () => {
    mocks.loadMastery.mockResolvedValue({ mastery: MASTERY });
    await renderTab();
    const green = screen.getByRole("button", { name: /Quadratic functions & equations — Mastered/i });
    expect(green.className).toContain("np-concepttag--green");
    const yellow = screen.getByRole("button", { name: /Algebraic expressions — In progress/i });
    expect(yellow.className).toContain("np-concepttag--yellow");
    const red = screen.getByRole("button", { name: /Ratios & unit rates — Struggling/i });
    expect(red.className).toContain("np-concepttag--red");
    // An untouched concept keeps its plain accessible name and no state class.
    const grey = screen.getByRole("button", { name: "Place value & the base-ten system" });
    expect(grey.className).not.toMatch(/np-concepttag--(green|yellow|red)/);
  });

  it("renders the color key legend once", async () => {
    await renderTab();
    expect(screen.getByLabelText(/concept color key/i)).toBeTruthy();
    expect(screen.getByText("Mastered")).toBeTruthy();
    expect(screen.getByText("Not attempted")).toBeTruthy();
  });

  it("a RED concept's page shows the build-the-foundations warning pointing at its roots", async () => {
    mocks.loadMastery.mockResolvedValue({
      mastery: { math: { quadratics: { attempts: 1, greenHits: 0, lastQuality: 10, bestQuality: 10 } } },
    });
    await renderTab();
    fireEvent.click(screen.getByRole("button", { name: /Quadratic functions & equations — Struggling/i }));
    expect(screen.getByText(/build the foundations first/i)).toBeTruthy();
    expect(screen.getByText(/root concepts below/i)).toBeTruthy();
    expect(screen.getByText(/understand these first/i)).toBeTruthy(); // the roots card is right there
  });

  it("a green concept's page shows the mastered status line and NO warning", async () => {
    mocks.loadMastery.mockResolvedValue({ mastery: MASTERY });
    await renderTab();
    fireEvent.click(screen.getByRole("button", { name: /Quadratic functions & equations — Mastered/i }));
    expect(screen.getByText(/clear understanding shown/i)).toBeTruthy();
    expect(screen.queryByText(/build the foundations first/i)).toBeNull();
  });

  it("a mastery load FAILURE (e.g. pre-0010 DB) still renders the full uncolored curriculum", async () => {
    mocks.loadMastery.mockResolvedValue({ error: { message: "relation does not exist" } });
    await renderTab();
    expect(screen.getByRole("button", { name: "Place value & the base-ten system" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stoichiometry" })).toBeTruthy();
  });
});

describe("LearnTab — AI concept-practice drill button (increment 3)", () => {
  it("the concept page shows a 'Practice this concept' button that calls onPractice with the concept", async () => {
    const onPractice = vi.fn();
    await act(async () => { render(<LearnTab onPractice={onPractice} />); });
    fireEvent.click(screen.getByRole("button", { name: "Quadratic functions & equations" }));
    const btn = screen.getByRole("button", { name: /practice this concept/i });
    fireEvent.click(btn);
    expect(onPractice).toHaveBeenCalledTimes(1);
    const arg = onPractice.mock.calls[0][0];
    expect(arg).toMatchObject({ subject: "math", key: "quadratics", rank: "high" });
  });

  it("shows a generating spinner + disables the button while THIS concept is busy", async () => {
    await act(async () => { render(<LearnTab onPractice={() => {}} busyConcept="quadratics" />); });
    fireEvent.click(screen.getByRole("button", { name: "Quadratic functions & equations" }));
    const btn = screen.getByRole("button", { name: /generating a question/i });
    expect(btn.disabled).toBe(true);
  });

  it("a DIFFERENT busy concept does not disable this concept's button", async () => {
    await act(async () => { render(<LearnTab onPractice={() => {}} busyConcept="some_other_key" />); });
    fireEvent.click(screen.getByRole("button", { name: "Quadratic functions & equations" }));
    expect(screen.getByRole("button", { name: /practice this concept/i }).disabled).toBe(false);
  });

  it("without onPractice (guest/undiagnosed), shows a sign-in/diagnostic hint instead of the button", async () => {
    await act(async () => { render(<LearnTab />); });
    fireEvent.click(screen.getByRole("button", { name: "Quadratic functions & equations" }));
    expect(screen.queryByRole("button", { name: /practice this concept/i })).toBeNull();
    expect(screen.getByText(/sign in or complete the diagnostic/i)).toBeTruthy();
  });
});
