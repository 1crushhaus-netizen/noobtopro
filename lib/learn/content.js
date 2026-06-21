// ---------------------------------------------------------------------------
// Server-side content shaping for the public Learn library (app/learn/**).
//
// Reads the FIXED curriculum (lib/curriculum.js) and the curated written guides
// (lib/guides) and reshapes them for the crawlable pages: subject overviews,
// rank cells grouped by curriculum strand, and a single concept's full guide
// plus its prerequisite ("foundations") and sibling ("related") links — the
// internal-link graph that gives the hub topical authority.
//
// Pure data assembly, no rendering. Guide loading is async (the guide modules
// are lazy code-split per cell); everything else is synchronous over the
// in-memory curriculum.
// ---------------------------------------------------------------------------

import { ORDER } from "@/lib/scoring";
import {
  conceptsFor,
  conceptByKey,
  rootsFor,
  crossRootsFor,
} from "@/lib/curriculum";
import { loadGuide } from "@/lib/guides";
import {
  SITE_URL,
  ORG_ID,
  WEBSITE_ID,
  PUBLIC_RANKS,
  isPublicCell,
  subjectLabel,
  rankSeoLabel,
  RANK_SEO,
  rankUrl,
  absolute,
} from "@/lib/learn/seo";

// Every populated (subject, rank) cell for a subject, with its concept count.
export function subjectRanks(subject) {
  return PUBLIC_RANKS.filter((rank) => conceptsFor(subject, rank).length > 0).map((rank) => ({
    rank,
    concepts: conceptsFor(subject, rank),
    count: conceptsFor(subject, rank).length,
  }));
}

// Total guides for a subject across its populated ranks.
export function subjectConceptCount(subject) {
  return subjectRanks(subject).reduce((n, r) => n + r.count, 0);
}

// The grand total across all public subjects/ranks (the single source of truth
// for the concept count used in copy, llms.txt, and the Learn hub).
export function totalConceptCount() {
  return ORDER.reduce((n, s) => n + subjectConceptCount(s), 0);
}

// Concepts of a (subject, rank) grouped by their curriculum strand, preserving
// curriculum order. Returns [{ strand, concepts: [{ key, label, strand }] }].
export function conceptsByStrand(subject, rank) {
  const groups = [];
  const index = new Map();
  for (const c of conceptsFor(subject, rank)) {
    if (!index.has(c.strand)) {
      const g = { strand: c.strand, concepts: [] };
      index.set(c.strand, g);
      groups.push(g);
    }
    index.get(c.strand).concepts.push(c);
  }
  return groups;
}

// Full data for one concept page, or null when the (subject, rank, key) triple
// is not a real, populated concept. Loads the curated guide and resolves the
// prerequisite + sibling links used for internal navigation.
export async function getConceptData(subject, rank, key) {
  if (!isPublicCell(subject, rank)) return null;
  const concept = conceptsFor(subject, rank).find((c) => c.key === key);
  if (!concept) return null;

  const guide = await loadGuide(subject, rank, key);

  // Same-subject prerequisites ("foundations") + cross-subject prerequisites
  // (e.g. pH → logarithms), both already resolved to full concept objects.
  const roots = rootsFor(subject, key).filter((c) => isPublicCell(subject, c.rank));
  const crossRoots = crossRootsFor(subject, key).filter((c) => isPublicCell(c.subject, c.rank));

  // Siblings: other concepts in the SAME strand + rank (the tightest topical
  // neighbours), then fall back to the rest of the rank, capped for a tidy list.
  const sameStrand = conceptsFor(subject, rank).filter(
    (c) => c.key !== key && c.strand === concept.strand
  );
  const otherInRank = conceptsFor(subject, rank).filter(
    (c) => c.key !== key && c.strand !== concept.strand
  );
  const related = [...sameStrand, ...otherInRank].slice(0, 6);

  return { subject, rank, concept, guide, roots, crossRoots, related };
}

// Resolve a concept key to its rank within a subject (for building a link to a
// prerequisite that lives in a lower rank). Returns null if unknown.
export function rankOfConcept(subject, key) {
  const c = conceptByKey(subject, key);
  return c ? c.rank : null;
}

// A schema.org Course object for one (subject, rank) cell — shared by the rank
// page (single Course) and the subject hub (the Course List carousel, the only
// surviving Course rich result in 2026, which needs 3+ Course items in an
// ItemList). Includes the now-load-bearing hasCourseInstance + offers +
// courseWorkload (ISO-8601) + courseMode the carousel feature expects.
export function buildCourse(subject, rank) {
  const concepts = conceptsFor(subject, rank);
  const count = concepts.length;
  const label = subjectLabel(subject);
  const name = `${rankSeoLabel(rank)} ${label}`;
  // ~15 min of reading/working per concept, rounded to whole hours (≥1).
  const hours = Math.max(1, Math.round((count * 15) / 60));
  return {
    "@type": "Course",
    "@id": `${absolute(rankUrl(subject, rank))}#course`,
    url: absolute(rankUrl(subject, rank)),
    name,
    description: `Reasoning-first ${rankSeoLabel(rank)} ${label.toLowerCase()}: ${count} concepts, each with a clear explanation, a worked example, and self-check questions.`,
    provider: { "@type": "Organization", "@id": ORG_ID, name: "noobtopro", url: SITE_URL },
    publisher: { "@id": ORG_ID },
    isPartOf: { "@id": WEBSITE_ID },
    inLanguage: "en",
    isAccessibleForFree: true,
    educationalLevel: RANK_SEO[rank].realWorld,
    about: { "@type": "Thing", name: label },
    teaches: concepts.map((c) => c.label),
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "online",
      courseWorkload: `PT${hours}H`,
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", category: "Free" },
    },
  };
}
