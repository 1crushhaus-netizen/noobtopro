import { describe, it, expect } from "vitest";
import {
  CURRICULUM,
  RANKS,
  PREREQUISITES,
  prereqKeysFor,
  rootsFor,
  allConcepts,
} from "@/lib/curriculum";

const rankIdx = (r) => RANKS.indexOf(r);

// Per-subject key -> rank index, from the curriculum (source of truth).
const keyRank = {};
for (const subject of Object.keys(CURRICULUM)) {
  keyRank[subject] = {};
  for (const rank of RANKS) for (const c of CURRICULUM[subject][rank]) keyRank[subject][c.key] = rankIdx(rank);
}

describe("curriculum prerequisite graph", () => {
  it("has a prerequisite entry for every curriculum concept", () => {
    for (const c of allConcepts()) {
      expect(PREREQUISITES[c.subject], `${c.subject} missing in PREREQUISITES`).toBeTruthy();
      expect(c.key in PREREQUISITES[c.subject], `no prereq entry for ${c.subject}/${c.key}`).toBe(true);
    }
  });

  it("every root exists in the same subject and is STRICTLY lower rank (acyclic by construction)", () => {
    for (const subject of Object.keys(PREREQUISITES)) {
      for (const [key, roots] of Object.entries(PREREQUISITES[subject])) {
        for (const r of roots) {
          expect(r in keyRank[subject], `${subject}/${key} -> unknown root ${r}`).toBe(true);
          expect(keyRank[subject][r], `${subject}/${key} -> ${r} not lower rank`).toBeLessThan(keyRank[subject][key]);
          expect(r).not.toBe(key); // no self-edge
        }
        // no duplicate roots
        expect(new Set(roots).size).toBe(roots.length);
      }
    }
  });

  it("elementary concepts have no roots (they are the foundation)", () => {
    for (const subject of Object.keys(CURRICULUM)) {
      for (const c of CURRICULUM[subject].elementary) {
        expect(prereqKeysFor(subject, c.key)).toEqual([]);
      }
    }
  });

  it("rootsFor resolves keys to full concept objects with a lower rank", () => {
    const roots = rootsFor("math", "derivatives");
    expect(roots.length).toBeGreaterThan(0);
    for (const r of roots) {
      expect(r.label).toBeTruthy();
      expect(rankIdx(r.rank)).toBeLessThan(rankIdx("university"));
    }
    // unknown / elementary concept → []
    expect(rootsFor("math", "counting_cardinality")).toEqual([]);
    expect(rootsFor("math", "nonexistent_key")).toEqual([]);
  });
});
