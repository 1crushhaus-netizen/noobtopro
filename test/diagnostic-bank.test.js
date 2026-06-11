import { describe, it, expect } from "vitest";
import {
  DIAGNOSTIC_BANK,
  diagnosticItemById,
  pickDiagnosticItem,
  nextDiagBand,
  DIAG_STEPS_PER_SUBJECT,
  DIAG_START_BAND,
  DIAG_STEP_UP_QUALITY,
} from "@/lib/diagnosticBank";
import { isCurriculumConcept } from "@/lib/mastery";
import { BAND_LADDER } from "@/lib/curriculum";
import { ORDER } from "@/lib/scoring";
import { isValidTopic } from "@/lib/taxonomy";

describe("curated adaptive diagnostic bank (RANKS_PLAN §8)", () => {
  it("has exactly TWO items per (subject × band) across ALL FIVE bands — 30 total", () => {
    expect(DIAGNOSTIC_BANK).toHaveLength(ORDER.length * BAND_LADDER.length * 2);
    const cells = {};
    const ids = new Set();
    for (const q of DIAGNOSTIC_BANK) {
      expect(ORDER).toContain(q.subject);
      expect(BAND_LADDER).toContain(q.band);
      expect(ids.has(q.id), `duplicate id ${q.id}`).toBe(false);
      ids.add(q.id);
      expect(q.id.startsWith(`${q.subject}:${q.band}:`), `id ${q.id} not canonical`).toBe(true);
      cells[`${q.subject}:${q.band}`] = (cells[`${q.subject}:${q.band}`] || 0) + 1;
    }
    for (const s of ORDER) for (const b of BAND_LADDER) expect(cells[`${s}:${b}`], `${s}/${b}`).toBe(2);
  });

  it("every item is substantive, topic-tagged with a valid slug, and mastery-tagged with a REAL same-subject concept", () => {
    for (const q of DIAGNOSTIC_BANK) {
      expect(typeof q.question).toBe("string");
      expect(q.question.trim().length).toBeGreaterThan(40);
      expect(typeof q.targetConcept).toBe("string");
      expect(isValidTopic(q.subject, q.topicSlug), `${q.id} slug ${q.topicSlug}`).toBe(true);
      expect(isCurriculumConcept(q.subject, q.conceptKey), `${q.id} -> ${q.conceptKey}`).toBe(true);
    }
  });

  it("every item declares an allow-listed reasoningSurface (trap ⇒ a trap description, and only then)", () => {
    const ALLOWED = new Set(["multi-step", "branch", "trap"]);
    for (const q of DIAGNOSTIC_BANK) {
      expect(ALLOWED.has(q.reasoningSurface), q.id).toBe(true);
      if (q.reasoningSurface === "trap") expect(typeof q.trap === "string" && q.trap.trim().length > 0, q.id).toBe(true);
      else expect(q.trap, `${q.id} has a trap on a non-trap surface`).toBeUndefined();
    }
  });
});

describe("diagnosticItemById (the grader's server-side source of truth)", () => {
  it("resolves every bank item by id; null for unknown/prototype ids", () => {
    for (const q of DIAGNOSTIC_BANK) expect(diagnosticItemById(q.id)).toBe(q);
    expect(diagnosticItemById("math:beginner:99")).toBe(null);
    expect(diagnosticItemById("__proto__")).toBe(null);
    expect(diagnosticItemById(null)).toBe(null);
  });
});

describe("pickDiagnosticItem (deterministic, standardized serving)", () => {
  it("serves the cell's first item, then the second when the first was asked", () => {
    const first = pickDiagnosticItem("math", "intermediate", []);
    expect(first.id).toBe("math:intermediate:1");
    const second = pickDiagnosticItem("math", "intermediate", [first.id]);
    expect(second.id).toBe("math:intermediate:2");
    // Exhausted cell (unreachable on a real 4-step walk) falls back, never null.
    expect(pickDiagnosticItem("math", "intermediate", [first.id, second.id]).id).toBe("math:intermediate:1");
  });

  it("is deterministic across calls (identical paths face identical items) and null only for unknown cells", () => {
    expect(pickDiagnosticItem("physics", "phd", [])).toBe(pickDiagnosticItem("physics", "phd", []));
    expect(pickDiagnosticItem("astrology", "beginner", [])).toBe(null);
  });
});

describe("nextDiagBand (the §8 ±1-band walk)", () => {
  it("moves one band up at/above the threshold, one band down below it, clamped at the ladder ends", () => {
    expect(nextDiagBand("intermediate", DIAG_STEP_UP_QUALITY)).toBe("advanced");
    expect(nextDiagBand("intermediate", DIAG_STEP_UP_QUALITY - 1)).toBe("foundational");
    expect(nextDiagBand("phd", 100)).toBe("phd"); // top clamp
    expect(nextDiagBand("beginner", 0)).toBe("beginner"); // bottom clamp
  });

  it("re-centers a malformed band on the start band (never walks off the ladder)", () => {
    expect(nextDiagBand("bogus", 100)).toBe("advanced"); // intermediate +1
    expect(nextDiagBand(undefined, 0)).toBe("foundational"); // intermediate -1
  });

  it("the walk's constants match the §8 decisions (4 steps, middle start)", () => {
    expect(DIAG_STEPS_PER_SUBJECT).toBe(4);
    expect(DIAG_START_BAND).toBe("intermediate");
    // From the middle, a 4-step ±1 walk can reach either extreme…
    expect(nextDiagBand(nextDiagBand(DIAG_START_BAND, 100), 100)).toBe("phd");
    expect(nextDiagBand(nextDiagBand(DIAG_START_BAND, 0), 0)).toBe("beginner");
    // …and any band at most twice — which is why two items per cell suffice.
  });
});
