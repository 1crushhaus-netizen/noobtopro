// These vectors must match the SQL _concept_key() in db/schema.sql, verified
// separately against the live DB by the orchestrator. C0/C1/zero-width/BOM are
// stripped (step 1); truncation is by code point (Array.from).
import { describe, it, expect } from "vitest";
import { conceptKey } from "@/lib/supabaseAdmin";

describe("conceptKey", () => {
  it("lowercases and trims a plain label", () => {
    expect(conceptKey("Equilibrium Constant")).toBe("equilibrium constant");
  });

  it("collapses internal whitespace runs to a single space", () => {
    expect(conceptKey("the   chain    rule")).toBe("the chain rule");
  });

  it("strips surrounding quote runs", () => {
    expect(conceptKey('"limits"')).toBe("limits");
    expect(conceptKey("''`hooke's law`''")).toBe("hooke's law");
  });

  // ---- Previously-divergent classes: chars where JS \s / trim() and Postgres
  // \s disagree. Each MUST be stripped as a control/format char, never turned
  // into (or treated as) a collapsible space.
  it("strips NEL (U+0085) as a control char, not a collapsed space", () => {
    expect(conceptKey("ab")).toBe("ab");
  });

  it("strips C0 separators (e.g. U+001C) entirely", () => {
    expect(conceptKey("hello")).toBe("hello");
  });

  it("strips a leading BOM (U+FEFF)", () => {
    expect(conceptKey("﻿chain rule")).toBe("chain rule");
  });

  it("strips a zero-width space (U+200B)", () => {
    expect(conceptKey("a​b")).toBe("ab");
  });

  it("truncates by code point so an astral char at the boundary is not split", () => {
    const result = conceptKey("a".repeat(199) + "\u{1F600}");
    expect(Array.from(result).length).toBe(200);
    // Last code point is the full emoji, not a lone surrogate half.
    expect(Array.from(result).pop()).toBe("\u{1F600}");
  });

  it("truncates a long plain string to 200 chars", () => {
    expect(conceptKey("x".repeat(250)).length).toBe(200);
  });
});
