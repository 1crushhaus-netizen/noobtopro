// Tells crawlers what they may index and where the sitemap lives. Next serves
// this at /robots.txt. SITE_URL is read from the env so preview deploys can
// point host/sitemap at their own origin (falls back to the production canonical).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://noobto.pro";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
