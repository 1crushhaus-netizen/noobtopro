// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock the catalog data layer so the test controls the directory contents and
// can assert on report submissions. vi.hoisted lets the mock factory reference
// the spies (vi.mock is hoisted above imports, so the spies must be too).
// ---------------------------------------------------------------------------
const catalog = vi.hoisted(() => ({
  browsePublicConcepts: vi.fn(),
  reportConcept: vi.fn(),
  loadTopics: vi.fn(),
}));

vi.mock("@/lib/catalog", () => ({
  browsePublicConcepts: catalog.browsePublicConcepts,
  reportConcept: catalog.reportConcept,
  loadTopics: catalog.loadTopics,
}));

// Import AFTER the mock is registered so LearnTab picks up the mocked catalog.
import LearnTab from "@/components/LearnTab";

// Canned approved guides across two subjects/topics (math · calculus, physics · energy).
const APPROVED = [
  { subject: "math", concept: "Removable discontinuities", concept_key: "removable-discontinuities", topic: "calculus_analysis", level_band: "advanced" },
  { subject: "physics", concept: "Energy transformation", concept_key: "energy-transformation", topic: "energy_momentum", level_band: "intermediate" },
];

beforeEach(() => {
  catalog.browsePublicConcepts.mockReset();
  catalog.reportConcept.mockReset();
  catalog.loadTopics.mockReset();
  catalog.browsePublicConcepts.mockResolvedValue({ concepts: APPROVED });
  catalog.reportConcept.mockResolvedValue({ ok: true });
  catalog.loadTopics.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// Common props for the ConceptHub mode.
function baseProps(overrides = {}) {
  return {
    hubEnabled: true,
    scores: {},
    active: null,
    content: null,
    busy: false,
    error: "",
    question: null,
    onSelect: vi.fn(),
    onPractice: vi.fn(),
    onPracticeQuestion: vi.fn(),
    onRegenerate: vi.fn(),
    ...overrides,
  };
}

describe("LearnTab — Concept Hub (hubEnabled)", () => {
  it("renders the 'Concept Hub' heading and, after the debounced load, the canned concepts under their topic labels", async () => {
    render(<LearnTab {...baseProps()} />);

    // Heading is present immediately (synchronous render).
    expect(screen.getByText("Concept Hub")).toBeTruthy();

    // The catalog loads inside a 250ms debounced setTimeout — waitFor lets the
    // async state settle before asserting on the directory contents.
    const mathChip = await waitFor(() => screen.getByRole("button", { name: "Removable discontinuities" }));
    expect(mathChip).toBeTruthy();
    // A concept from the second subject is present too.
    expect(screen.getByRole("button", { name: "Energy transformation" })).toBeTruthy();

    // Concepts are grouped under their topic labels (from @/lib/taxonomy TOPICS).
    expect(screen.getByText("Calculus & Analysis")).toBeTruthy();
    expect(screen.getByText("Energy & Momentum")).toBeTruthy();
  });

  it("clicking a concept chip calls onSelect(subject, concept) with the display concept", async () => {
    const onSelect = vi.fn();
    render(<LearnTab {...baseProps({ onSelect })} />);

    const chip = await waitFor(() => screen.getByRole("button", { name: "Removable discontinuities" }));
    fireEvent.click(chip);
    expect(onSelect).toHaveBeenCalledWith("math", "Removable discontinuities");
  });

  it("shows a 'Your weak concepts' section from scores and clicking one calls onSelect", async () => {
    const onSelect = vi.fn();
    const scores = {
      math: { score: 0, weakConcepts: ["limits"] },
      physics: { score: 0, weakConcepts: ["momentum"] },
    };
    render(<LearnTab {...baseProps({ onSelect, scores })} />);

    expect(screen.getByText(/your weak concepts/i)).toBeTruthy();
    // The weak-concept buttons render the concept text alongside the subject glyph.
    const weak = screen.getByRole("button", { name: /limits/i });
    fireEvent.click(weak);
    expect(onSelect).toHaveBeenCalledWith("math", "limits");

    // Let the debounced catalog load settle to avoid an act() warning after unmount.
    await waitFor(() => screen.getByRole("button", { name: "Removable discontinuities" }));
  });

  it("admin overlay: with isAdmin shows the unapproved concept (trailing '*', np-hub-unapproved); hidden for non-admins", async () => {
    const adminApi = vi.fn(async (path) => {
      if (path === "/api/admin/data") {
        return {
          pendingGuides: [
            { subject: "math", concept: "unapproved thing", concept_key: "unapproved thing", topic: "algebra", status: "ready" },
          ],
        };
      }
      return { ok: true };
    });

    const { unmount } = render(<LearnTab {...baseProps({ isAdmin: true, adminApi })} />);

    // The admin /data fetch + debounced catalog both resolve asynchronously.
    const unapproved = await waitFor(() => screen.getByRole("button", { name: /unapproved thing/i }));
    // Rendered with a trailing "*" and the unapproved class.
    expect(unapproved.textContent).toMatch(/unapproved thing\s*\*/);
    expect(unapproved.className).toMatch(/np-hub-unapproved/);
    expect(adminApi).toHaveBeenCalledWith("/api/admin/data");

    unmount();
    cleanup();

    // Non-admin: same canned catalog, but the unapproved concept must NOT appear.
    render(<LearnTab {...baseProps({ isAdmin: false })} />);
    await waitFor(() => screen.getByRole("button", { name: "Removable discontinuities" }));
    expect(screen.queryByRole("button", { name: /unapproved thing/i })).toBeNull();
  });

  it("report flow: opening the report, submitting, calls reportConcept and shows a 'Thanks — reported' status", async () => {
    render(
      <LearnTab
        {...baseProps({
          user: { id: "u1" },
          active: { subject: "math", concept: "limits" },
          content: { concept: "limits", overview: "An intro to limits." },
        })}
      />
    );

    // GuideView is showing for the active concept.
    expect(screen.getByText("An intro to limits.")).toBeTruthy();

    // Open the report affordance.
    fireEvent.click(screen.getByRole("button", { name: /report/i }));
    const reason = screen.getByLabelText(/reason for reporting/i);
    fireEvent.change(reason, { target: { value: "wrong definition" } });

    // Submit the report.
    fireEvent.click(screen.getByRole("button", { name: /submit report/i }));

    // The component calls the mocked reportConcept (via onReport) with the active
    // subject, the content concept as conceptKey, and the typed reason.
    await waitFor(() =>
      expect(catalog.reportConcept).toHaveBeenCalledWith({
        subject: "math",
        conceptKey: "limits",
        reason: "wrong definition",
      })
    );

    // Success status surfaces.
    expect(await screen.findByText(/thanks — reported/i)).toBeTruthy();

    // Let the debounced catalog load settle.
    await waitFor(() => screen.getByRole("button", { name: "Removable discontinuities" }));
  });

  it("search: typing in the search input eventually calls browsePublicConcepts with the typed query (after the debounce)", async () => {
    // Fake timers so we can deterministically advance past the 250ms debounce.
    vi.useFakeTimers();
    render(<LearnTab {...baseProps()} />);

    const searchInput = screen.getByPlaceholderText(/search concepts/i);
    fireEvent.change(searchInput, { target: { value: "energy" } });

    // Flush the debounce timer.
    vi.advanceTimersByTime(300);
    // Hand control back to real timers so RTL's async helpers work normally.
    vi.useRealTimers();

    await waitFor(() =>
      expect(catalog.browsePublicConcepts).toHaveBeenCalledWith(
        expect.objectContaining({ query: "energy" })
      )
    );
  });
});
