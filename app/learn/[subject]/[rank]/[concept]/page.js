import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import JsonLd from "@/components/learn/JsonLd";
import Breadcrumbs from "@/components/learn/Breadcrumbs";
import {
  ORG_ID,
  WEBSITE_ID,
  subjectLabel,
  subjectTextColor,
  subjectUrl,
  rankUrl,
  conceptUrl,
  rankSeoLabel,
  RANK_SEO,
  absolute,
  breadcrumbList,
  clampDescription,
  conceptTitle,
  slugToKey,
  socialMeta,
  howToFromExample,
} from "@/lib/learn/seo";
import { getConceptData } from "@/lib/learn/content";

// Concise, content-derived meta description: the FIRST line of the guide (real,
// unique, front-loaded prose) rather than boilerplate — answer engines cite the
// opening of a document most. Falls back to a templated line if a guide is absent.
function conceptDescription(data) {
  const lead = data.guide && data.guide.explanation && data.guide.explanation[0];
  if (lead) return clampDescription(lead);
  return clampDescription(
    `${data.concept.label}: a reasoning-first ${rankSeoLabel(data.rank)} ${subjectLabel(
      data.subject
    ).toLowerCase()} guide with a clear explanation, a worked example, and self-check questions.`
  );
}

export async function generateMetadata({ params }) {
  const { subject, rank, concept } = await params;
  const data = await getConceptData(subject, rank, slugToKey(concept));
  if (!data) return {};
  // `absolute` so the root template doesn't append " — noobtopro" (keeps the SERP
  // title short — see conceptTitle). The branded form is kept for the share card.
  const title = conceptTitle(subject, data.concept.label);
  const description = conceptDescription(data);
  const canonical = conceptUrl(subject, rank, concept);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    ...socialMeta({
      type: "article",
      title: `${data.concept.label} — noobtopro`,
      description,
      url: absolute(canonical),
    }),
  };
}

