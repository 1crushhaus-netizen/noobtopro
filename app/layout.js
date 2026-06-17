import "./globals.css";
import { headers } from "next/headers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { proIsAvailable } from "@/lib/polar";

// Canonical production origin. metadataBase makes the auto-generated
// opengraph-image / twitter-image URLs absolute, which crawlers and link
// unfurlers (Discord / Slack / iMessage / X) require to render a rich preview.
// Overridable so preview deploys (Vercel branch URLs) emit their own origin
// instead of pointing canonicals/OG images at production.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://noobto.pro";
const TITLE = "noobtopro: prove what you know";
const DESCRIPTION =
  "Real problems in math, physics, and chemistry. Your reasoning is graded, not just the answer. Get ranked from Elementary to Doctorate, then climb.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  // SEO P2-2: a title TEMPLATE so per-page titles compose (e.g. "Privacy Policy — noobtopro")
  // while the home route uses the full default. Child routes set a plain title (no suffix).
  title: { default: TITLE, template: "%s — noobtopro" },
  description: DESCRIPTION,
  applicationName: "noobtopro",
  // SEO P2-4: supplementary keywords (low value for Google, free for other engines).
  keywords: [
    "STEM assessment",
    "reasoning grading",
    "math practice",
    "physics practice",
    "chemistry practice",
    "adaptive diagnostic",
    "learn math physics chemistry",
    "AI tutor",
    "problem solving",
    "skill ranking",
  ],
  // Self-referencing canonical so every URL variant (query strings, preview
  // hosts) consolidates ranking signals onto the home route.
  alternates: { canonical: "/" },
  // The og:image / twitter:image are supplied automatically by
  // app/opengraph-image.js + app/twitter-image.js (Next merges them in here).
  openGraph: {
    type: "website",
    siteName: "noobtopro",
    url: SITE_URL,
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// viewport-fit=cover lets the app paint into the notch/home-indicator area; the
// globals.css safe-area-inset padding then keeps content (and the drawer/modal close
// buttons + bottom CTAs) clear of them. width/initialScale replace Next's default
// viewport meta, so they must be restated here.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Tints the link-embed accent bar (e.g. Discord's left rail) and the mobile
  // browser chrome. Uses the physics-teal subject accent for a calm, on-brand pop.
  themeColor: "#56897e",
};

// Resolve the saved theme BEFORE first paint so there is never a flash of the
// wrong theme. Dark is the product default; "system" is an explicit opt-in via
// the theme switcher. Runs inline in <head> — it carries the per-request CSP nonce
// (Finding 5: middleware sets a nonce-based script-src, so this inline script needs
// the nonce to execute; an injected inline script without it is blocked).
const THEME_INIT = `(function(){try{var p=localStorage.getItem("np-theme");var t=p==="light"?"light":p==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

// SEO P2-4: Organization + SoftwareApplication/Offer structured data for rich
// results (brand knowledge-panel signals + product/offer snippets for a priced
// SaaS). Server-rendered and unicode-escaped exactly like the Landing FAQ JSON-LD
// so it ships in the SSR HTML and can never break out of the <script> as a plain
// text child (no dangerouslySetInnerHTML). Claims stay truthful + price-consistent
// with the Landing pricing card (€9.99/mo).
//
// Built per-request (server-only) so the priced Pro Offer is emitted ONLY when Pro
// is actually sellable (proIsAvailable() — POLAR_* configured). Advertising a priced
// Offer for a tier nobody can buy is a Google Rich Results mismatch, so when Pro is
// off the offers array carries the Free offer alone. lib/polar is server-only (reads
// secrets, no NEXT_PUBLIC_*) — safe here since this is a server component.
function buildStructuredData() {
  // Authoritative profile URLs for the brand entity (Wikipedia/Wikidata, social,
  // Product Hunt, Crunchbase, …). Set NEXT_PUBLIC_SAME_AS to a comma-separated list
  // once those profiles exist — sameAs is one of the highest-value Organization
  // signals for knowledge-graph disambiguation (esp. given the "noob to pro" gaming
  // namespace collision). Omitted entirely when unset (never emit a fabricated link).
  const sameAs = (process.env.NEXT_PUBLIC_SAME_AS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const offers = [
    {
      "@type": "Offer",
      name: "Free",
      price: "0",
      priceCurrency: "EUR",
    },
  ];
  if (proIsAvailable()) {
    offers.push({
      "@type": "Offer",
      name: "Pro",
      price: "9.99",
      priceCurrency: "EUR",
      category: "subscription",
    });
  }
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        // EducationalOrganization (a subtype of Organization) is the right entity
        // type for a learning platform — better knowledge-graph categorization.
        // sameAs is intentionally omitted (no verified social/Wikidata profiles to
        // claim yet); add real ones here when they exist.
        "@type": ["Organization", "EducationalOrganization"],
        "@id": `${SITE_URL}/#organization`,
        name: "noobtopro",
        alternateName: "noob to pro",
        url: SITE_URL,
        // Raster (PNG) logo, not the SVG icon: Google's logo rich result generally
        // won't render an SVG. /apple-icon is the brand mark rendered as a 180×180 PNG.
        logo: `${SITE_URL}/apple-icon`,
        description: DESCRIPTION,
        slogan: "Prove what you know. Climb from noob to pro.",
        knowsAbout: [
          "Mathematics",
          "Physics",
          "Chemistry",
          "STEM reasoning",
          "Reasoning-first assessment",
        ],
        ...(sameAs.length ? { sameAs } : {}),
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "noobtopro",
        url: SITE_URL,
        description: DESCRIPTION,
        inLanguage: "en",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        name: "noobtopro",
        description: DESCRIPTION,
        url: SITE_URL,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        publisher: { "@id": `${SITE_URL}/#organization` },
        offers,
      },
    ],
  }).replace(/[<>&]/g, (c) => ({ "<": "\\u003c", ">": "\\u003e", "&": "\\u0026" }[c]));
}

export default async function RootLayout({ children }) {
  const structuredData = buildStructuredData();
  // Per-request CSP nonce set by middleware.js (Finding 5). Undefined in contexts without
  // the middleware (e.g. a unit test rendering the layout directly) — React simply omits the
  // attribute, and the legacy 'unsafe-inline' fallback in lib/csp.js keeps that path working.
  const nonce = (await headers()).get("x-nonce") || undefined;
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        {/* SEO P2-4: Organization + SoftwareApplication/Offer structured data (a plain
            text child — already unicode-escaped above, so no dangerouslySetInnerHTML).
            ld+json is non-executable data, but carry the nonce too for consistency. */}
        <script nonce={nonce} type="application/ld+json">{structuredData}</script>
        {/* Ahrefs Web Analytics — cookieless organic-traffic/SEO tracking. Loaded from
            analytics.ahrefs.com (allow-listed in lib/csp.js script-src + connect-src) and
            carries the per-request CSP nonce. The data-key is a public site identifier. */}
        <script
          src="https://analytics.ahrefs.com/analytics.js"
          data-key="T96nmRUfiiNKYhmeieDgOg"
          nonce={nonce}
          async
        />
      </head>
      <body>
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
