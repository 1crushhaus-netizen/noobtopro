import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ORDER } from "@/lib/scoring";
import JsonLd from "@/components/learn/JsonLd";
import Breadcrumbs from "@/components/learn/Breadcrumbs";
import {
  ORG_ID,
  WEBSITE_ID,
  isPublicSubject,
  subjectLabel,
  subjectColor,
  subjectUrl,
  rankUrl,
  conceptUrl,
  rankSeoLabel,
  RANK_SEO,
  SUBJECT_SEO,
  absolute,
  breadcrumbList,
  socialMeta,
} from "@/lib/learn/seo";
import { subjectRanks, conceptsByStrand, subjectConceptCount, buildCourse } from "@/lib/learn/content";

export async function generateMetadata({ params }) {
  const { subject } = await params;
  if (!isPublicSubject(subject)) return {};
  const label = subjectLabel(subject);
  const title = `${label} — concept guides`;
  const description = SUBJECT_SEO[subject].description;
  return {
    title,
    description,
    keywords: SUBJECT_SEO[subject].keywords,
    alternates: { canonical: subjectUrl(subject) },
    ...socialMeta({
      title: `${title} — noobtopro`,
      description,
      url: absolute(subjectUrl(subject)),
    }),
  };
}

export default async function SubjectHub({ params }) {
  const { subject } = await params;
  if (!isPublicSubject(subject)) notFound();

  const nonce = (await headers()).get("x-nonce") || undefined;
  const label = subjectLabel(subject);
  const color = subjectColor(subject);
  const ranks = subjectRanks(subject);
  const count = subjectConceptCount(subject);

  const crumbs = [
    { name: "noobtopro", path: "/" },
    { name: "Learn", path: "/learn" },
    { name: label, path: subjectUrl(subject) },
  ];

  const jsonLd = [
    {
      "@type": "CollectionPage",
      "@id": `${absolute(subjectUrl(subject))}#webpage`,
      url: absolute(subjectUrl(subject)),
      name: `${label} — concept guides — noobtopro`,
      description: SUBJECT_SEO[subject].description,
      isPartOf: { "@id": WEBSITE_ID },
      publisher: { "@id": ORG_ID },
      inLanguage: "en",
      about: { "@type": "Thing", name: label },
    },
    breadcrumbList(crumbs),
    {
      // Course List carousel — each level is a free, online Course. This is the
      // one Course rich result Google still renders in 2026 (needs an ItemList of
      // 3+ Course items; every subject has four populated levels).
      "@type": "ItemList",
      name: `${label} courses by level`,
      itemListElement: ranks.map((r, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: buildCourse(subject, r.rank),
      })),
    },
  ];

  return (
    <>
      <JsonLd data={jsonLd} nonce={nonce} />
      <Breadcrumbs items={crumbs} />

      <div className="np-pagehead">
        <span className="np-eyebrow--mono" style={{ color }}>
          {count} concept guides
        </span>
        <h1 className="np-h1" style={{ marginTop: 8 }}>
          {label}
        </h1>
        <p className="np-lede">{SUBJECT_SEO[subject].intro}</p>
        <div className="np-introcta">
          <Link href="/" className="np-btn np-primary" style={{ textDecoration: "none" }}>
            Test your {label.toLowerCase()} reasoning
          </Link>
        </div>
      </div>

      {ranks.map(({ rank }) => {
        const strands = conceptsByStrand(subject, rank);
        return (
          <section key={rank} aria-label={`${rankSeoLabel(rank)} ${label}`} style={{ marginTop: 36 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <h2 className="np-h2" style={{ margin: 0 }}>
                <Link href={rankUrl(subject, rank)} style={{ color: "var(--text)", textDecoration: "none" }}>
                  {rankSeoLabel(rank)}
                </Link>
              </h2>
              <span className="np-eyebrow--mono">{RANK_SEO[rank].range}</span>
            </div>
            <p style={{ color: "var(--muted)", fontSize: 14, margin: "6px 0 14px", maxWidth: "64ch" }}>
              {RANK_SEO[rank].blurb}
            </p>

            {strands.map((g) => (
              <div key={g.strand} style={{ marginBottom: 16 }}>
                <h3 className="np-learngrouphead" style={{ color: "var(--muted)" }}>
                  {g.strand}
                </h3>
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
              </div>
            ))}
          </section>
        );
      })}

      <section style={{ marginTop: 44 }}>
        <h2 className="np-h2">Other subjects</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
          {ORDER.filter((s) => s !== subject).map((s) => (
            <Link key={s} href={subjectUrl(s)} className="np-chip" style={{ textDecoration: "none" }}>
              {subjectLabel(s)}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
