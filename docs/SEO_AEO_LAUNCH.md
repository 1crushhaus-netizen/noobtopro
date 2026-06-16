# SEO / AEO Launch Playbook

How to take noobtopro from "invisible" to "found and cited." This is the
**off-page** half of the work — the on-page/technical half ships in the Learn
library PR. Code is necessary but **not sufficient**: a brand-new domain with no
inbound links and no brand mentions stays invisible no matter how good its markup
is. This doc is the checklist that actually moves the needle after deploy.

> **Baseline (measured 2026-06-16, via a 5-agent visibility audit):**
> - `site:noobto.pro` → **0 pages indexed**. The site appeared in **0 of 17**
>   real searches, including the exact-domain query.
> - **0 third-party brand mentions** anywhere (Reddit, blogs, directories, news) —
>   the single strongest correlate of AI-answer citation.
> - On-page SEO and technical SEO are already **strong** (full SSR HTML, valid
>   structured data, OG cards, robots/sitemap). The gaps are discovery signals,
>   not code.
> - Brand-name collision: "noob to pro" is saturated by gaming content, plus a
>   lookalike domain `noobtopro.online`.
>
> **Realistic timeline:** indexation in days–weeks after submission; meaningful
> organic + AI-citation traction in **2–6 months** with consistent off-page work.
> Anyone promising faster on a new domain is selling something.

---

## Why AEO ≈ SEO here

The best-evidenced drivers of being cited by ChatGPT, Claude, Gemini, Perplexity,
and Google AI Overviews are, in order:

1. **Already ranking organically** in the index the engine uses
   (Google → AI Overviews/Gemini, Bing → ChatGPT, Brave → Claude).
2. **Off-page brand mentions** (correlates with AI citation far more than backlinks).
3. **Extractable, front-loaded content** (the Learn pages are built for this).
4. **Original data/examples** (the worked examples + the 0–350 rank data are the moat).

