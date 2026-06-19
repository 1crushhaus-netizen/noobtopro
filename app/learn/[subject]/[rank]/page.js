import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import JsonLd from "@/components/learn/JsonLd";
import Breadcrumbs from "@/components/learn/Breadcrumbs";
import {
  isPublicCell,
  subjectLabel,
  subjectTextColor,
  subjectUrl,
  rankUrl,
  conceptUrl,
  rankSeoLabel,
  RANK_SEO,
  absolute,
  breadcrumbList,
  socialMeta,
} from "@/lib/learn/seo";
import { conceptsByStrand, subjectRanks, buildCourse } from "@/lib/learn/content";
import { conceptsFor } from "@/lib/curriculum";

function describe(subject, rank, count) {
  const label = subjectLabel(subject).toLowerCase();
  return `Reasoning-first ${rankSeoLabel(rank)} ${label}: ${count} concepts, each with a clear explanation, a fully worked example, and self-check questions.`;
}

export async function generateMetadata({ params }) {
  const { subject, rank } = await params;
  if (!isPublicCell(subject, rank)) return {};
  const count = conceptsFor(subject, rank).length;
  const title = `${rankSeoLabel(rank)} ${subjectLabel(subject)}`;
  const description = describe(subject, rank, count);
  return {
    title,
    description,
    alternates: { canonical: rankUrl(subject, rank) },
    ...socialMeta({
      title: `${title} — noobtopro`,
      description,
      url: absolute(rankUrl(subject, rank)),
    }),
  };
}

export default async function RankCell({ params }) {
  const { subject, rank } = await params;
  if (!isPublicCell(subject, rank)) notFound();

  const nonce = (await headers()).get("x-nonce") || undefined;
  const label = subjectLabel(subject);
  const color = subjectTextColor(subject);
  const concepts = conceptsFor(subject, rank);
  const strands = conceptsByStrand(subject, rank);
  const count = concepts.length;
  const title = `${rankSeoLabel(rank)} ${label}`;
  const description = describe(subject, rank, count);

  // Sibling ranks for "next/prev level" navigation within the subject.
  const populated = subjectRanks(subject).map((r) => r.rank);
  const idx = populated.indexOf(rank);
  const prevRank = idx > 0 ? populated[idx - 1] : null;
  const nextRank = idx < populated.length - 1 ? populated[idx + 1] : null;

  const crumbs = [
    { name: "noobtopro", path: "/" },
    { name: "Learn", path: "/learn" },
    { name: label, path: subjectUrl(subject) },
    { name: rankSeoLabel(rank), path: rankUrl(subject, rank) },
  ];

  const jsonLd = [
    buildCourse(subject, rank),
    breadcrumbList(crumbs),
    {
      "@type": "ItemList",
      name: `${title} concepts`,
      itemListElement: concepts.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.label,
        url: absolute(conceptUrl(subject, rank, c.key)),
      })),
    },
  ];

  return (
    <>
      <JsonLd data={jsonLd} nonce={nonce} />
      <Breadcrumbs items={crumbs} />

      <div className="np-pagehead">
        <span className="np-eyebrow--mono" style={{ color }}>
          {label} · {RANK_SEO[rank].range} · {count} concepts
        </span>
        <h1 className="np-h1" style={{ marginTop: 8 }}>
          {title}
        </h1>
        <p className="np-lede">{description}</p>
        <div className="np-introcta">
          <Link href="/" className="np-btn np-primary" style={{ textDecoration: "none" }}>
            Practice at this level — free
          </Link>
        </div>
      </div>

      {strands.map((g) => (
        <section key={g.strand} aria-label={g.strand} style={{ marginBottom: 22 }}>
          <h2 className="np-learngrouphead" style={{ fontSize: 16, color: "var(--text)" }}>
            {g.strand}
          </h2>
          <div className="np-conceptgrid" style={{ marginLeft: 0 }}>
            {g.concepts.map((c) => (
              <Link
                key={c.key}
                href={conceptUrl(subject, rank, c.key)}
                className="np-concepttag"
                style={{ textDecoration: "none" }}
              >
                <span className="np-ctlabel">{c.label}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {/* Level navigation */}
      <nav
        aria-label="Levels"
        style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 36, paddingTop: 18, borderTop: "1px solid var(--line)" }}
      >
        {prevRank && (
          <Link href={rankUrl(subject, prevRank)} style={{ color: "var(--muted)", textDecoration: "none", fontSize: 14 }}>
            ← {rankSeoLabel(prevRank)} {label}
          </Link>
        )}
        {nextRank && (
          <Link
            href={rankUrl(subject, nextRank)}
            style={{ color: "var(--muted)", textDecoration: "none", fontSize: 14, marginLeft: "auto" }}
          >
            {rankSeoLabel(nextRank)} {label} →
          </Link>
        )}
      </nav>
    </>
  );
}
