import { describe, it, expect } from "vitest";
import { DIAGNOSTIC_BANK, buildDiagnostic, diagnosticSurfaceFor } from "@/lib/diagnosticBank";
import { ORDER, DIAGNOSTIC_DIFFICULTIES } from "@/lib/scoring";
import { isValidTopic } from "@/lib/taxonomy";

describe("curated diagnostic bank", () => {
  it("has exactly ONE curated question per (subject × level) — 9 total", () => {
    expect(DIAGNOSTIC_BANK).toHaveLength(ORDER.length * DIAGNOSTIC_DIFFICULTIES.length); // 3 × 3
    const slots = new Set();
    for (const q of DIAGNOSTIC_BANK) {
      expect(ORDER).toContain(q.subject);
      expect(DIAGNOSTIC_DIFFICULTIES).toContain(q.difficulty);
      const key = `${q.subject}:${q.difficulty}`;
      expect(slots.has(key)).toBe(false); // no duplicate slot
      slots.add(key);
    }
    for (const s of ORDER) for (const d of DIAGNOSTIC_DIFFICULTIES) expect(slots.has(`${s}:${d}`)).toBe(true);
  });

  it("every question is substantive (reasoning-rich, not a one-liner) and tagged with a valid topic slug", () => {
    for (const q of DIAGNOSTIC_BANK) {
      expect(typeof q.question).toBe("string");
      expect(q.question.trim().length).toBeGreaterThan(40);
      expect(typeof q.targetConcept).toBe("string");
      expect(isValidTopic(q.subject, q.topicSlug)).toBe(true);
    }
  });

  it("buildDiagnostic returns a FRESH 9-question copy that can't corrupt the bank", () => {
    const a = buildDiagnostic();
    expect(a.curated).toBe(true);
    expect(a.questions).toHaveLength(9);
    a.questions[0].question = "MUTATED";
    expect(buildDiagnostic().questions[0].question).not.toBe("MUTATED");
    expect(DIAGNOSTIC_BANK[0].question).not.toBe("MUTATED");
  });

  it("every question declares an allow-listed reasoningSurface (trap ⇒ a trap description)", () => {
    const ALLOWED = new Set(["multi-step", "branch", "trap"]);
    for (const q of DIAGNOSTIC_BANK) {
      expect(ALLOWED.has(q.reasoningSurface)).toBe(true);
      if (q.reasoningSurface === "trap") expect(typeof q.trap === "string" && q.trap.trim().length > 0).toBe(true);
    }
  });
});

describe("diagnosticSurfaceFor (server-side bank lookup — the grader's source of truth)", () => {
  it("returns the bank's surface/trap for every real slot", () => {
    for (const q of DIAGNOSTIC_BANK) {
      const s = diagnosticSurfaceFor(q.subject, q.difficulty);
      expect(s.reasoningSurface).toBe(q.reasoningSurface);
      expect(s.trap).toBe(q.trap || "");
    }
  });
  it("returns an empty surface for an unknown/prototype slot (never throws)", () => {
    expect(diagnosticSurfaceFor("math", "phd")).toEqual({ reasoningSurface: null, trap: "" });
    expect(diagnosticSurfaceFor("astrology", "beginner")).toEqual({ reasoningSurface: null, trap: "" });
    expect(diagnosticSurfaceFor("__proto__", "beginner")).toEqual({ reasoningSurface: null, trap: "" });
  });
});
