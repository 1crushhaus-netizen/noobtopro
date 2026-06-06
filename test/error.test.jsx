// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import Error from "@/app/error";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("app/error.jsx — error boundary", () => {
  it("logs the caught error on mount so prod crashes leave a breadcrumb", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const boom = new globalThis.Error("boom");
    render(<Error error={boom} reset={() => {}} />);
    expect(spy).toHaveBeenCalledWith("[error boundary]", boom);
  });

  it("renders a recoverable message and invokes reset on 'Try again'", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    render(<Error error={new globalThis.Error("x")} reset={reset} />);
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
    fireEvent.click(screen.getByText(/try again/i));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
