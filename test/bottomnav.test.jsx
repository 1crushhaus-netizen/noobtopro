// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import BottomNav from "@/components/BottomNav";

afterEach(cleanup);

const tabs = (active = "practice") => [
  { id: "practice", label: "Practice", icon: "target", active: active === "practice", onClick: vi.fn() },
  { id: "learn", label: "Learn", icon: "book", active: active === "learn", onClick: vi.fn() },
  { id: "dashboard", label: "Dashboard", icon: "grid", active: active === "dashboard", onClick: vi.fn() },
];

describe("BottomNav", () => {
  it("renders one button per tab, labelled as a Primary nav", () => {
    render(<BottomNav tabs={tabs()} />);
    expect(screen.getByRole("navigation", { name: /primary/i })).toBeTruthy();
    for (const label of ["Practice", "Learn", "Dashboard"]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }
  });

  it("marks only the active tab with aria-current=page", () => {
    render(<BottomNav tabs={tabs("learn")} />);
    expect(screen.getByRole("button", { name: "Learn" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: "Practice" }).getAttribute("aria-current")).toBeNull();
  });

  it("calls the tab's onClick when tapped", () => {
    const t = tabs();
    render(<BottomNav tabs={t} />);
    fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));
    expect(t[2].onClick).toHaveBeenCalledTimes(1);
    expect(t[0].onClick).not.toHaveBeenCalled();
  });

  it("renders nothing when there are no tabs (guest / no chrome)", () => {
    const { container } = render(<BottomNav tabs={null} />);
    expect(container.firstChild).toBeNull();
    cleanup();
    const { container: c2 } = render(<BottomNav tabs={[]} />);
    expect(c2.firstChild).toBeNull();
  });
});
