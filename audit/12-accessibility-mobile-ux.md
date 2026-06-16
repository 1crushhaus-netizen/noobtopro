# Accessibility / Mobile / Responsive / UX Audit — noobtopro

**Scope:** WCAG 2.1 AA, mobile/responsive, theme handling, UX polish for the marketing launch.
**Date:** 2026-06-16
**Method:** Full read of every component in `components/*`, `app/layout.js`, `app/error.jsx`, `app/globals.css`, plus `test/mobile-responsive.test.js`. Contrast ratios computed from the actual tokens in `globals.css` (`:root` dark + `[data-theme="light"]`) for both themes. `test/mobile-responsive.test.js` passes (17/17).

**Overall verdict:** This is a *substantially* more accessible codebase than the antagonistic mandate assumes. Real, deliberate a11y work is present: focus traps + return-focus + Esc in modals/drawers (`Dashboard.jsx`, `Noobtopro.jsx`), `prefers-reduced-motion` kill-switch (`globals.css:1035-1047`), chart `aria-label` text equivalents (`charts.jsx`), color-AND-text encoding for mastery (`globals.css:596-605`, `LearnTab.jsx:103-104`), 44px touch targets enforced by tests, `viewport-fit`/safe-area handling, `lang="en"`, real `<button>`/`<main>`/`<header>`/`<nav>` semantics, and a flash-of-wrong-theme pre-paint script. The remaining defects are concentrated in **(a) light-theme contrast of `--faint` and the subject accent colors used as small text**, **(b) no `aria-live` on the asynchronous grading result**, **(c) no skip-to-content link / no `<h1>` or `<main>` landmark on key pages**, and **(d) the file input + a couple of icon-only/`title`-only controls.** No P0 launch blockers were confirmed — the core flow (sign in, answer, see result, upgrade) works by keyboard and is usable on a phone.

---

## Summary table

