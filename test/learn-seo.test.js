// Unit coverage for the public Learn library's SEO/AEO helper layer
// (lib/learn/seo.js): URL builders, the snake_case⇄hyphen slug invariant, the
// content-derived meta-description clamp, breadcrumb structured data, the JSON-LD
// hardening, and the public-cell gating (doctorate excluded).
import { describe, it, expect } from "vitest";
import { CURRICULUM, RANKS, conceptsFor } from "@/lib/curriculum";
import { ORDER } from "@/lib/scoring";
import {
  SITE_URL,
  PUBLIC_RANKS,
  keyToSlug,
  slugToKey,
  conceptUrl,
  subjectUrl,
  rankUrl,
  absolute,
  clampDescription,
  breadcrumbList,
  escapeJsonLd,
  serializeJsonLd,
  isPublicSubject,
  isPublicRank,
  isPublicCell,
  rankSeoLabel,
  SUBJECT_SEO,
  RANK_SEO,
} from "@/lib/learn/seo";

// Every curriculum key across every subject/rank — the universe the slug
// transform must round-trip.
const ALL_KEYS = [];
for (const subject of Object.keys(CURRICULUM)) {
  for (const rank of RANKS) {
    for (const c of conceptsFor(subject, rank)) ALL_KEYS.push(c.key);
  }
}

describe("learn/seo — slug ⇄ key transform", () => {
  it("no curriculum key contains a hyphen (so '_'→'-' is reversible)", () => {
    expect(ALL_KEYS.filter((k) => k.includes("-"))).toEqual([]);
  });

  it("round-trips every key losslessly", () => {
    for (const key of ALL_KEYS) {
      expect(slugToKey(keyToSlug(key))).toBe(key);
    }
  });

  it("keys with underscores become hyphenated slugs", () => {
    expect(keyToSlug("real_complex_numbers")).toBe("real-complex-numbers");
    expect(slugToKey("real-complex-numbers")).toBe("real_complex_numbers");
    expect(keyToSlug("shapes_2d_3d")).toBe("shapes-2d-3d");
  });

  it("conceptUrl emits the hyphenated slug under the subject/rank path", () => {
    expect(conceptUrl("math", "high", "real_complex_numbers")).toBe(
      "/learn/math/high/real-complex-numbers"
    );
  });

  it("produces unique concept URLs across the whole curriculum", () => {
    const urls = new Set();
    for (const subject of ORDER) {
      for (const rank of PUBLIC_RANKS) {
        for (const c of conceptsFor(subject, rank)) urls.add(conceptUrl(subject, rank, c.key));
      }
    }
    let total = 0;
    for (const subject of ORDER)
      for (const rank of PUBLIC_RANKS) total += conceptsFor(subject, rank).length;
    expect(urls.size).toBe(total);
    expect(total).toBe(224);
  });
});

describe("learn/seo — URL builders", () => {
  it("builds absolute URLs against the canonical origin", () => {
    expect(SITE_URL).toBe("https://noobto.pro");
    expect(absolute(subjectUrl("physics"))).toBe("https://noobto.pro/learn/physics");
    expect(absolute(rankUrl("chemistry", "university"))).toBe(
      "https://noobto.pro/learn/chemistry/university"
    );
  });
});

describe("learn/seo — public-cell gating", () => {
  it("accepts the three subjects and four populated ranks", () => {
    for (const s of ORDER) expect(isPublicSubject(s)).toBe(true);
    expect(PUBLIC_RANKS).toEqual(["elementary", "middle", "high", "university"]);
    for (const r of PUBLIC_RANKS) expect(isPublicRank(r)).toBe(true);
  });

  it("rejects doctorate (WIP/empty) and unknown subjects/ranks", () => {
    expect(isPublicRank("doctorate")).toBe(false);
    expect(isPublicSubject("biology")).toBe(false);
    expect(isPublicCell("math", "doctorate")).toBe(false);
    expect(isPublicCell("biology", "high")).toBe(false);
    expect(isPublicCell("math", "high")).toBe(true);
  });

  it("is prototype-safe", () => {
    expect(isPublicSubject("__proto__")).toBe(false);
    expect(isPublicCell("__proto__", "high")).toBe(false);
  });
});

describe("learn/seo — clampDescription", () => {
  it("passes short text through unchanged", () => {
    expect(clampDescription("A short sentence.")).toBe("A short sentence.");
  });

  it("collapses whitespace", () => {
    expect(clampDescription("a   b\n c")).toBe("a b c");
  });

  it("trims long text at a word boundary and adds an ellipsis", () => {
    const long = "word ".repeat(60).trim();
    const out = clampDescription(long, 40);
    expect(out.length).toBeLessThanOrEqual(41); // 40 + ellipsis
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/\s…$/); // no dangling space before ellipsis
    expect(out.includes("wor…")).toBe(false); // never cuts mid-word awkwardly at the boundary
  });

  it("handles null/undefined", () => {
    expect(clampDescription(null)).toBe("");
    expect(clampDescription(undefined)).toBe("");
  });
});

describe("learn/seo — breadcrumbList", () => {
  it("emits 1-based positions with absolute item URLs", () => {
    const bl = breadcrumbList([
      { name: "noobtopro", path: "/" },
      { name: "Learn", path: "/learn" },
      { name: "Mathematics", path: "/learn/math" },
    ]);
    expect(bl["@type"]).toBe("BreadcrumbList");
    expect(bl.itemListElement).toHaveLength(3);
    expect(bl.itemListElement[0]).toMatchObject({ position: 1, name: "noobtopro" });
    expect(bl.itemListElement[2]).toMatchObject({
      position: 3,
      name: "Mathematics",
      item: "https://noobto.pro/learn/math",
    });
  });
});

describe("learn/seo — JSON-LD hardening", () => {
  it("escapes <, >, and & so a value cannot break out of the script element", () => {
    expect(escapeJsonLd('a<b>c&d')).toBe("a\\u003cb\\u003ec\\u0026d");
  });

  it("serializeJsonLd produces escaped JSON with no raw angle brackets", () => {
    const s = serializeJsonLd({ name: "x < y & z >" });
    expect(s).not.toMatch(/[<>]/);
    expect(s).toContain("\\u003c");
    expect(s).toContain("\\u0026");
    // still valid JSON once unescaped back
    const restored = s
      .replace(/\\u003c/g, "<")
      .replace(/\\u003e/g, ">")
      .replace(/\\u0026/g, "&");
    expect(JSON.parse(restored)).toEqual({ name: "x < y & z >" });
  });
});

describe("learn/seo — copy tables are complete", () => {
  it("has SEO copy for every subject", () => {
    for (const s of ORDER) {
      expect(SUBJECT_SEO[s]).toBeTruthy();
      expect(SUBJECT_SEO[s].description.length).toBeGreaterThan(60);
      expect(SUBJECT_SEO[s].description.length).toBeLessThanOrEqual(160);
      expect(Array.isArray(SUBJECT_SEO[s].keywords)).toBe(true);
    }
  });

  it("has SEO labels + ranges for every public rank", () => {
    for (const r of PUBLIC_RANKS) {
      expect(RANK_SEO[r]).toBeTruthy();
      expect(rankSeoLabel(r)).toMatch(/[A-Za-z]/);
      expect(RANK_SEO[r].range).toMatch(/^\d+–\d+$/);
    }
  });
});