So the off-page plan below serves SEO and AEO simultaneously. Two honest caveats:
**schema is not a ranking multiplier** (it aids parsing — we keep it valid, not
magical), and **`llms.txt` is not yet verifiably consumed** by major engines
(Google has said it won't) — we ship it because it's cheap and future-facing, not
because it drives traffic today.

---

## Step 0 — Deploy the Learn library, then verify production

The improvements only count once live. After merging the PR and deploying:

- [ ] `https://noobto.pro/learn` returns **200** with visible text (not a 404).
- [ ] A concept page (e.g. `/learn/math/high/quadratics`) renders the guide text
      server-side and has a self-canonical to the same URL.
- [ ] `https://noobto.pro/sitemap.xml` lists **~244 URLs** (not 4).
- [ ] `https://noobto.pro/robots.txt` shows the AI-crawler allow-list.
- [ ] `https://noobto.pro/llms.txt` and `/llms-full.txt` return **200**.
- [ ] **Confirm production does NOT send `X-Robots-Tag: noindex`** on `/learn`
      pages. Vercel adds that automatically to *preview* deploys; production
      shouldn't have it. Check with:
      `curl -sI https://noobto.pro/learn | grep -i x-robots-tag` (expect nothing).

---

## Step 1 — Force indexation (highest urgency)

A new domain won't get crawled quickly on its own. Make it explicit.

- [ ] **Google Search Console** — add `noobto.pro`, verify, submit `sitemap.xml`,
      then use **URL Inspection → Request Indexing** on the homepage, `/learn`, and
      5–10 top concept pages.
- [ ] **Bing Webmaster Tools** — add + verify the site and submit the sitemap.
      **Bing matters disproportionately**: ChatGPT Search is built on the Bing index.
- [ ] **IndexNow** — Bing/Yandex (and Vercel) support IndexNow for instant
      submission of new/changed URLs. Vercel can wire this up; otherwise post the
      URL list to the IndexNow endpoint with a key file at the domain root.
- [ ] Re-check `site:noobto.pro` weekly until the count climbs past ~20.

---

## Step 2 — Earn brand mentions + a few backlinks (the biggest lever)

This is the #1 AEO signal and also the fastest path to indexation (crawlers follow
links in). Aim for **5–15 credible, on-topic mentions** in the first month. Always
pair the brand with disambiguating words ("noobto.pro — reasoning-first STEM
assessment") so it doesn't get lost in the "noob to pro" gaming namespace.

**Launch surfaces (do these first):**
- [ ] **Product Hunt** launch (EdTech / AI category) — a strong do-follow profile + traffic spike.
- [ ] **Hacker News** "Show HN: noobtopro — an AI that grades your STEM *reasoning*, not your answer."
- [ ] **AI-tool directories:** There's An AI For That, Futurepedia, Toolify,
      AIxploria, SaaSHub, AlternativeTo (list it as a Khan Academy/Brilliant/Chegg alternative).
- [ ] **EdTech directories:** Common Sense Education, eLearning Industry, Capterra/G2 (if applicable).

**Community surfaces (genuine, non-spammy participation):**
- [ ] Reddit: r/learnmath, r/chemhelp, r/PhysicsStudents, r/EngineeringStudents,
      r/edtech, r/artificial — answer real questions and link the matching
      `/learn` guide where it genuinely helps. (Reddit is one of the most-cited
      domains across AI engines.)
- [ ] Relevant Discord/forum communities (homeschool, test-prep, CS/STEM study).

**Lightweight link-building:**
- [ ] 2–3 guest posts / interviews on EdTech or "AI in education" blogs.
- [ ] Get added to "best AI tutors / math practice sites" roundup articles
      (reach out to the authors who already rank for those terms).

---

## Step 3 — Disambiguate and own the brand entity

- [ ] Register and **fill** brand profiles: X/Twitter, LinkedIn (company),
      Instagram, YouTube, GitHub — all linking to `noobto.pro` with consistent
      name + description.
- [ ] Create a **Wikidata** item and a **Crunchbase** profile (strong knowledge-graph
      anchors that AI engines lean on for entity disambiguation).
- [ ] Once those exist, set the env var so they flow into the Organization schema:
      ```
      NEXT_PUBLIC_SAME_AS=https://x.com/...,https://www.linkedin.com/company/...,https://www.wikidata.org/wiki/...
      ```
      (`app/layout.js` reads this and emits `sameAs` only when set — no fabricated links.)
- [ ] Watch the lookalike `noobtopro.online` — make sure your profiles/links all
      point to `noobto.pro` so the right domain accrues the signals.

---

## Step 4 — Target *winnable* queries (don't fight Wikipedia)

The audit mapped who owns the STEM-learning SERPs. Pick battles you can win:

| Tier | Examples | Owned by | Verdict |
|---|---|---|---|
| Definitional | "what is conservation of energy" | Wikipedia, LibreTexts, OpenStax, Britannica | **Avoid near-term** (link-authority play) |
| Head comparison | "Khan Academy vs Brilliant" | Brilliant, Khan, AlternativeTo | **Avoid near-term** |
| **Worked-example long-tail** | "quadratic functions worked example", "solve quadratics by completing the square step by step" | cuemath, geeksforgeeks, study.com | **Best target** — beatable with focused on-page SEO + internal linking |
| **Differentiator niche** | "AI that grades math reasoning", "why is my derivation wrong if the answer is right", "STEM reasoning level test" | startups + arXiv (not entrenched) | **Strong target** — your actual moat |

- [ ] Make sure each `/learn` guide leads with a tight, direct answer in the first
      1–2 sentences (front-loaded = what snippets and AI answers extract).
- [ ] Build a couple of "differentiator" landing/blog pages around the reasoning-first
      angle and the 0–350 rank — original data the incumbents can't copy.

---

## Step 5 — Measure

- [ ] **GSC**: indexed-page count, impressions, clicks, average position (weekly).
- [ ] **Bing Webmaster**: same, plus crawl stats.
- [ ] **Brand-mention monitoring**: a Google Alert / search for `"noobto.pro"` and
      `noobtopro STEM`; track count over time (this is your AEO leading indicator).
- [ ] **AI-citation spot checks**: periodically ask ChatGPT/Perplexity/Gemini a
      query you target ("what's a good site to test my STEM reasoning level?") and
      note whether noobto.pro is mentioned. (Qualitative, but it's the real outcome.)
- [ ] **Server logs**: watch for AI-crawler user-agents (GPTBot, OAI-SearchBot,
      ClaudeBot, PerplexityBot) hitting the site — confirms the robots allow-list is
      being honored and the content is being ingested.

---

## What we deliberately did NOT change (and why)

- **Homepage/`/learn` are dynamically rendered (`Cache-Control: no-store`).** This
  is **required**, not a bug: the app's Content-Security-Policy mints a fresh
  per-request nonce (`middleware.js`), so pages can't be CDN-cached without serving
  a stale nonce and breaking CSP. The pages are still fully server-rendered and
  crawlable; TTFB is fine from in-memory data. Don't "fix" this by forcing static
  caching unless the CSP-nonce architecture changes first.
- **No fabricated `sameAs`, testimonials, ratings, or user counts.** These help SEO/AEO
  but must be real — add them via config/markup only once they exist.
- **No `aggregateRating` on the SoftwareApplication schema** until there are genuine reviews.

---

## TL;DR priority order

1. Deploy the Learn library; verify production isn't `noindex`.
2. Submit to Google Search Console + Bing Webmaster Tools; request indexing.
3. Earn 5–15 real brand mentions (Product Hunt, HN, AI directories, Reddit).
4. Claim + fill brand profiles; add Wikidata/Crunchbase; set `NEXT_PUBLIC_SAME_AS`.
5. Target worked-example long-tails + the reasoning-first differentiator; publish original content.
6. Measure indexation, mentions, and AI citations monthly; keep shipping.