| ID | Sev | Category | File(s) | One-line |
|----|-----|----------|---------|----------|
| P1-1 | P1 | Contrast (light) | globals.css:35,113,189,235,270,274,425,846,852,871,915,928 | `--faint` #999999 = 2.6–2.9:1 on white — fails AA on meaningful labels (eyebrows, hero meta, footer, step numbers). |
| P1-2 | P1 | Contrast (light) | globals.css:51-53,353,728,631-633; Noobtopro.jsx:1687; Dashboard.jsx:181 | Subject accents (`--math` 3.81, `--phys` 3.98) used as small text (rank band tag, subject band pill, mastery status) fail AA in light theme. |
| P1-3 | P1 | aria-live / async | Noobtopro.jsx:1773-1861, 1744-1751 | Grading result + live score delta render with no `aria-live`/`role=status` — screen-reader users are never told the score landed. |
| P1-4 | P1 | Landmarks / headings | Noobtopro.jsx:1340-1359, Landing.jsx:209-210 | Marketing Landing has no `<main>` landmark and no skip-to-content link; whole signed-in app has no skip link. |
| P1-5 | P1 | Heading order | Dashboard.jsx:462, LearnTab.jsx:241,412, Noobtopro.jsx:1674,1731 | Signed-in pages (Dashboard, Learn, Practice) have no `<h1>`; they start at `<h2>`. LearnTab styles an `<h2>` as `np-h1`. |
| P1-6 | P1 | Forms / labels | Noobtopro.jsx:282-292 | The work-photo `<input type=file>` is visually hidden with no programmatic label; only the adjacent ghost button is labeled. |
| P2-1 | P2 | Contrast (dark) | globals.css:35, 270,846 | `--faint` #6e6e6e on panel = 3.88:1 — small mono eyebrow/footer text is AA-large only, not AA. |
| P2-2 | P2 | Color-only meaning | Noobtopro.jsx:1602-1610 | Diagnostic progress dots convey step completion by color only, with no text/aria equivalent. |
| P2-3 | P2 | Color-only meaning | charts.jsx:90-94, Noobtopro.jsx:1746-1751,1790 | Gain/loss valence is teal-vs-coral with no non-color cue in the bar chart and the inline live-score delta. |
| P2-4 | P2 | Icon-only / title-only | TopNav.jsx:120,131; Dashboard.jsx:429,465; Noobtopro.jsx:1744 | Several controls rely on `title=` only (no `aria-label`); `title` is not reliably exposed to AT or touch. |
| P2-5 | P2 | Img alt semantics | Noobtopro.jsx:275 | Attached work photo uses `alt="your work"` (a label, fine) but the preview thumbnail has no remove affordance described relative to it; minor. Decorative avatars correctly use `alt=""`. |
| P2-6 | P2 | Reduced motion gap | globals.css:1035-1038; Landing.jsx:336 | The reduced-motion reset covers `[data-reveal]` and `.np-lp-scale .np-lp-seg` but not the generic `[data-revealbar]` selector — currently harmless (only the scale bar uses it, and it's `aria-hidden`/hidden <720px) but fragile. |
| P2-7 | P2 | Mobile: sign-in reachability | globals.css:241 | `.np-topnav-signin { display:none }` below 540px hides the only header sign-in for a guest on the Practice/Learn tabs at phone widths. |
| P2-8 | P2 | Mobile: long-content overflow | globals.css:339; Noobtopro.jsx:1618,1753 | `.np-question` has no `overflow-wrap`/`word-break`; a long unbroken token/URL/formula in a generated question can overflow horizontally on a 320px screen. NEEDS VERIFICATION with real LLM output. |
| P2-9 | P2 | `inert` support | Noobtopro.jsx:1437; Dashboard.jsx:390 | Background inerting relies on the `inert` attribute, unsupported in Safari < 15.5 / older Android WebViews; on those, focus can escape the modal. NEEDS VERIFICATION of browser-support target. |
| P2-10 | P2 | Native confirm() | Noobtopro.jsx:789-794; AdminDashboard.jsx:122 | `window.confirm` for "re-take diagnostic" and admin delete is a jarring, unstyled, and (in some embedded webviews) suppressible dialog; the styled reset modal sets the better precedent. |
| P2-11 | P2 | UX polish | charts.jsx:114-185; Leaderboard.jsx:90 | Leaderboard legend is `aria-hidden="true"`; the curve colors are then the only way to tell tracks apart visually, and the chart's own `aria-label` summary doesn't name colors (acceptable, but legend should not be hidden). |

---

# P0 — Launch Blockers

**None confirmed.** The critical flows were traced end to end:
- **Sign in** — `SignIn.jsx` provider buttons are real `<button>`s with `aria-label`; the menu is reachable by keyboard and from the intro, dashboard gate, and save modal.
- **Answer a question** — `AnswerComposer` (`Noobtopro.jsx:239-313`) is a labeled `<textarea aria-label="Your reasoning">` with real submit/skip buttons.
- **See result** — renders as readable DOM (the only defect is the missing live-region announcement, P1-3 — content is reachable, just not auto-announced).
- **Upgrade/checkout** — `np-btn` buttons, keyboard-operable, modal-trapped.
- **Mobile** — single-column collapses at 1023/680/560/480px; drawer is 94vw; modals are safe-area padded; inputs are 16px (no iOS zoom). No total breakage found.

Contrast on *core* body text is strong in both themes (`--text` 17.9:1 dark / 18.9:1 light; `--muted` 7.6:1 / 5.7:1), so no "unreadable core text" blocker exists.

---

# P1 — High

### [P1-1] `--faint` (#999999) fails AA contrast in the light theme on meaningful text
- **File(s):** `app/globals.css:35` (token), `113`, and usages: `189` (.np-arrow), `235` (.np-topnav-email), `270` (.np-eyebrow--mono), `274` (.np-stepnum), `425` (.np-foot), `846` (.np-lp-eyebrow), `852` (.np-lp-herometa), `871` (.np-lp-step-n), `891` (.np-lp-subj-foot), `915` (.np-lp-faqcat), `928-929` (footer)
- **Category:** Color contrast (WCAG 1.4.3 Contrast Minimum)
- **Description:** In light theme `--faint` is `#999999`. Measured contrast: **2.85:1 on `--bg` #ffffff** and **2.61:1 on `--panel2` #f5f5f5**. AA requires 4.5:1 for normal text and 3:1 for large text (≥18.66px/24px, or 14px bold). These tokens style real, information-bearing labels at 11–12.5px: the section eyebrows ("Reasoning-first STEM assessment", "How it works", "FAQ"), the hero meta strip ("math · physics · chemistry · 0–350 per subject · 5 ranks"), the FAQ category headers, the step numbers, the user email in the nav, and the footer copyright/tech line. These are below the large-text threshold, so they fail AA outright.
- **Impact:** Low-vision and many sighted users in bright conditions cannot read the marketing eyebrows/meta — the exact terse signposting the Polar-style landing leans on for conversion. Legal exposure (ADA/EAA) since these are public marketing surfaces.
- **Recommended fix:** Darken `--faint` in `[data-theme="light"]` to ≈`#737373` (4.5:1 on white) or `#707070`. If the airy look must be preserved on white, restrict `--faint` to ≥18.66px usages only and switch the small labels to `--muted` (#666666, already 5.74:1). Re-check `--faint` on `--panel2` after the change.

### [P1-2] Subject accent colors used as small meaningful text fail AA in light theme
- **File(s):** `app/globals.css:51-53` (tokens), `353` (.np-bandtag), `728` (.np-dash-subband), `606,610,631-633` (mastery green/yellow text); `components/Noobtopro.jsx:1687` (`<div className="np-bandtag" style={{ color: SUBJECTS[k].color }}>`); `components/Dashboard.jsx:181` (subject band); `components/LearnTab.jsx:412,416`
- **Category:** Color contrast (WCAG 1.4.3)
- **Description:** `--math #97804d`, `--phys #56897e`, `--chem #9d685e` are the same hex in both themes. On white: **math 3.81:1, phys 3.98:1, chem 4.59:1**. The band/rank tags use these as 11–13.5px text: `.np-bandtag` (12px mono, the rank name e.g. "University" tinted by subject — `Noobtopro.jsx:1687`), `.np-dash-subband` (11px subject-colored rank pill — `Dashboard.jsx:181`), `.np-masterystatus--green/yellow` (13.5px concept standing — `LearnTab.jsx:416`), and the concept-page title `<h2 className="np-h1" style={{ color }}>` (this one is large, OK). Math and physics rank labels miss AA (need 4.5); chem squeaks by.
- **Impact:** The earned rank — a headline outcome of the product — is hard to read in light theme for math and physics. The mastery status line ("In progress"/"Mastered") is similarly hard to read. Color also doubles as meaning here, compounding P2-3.
- **Recommended fix:** For small text tinted by subject, either (a) introduce darker `*-text` variants per subject for light theme (e.g. math `#6f5c34`), used by `.np-bandtag`/`.np-dash-subband`/`.np-masterystatus`, or (b) render the rank/status in `--text` and reserve the accent for a non-text cue (border/swatch). Keep the bright accents for charts/large headings where they pass.

### [P1-3] Asynchronous grading result is not announced to screen readers (no aria-live)
- **File(s):** `components/Noobtopro.jsx:1773-1861` (the `feedback` block, `<div className="fade-up">` — no live region), `1744-1751` (`.np-livescore` inline score + delta), `1656` (scoring `<Loader>`)
- **Category:** ARIA live regions / status messages (WCAG 4.1.3 Status Messages)
- **Description:** When a learner submits an answer, `submitPractice` flips `feedback` and the result UI (reasoning score, "Why your rank moved", strengths/improvements, worked solution) renders in place of the composer. That container has no `role="status"`/`aria-live`. The `<Loader>` correctly announces "Working…" via `role="status" aria-live="polite"` (`Noobtopro.jsx:327`), but the moment it's replaced by the actual graded result, nothing announces it — focus stays on the now-removed submit button's position and the score is silent. Same for the inline `.np-livescore` (`1744`) and its `scoreDelta`, which update silently. The diagnostic finalize path lands on the dashboard scores with no announcement either.
- **Impact:** A screen-reader user submits, hears "Working…", then silence — they don't know the grade arrived, what it was, or that the page changed. This is the *payoff* of the entire flow and it's inaccessible to AT without manual exploration. WCAG 4.1.3 (AA) violation on the core loop.
- **Recommended fix:** Wrap the feedback container in `role="status" aria-live="polite" aria-atomic` (or render a focused, off-screen summary like "Reasoning quality 72 of 100. Your rank moved +4."). Alternatively, on grade completion move focus to the feedback heading (`tabindex={-1}`) so the result is read. Add `aria-live="polite"` to the live-score chip.

### [P1-4] No `<main>` landmark on the marketing landing; no skip-to-content link anywhere
- **File(s):** `components/Landing.jsx:209-210` (root is `<div className="np-lp">`, never `<main>`), `components/Noobtopro.jsx:1340-1359` (Landing branch returns before the app shell that *does* have `<main>` at `1468`); no skip link in any file (verified — `globals.css` has `.np-sronly` but no skip-link rule)
- **Category:** Landmarks / bypass blocks (WCAG 1.3.1, 2.4.1 Bypass Blocks)
- **Description:** The signed-in app correctly wraps content in `<main className="np-main">` (`Noobtopro.jsx:1468`) under a `<header>` (TopNav) — good. But the public Landing renders an *early return* (`Noobtopro.jsx:1340`) that is a `<div className="np-lp">` containing `<header>` (TopNav), several `<section>`s, and a `<footer>` — but **no `<main>`**, so screen-reader landmark navigation finds no primary region on the most-visited page. Additionally there is **no skip-to-content link** on either the landing or the app, so keyboard users must tab through the entire TopNav (brand, up to 4 section links/4 tabs, identity, 3-button theme toggle, sign-in/out, CTA) on every page before reaching content.
- **Impact:** Keyboard-only and screen-reader users pay a heavy per-page tab tax (2.4.1). Missing `main` on the landing degrades AT navigation. Both are standard automated-scan failures (axe/Lighthouse) that auditors and ADA complaints flag immediately.
- **Recommended fix:** Wrap the Landing body sections in `<main id="content">` (TopNav stays the `<header>`). Add a visually-hidden, focus-visible `<a className="np-skip" href="#content">Skip to content</a>` as the first focusable element in both the Landing and the app shell, with a `.np-skip-link { position:absolute; left:-9999px } :focus { left: ... }` style (distinct from the existing `.np-skip` answer-skip class — reuse a new class).

### [P1-5] Signed-in pages have no `<h1>`; heading hierarchy starts at `<h2>`
- **File(s):** `components/Dashboard.jsx:462` ("Your dashboard" is `<h2>`), `components/LearnTab.jsx:241` ("The concept library" `<h2>`), `412` (`<h2 className="np-h1">` — h1 *style* on an h2 element), `components/Noobtopro.jsx:1674` ("Where you stand" `<h2>`), `1731` ("Climb …" `<h2>`); `AdminDashboard.jsx:78` ("Curation and security" `<h2>`)
- **Category:** Heading structure (WCAG 1.3.1 Info and Relationships; best practice 2.4.6)
- **Description:** Only the intro stages use a real `<h1>` (Landing `Landing.jsx:248`, signed-in-unranked intro `Noobtopro.jsx:1546`). Every *signed-in working page* — Dashboard, Learn, Practice, Admin — has its page title as `<h2>` with no `<h1>` above it, so the document has no top-level heading. `LearnTab.jsx:412` compounds the confusion by styling an `<h2>` with `className="np-h1"` (the concept title looks like an h1 but is coded h2, and there's still no real h1).
- **Impact:** Screen-reader users navigating by heading level land in a page whose primary title is h2 with nothing at h1 — disorienting and an automated-scan failure. Inconsistent visual-vs-semantic level (LearnTab) misleads AT.
- **Recommended fix:** Promote each page's primary title to `<h1>` (keep `np-h2`/`np-h1` purely as visual classes). In LearnTab, make the concept title a real `<h1>`. Ensure exactly one `<h1>` per rendered view.

### [P1-6] Work-photo file input has no associated label
- **File(s):** `components/Noobtopro.jsx:282-292` (`<input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} … />`), triggered by the ghost button at `281`
- **Category:** Form labels (WCAG 1.3.1, 4.1.2 Name/Role/Value)
- **Description:** The "Attach your work" affordance is a visible `<button>` (labeled, fine) that programmatically clicks a hidden `<input type="file">`. The input itself has no `aria-label`/`<label>`/`title`. For most users the button is enough, but a screen-reader user who reaches the input directly (some AT exposes hidden file inputs, and `display:none` only sometimes removes it from the tree across browsers/AT combos) gets an unlabeled "file upload" control. There is also no `aria-describedby` connecting the accepted-types/size guidance.
- **Impact:** Inconsistent/unlabeled file-upload control on a Pro-gated feature; minor but a clean 4.1.2 nit and easy to fix.
- **Recommended fix:** Add `aria-label="Attach a photo of your work"` to the input, or associate it via a real `<label>`. Optionally `aria-hidden` it and keep the button as the sole control if the input is guaranteed click-proxied (riskier across AT). Add an `aria-describedby` to surface the JPEG/PNG/size constraints handled in `prepareImage`.

---

# P2 — Medium

### [P2-1] `--faint` on dark panels is AA-large only, used on small text
- **File(s):** `app/globals.css:35` (#6e6e6e), `270` (.np-eyebrow--mono 12px), `846` (.np-lp-eyebrow 12px), `425` (.np-foot 12px)
- **Category:** Color contrast (WCAG 1.4.3)
- **Description:** Dark `--faint` #6e6e6e = **4.12:1 on #000000** and **3.88:1 on `--panel` #0a0a0a**. The 12px eyebrow/footer mono labels are below the large-text threshold, so they meet only AA-large, not AA for normal text.
- **Impact:** Marginal — these are secondary labels, but they technically miss AA on normal-size text in dark theme too.
- **Recommended fix:** Lift dark `--faint` to ≈`#808080` (4.5:1 on `--panel`) or apply `--muted` to the sub-14px eyebrow/footer usages.

### [P2-2] Diagnostic progress conveyed by color only
- **File(s):** `components/Noobtopro.jsx:1602-1610` (the `.np-progdot` row), `app/globals.css:332-333`
- **Category:** Use of color (WCAG 1.4.1); status info (1.3.1)
- **Description:** Progress through the 9-step adaptive placement is shown as three groups of dots filled with the subject color when answered (`background: di < answered ? color : tint-2`). There is no `aria` text ("Math: 2 of 3 answered"), no `role`, and the only distinction between done/not-done is fill color/shade. The `.np-metaline` does show "STEP n/total" for the *current* question, which partially mitigates, but the overall per-subject progress is color-only and silent to AT.
- **Impact:** Screen-reader and color-blind users can't perceive diagnostic progress.
- **Recommended fix:** Add a visually-hidden live/summary text (e.g. `<span className="np-sronly">Math {a}/{total}, Physics {b}/{total}, Chemistry {c}/{total} answered</span>`) and/or `role="img" aria-label` on each subject group.

### [P2-3] Gain/loss valence relies on color alone in chart and live-score delta
- **File(s):** `components/charts.jsx:90-94` (BarChart fill teal/coral by sign; the `+`/number label helps), `components/Noobtopro.jsx:1746-1751` (live-score delta colored only), `1790` (rationale uses ▲/▼/■ — good, keep as the model)
- **Category:** Use of color (WCAG 1.4.1)
- **Description:** The bar chart already prints the signed number (`+3`/`-2`) so it's largely fine; the **inline live-score delta** at `1746` shows `{scoreDelta>0?"+":""}{scoreDelta}` colored via `deltaColor` — the `+`/`-` sign is the non-color cue, so this is actually OK. The cleanest pattern is `1790-1791` which adds ▲/▼/■ glyphs. Flagged as a consistency/robustness note: ensure no place encodes gain/loss with color and no sign.
- **Impact:** Low — current code mostly includes a textual sign; this is a guard against regressions.
- **Recommended fix:** Keep the explicit `+`/`-`/▲▼ everywhere valence color is used; add the arrow glyph to the bar chart labels for parity.

### [P2-4] Controls that rely on `title` only (no accessible name)
- **File(s):** `components/TopNav.jsx:120` (`.np-topnav-id title=email`), `131` (rank chip `title="Your overall rank"`), `49-51` (brand button `title={brandTitle}` "Restart" — its visible text "noob→topro" is the name, title is supplemental, OK); `components/Dashboard.jsx:429` (rank chip `title`), `465` (Pro chip `title`); `components/Noobtopro.jsx:1744` (livescore — no name)
- **Category:** Name/Role/Value (WCAG 4.1.2); 1.3.1
- **Description:** Several informational chips carry meaning only via `title=` (e.g. the rank chip just shows "University" with `title="Your overall rank"`). `title` is not announced by many screen readers and is invisible on touch. The brand "Restart" relies on `title` for the restart semantics — the visible wordmark doesn't convey "click to restart". These are mostly supplemental, but the live-score chip (`1744`) has no name at all and the rank chips' purpose is title-only.
- **Impact:** Minor confusion for AT/touch users on identity/rank chrome; the restart-on-brand behavior is undiscoverable.
- **Recommended fix:** Add `aria-label` mirroring each `title`. For the brand-as-restart, add `aria-label="noobtopro — restart"`. Give the live-score chip an `aria-label` like "Current score N of 350".

### [P2-5] Image alt review on work-photo preview / decorative imagery
- **File(s):** `components/Noobtopro.jsx:275` (`<img src={img.preview} alt="your work" />`), `TopNav.jsx:122` + `Dashboard.jsx:420` (avatars `alt=""` — correct, decorative with text fallback)
- **Category:** Non-text content (WCAG 1.1.1)
- **Description:** Avatars correctly use `alt=""` with a visible name elsewhere and an `onError` fallback initial — good. The attached-work thumbnail uses `alt="your work"` which is acceptable. The only nit: the remove-image `<button aria-label="remove image">` is fine, but the relationship between the thumbnail and its remove button is only spatial. Decorative SVG icons (`Icon.jsx`) are inline and inherit `currentColor` with no `aria-hidden`, but they sit *inside* labeled buttons so the button's text/`aria-label` is the name — generally OK, though belt-and-suspenders `aria-hidden="true"` on purely-decorative `<Icon>` would be cleaner (SignIn provider glyphs already do this at `SignIn.jsx:12,19`).
- **Impact:** Very low.
- **Recommended fix:** Optionally add `aria-hidden="true"` to decorative `<Icon>` usages that sit beside visible text. No change strictly required.

### [P2-6] Reduced-motion reset doesn't cover the generic `[data-revealbar]` selector
- **File(s):** `app/globals.css:1035-1038` (resets `[data-reveal]` and `.np-lp-scale .np-lp-seg`), `components/Landing.jsx:336` (`<div className="np-lp-scale" aria-hidden="true" data-revealbar>`)
- **Category:** Reduced motion (WCAG 2.3.3 best practice; robustness)
- **Description:** The scroll-reveal hook (`useReveal.js:27`) arms both `[data-reveal]` and `[data-revealbar]`. The reduced-motion block resets `[data-reveal]` generically but resets the bar via the specific `.np-lp-scale .np-lp-seg` selector. Today the only `[data-revealbar]` consumer is `.np-lp-scale`, which is `aria-hidden="true"` and `display:none` below 720px, so there's no actual harm — but a future `[data-revealbar]` user with `opacity:0` initial state would be stranded invisible for reduced-motion users.
- **Impact:** None currently; latent fragility.
- **Recommended fix:** Add `[data-revealbar] { opacity: 1 !important; }` to the reduced-motion block, or normalize on a single `[data-reveal]` mechanism.

### [P2-7] Guest sign-in disappears from the header below 540px
- **File(s):** `app/globals.css:241` (`@media (max-width:540px){ .np-topnav-signin { display:none } }`), `components/Noobtopro.jsx:1455-1462`
- **Category:** Mobile responsive / reachability
- **Description:** In app chrome, a guest's sign-in entry point is `np-topnav-signin`, which is hidden below 540px to save nav space. On the Practice or Learn tab at phone width, a guest then has no header sign-in. The intro and the dashboard save-CTA provide alternative entry points, and the dashboard tab routes guests to the sign-in gate — so it's not a dead end, but a guest mid-practice on a phone loses the obvious "Sign in to save" affordance.
- **Impact:** Conversion friction on mobile (the launch's primary surface); not a hard block.
- **Recommended fix:** Keep a compact icon-only sign-in (`np-iconbtn` with `aria-label="Sign in"`) visible below 540px instead of hiding it entirely, or surface a persistent "Sign in to save" affordance on the practice surface for guests.

### [P2-8] Question text has no word-break guard against long unbroken tokens
- **File(s):** `app/globals.css:339` (`.np-question` — no `overflow-wrap`/`word-break`), used at `components/Noobtopro.jsx:1618` (diagnostic) and `1753` (practice); also `.np-lessontext` (worked solutions, `whiteSpace: pre-wrap`)
- **Category:** Responsive overflow (WCAG 1.4.10 Reflow)
- **Description:** Generated questions are LLM output and can contain long unbroken strings (URLs, big numbers, chemical formulae, inline expressions). `.np-question` sets only font/line-height; without `overflow-wrap: anywhere`/`word-break: break-word`, such a token can force horizontal scroll on a 320px viewport, breaking 1.4.10 Reflow. The admin sample at `globals.css:791` correctly uses `word-break: break-word`, so the pattern is known elsewhere.
- **Impact:** Possible horizontal scroll / clipped question on narrow phones. NEEDS VERIFICATION against real generator output.
- **Recommended fix:** Add `overflow-wrap: anywhere;` (and `hyphens: auto`) to `.np-question`, `.np-lessontext`, `.np-guideproblem`, and `.np-metaline`/`.np-topic` if topics can be long.

### [P2-9] Modal/drawer focus containment depends on `inert` (older-browser gap)
- **File(s):** `components/Noobtopro.jsx:1437` (`<div className="np-app" inert={bgInert}>`), `components/Dashboard.jsx:390` (`inert={true}` on the gate blur)
- **Category:** Focus management (WCAG 2.4.3, 2.1.2)
- **Description:** Background inerting uses the React 19 `inert` attribute. `inert` is unsupported in Safari < 15.5 and several older Android WebViews. On those engines, a keyboard/AT user could Tab out of the open modal/drawer into the (visually dimmed) background. The drawer also implements its own Tab focus-trap (`Dashboard.jsx:69-87`), which protects the *drawer* path, but the save/upgrade/reset modals rely on `inert` for containment without an internal trap.
- **Impact:** On legacy mobile Safari/WebView, modal focus can escape. NEEDS VERIFICATION of the project's browser-support matrix (`.nvmrc`/README target).
- **Recommended fix:** Confirm the supported-browser floor. If it includes Safari < 15.5, add an explicit focus-trap to the modals (as the drawer has) or load an `inert` polyfill.

### [P2-10] Native `window.confirm()` for destructive/important actions
- **File(s):** `components/Noobtopro.jsx:789-794` (re-take diagnostic confirm), `components/AdminDashboard.jsx:122` (delete guide confirm)
- **Category:** UX / consistency (and AT predictability)
- **Description:** "Re-take the diagnostic will replace your scores…" and admin delete use `window.confirm`. The reset-progress flow already replaced `confirm` with a proper styled, focus-trapped, Esc-closable modal (`Dashboard.jsx:560-608`) — the better pattern. Native `confirm` is unstyled, can be suppressed/blocked in some embedded webviews ("don't let this page create more dialogs"), and breaks the app's own focus-management model.
- **Impact:** Inconsistent, and on suppressed-dialog webviews the re-take confirm silently no-ops or auto-proceeds.
- **Recommended fix:** Reuse the existing styled-modal pattern for the re-take-diagnostic and admin-delete confirmations.

### [P2-11] Leaderboard legend is `aria-hidden`, leaving color as the only visual track key
- **File(s):** `components/Leaderboard.jsx:90` (`<div className="np-legend" aria-hidden="true">`), `components/charts.jsx:114-185` (`RankDistribution` `aria-label` summary names tracks but not colors)
- **Category:** Use of color (WCAG 1.4.1) / info relationships
- **Description:** The leaderboard renders four overlaid curves distinguished only by color. The visible legend that maps color→track is `aria-hidden="true"`. The chart's `aria-label` does give a full text summary per track (good for AT), but for a *sighted color-blind* user the only on-screen track key is the color swatches in the legend — and the legend, while visible, conveys track identity through the swatch color plus the label text (the label text is present, so it's actually distinguishable). The `aria-hidden` is defensible (the chart aria-label is the AT path), but hiding the legend means AT users lose the color↔track mapping entirely if they ever need it.
- **Impact:** Low — text summary covers AT; sighted color-blind users have the text labels in the legend. Mostly a polish/robustness note.
- **Recommended fix:** Drop `aria-hidden` from the legend (its labels are useful and harmless), or ensure curves are also distinguished by a non-color cue (dash pattern / direct end-labels).

---

## What is already done well (do not regress)

- **Modal/drawer a11y:** focus-on-open, return-focus-on-close (with the rAF deferral for the inert-untangle, `Dashboard.jsx:97-100`), Esc-to-close, scroll-lock, and a real Tab focus-trap in the drawer (`Dashboard.jsx:38-126`; save/upgrade/reset modals in `Noobtopro.jsx:1291-1306`, `Dashboard.jsx:369-378`). The onClose-in-a-ref fix to keep the effect dep on `open` only is a genuinely subtle correct call.
- **Reduced motion:** global kill-switch collapsing all animation/transition (`globals.css:1040-1047`) plus the reveal un-hide (`1035-1038`); reveals gated behind `.is-armed` so content is visible JS-off/for crawlers.
- **Charts:** every SVG chart is `role="img"` with a data-bearing `aria-label` text equivalent including per-axis/per-bucket values (`charts.jsx:41,80,154,234`; `Noobtopro.jsx:213`).
- **Color-and-text encoding:** mastery uses distinct glyphs ✓/…/! plus text labels, not hue alone (`globals.css:596-605`, `LearnTab.jsx:103-104`); gate state stated in text (`Dashboard.jsx:184-189`).
- **Touch targets:** 44px enforced on `.np-btn/.np-tab/.np-signinbtn/.np-skip/.np-ghost/.np-iconbtn`, summaries, and chips bumped to 44px ≤480px — pinned by `test/mobile-responsive.test.js`.
- **Mobile foundations:** `viewport-fit=cover` + safe-area insets on shell/modal/drawer/toast; 16px inputs (no iOS zoom); single-column reflow at sensible breakpoints; drawer 94vw.
- **Theme:** pre-paint inline script prevents flash-of-wrong-theme (`layout.js:53-64`); 3-way toggle is a proper `role="radiogroup"`/`role="radio"` with `aria-checked` + per-option `aria-label` (`ThemeToggle.jsx:72-86`); `lang="en"` set.
- **Error boundary & empty/loading states** are understandable and token-styled (`app/error.jsx`; `Loader` with `role=status`; empty-state copy throughout).

## What the existing test misses (gaps to add coverage for)

`test/mobile-responsive.test.js` only guards touch-target sizes, the breakdown-table reflow, 16px inputs, viewport-fit/safe-area, and chart label sizes. It does **not** cover: color-contrast of any token (P1-1, P1-2, P2-1), presence of `aria-live` on the grading result (P1-3), `<main>`/skip-link/`<h1>` presence (P1-4, P1-5), file-input labeling (P1-6), or `overflow-wrap` on question text (P2-8). Consider adding: a token-contrast unit test (compute ratios for `--faint`/subject accents vs `--bg`/`--panel` per theme), and DOM assertions that the practice-feedback container has a live region and that each top-level view renders exactly one `<h1>`.
