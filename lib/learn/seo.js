// ---------------------------------------------------------------------------
// SEO/AEO shared helpers for the public Learn library (app/learn/**).
//
// The Learn library turns the in-app concept hub — 224 curated guides across
// math / physics / chemistry and four ranks — into fully server-rendered,
// crawlable, citable pages so search engines AND answer engines (Google AI
// Overviews, ChatGPT Search, Claude, Gemini, Perplexity) can index and recommend
// the content. This module is the single source of truth for:
//   - the canonical origin + URL builders for every Learn route,
//   - the human/marketing copy (subject + rank descriptions, keywords),
//   - the JSON-LD escaping/serialization used by every structured-data block.
//
// Plain JS, no browser APIs (mirrors lib/scoring.js) so it imports cleanly into
// server components AND the metadata routes (sitemap / llms.txt).
// ---------------------------------------------------------------------------

import { ORDER, SUBJECTS } from "@/lib/scoring";
import { RANKS, RANK_LABELS, conceptsFor } from "@/lib/curriculum";

// Canonical production origin (overridable so Vercel preview deploys advertise
// their own origin instead of pointing canonicals/OG at production). Mirrors the
// constant used by app/layout.js, app/sitemap.js, app/robots.js.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://noobto.pro";

export const BRAND = "noobtopro";

// The four populated ranks, in ladder order (doctorate is WIP/empty — excluded
// from the public library since it has no concepts/guides yet).
export const PUBLIC_RANKS = RANKS.filter((r) => r !== "doctorate");

// Per-subject SEO copy. Blurbs mirror the marketing Landing ("Three subjects,
// same rigor") so search/share/page tell one story; descriptions are original,
// truthful, ≤ ~158 chars for a clean meta description.
export const SUBJECT_SEO = {
  math: {
    blurb: "Arithmetic and algebra through calculus and proof.",
    description:
      "Reasoning-first math guides from counting to calculus and proof — each with a clear explanation, a fully worked example, and self-check questions.",
    intro:
      "Mathematics on noobtopro is built around reasoning, not recall. Each concept below comes with a clear explanation, one fully worked example you can follow step by step, and self-check questions that probe whether you really understand the idea — the same way the platform grades you.",
    keywords: [
      "math practice",
      "learn mathematics",
      "math reasoning",
      "math worked examples",
      "math concepts explained",
      "how to solve math problems",
    ],
  },
  physics: {
    blurb: "Mechanics through modern physics, reasoned from first principles.",
    description:
      "Reasoning-first physics guides from forces and energy to relativity — each with a clear explanation, a fully worked example, and self-check questions.",
    intro:
      "Physics on noobtopro is reasoned from first principles. Every concept below starts from the governing idea, works one example all the way through with units and sanity checks, and ends with questions that test whether you can apply the reasoning yourself.",
    keywords: [
      "physics practice",
      "learn physics",
      "physics reasoning",
      "physics worked examples",
      "physics concepts explained",
      "how to solve physics problems",
    ],
  },
  chemistry: {
    blurb: "Stoichiometry through mechanisms and equilibrium.",
    description:
      "Reasoning-first chemistry guides from atoms and bonding to equilibrium — each with a clear explanation, a fully worked example, and self-check questions.",
    intro:
      "Chemistry on noobtopro connects the particle picture to the math you actually do. Each concept below explains the idea in plain language, works one example step by step, and asks the questions that reveal whether the reasoning has clicked.",
    keywords: [
      "chemistry practice",
      "learn chemistry",
      "chemistry reasoning",
      "chemistry worked examples",
      "chemistry concepts explained",
      "how to solve chemistry problems",
    ],
  },
};

// Per-rank SEO copy. `seoLabel` is the search-friendly grade band ("High School")
// vs the terse in-app RANK_LABELS ("High"); `range` is the 0–350 sub-band.
export const RANK_SEO = {
  elementary: {
    seoLabel: "Elementary School",
    range: "0–69",
    realWorld: "elementary-school level",
    blurb: "Foundations: the concrete ideas every later concept is built on.",
  },
  middle: {
    seoLabel: "Middle School",
    range: "70–139",
    realWorld: "middle-school level",
    blurb: "Ratios, expressions, and the particle picture — the bridge to abstraction.",
  },
  high: {
    seoLabel: "High School",
    range: "140–209",
    realWorld: "high-school level",
    blurb: "Functions, mechanics, and stoichiometry — the core curriculum, reasoned out.",
  },
  university: {
    seoLabel: "University",
    range: "210–279",
    realWorld: "undergraduate level",
    blurb: "Calculus, electromagnetism, and equilibrium — first-principles depth.",
  },
  doctorate: {
    seoLabel: "Doctorate",
    range: "280–350",
    realWorld: "PhD level",
    blurb: "The top of the ladder.",
  },
};

// --- display labels --------------------------------------------------------

export function subjectLabel(subject) {
  return (SUBJECTS[subject] && SUBJECTS[subject].label) || subject;
}

export function subjectGlyph(subject) {
  return (SUBJECTS[subject] && SUBJECTS[subject].glyph) || "";
}

export function subjectColor(subject) {
  return (SUBJECTS[subject] && SUBJECTS[subject].color) || "#9b9b9b";
}

export function rankSeoLabel(rank) {
  return (RANK_SEO[rank] && RANK_SEO[rank].seoLabel) || RANK_LABELS[rank] || rank;
}

// --- validation (prototype-safe membership) --------------------------------

export function isPublicSubject(subject) {
  return ORDER.includes(subject);
}

export function isPublicRank(rank) {
  return PUBLIC_RANKS.includes(rank);
}

