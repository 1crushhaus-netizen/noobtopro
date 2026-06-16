import { serializeJsonLd } from "@/lib/learn/seo";

// Renders one structured-data block as a nonce-carrying <script type=
// "application/ld+json">. The JSON is a PLAIN TEXT child (already unicode-escaped
// by serializeJsonLd) — never dangerouslySetInnerHTML — so a content value can't
// break out of the element. ld+json is non-executable data, but it carries the
// per-request CSP nonce (set by middleware.js, read via headers() in the page)
// for consistency with app/layout.js's script-src 'nonce-…' policy.
//
// `data` may be a single schema.org object or an array of them; arrays are
// wrapped in an @graph under one @context so related nodes (WebPage +
// BreadcrumbList + ItemList, etc.) ship as one connected block.
export default function JsonLd({ data, nonce }) {
  const payload = Array.isArray(data)
    ? { "@context": "https://schema.org", "@graph": data }
    : { "@context": "https://schema.org", ...data };
  return (
    <script type="application/ld+json" nonce={nonce}>
      {serializeJsonLd(payload)}
    </script>
  );
}
