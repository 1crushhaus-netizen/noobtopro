// Lists the public, indexable routes for search engines. Next serves this at
// /sitemap.xml. SITE_URL matches the canonical origin (overridable for previews).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://noobto.pro";

export default function sitemap() {
  const lastModified = new Date();

  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/refunds`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
