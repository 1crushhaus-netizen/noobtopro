// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import AgeGate from "@/components/AgeGate";

afterEach(cleanup);

const setDob = (value) =>
  fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value } });

describe("AgeGate (P0-10 neutral age screen)", () => {
  it("confirms a 13+ date of birth, reporting the birth year", async () => {
    const onConfirm = vi.fn(async () => {});
    render(<AgeGate onConfirm={onConfirm} onUnderage={vi.fn()} />);
    setDob("2000-05-15");
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({ birthYear: 2000 }));
  });

  it("blocks an under-13 date of birth with parental-consent messaging and signs out", () => {
    const onConfirm = vi.fn(async () => {});
    const onUnderage = vi.fn();
    render(<AgeGate onConfirm={onConfirm} onUnderage={onUnderage} />);
    const eightYearsOld = new Date().getFullYear() - 8;
    setDob(`${eightYearsOld}-01-01`);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    // Blocked: parental-consent message shown, never confirmed.
    expect(screen.getByText(/ages 13 and up/i)).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
    // Signing out from the blocked state triggers the underage handler.
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(onUnderage).toHaveBeenCalled();
  });

  it("keeps Continue disabled until a date is entered", () => {
    render(<AgeGate onConfirm={vi.fn()} onUnderage={vi.fn()} />);
    expect(screen.getByRole("button", { name: /continue/i }).disabled).toBe(true);
  });
});
