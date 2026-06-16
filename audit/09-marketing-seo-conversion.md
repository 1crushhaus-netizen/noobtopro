# Audit 09 — Marketing / SEO / Conversion Readiness

**Target:** noobtopro (Next.js 15 educational SaaS) at `/home/user/noobtopro`
**Scope:** Discoverability (SEO/crawl), shareability (OG/Twitter/favicon/PWA), trust (legal, social proof), and conversion funnel (CTA → signup → activation → Pro upgrade), plus measurability (analytics events).
**Context:** Imminent marketing push + paid Pro tier (€9.99/mo) going live.
**Stance:** Adversarial. Assume invisible-to-search, ugly-when-shared, leaky-in-funnel until proven otherwise.
**Date:** 2026-06-16

---

## Summary

The metadata foundation is better than expected: `metadataBase` is set (`app/layout.js:16`), absolute OG/Twitter image URLs are auto-generated from code (`app/opengraph-image.js`, `app/twitter-image.js`, `lib/ogImage.jsx`), `twitter:card=summary_large_image` is present, OG locale is set, a `themeColor` is set, and there is even FAQPage JSON-LD on the landing (`components/Landing.jsx:199-211`). The site is **not** blocked from indexing (no `noindex`, no robots disallow). Those are real wins and lower the launch risk.

But the launch is still leaky and risky in three ways: **(1) the funnel is completely unmeasured** — `@vercel/analytics` is mounted but there is not a single custom `track()` event for signup, diagnostic start, checkout start, or purchase success, so a paid acquisition campaign cannot be attributed or optimized; **(2) two paid-tier feature claims are misleading** — "Data export" is advertised on the pricing card but is not implemented anywhere, and "Full worked solutions + 'how to reach 100'" is sold as Pro but is delivered to Free users too; **(3) there are no Privacy/Terms links anywhere**, which is both a trust gap at the point of payment and a Merchant-of-Record / payment-processor expectation. Secondary: no `robots.(js|ts)`, no `sitemap.(js|ts)`, no `not-found.js`, no web manifest, no `apple-touch-icon`, and a hardcoded canonical origin with no per-route canonical.

### Findings table

| ID | Severity | Title | File(s) |
|----|----------|-------|---------|
| P0-1 | P0 | No funnel/conversion event tracking — paid launch flies blind | `app/layout.js:5,69`; `app/api/checkout/route.js`; `components/Noobtopro.jsx:549-578,674-691` |
| P0-2 | P0 | "Data export" advertised as a Pro feature but never implemented | `components/Landing.jsx:95` |
| P0-3 | P0 | "Full worked solutions + how to reach 100" sold as Pro but delivered to Free | `components/Landing.jsx:93`; `app/api/score/route.js:473-479`; `components/ReviewList.jsx:97-107` |
| P1-1 | P1 | No Privacy Policy / Terms links anywhere (trust + payment-processor requirement) | `components/Landing.jsx:483-492`; `app/layout.js` |
| P1-2 | P1 | No `robots.txt` / `app/robots.(js\|ts)` | (absent) |
| P1-3 | P1 | No `sitemap.xml` / `app/sitemap.(js\|ts)` | (absent) |
| P1-4 | P1 | No `not-found.js` (404) page | `app/` (only `error.jsx` exists) |
| P1-5 | P1 | No web app manifest (no PWA / add-to-home / install) | (absent) |
| P1-6 | P1 | No `apple-touch-icon` (broken/blank icon when saved to iOS home screen) | `app/` (only `icon.svg`) |
| P1-7 | P1 | No canonical URL and hardcoded origin (no env), no per-route canonical | `app/layout.js:10,16` |
| P2-1 | P2 | No social proof anywhere (no users/ratings/logos/testimonials) | `components/Landing.jsx` |
| P2-2 | P2 | `<title>` is identical site-wide / not template-ized; landing H1 diverges from title | `app/layout.js:11`; `components/Landing.jsx:249-251` |
| P2-3 | P2 | Currency inconsistency: landing Free card "$0", Pro card "€9.99" | `components/Landing.jsx:388,402` |
| P2-4 | P2 | No `keywords` / weak supplementary metadata; no Organization/SoftwareApplication/Offer JSON-LD | `app/layout.js:15-35` |
| P2-5 | P2 | No email capture / waitlist; no exit-intent or secondary capture | `components/Landing.jsx` |

