// Guards the expanded sitemap (app/sitemap.js): full route coverage, the canonical
// URL form (bare origin home, hyphenated concept slugs, no trailing slashes), and a
// STABLE lastmod (not new Date() per build, which trains Google to ignore it).
import { describe, it, expect } from "vitest";
import sitemap from "@/app/sitemap";
import { SITE_URL } from "@/lib/learn/seo";

const entries = sitemap();
const urls = entries.map((e) => e.url);

describe("sitemap", () => {
  it("covers home + /learn + 3 subjects + 12 cells + 224 concepts + 13 legal (254)", () => {
    expect(entries.length).toBe(254);
    const learn = urls.filter((u) => u.includes("/learn/"));
    const concepts = learn.filter((u) => u.split("/").length === 7); // /learn/subject/rank/concept
    expect(concepts.length).toBe(224);
  });

  it("homepage loc is the bare origin (matches the no-trailing-slash canonical)", () => {
    expect(urls).toContain(SITE_URL);
    expect(urls).toContain(`${SITE_URL}/learn`);
    expect(urls).not.toContain(`${SITE_URL}/`); // no trailing-slash home variant
  });

  it("every URL is absolute on the canonical origin with no trailing slash", () => {
    for (const u of urls) {
      expect(u.startsWith(SITE_URL)).toBe(true);
      expect(u.endsWith("/")).toBe(false);
    }
  });

  it("concept URLs are hyphenated (no underscores leak from snake_case keys)", () => {
    const conceptUrls = urls.filter((u) => u.split("/").length === 7);
    for (const u of conceptUrls) {
      const slug = u.split("/").pop();
      expect(slug).not.toContain("_");
    }
  });

  it("uses a single stable lastModified (not a per-build timestamp)", () => {
    const times = new Set(entries.map((e) => e.lastModified.getTime()));
    expect(times.size).toBe(1); // every entry shares one fixed date
    expect(entries[0].lastModified.getTime()).toBeLessThan(Date.now());
  });

  it("has no duplicate URLs", () => {
    expect(new Set(urls).size).toBe(urls.length);
  });
});
