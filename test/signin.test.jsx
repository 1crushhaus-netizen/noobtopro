// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import SignIn from "@/components/SignIn";
import { PROVIDERS } from "@/lib/supabase";

afterEach(cleanup);

describe("SignIn menu", () => {
  it("PROVIDERS: only Google is enabled (GitHub/Discord are placeholders)", () => {
    const byId = Object.fromEntries(PROVIDERS.map((p) => [p.id, p.enabled]));
    expect(byId.google).toBe(true);
    expect(byId.github).toBe(false);
    expect(byId.discord).toBe(false);
  });

  it("renders one button per provider; Google enabled, GitHub/Discord disabled with 'Coming soon'", () => {
    render(<SignIn providers={PROVIDERS} onProvider={() => {}} onBack={() => {}} />);
    expect(screen.getByRole("button", { name: /continue with google/i }).disabled).toBe(false);
    expect(screen.getByRole("button", { name: /github sign-in coming soon/i }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: /discord sign-in coming soon/i }).disabled).toBe(true);
    expect(screen.getAllByText(/coming soon/i).length).toBe(2);
  });

  it("calls onProvider('google') when the enabled Google button is clicked", () => {
    const onProvider = vi.fn();
    render(<SignIn providers={PROVIDERS} onProvider={onProvider} onBack={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    expect(onProvider).toHaveBeenCalledWith("google");
  });

  it("does not call onProvider for a disabled placeholder", () => {
    const onProvider = vi.fn();
    render(<SignIn providers={PROVIDERS} onProvider={onProvider} onBack={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /github sign-in coming soon/i }));
    expect(onProvider).not.toHaveBeenCalled();
  });

  it("has no email/password input (OAuth-only by design)", () => {
    render(<SignIn providers={PROVIDERS} onProvider={() => {}} onBack={() => {}} />);
    expect(document.querySelector('input[type="password"]')).toBe(null);
    expect(document.querySelector('input[type="email"]')).toBe(null);
  });

  it("calls onBack from the Back button", () => {
    const onBack = vi.fn();
    render(<SignIn providers={PROVIDERS} onProvider={() => {}} onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
