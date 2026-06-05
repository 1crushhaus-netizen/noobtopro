// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import ProfileTab from "@/components/ProfileTab";

afterEach(cleanup);

const user = { email: "ada@example.com", user_metadata: { full_name: "Ada Lovelace" }, created_at: "2024-01-01" };
const scores = { math: { score: 60 }, physics: { score: 30 }, chemistry: { score: 90 } };

describe("ProfileTab", () => {
  it("shows the user's name and email", () => {
    render(<ProfileTab user={user} scores={null} history={[]} />);
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("ada@example.com")).toBeTruthy();
  });

  it("shows an empty state + Begin diagnostic when there are no scores", () => {
    const onStartDiagnostic = vi.fn();
    render(<ProfileTab user={user} scores={null} history={[]} onStartDiagnostic={onStartDiagnostic} />);
    expect(screen.getByText(/no diagnostic yet/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /begin diagnostic/i }));
    expect(onStartDiagnostic).toHaveBeenCalled();
  });

  it("shows stats when scores exist", () => {
    render(<ProfileTab user={user} scores={scores} history={[{ type: "attempt" }, { type: "baseline" }]} onPractice={() => {}} onViewProgress={() => {}} onSignOut={() => {}} onReset={() => {}} />);
    expect(screen.getByText(/PhD-level intelligence/i)).toBeTruthy();
    expect(screen.getByText("180")).toBeTruthy(); // total points = 60+30+90
    expect(screen.getByText("Mathematics")).toBeTruthy();
    expect(screen.getByText("Physics")).toBeTruthy();
    expect(screen.getByText("Chemistry")).toBeTruthy();
  });

  it("fires onSignOut and onReset", () => {
    const onSignOut = vi.fn();
    const onReset = vi.fn();
    render(<ProfileTab user={user} scores={scores} history={[]} onSignOut={onSignOut} onReset={onReset} onPractice={() => {}} onViewProgress={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /reset my progress/i }));
    expect(onReset).toHaveBeenCalled();
  });
});
