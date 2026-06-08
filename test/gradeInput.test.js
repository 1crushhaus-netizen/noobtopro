import { describe, it, expect } from "vitest";
import { normalizeReasoningSurface, capTrap, reasoningSurfaceContext } from "@/lib/gradeInput";

describe("normalizeReasoningSurface", () => {
  it("allow-lists the three surfaces (case/space-tolerant)", () => {
    expect(normalizeReasoningSurface("multi-step")).toBe("multi-step");
    expect(normalizeReasoningSurface(" BRANCH ")).toBe("branch");
    expect(normalizeReasoningSurface("Trap")).toBe("trap");
  });
  it("returns null for anything off-list or non-string", () => {
    for (const bad of ["atomic", "single", "", "  ", 3, null, undefined, {}, ["trap"]]) {
      expect(normalizeReasoningSurface(bad)).toBe(null);
    }
  });
});

describe("capTrap", () => {
  it("trims and caps at 200 chars; '' for blank/non-string", () => {
    expect(capTrap("  inverted the ratio  ")).toBe("inverted the ratio");
    expect(capTrap("z".repeat(500)).length).toBe(200);
    expect(capTrap("")).toBe("");
    expect(capTrap(42)).toBe("");
    expect(capTrap(null)).toBe("");
  });
});

describe("reasoningSurfaceContext", () => {
  it("renders the surface line for a valid non-trap surface (no trap line)", () => {
    const out = reasoningSurfaceContext("multi-step", "ignored");
    expect(out).toBe("Reasoning surface: multi-step");
  });
  it("renders the trap line only for a trap surface with a trap description", () => {
    const out = reasoningSurfaceContext("trap", "reporting weight as the net force");
    expect(out).toContain("Reasoning surface: trap");
    expect(out).toContain("Common wrong path (trap): reporting weight as the net force");
  });
  it("drops a stray trap on a non-trap surface", () => {
    expect(reasoningSurfaceContext("branch", "some naive path")).toBe("Reasoning surface: branch");
  });
  it("returns '' when the surface is absent/invalid (safe to concatenate)", () => {
    expect(reasoningSurfaceContext(null, "x")).toBe("");
    expect(reasoningSurfaceContext("atomic", "x")).toBe("");
    expect(reasoningSurfaceContext(undefined, undefined)).toBe("");
  });
  it("a trap surface with no description still renders just the surface line", () => {
    expect(reasoningSurfaceContext("trap", "")).toBe("Reasoning surface: trap");
  });
});