export default async function ConceptPage({ params }) {
  const { subject, rank, concept } = await params;
  const key = slugToKey(concept);
  const data = await getConceptData(subject, rank, key);
  if (!data) notFound();

  const nonce = (await headers()).get("x-nonce") || undefined;
  const { guide, roots, crossRoots, related } = data;
  const label = data.concept.label;
  const color = subjectTextColor(subject);
  const sLabel = subjectLabel(subject);
  const description = conceptDescription(data);
  const canonical = conceptUrl(subject, rank, key);

  const crumbs = [
    { name: "noobtopro", path: "/" },
    { name: "Learn", path: "/learn" },
    { name: sLabel, path: subjectUrl(subject) },
    { name: rankSeoLabel(rank), path: rankUrl(subject, rank) },
    { name: label, path: canonical },
  ];

  // The worked example as a schema.org HowTo (step-by-step solution) — the AEO
  // type answer engines parse for "how to solve …" intent. Only present when the
  // concept actually has a guide with an example (guide-less concepts skip it).
  const resourceId = `${absolute(canonical)}#resource`;
  const howToId = `${absolute(canonical)}#howto`;
  const howTo = guide
    ? howToFromExample({ id: howToId, isPartOfId: resourceId, label, example: guide.example })
    : null;

  const jsonLd = [
    {
      // LearningResource is vocabulary-only (no Google rich result) but is the
      // most precise semantic type for an answer engine / LLM to understand a
      // concept-explanation page — exactly the AEO surface we care about.
      "@type": "LearningResource",
      "@id": resourceId,
      url: absolute(canonical),
      name: label,
      headline: label,
      description,
      inLanguage: "en",
      isAccessibleForFree: true,
      learningResourceType: ["concept explanation", "worked example", "self-assessment"],
      educationalLevel: RANK_SEO[rank].realWorld,
      teaches: label,
      about: { "@type": "Thing", name: label },
      // Link the worked-example HowTo into the resource so the two nodes read as
      // one connected explanation (the HowTo node itself is added below).
      ...(howTo ? { hasPart: { "@id": howToId } } : {}),
      isPartOf: [
        { "@id": `${absolute(rankUrl(subject, rank))}#course` },
        { "@id": WEBSITE_ID },
      ],
      author: { "@id": ORG_ID },
      publisher: { "@id": ORG_ID },
    },
    ...(howTo ? [howTo] : []),
    breadcrumbList(crumbs),
  ];

  return (
    <>
      <JsonLd data={jsonLd} nonce={nonce} />
      <Breadcrumbs items={crumbs} />

      <article>
        <div className="np-pagehead">
          <span className="np-eyebrow--mono" style={{ color }}>
            {sLabel} · {rankSeoLabel(rank)} · {data.concept.strand}
          </span>
          <h1 className="np-h1" style={{ marginTop: 8 }}>
            {label}
          </h1>
        </div>

        {guide ? (
          <>
            {/* THE IDEA — front-loaded explanation (the region answer engines cite most). */}
            <section aria-labelledby="idea-h" style={{ marginBottom: 28 }}>
              <h2 id="idea-h" className="np-sectiontitle">
                The idea
              </h2>
              {guide.explanation.map((p, i) => (
                <p
                  key={i}
                  style={{
                    fontSize: i === 0 ? 16 : 15,
                    lineHeight: 1.7,
                    color: "var(--text)",
                    margin: "10px 0",
                  }}
                >
                  {p}
                </p>
              ))}
            </section>

            {/* WORKED EXAMPLE — "worked example" matches a strong long-tail intent. */}
            <section aria-labelledby="example-h" style={{ marginBottom: 28 }}>
              <h2 id="example-h" className="np-sectiontitle">
                Worked example
              </h2>
              <p className="np-guideproblem">{guide.example.problem}</p>
              <ol className="np-guidesteps">
                {guide.example.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              <p className="np-guideanswer">
                <strong>Answer.</strong> {guide.example.answer}
              </p>
            </section>

            {/* SELF-CHECK — open questions that test understanding (the noobtopro way). */}
            <section aria-labelledby="check-h" style={{ marginBottom: 28 }}>
              <h2 id="check-h" className="np-sectiontitle">
                Check your understanding
              </h2>
              <ul className="np-selfqs">
                {guide.selfQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </section>
          </>
        ) : (
          <p className="np-lede">
            A full written guide for this concept is on the way. In the meantime, you can test your
            reasoning on it in the app.
          </p>
        )}

        {/* FOUNDATIONS — prerequisite internal links (topical authority + study order). */}
        {(roots.length > 0 || crossRoots.length > 0) && (
          <section aria-labelledby="found-h" style={{ marginBottom: 28 }}>
            <h2 id="found-h" className="np-sectiontitle">
              Build the foundations first
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 14, margin: "6px 0 12px", maxWidth: "64ch" }}>
              {label} builds on these concepts. If any feel shaky, start there.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {roots.map((c) => (
                <Link
                  key={`r-${c.key}`}
                  href={conceptUrl(subject, c.rank, c.key)}
                  className="np-concepttag"
                  style={{ textDecoration: "none" }}
                >
                  <span className="np-ctlabel">{c.label}</span>
                </Link>
              ))}
              {crossRoots.map((c) => (
                <Link
                  key={`x-${c.subject}-${c.key}`}
                  href={conceptUrl(c.subject, c.rank, c.key)}
                  className="np-concepttag"
                  style={{ textDecoration: "none" }}
                  title={`${subjectLabel(c.subject)} prerequisite`}
                >
                  <span className="np-ctlabel">
                    {c.label} · {subjectLabel(c.subject)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* PRACTICE CTA — into the funnel. */}
        <section
          className="np-card"
          style={{ marginBottom: 28, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}
        >
          <div style={{ minWidth: 220, flex: 1 }}>
            <div style={{ fontFamily: "var(--display)", fontWeight: 600, fontSize: 16 }}>
              Can you reason it out?
            </div>
            <div style={{ color: "var(--muted)", fontSize: 14, marginTop: 2 }}>
              noobtopro grades how you think, not just the answer — a sound method scores even when the
              final number is wrong.
            </div>
          </div>
          <Link href="/" className="np-btn np-primary" style={{ textDecoration: "none" }}>
            Practice {label.length < 28 ? label.toLowerCase() : "this concept"}
          </Link>
        </section>

        {/* RELATED — sibling internal links. */}
        {related.length > 0 && (
          <section aria-labelledby="related-h">
            <h2 id="related-h" className="np-sectiontitle">
              Keep going
            </h2>
            <div className="np-conceptgrid" style={{ marginLeft: 0, marginTop: 10 }}>
              {related.map((c) => (
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
            <p style={{ marginTop: 16 }}>
              <Link href={rankUrl(subject, rank)} style={{ color: "var(--muted)", fontSize: 14, textDecoration: "none" }}>
                ← All {rankSeoLabel(rank)} {sLabel.toLowerCase()} concepts
              </Link>
            </p>
          </section>
        )}
      </article>
    </>
  );
}