**Counts:** P0 = 3 · P1 = 7 · P2 = 5 · Total = 15

---

## P0 — Launch blockers for marketing

### [P0-1] No funnel/conversion event tracking — a paid launch cannot be measured
- **File(s):** `app/layout.js:5,69` (Analytics mounted); `app/api/checkout/route.js`; `components/Noobtopro.jsx:549-578` (checkout start), `components/Noobtopro.jsx:674-691` (purchase success); `components/Landing.jsx:258,395,414` (primary CTAs)
- **Category:** Analytics / conversion measurement
- **Description:** `@vercel/analytics`'s `<Analytics />` is mounted (pageviews only) and `@vercel/speed-insights` for perf, but a repository-wide search for `track(`, `gtag`, `dataLayer`, `posthog`, `plausible`, `mixpanel`, `fbq` returns **zero** custom analytics events. The high-intent funnel steps emit nothing:
  - "Prove it" / "Get started" / "Start free" diagnostic start (`onProveIt` → `beginDiagnostic`).
  - Sign-in start / completion (`openSignIn`, the `SIGNED_IN` auth event at `Noobtopro.jsx:610`).
  - Checkout start (`startCheckout`/`beginCheckout`, `Noobtopro.jsx:549,567`).
  - Purchase success (the `?checkout=success` handler, `Noobtopro.jsx:674-691`).
  - The 402 "hit your free cap / photo is Pro" upgrade nudge being shown vs. clicked (`Noobtopro.jsx:1405-1435`).
- **Impact:** For a paid acquisition push this is the single most damaging gap. With only pageviews you cannot compute visitor→signup, signup→activation (diagnostic completed), or activation→Pro conversion; you cannot attribute spend to revenue, cannot A/B a CTA, and cannot tell a broken checkout from low demand. You are buying traffic with no feedback loop. (Note: the OG/SEO basics are in place, so this — not discoverability — is the dominant launch risk.)
- **Recommended fix:** `@vercel/analytics` already exports a `track()` helper (`import { track } from "@vercel/analytics"`). Fire named events at minimum at: `diagnostic_start`, `diagnostic_complete`, `signin_complete`, `checkout_start`, `purchase_success`, and `upgrade_nudge_shown`/`upgrade_nudge_clicked`. Set `POLAR_SUCCESS_URL` to carry through enough to fire `purchase_success` exactly once (the `?checkout=success` handler is the natural place). If deeper attribution is needed for ad platforms, add a real product analytics tool (PostHog/Plausible) — note the CSP `connect-src`/`script-src` in `next.config.js` would need the new host allow-listed.