// True only when (subject, rank) is a real, populated cell with concepts/guides.
export function isPublicCell(subject, rank) {
  return isPublicSubject(subject) && isPublicRank(rank) && conceptsFor(subject, rank).length > 0;
}

// --- URL builders (always absolute paths; pair with SITE_URL for absolute) --

export function learnUrl() {
  return "/learn";
}
export function subjectUrl(subject) {
  return `/learn/${subject}`;
}
export function rankUrl(subject, rank) {
  return `/learn/${subject}/${rank}`;
}
// Concept keys are snake_case (lib/curriculum.js); URLs use hyphens because
// Google treats "_" as a NON-separator but "-" as a word break. The transform is
// bijective (no key contains a hyphen — pinned by test/learn-seo.test.js), so the
// slug round-trips exactly back to the stored key.
export function keyToSlug(key) {
  return String(key).replace(/_/g, "-");
}
export function slugToKey(slug) {
  return String(slug).replace(/-/g, "_");
}
export function conceptUrl(subject, rank, key) {
  return `/learn/${subject}/${rank}/${keyToSlug(key)}`;
}
export function absolute(path) {
  return `${SITE_URL}${path}`;
}

// The brand social card (1200×630, app/opengraph-image.js + app/twitter-image.js).
// Child routes that export their OWN openGraph/twitter REPLACE the inherited
// file-based image and downgrade the Twitter card to "summary", so every Learn
// page must re-attach these explicitly to keep a rich, on-brand share preview.
export const OG_IMAGE = "/opengraph-image";
export const TWITTER_IMAGE = "/twitter-image";
export const OG_ALT =
  "noobtopro — reasoning-graded problems in math, physics, and chemistry, ranked Elementary to Doctorate.";

// Build the openGraph + twitter metadata for a Learn page, carrying the brand
// card. `title`/`description` are used verbatim (pass the brand-suffixed title).
export function socialMeta({ title, description, url, type = "website" }) {
  return {
    openGraph: {
      type,
      title,
      description,
      url,
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: OG_ALT }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [TWITTER_IMAGE],
    },
  };
}

// --- JSON-LD serialization -------------------------------------------------
//
// Server-render structured data as a PLAIN TEXT child of <script type=
// "application/ld+json"> (never dangerouslySetInnerHTML), unicode-escaping the
// three characters that could let a value break out of the script element. This
// is byte-for-byte the same hardening app/layout.js + components/Landing.jsx use.

export function escapeJsonLd(json) {
  return json.replace(/[<>&]/g, (c) => ({ "<": "\\u003c", ">": "\\u003e", "&": "\\u0026" }[c]));
}

export function serializeJsonLd(data) {
  return escapeJsonLd(JSON.stringify(data));
}

// The shared Organization @id, so every page's structured data references the
// SAME publisher node defined in app/layout.js (one canonical entity for the
// brand knowledge graph).
export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

// Trim prose to a clean meta-description length at a word boundary (no mid-word
// cut, no dangling punctuation). Used to derive a concept page's description from
// the FIRST line of its guide — real, unique, front-loaded content (the region
// answer engines cite most) rather than a templated boilerplate string.
export function clampDescription(text, max = 158) {
  const s = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const base = (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-—]+$/, "");
  return `${base}…`;
}

// A BreadcrumbList from an ordered [{ name, path }] trail (path relative; the
// last item is usually the current page).
export function breadcrumbList(items) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absolute(it.path),
    })),
  };
}

// A concise, human-readable label for one HowToStep, derived from the step's
// prose: its first sentence (up to the first "." / ":"), clamped at a word
// boundary. HowToStep.name is optional, but a short lead makes each step
// scannable in the structured data without ever cutting mid-word.
export function stepName(text, max = 72) {
  const s = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
  if (!s) return "";
  // First sentence/clause (boundary = "." or ":" + space, so decimals like 6.25
  // don't split it), with any trailing sentence punctuation stripped off.
  const m = s.match(/^(.+?)[.:]\s/);
  const lead = (m ? m[1] : s).replace(/[.:]+$/, "").trim();
  return clampDescription(lead, max);
}

// Build a schema.org HowTo from a guide's worked example. A worked example is a
// problem statement + an ordered list of solution steps + a final answer — which
// is exactly the shape of a HowTo, the structured type answer engines (ChatGPT
// Search, Perplexity, Gemini, AI Overviews) parse to surface and cite a
// step-by-step solution. (Google retired the *visual* HowTo rich result in 2023,
// but the markup still feeds answer engines / LLMs — the AEO surface this hub
// targets — so it is pure upside.) Every field mirrors content rendered visibly
// on the page (the <ol> of steps + the Answer line), so structured data and
// visible content stay in lockstep.
//
// `id`/`isPartOfId` are passed in (absolute, hash-suffixed) so this stays a pure,
// URL-agnostic transform. Returns null when there is no usable example, letting
// callers skip guide-less concepts cleanly.
export function howToFromExample({ id, isPartOfId, label, example }) {
  if (!example || !Array.isArray(example.steps) || example.steps.length === 0) return null;
  const step = example.steps.map((text, i) => ({
    "@type": "HowToStep",
    position: i + 1,
    name: stepName(text),
    text,
  }));
  // The final answer is the result of the procedure and is rendered on the page,
  // so include it as the closing step (HowTo has no dedicated result field).
  if (example.answer) {
    step.push({
      "@type": "HowToStep",
      position: step.length + 1,
      name: "Answer",
      text: String(example.answer),
    });
  }
  return {
    "@type": "HowTo",
    ...(id ? { "@id": id } : {}),
    name: `${label}: worked example`,
    description: example.problem || `A fully worked example for ${label}.`,
    inLanguage: "en",
    ...(isPartOfId ? { isPartOf: { "@id": isPartOfId } } : {}),
    step,
  };
}
