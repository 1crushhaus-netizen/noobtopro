import Link from "next/link";
import { headers } from "next/headers";
import { ORDER } from "@/lib/scoring";
import JsonLd from "@/components/learn/JsonLd";
import Breadcrumbs from "@/components/learn/Breadcrumbs";
import {
  ORG_ID,
  WEBSITE_ID,
  subjectLabel,
  subjectColor,
  subjectTextColor,
  subjectUrl,
  rankUrl,
  rankSeoLabel,
  RANK_SEO,
  SUBJECT_SEO,
  PUBLIC_RANKS,
  absolute,
  breadcrumbList,
  socialMeta,
} from "@/lib/learn/seo";
import {
  subjectRanks,
  subjectConceptCount,
  totalConceptCount,
} from "@/lib/learn/content";

const TITLE = "Learn math, physics & chemistry by reasoning";
const DESCRIPTION =
  "Free, reasoning-first guides to 224 concepts in math, physics, and chemistry — each with a clear explanation, a worked example, and self-check questions.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/learn" },
  ...socialMeta({
    title: `${TITLE} — noobtopro`,
    description: DESCRIPTION,
    url: absolute("/learn"),
  }),
};

export default async function LearnHub() {
  const nonce = (await headers()).get("x-nonce") || undefined;
  const total = totalConceptCount();
  const crumbs = [
    { name: "noobtopro", path: "/" },
    { name: "Learn", path: "/learn" },
  ];

  const jsonLd = [
    {
      "@type": "CollectionPage",
      "@id": `${absolute("/learn")}#webpage`,
      url: absolute("/learn"),
      name: `${TITLE} — noobtopro`,
      description: DESCRIPTION,
      isPartOf: { "@id": WEBSITE_ID },
      publisher: { "@id": ORG_ID },
      inLanguage: "en",
      about: ORDER.map((s) => ({ "@type": "Thing", name: subjectLabel(s) })),
    },
    breadcrumbList(crumbs),
    {
      "@type": "ItemList",
      name: "Subjects",
      itemListElement: ORDER.map((s, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: subjectLabel(s),
        url: absolute(subjectUrl(s)),
      })),
    },
  ];

  return (
    <>
      <JsonLd data={jsonLd} nonce={nonce} />
      <Breadcrumbs items={crumbs} />

      <div className="np-pagehead">
        <span className="np-eyebrow--mono">Concept library · free forever</span>
        <h1 className="np-h1" style={{ marginTop: 8 }}>
          Learn math, physics &amp; chemistry — by reasoning
        </h1>
        <p className="np-lede">
          {total} curated guides across three subjects and four ranks. Every concept gets a clear
          explanation, one fully worked example you can follow step by step, and self-check questions —
          because on noobtopro, understanding is measured by <em>how you reason</em>, not what you memorize.
        </p>
        <div className="np-introcta">
          <Link href="/" className="np-btn np-primary np-big" style={{ textDecoration: "none" }}>
            Find your level — free
          </Link>
        </div>
      </div>

      {/* Subject cards */}
      <section aria-label="Subjects" style={{ marginTop: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          {ORDER.map((s) => (
            <Link
              key={s}
              href={subjectUrl(s)}
              className="np-card"
              style={{
                textDecoration: "none",
                color: "var(--text)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                borderTop: `3px solid ${subjectColor(s)}`,
              }}
            >
              <span className="np-eyebrow" style={{ color: subjectTextColor(s) }}>
                {subjectConceptCount(s)} concepts
              </span>
              <span style={{ fontFamily: "var(--display)", fontSize: 20, fontWeight: 600 }}>
                {subjectLabel(s)}
              </span>
              <span style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.5 }}>
                {SUBJECT_SEO[s].blurb}
              </span>
              <span style={{ color: "var(--faint)", fontSize: 13, marginTop: 4 }}>
                {subjectRanks(s)
                  .map((r) => rankSeoLabel(r.rank))
                  .join(" · ")}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Ranks explainer */}
      <section aria-label="Ranks" style={{ marginTop: 40 }}>
        <h2 className="np-h2">One ladder: Elementary → Doctorate</h2>
        <p className="np-lede">
          Every subject is organized on the same 0–350 scale, split into curriculum ranks. Start anywhere —
          each guide names the foundations it builds on, so you can climb in the right order.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {PUBLIC_RANKS.map((rank) => (
            <div key={rank} className="np-card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="np-eyebrow--mono">{RANK_SEO[rank].range}</span>
              <span style={{ fontFamily: "var(--display)", fontSize: 16, fontWeight: 600 }}>
                {rankSeoLabel(rank)}
              </span>
              <span style={{ color: "var(--muted)", fontSize: 13.5, lineHeight: 1.5 }}>
                {RANK_SEO[rank].blurb}
              </span>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
                {ORDER.map((s) => (
                  <Link
                    key={s}
                    href={rankUrl(s, rank)}
                    style={{ color: "var(--muted)", fontSize: 12.5, textDecoration: "none" }}
                  >
                    {subjectLabel(s)}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
