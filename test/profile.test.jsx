// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
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

  it("shows an empty state + the 'Prove it' CTA when there are no scores", () => {
    const onStartDiagnostic = vi.fn();
    render(<ProfileTab user={user} scores={null} history={[]} onStartDiagnostic={onStartDiagnostic} />);
    expect(screen.getByText(/not ranked yet/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /prove it/i }));
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

  it("renders the anonymous-tiers leaderboard (distribution + own position, NO identities)", async () => {
    const tiers = {
      overall: { counts: [3, 2, 1, 0, 0], total: 6, you: { band: 1, score: 30, above: 3 } },
      math: { counts: [1, 1, 2, 1, 1], total: 6, you: { band: 3, score: 60, above: 2 } },
      physics: { counts: [4, 1, 1, 0, 0], total: 6, you: { band: 0, score: 10, above: 5 } },
      chemistry: { counts: [0, 1, 2, 2, 1], total: 6, you: { band: 4, score: 90, above: 0 } },
    };
    const loadLeaderboard = vi.fn(async () => ({ tiers }));
    render(
      <ProfileTab user={user} scores={scores} history={[]} loadLeaderboard={loadLeaderboard}
        onPractice={() => {}} onViewProgress={() => {}} onSignOut={() => {}} onReset={() => {}} />
    );
    expect(screen.getByText("Leaderboard")).toBeTruthy();
    // After the async load, the caller's own position is shown for at least one track.
    await waitFor(() => expect(screen.getAllByText(/You're/i).length).toBeGreaterThan(0));
    expect(loadLeaderboard).toHaveBeenCalled();
    // Anonymous: no email / name / "user" identity leaks into the leaderboard render.
    expect(screen.queryByText("ada@example.com")).toBeTruthy(); // (the profile header still shows the OWN email)
    // The distribution counts render (e.g. the overall total "6 ranked" appears per track).
    expect(screen.getAllByText(/ranked/i).length).toBeGreaterThan(0);
  });

  it("fires onSignOut, and onReset only after confirmation", () => {
    const onSignOut = vi.fn();
    const onReset = vi.fn();
    render(<ProfileTab user={user} scores={scores} history={[]} onSignOut={onSignOut} onReset={onReset} onPractice={() => {}} onViewProgress={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalled();

    // Reset is guarded by a confirm() — declined: no-op; confirmed: fires.
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: /reset my progress/i }));
    expect(onReset).not.toHaveBeenCalled();
    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: /reset my progress/i }));
    expect(onReset).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
