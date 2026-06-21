// Lists the public, indexable routes for search engines. Next serves this at
// /sitemap.xml. With the Learn library live this enumerates the home + legal
// pages, the library hub, every subject + populated level, and all 224 concept
// guides — ~254 URLs, well under the 50,000-per-file limit (no sitemap index
// needed). SITE_URL matches the canonical origin (overridable for previews).
import { ORDER } from "@/lib/scoring";
import { conceptsFor } from "@/lib/curriculum";
import {
  SITE_URL,
  absolute,
  learnUrl,
  subjectUrl,
  rankUrl,
  conceptUrl,
  PUBLIC_RANKS,
} from "@/lib/learn/seo";

// STABLE last-content-update date. Google only trusts <lastmod> when it is
// verifiably accurate, so this is a fixed constant bumped only when the library
// content genuinely changes — NOT `new Date()` on every build (which trains
// crawlers to ignore the field).
const LAST_UPDATED = new Date("2026-06-19T00:00:00Z");
const LEGAL_UPDATED = new Date("2026-06-19T00:00:00Z");

export default function sitemap() {
  const entries = [
    // Bare origin (no trailing slash) to match the homepage canonical + og:url —
    // absolute("/") would emit "https://noobto.pro/" and split signals from the
    // "https://noobto.pro" canonical the layout sets.
    { url: SITE_URL, lastModified: LAST_UPDATED, changeFrequency: "weekly", priority: 1 },
    { url: absolute(learnUrl()), lastModified: LAST_UPDATED, changeFrequency: "weekly", priority: 0.9 },
  ];

  for (const subject of ORDER) {
    entries.push({
      url: absolute(subjectUrl(subject)),
      lastModified: LAST_UPDATED,
      changeFrequency: "weekly",
      priority: 0.8,
    });
    for (const rank of PUBLIC_RANKS) {
      if (conceptsFor(subject, rank).length === 0) continue;
      entries.push({
        url: absolute(rankUrl(subject, rank)),
        lastModified: LAST_UPDATED,
        changeFrequency: "monthly",
        priority: 0.7,
      });
      for (const c of conceptsFor(subject, rank)) {
        entries.push({
          url: absolute(conceptUrl(subject, rank, c.key)),
          lastModified: LAST_UPDATED,
          changeFrequency: "monthly",
          priority: 0.6,
        });
      }
    }
  }

  for (const path of [
    "/privacy",
    "/terms",
    "/refunds",
    "/cookies",
    "/aup",
    "/accessibility",
    "/legal",
    "/legal/notice",
    "/legal/billing-terms",
    "/legal/ai-transparency",
    "/legal/sub-processors",
    "/legal/data-retention",
    "/legal/us-privacy",
  ]) {
    entries.push({ url: absolute(path), lastModified: LEGAL_UPDATED, changeFrequency: "yearly", priority: 0.3 });
  }

  return entries;
}
