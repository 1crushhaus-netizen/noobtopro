import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

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
  title: TITLE,
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
// the theme switcher. Runs inline in <head> (CSP allows 'unsafe-inline').
const THEME_INIT = `(function(){try{var p=localStorage.getItem("np-theme");var t=p==="light"?"light":p==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

// SEO P2-4: Organization + SoftwareApplication/Offer structured data for rich
// results (brand knowledge-panel signals + product/offer snippets for a priced
// SaaS). Server-rendered and unicode-escaped exactly like the Landing FAQ JSON-LD
// so it ships in the SSR HTML and can never break out of the <script> as a plain
// text child (no dangerouslySetInnerHTML). Claims stay truthful + price-consistent
// with the Landing pricing card (€9.99/mo).
const STRUCTURED_DATA = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "noobtopro",
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "noobtopro",
      url: SITE_URL,
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
      offers: [
        {
          "@type": "Offer",
          name: "Free",
          price: "0",
          priceCurrency: "EUR",
        },
        {
          "@type": "Offer",
          name: "Pro",
          price: "9.99",
          priceCurrency: "EUR",
          category: "subscription",
        },
      ],
    },
  ],
}).replace(/[<>&]/g, (c) => ({ "<": "\\u003c", ">": "\\u003e", "&": "\\u0026" }[c]));

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        {/* SEO P2-4: Organization + SoftwareApplication/Offer structured data (a plain
            text child — already unicode-escaped above, so no dangerouslySetInnerHTML). */}
        <script type="application/ld+json">{STRUCTURED_DATA}</script>
      </head>
      <body>
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