### [P0-2] "Data export" is advertised as a paid Pro feature but is not implemented
- **File(s):** `components/Landing.jsx:95` (`PRO_FEATURES` includes `"Data export"`)
- **Category:** Misleading pricing/feature claim
- **Description:** The Pro pricing card lists "Data export" as a paid benefit. A repository-wide search for an export/download path (`export`, `downloadData`, `application/json` download, a "Export" button in `Dashboard.jsx` / `Noobtopro.jsx` / `lib/store.js` / any `app/api/*` route) finds **nothing** — only the marketing string at `Landing.jsx:95`. There is a "Reset my progress" delete action (`Dashboard.jsx:525-531`) but no export of any kind.
- **Impact:** Selling a feature that does not exist is a refund/chargeback liability and a direct trust hit at the moment of payment — exactly when scrutiny is highest. With Polar as Merchant of Record, advertised-but-undelivered features invite disputes and can jeopardize the merchant relationship.
- **Recommended fix:** Either implement a real export (e.g. a "Download my data (JSON)" button in the Dashboard that serializes the user's scores/history, gated by `isPro`), or remove the "Data export" line from `PRO_FEATURES` before the Pro tier is sold. Removing the claim is the zero-code fix to unblock launch.

### [P0-3] "Full worked solutions + 'how to reach 100'" is sold as Pro but delivered to Free users
- **File(s):** `components/Landing.jsx:93` (`PRO_FEATURES`: `'Full worked solutions + "how to reach 100"'`); `app/api/score/route.js:473-479,558,598,603-604`; `components/ReviewList.jsx:97-107`
- **Category:** Misleading pricing / feature-gate mismatch
- **Description:** The Pro card sells "Full worked solutions + 'how to reach 100'" as a paid benefit. In code, the score route returns `workedSolution` and `improvements` ("To reach 100") in the feedback payload for **every substantive graded attempt regardless of Pro status** (`app/api/score/route.js:479` computes `workedSolution` only conditioned on `dock`, i.e. whether it was a real attempt — not on `isPro`). The only Pro gates in that route are the free daily practice cap (`:213`) and photo-of-work grading (`:286`). `components/ReviewList.jsx:97-107` then renders "To reach 100" and the full worked solution unconditionally for any user reviewing a past answer. So a Free user already gets full worked solutions and the "how to reach 100" guidance for each problem they grade.
- **Impact:** The Pro tier's value proposition is overstated. A buyer paying for "full worked solutions" receives nothing additional on that bullet — it is already Free. This both weakens the upgrade incentive (a savvy free user notices they already have it) and is a misleading claim, the same refund/trust risk as P0-2 in the opposite direction.
- **Recommended fix:** Decide the intended gate and make copy and code agree. If worked solutions should be Pro-only, gate `workedSolution`/`improvements` in `app/api/score/route.js` (return them empty for non-Pro and lock the display in `ReviewList.jsx`), mirroring the photo-grading gate. If they are intentionally free, remove or reword that Pro bullet (e.g. emphasize the genuinely Pro-only items: unlimited practice, photo grading, progress trends + answer history, which *are* gated at `Dashboard.jsx:489-506`).

---

## P1 — High

### [P1-1] No Privacy Policy or Terms of Service links anywhere
- **File(s):** `components/Landing.jsx:483-492` (footer — brand, tagline, tech stack, copyright only); `app/layout.js` (no metadata link); no `app/privacy` or `app/terms` route exists
- **Category:** Trust / legal / payment-processor requirement
- **Description:** A repository-wide search for `privacy`, `terms`, `legal`, `cookie`, `policy` in `app/` and `components/` finds no user-facing link or page. The landing footer (`Landing.jsx:483-492`) has the brand, a tagline, "Next.js · Supabase · Groq", and a copyright line — no Privacy/Terms/Contact. The FAQ verbally claims "we do not sell your data" (`Landing.jsx:170`) but there is no actual policy document to back it.
- **Impact:** (1) Trust: paying customers expect Terms/Privacy visible at checkout; their absence depresses conversion and looks unprofessional. (2) Compliance: Polar (Merchant of Record) and EU/GDPR norms effectively require a published Privacy Policy and Terms — selling a €9.99/mo subscription without them is a real liability. (3) Ad networks (Google/Meta) commonly require a privacy policy for accounts running campaigns.
- **Recommended fix:** Add `/privacy` and `/terms` routes (static is fine) and link them in the landing footer and near the Pro CTA. Add a short cookie/analytics note since `@vercel/analytics` is loaded. This is also a prerequisite for the P0-1 analytics expansion if you add a third-party tracker.

### [P1-2] No `robots.txt` / `app/robots.(js|ts)`
- **File(s):** absent (no `robots*` anywhere; no `public/` dir at all)
- **Category:** SEO / crawlability
- **Description:** There is no `app/robots.js`/`.ts` and no `public/robots.txt`. Next.js will not synthesize one. Crawlers get no explicit allow signal and, critically, no `Sitemap:` directive.
- **Impact:** Without a robots file (and the Sitemap reference it should carry) search engines crawl less efficiently and have no pointer to a sitemap. For a brand-new domain about to be promoted, this slows indexing of the pages you are paying to drive traffic to. (Not a hard block — nothing sets `noindex` — but it leaves easy SEO on the table.)
- **Recommended fix:** Add `app/robots.js` exporting `{ rules: [{ userAgent: "*", allow: "/" }], sitemap: "https://noobto.pro/sitemap.xml" }` (use the same origin constant as `SITE_URL`).

### [P1-3] No `sitemap.xml` / `app/sitemap.(js|ts)`
- **File(s):** absent
- **Category:** SEO / crawlability
- **Description:** No `app/sitemap.js`/`.ts` and no static sitemap. Even for a primarily single-page marketing site, a sitemap gives the canonical URL, a `lastModified`, and (with the robots reference) faster, more reliable indexing.
- **Impact:** Slower/less reliable discovery and prioritization of the landing page right when a campaign is sending traffic; no machine-readable list of indexable URLs.
- **Recommended fix:** Add `app/sitemap.js` returning at least the home URL (`https://noobto.pro/`) with `lastModified`. Expand if/when content routes (e.g. a public Concept Hub) become indexable.

### [P1-4] No `not-found.js` (404) page
- **File(s):** `app/` contains only `error.jsx` (`app/error.jsx`) — no `not-found.js`
- **Category:** SEO / UX / trust
- **Description:** There is a global error boundary (`app/error.jsx`) but no `app/not-found.js`. A mistyped or stale shared/campaign URL renders the unstyled Next.js default 404.
- **Impact:** Broken/expired marketing links land on a default, off-brand 404 with no path back into the funnel — a dead end that wastes paid clicks and looks unfinished. Default 404s also give no on-brand recovery CTA.
- **Recommended fix:** Add `app/not-found.js` styled on the same `np-*` primitives as `error.jsx`, with a clear "Back home / Get started" CTA that re-enters the funnel.

### [P1-5] No web app manifest (no PWA / installability / rich Android share)
- **File(s):** absent (no `app/manifest.(js|ts)`, no `manifest.json`)
- **Category:** Shareability / professionalism / PWA
- **Description:** No web manifest. `app/layout.js` sets `applicationName` and a `themeColor` (`:19,47`) but there is no manifest declaring `name`, `short_name`, `icons`, `display`, `background_color`, `theme_color`, or `start_url`.
- **Impact:** No add-to-home-screen / installable experience; Android home-screen icon and theming fall back to defaults; the app reads as a plain webpage rather than an installable product. For a mobile-friendly STEM practice tool (photo grading is explicitly pitched for mobile, `Landing.jsx:172`), missing installability is a retention/engagement miss.
- **Recommended fix:** Add `app/manifest.js` (Next metadata route) with name/short_name "noobtopro", `theme_color: "#56897e"` (match `viewport.themeColor`), `background_color`, `display: "standalone"`, `start_url: "/"`, and PNG icons in 192/512 (reuse the `brand/` PNGs or render from `icon.svg`).

### [P1-6] No `apple-touch-icon` (blank/ugly icon when saved to iOS home screen)
- **File(s):** `app/` has only `icon.svg`; no `apple-icon.(png|svg)`, no `apple-touch-icon`
- **Category:** Shareability / professionalism
- **Description:** Only `app/icon.svg` exists. iOS Safari ignores SVG favicons for the home-screen icon and looks for an `apple-touch-icon` (Next.js supports `app/apple-icon.png`). Without it, "Add to Home Screen" on iPhone yields a blurry screenshot thumbnail instead of the brand mark.
- **Impact:** Saved-to-home-screen instances look broken/off-brand on the most common mobile-share platform — directly undercuts the "shoot your handwritten work on mobile" pitch where iOS install is most likely.
- **Recommended fix:** Add `app/apple-icon.png` (180×180, on a solid background — Apple does not honor transparency the same way). Reuse the `brand/noobtopro-logo*.png` artwork.

### [P1-7] Canonical origin hardcoded, no env override, and no per-route canonical
- **File(s):** `app/layout.js:10` (`const SITE_URL = "https://noobto.pro"`), `:16` (`metadataBase`), `:25` (`openGraph.url`)
- **Category:** SEO / portability
- **Description:** `SITE_URL` is hardcoded and not read from an env var (e.g. `NEXT_PUBLIC_SITE_URL`/`VERCEL_PROJECT_PRODUCTION_URL`). There is also no `alternates: { canonical }` in the metadata — only `metadataBase` and a single `openGraph.url`. Preview deployments and any future custom-domain change will still emit `noobto.pro` absolute URLs.
- **Impact:** No explicit `<link rel="canonical">` means duplicate-content ambiguity is left to the crawler's discretion (e.g. trailing-slash, query-param, or preview-domain variants competing). Hardcoding the origin also makes Vercel preview URLs advertise the production origin in OG tags, and a domain rename becomes a code change. Lower risk than P1-2/3 since `metadataBase` is present, but it is a real gap for a domain about to be promoted.
- **Recommended fix:** Add `alternates: { canonical: "/" }` to the root metadata (resolves against `metadataBase`). Source the origin from `process.env.NEXT_PUBLIC_SITE_URL` with the current literal as a fallback, so previews and renames behave correctly.

---

## P2 — Medium

### [P2-1] No social proof anywhere on the landing page
- **File(s):** `components/Landing.jsx` (entire file — hero, engine, ranks, subjects, pricing, FAQ, CTA)
- **Category:** Conversion copy / trust
- **Description:** The landing has strong mechanism-forward copy but zero social proof: no user count, no ratings/testimonials, no "as used by", no leaderboard population stat, no press/credibility markers. The closest is the anonymous leaderboard concept, which is not surfaced as proof on the marketing page.
- **Impact:** For a new paid product, the absence of any "others trust this" signal suppresses conversion, especially at the €9.99 decision point. Mechanism explanation alone rarely closes skeptical visitors.
- **Recommended fix:** Add lightweight, truthful proof when available: number of problems graded, learners placed, or a live leaderboard population/distribution snapshot (the data exists per `app/api/leaderboard`). Avoid fabricated testimonials.

### [P2-2] `<title>` is identical site-wide and not template-ized; landing H1 diverges from the title
- **File(s):** `app/layout.js:11` (`TITLE = "noobtopro: prove what you know"`); `components/Landing.jsx:249-251` (H1 "Memorize nothing / Understand everything")
- **Category:** SEO metadata / messaging consistency
- **Description:** One static title is set in the root layout with no `title.template`/`title.default`, so every route (now and future) shares the exact same `<title>`. Separately, the document title says "prove what you know" while the landing's visible H1 leads with "Memorize nothing / Understand everything" — the SERP/share headline and the on-page hero headline tell different stories. (This is a single-page app today, so duplicate-title harm is latent, but the divergence and lack of a template are still gaps.)
- **Impact:** Future routes (Concept Hub pages, privacy/terms) will inherit a non-unique, non-descriptive title, hurting SERP click-through. The headline mismatch dilutes message consistency between what's shared and what's seen.
- **Recommended fix:** Use `title: { default: TITLE, template: "%s · noobtopro" }` so child routes can set unique titles. Align the SERP/OG title with the live hero headline (or vice versa) so the promise is consistent across search, share, and page.

### [P2-3] Currency inconsistency on the pricing section
- **File(s):** `components/Landing.jsx:388` (Free: `$0 / forever`), `:402` (Pro: `€9.99 / month`)
- **Category:** Conversion copy / clarity
- **Description:** The Free plan price renders "$0" while the Pro plan renders "€9.99". Mixed currency symbols in the same pricing block.
- **Impact:** Minor but real polish issue at the highest-scrutiny moment (pricing). Mixed symbols read as sloppy and can momentarily confuse the price/value comparison.
- **Recommended fix:** Use one currency presentation. Since Pro is EUR (per `MONETIZATION_PLAN.md`), render Free as "€0 / forever".

### [P2-4] No `keywords` and no Organization / SoftwareApplication / Offer structured data
- **File(s):** `app/layout.js:15-35` (metadata); `components/Landing.jsx:199-211` (only FAQPage JSON-LD)
- **Category:** SEO / rich results
- **Description:** FAQPage JSON-LD is present (good), but there is no Organization/WebSite or `SoftwareApplication` + `Offer` structured data despite a clear product with a defined price (€9.99/mo). No `keywords` field (low value for modern Google, but free to add for other engines). No `WebSite`+`SearchAction`/sitelinks signal.
- **Impact:** Missed eligibility for richer SERP treatment (product/offer rich snippets, brand knowledge-panel signals) that a priced SaaS can qualify for. Pure upside; not a blocker.
- **Recommended fix:** Add `SoftwareApplication`/`Product` + `Offer` JSON-LD (price `9.99`, `priceCurrency "EUR"`) and an `Organization`/`WebSite` block. Keep claims truthful and consistent with P0-2/P0-3 fixes.

### [P2-5] No email capture / waitlist / secondary conversion path
- **File(s):** `components/Landing.jsx` (no email input/newsletter/waitlist anywhere)
- **Category:** Funnel / lead capture
- **Description:** Every CTA is "start the diagnostic" or "sign in" — there is no lower-commitment capture (email, "notify me", newsletter) for visitors not ready to commit ~10–15 minutes to the placement. A paid campaign will send many top-of-funnel visitors who bounce with no way to re-engage them.
- **Impact:** Paid traffic that doesn't immediately start the diagnostic is lost entirely — no remarketing list, no nurture path. This caps the ROI of acquisition spend.
- **Recommended fix:** Add a low-friction email capture (e.g. "Get a sample graded problem" or launch-list) so non-converting paid traffic is retained for nurture/remarketing. Tie its submit to a `track()` event (P0-1).

---

## Notes / verified-OK (so the team doesn't re-flag)

- **Indexable:** No `noindex` and no robots disallow anywhere — the site is crawlable in principle. The SEO gaps above are about *helping* crawlers, not unblocking them.
- **OG/Twitter cards work:** `metadataBase` is set (`app/layout.js:16`), so the auto-generated OG/Twitter images resolve to absolute URLs at the correct 1200×630 (`lib/ogImage.jsx:18`); `twitter:card=summary_large_image`, `og:type`, `og:site_name`, `og:locale=en_US`, and descriptive `alt` are all present. Shared links should unfurl correctly. (NEEDS VERIFICATION at runtime: that the `geist` TTF reads in `lib/ogImage.jsx:35-37` succeed in the production build's image route — they are build-time reads from `node_modules`, which is the documented constraint.)
- **Favicon present:** `app/icon.svg` exists (browser tab favicon is covered); only the *Apple*/manifest icons are missing (P1-5/P1-6).
- **Pro gating mostly matches copy:** "Unlimited graded practice" (free daily cap at `app/api/score/route.js:213`), "Photo-of-work grading" (`:286`, `app/api/grade/route.js:107-111`), and "Progress trends + answer history" (`Dashboard.jsx:489-506`) are genuinely Pro-gated and server-enforced, matching the marketing — the only mismatches are P0-2 (Data export) and P0-3 (worked solutions).
- **Deny-by-default monetization:** Pro UI only shows when `NEXT_PUBLIC_PRO_ENABLED=true` (`Noobtopro.jsx:369`) and server gates only bite when Polar is configured — so an accidental half-config won't show a broken paywall.
