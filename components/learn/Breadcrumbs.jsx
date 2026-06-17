import Link from "next/link";

// Visual breadcrumb trail for the Learn library. The matching BreadcrumbList
// JSON-LD is emitted separately by each page (via lib/learn/seo breadcrumbList +
// JsonLd) so the structured data and the visible trail stay in lockstep.
//
// `items` is an ordered [{ name, path }]; the final item is rendered as the
// current page (no link, aria-current).
export default function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" style={{ margin: "0 0 18px" }}>
      <ol
        style={{
          listStyle: "none",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          margin: 0,
          padding: 0,
          fontSize: 13,
          color: "var(--muted)",
        }}
      >
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={it.path} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              {last ? (
                <span aria-current="page" style={{ color: "var(--text)" }}>
                  {it.name}
                </span>
              ) : (
                <>
                  <Link href={it.path} style={{ color: "var(--muted)", textDecoration: "none" }}>
                    {it.name}
                  </Link>
                  <span aria-hidden="true" style={{ color: "var(--faint)" }}>
                    /
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
