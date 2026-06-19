# UI/UX Adversarial Audit — noobtopro

**Date:** 2026-06-19
**Scope:** Full UI/UX of the web app (landing → diagnostic → results → dashboard → learn), all client components, `app/globals.css`, and the marketing/legal surfaces.
**Method:** A fleet of seven adversarial specialist agents each read the real source (file:line cited) across six domains — accessibility, responsive/cross-device, design-system consistency, usability heuristics, front-end performance, and UX-writing/IA — benchmarked against a deep-research standards backbone (WCAG 2.2 AA, Core Web Vitals/INP, Nielsen heuristics, Apple HIG / Material 3, GOV.UK/web.dev forms, EDPB consent guidance) with primary-source citations (Appendix A).

> Posture: deliberately antagonistic. Prior `A11y P1-x` / `PERF (INP)` fixes in the codebase were **re-verified, not trusted**. "Verified clean" items are recorded in Appendix C so they aren't re-litigated.

---

## Severity definitions

- **P0 — Blocker.** Excludes a class of users, a legal/conformance violation (WCAG 2.2 AA / GDPR-ePrivacy), data loss, or a core-flow dead-end. Fix before further growth.
- **P1 — High.** A real WCAG AA failure, significant friction/confusion, conversion/perf degradation, or visible breakage on a common device.
- **P2 — Polish.** Inconsistency, minor edge case, or nice-to-have.

## Headline

The app is unusually mature (extensive prior a11y/perf/legal work, a coherent greyscale design system, thorough legal copy). The remaining issues cluster in **five themes**:

1. **Diagnostic flow resilience** — grading is fire-and-forget; failures (network/429/402) surface late or dead-end; in-progress work is destroyed without confirmation. *(highest user-impact)*
2. **Color-contrast conformance** — meaning-bearing accent text fails WCAG 1.4.3 AA in light theme (and chemistry in dark), despite accessible `-text` tokens existing but unused.
3. **EU consent + modal focus** — the cookie banner is a borderline dark pattern; some modals don't trap focus / make the background inert.
4. **Responsive overflow** — several rows and LLM-generated text overflow at 320px; tall modals can't scroll in landscape.
5. **Perceived performance** — a 2,487-line monolith re-renders on every state change (INP), font/avatar/lazy-chunk layout shift (CLS).

Counts: **P0 ×9 · P1 ×24 · P2 ×27** (deduplicated across agents).

---

# P0 — Blockers

### P0-1 · Diagnostic grading is fire-and-forget; failures are invisible until the very end
**Domain:** Usability / Flow · **Where:** `components/Noobtopro.jsx:1113-1121` (`submitDiagStep(q,a); setQi(qi+1)`), `:1174-1175` (failed step pushed to a silent `diagFailed` queue).
**Issue:** Each step advances `qi` immediately and grades in the background. A 429/network failure on any of the 9 steps only surfaces on the final "waiting" card — after the learner has invested 10–15 min answering everything. There is no per-step indication that step N failed.
**Impact:** Maximum-effort abandonment: the user hits a wall of "grading hit a snag" at the most-invested moment, with no idea which answers were lost.
**Standard:** Nielsen H1 (visibility of system status), H9 (error recovery).
**Fix:** Reflect per-step grade state inline the moment `submitDiagStep` catches (e.g. the progress pip turns amber); show the queued-retry count on the waiting card ("2 answers still grading").

### P0-2 · 402 paywall mid-diagnostic dead-ends in an infinite retry loop
**Domain:** Usability / Flow · **Where:** `components/Noobtopro.jsx:1165-1176` — `submitDiagStep`'s catch never checks `e.status===402 || e.upgrade` (unlike `submitPractice` at `:1582`).
**Issue:** If `/api/score` returns 402 during the diagnostic, the learner gets a generic "try again" whose retry re-sends the same request and 402s again — no upgrade path, no explanation.
**Impact:** The core conversion flow can hard-loop with no exit.
**Standard:** Nielsen H9; WCAG 3.3.4 (error prevention).
**Fix:** Mirror the practice 402 handling — route to the upgrade nudge or a clear "diagnostic temporarily unavailable" instead of an unwinnable retry.

### P0-3 · Submit has no in-flight lock during the diagnostic (`loading={false}` hardcoded)
**Domain:** Usability / Perf · **Where:** `components/Noobtopro.jsx:2121` (`<AnswerComposer loading={false}>`), button at `:343`.
**Issue:** The most-repeated action (9×) gives zero acknowledgment and is double-submittable; a fast double-tap/Enter can fire `nextDiagnostic` twice before `qi` commits.
**Impact:** Confusing dead feedback + possible skipped/duplicated steps.
**Standard:** Nielsen H1; double-submit prevention.
**Fix:** Give the diagnostic composer a real per-step `loading` state until `setQi` commits; disable + show "Working…" for the frame.

### P0-4 · Destructive navigation silently destroys in-progress answers (no confirm)
**Domain:** Usability / Flow · **Where:** sign-out handler `Noobtopro.jsx:748-789`; `reset()` (brand-logo "Restart") `:826-866`; "Back to scores" `:2268-2270`; tab/BottomNav switches `:1726-1730`.
**Issue:** Signing out, clicking the brand logo, or switching tabs mid-diagnostic/practice clears `answers`/`questions` (and the composer's local text, lifted only on blur) with **no "abandon your work?" confirm**. The answer textarea also has **no `maxLength`** (a huge paste bloats the single all-answers request toward the 4.5 MB Vercel cap).
**Impact:** One mis-tap (especially the thumb-reachable mobile BottomNav) destroys up to 9 questions of typed reasoning.
**Standard:** WCAG 3.3.4 (data loss prevention); Nielsen H3/H5.
**Fix:** Guard sign-out / brand-Restart / tab change with a confirm when `stage==="diagnostic"|"practice"` and any answer text exists; add a `maxLength` and a draft/persist for practice text.

### P0-5 · Failed guest→account migration has no real retry → stranded baseline
**Domain:** Usability / Flow · **Where:** `components/Noobtopro.jsx:535-539` (`mig.error` → only `setError(...)`).
**Issue:** A guest signs in to save their diagnostic; if `migrateGuestToAccount()` fails atomically, the only "retry" is to sign out and back in — which the user has no way to know. The dismissible banner is easily lost amid the SIGNED_IN cascade (closes save modal, may open consent).
**Impact:** The guest's only baseline is stranded in localStorage; they re-take the 15-min diagnostic or abandon.
**Standard:** Nielsen H9.
**Fix:** Make the banner actionable with an explicit "Retry saving my progress" button that re-invokes `migrateGuestToAccount()`.

### P0-6 · Indefinite LLM loader — no timeout, no progress, no escape
**Domain:** Usability / Perf · **Where:** `Loader` `Noobtopro.jsx:356-371`; `api`/`authApi` `:49-109` have **no `AbortController`/timeout**; used at `:2150/2156/2277`.
**Issue:** During the highest-latency operation (LLM grading/finalize/generation), the loader cycles reassuring phrases forever. A hung fetch leaves the user staring at "Evaluating all three…" indefinitely with no cancel.
**Impact:** A stalled request looks identical to a frozen app on the core flow.
**Standard:** NN/g response-time limits (progress >1 s, determinate >10 s); Nielsen H1/H3.
**Fix:** Add a client fetch timeout (AbortController); after N seconds show "This is taking longer than usual — keep waiting / restart"; prefer staged progress ("scoring 2 of 3").

### P0-7 · Light-theme (and dark-chemistry) accent text fails WCAG 1.4.3 AA
**Domain:** Accessibility · **Where:** mastery chips `globals.css:807-812` (`.np-concepttag--green/--yellow` use raw `--phys`/`--math`); valence eyebrows `:524-526`; error badges `ScoreBreakdown.jsx:38`; `--chem` small text in dark.
**Issue:** Measured ratios on meaning-bearing 11–13px text: light `--math` ≈ **3.4–3.8:1**, `--phys` ≈ **3.6:1**, `--chem` ≈ 3.8:1; dark `--chem #9d685e` ≈ **4.0–4.3:1** on panels. All below the **4.5:1** floor. The accessible `--math-text`/`--phys-text`/`--chem-text` tokens already exist (used by `.np-masterystatus--*`) but the chips/eyebrows/badges don't use them.
**Impact:** Low-vision users can't reliably read mastery state, error types, or valence labels — the Learn library's primary navigation. EU EN 301 549 / EAA conformance exposure.
**Standard:** WCAG 1.4.3 (Minimum Contrast) AA.
**Fix:** Switch every small meaning-bearing accent text to the `-text` variants; keep the bright accents only for borders/graphics/charts (≥3:1 non-text).

### P0-8 · Cookie consent banner is a borderline EU dark pattern; consent dialog doesn't isolate focus
**Domain:** Legal / Accessibility · **Where:** `ConsentManager.jsx:133-138` — "Reject" is `.np-secondary`, "Accept" is `.np-primary` (unequal prominence); focus gate `Noobtopro.jsx:1647` omits `showConsent`/`upgradeNudge` from the `bgInert` expression.
**Issue:** EDPB guidance + *Planet49* require accept/reject to have **equal prominence on the same layer**; the filled-primary Accept vs quiet-secondary Reject is the classic "false hierarchy" nudge. Separately, the CRD checkout-consent dialog never makes the background `inert`, so keyboard/SR users can Tab behind it into nav/footer — and in-shell modals lack the real Tab-trap the Dashboard `Drawer` has (`Dashboard.jsx:73-91`).
**Impact:** Invalid-consent legal risk (GDPR/ePrivacy) + the legally-required consent gate is focus-bypassable.
**Standard:** GDPR Art. 4/7, EDPB Cookie-Banner Taskforce, *Planet49* C-673/17; WCAG 2.4.3 + ARIA dialog pattern.
**Fix:** Give Accept/Reject identical visual weight (both secondary, or matched). Add `showConsent`/`upgradeNudge` to the inert gate and give in-shell modals a focus trap (or portal them outside `.np-app`).

### P0-9 · Marketing promises "Doctorate-level mastery" that the product can't deliver
**Domain:** UX-writing / Trust · **Where:** `Landing.jsx:256` ("a structured path … to Doctorate-level mastery"), `:368` ranks bar; vs `lib/curriculum.js:36` (`WIP_RANKS_NOTE` — Doctorate "coming soon") and `lib/learn/seo.js:29` (`PUBLIC_RANKS` excludes doctorate — zero concepts).
**Issue:** Every marketing surface sells a 5-rank ladder ending at Doctorate, but Doctorate has no content and practice is greyed out; the dead-end is disclosed only after a user reaches it.
**Impact:** The headline value prop is currently undeliverable — trust/conversion and advertising-accuracy risk.
**Standard:** Truthful capability claims; Nielsen H2.
**Fix:** Either soften the claim ("Elementary → University, with Doctorate in development") or add a visible disclosure on the Ranks section while keeping the full 0–350 ranking honest.

---

# P1 — High priority

### Accessibility
- **P1-A1 · Decorative icons are not hidden from AT (systemic).** `components/Icon.jsx:33-58` returns bare `<svg>` with no `aria-hidden`/`focusable="false"`. Inside already-labeled buttons/tabs/nav this produces redundant or empty announcements everywhere. *WCAG 1.1.1, 4.1.2.* **Fix:** default `aria-hidden="true" focusable="false"` on every Icon; add an opt-in label prop for standalone-meaning icons.
- **P1-A2 · Sticky nav can obscure the focused control.** `globals.css:254` sticky `.np-topnav`; no `scroll-padding-top` on the scroll root nor `scroll-margin-top` on anchor/focus targets. Tabbing/skip-link can land a control under the ~56px bar. *WCAG 2.4.11 Focus Not Obscured.* **Fix:** `scroll-padding-top: <navheight>` on `html`.
- **P1-A3 · Form-field placeholder / empty-DOB fails AA.** `globals.css:482` `.np-field::placeholder { color: var(--faint) }`; `:499` `:invalid` date uses `--faint` (≈4.17:1 on the tint fill). The required age-gate DOB prompt is sub-AA, and the age gate blocks the whole app. *WCAG 1.4.3.* **Fix:** use `--muted` for placeholder/invalid-date text.
- **P1-A4 · Dashboard section titles aren't headings.** `Dashboard.jsx:173/235/306` render "By subject", "Reasoning profile", "Why your reasoning moved" as `<div class="np-charttitle">`. The densest screen has an `<h1>` then no `<h2>` structure. *WCAG 1.3.1, 2.4.6.* **Fix:** promote to `<h2>/<h3>` (keep the visual class).
- **P1-A5 · Form errors not programmatically linked to inputs.** AgeGate / sign-in lack `aria-describedby` → `aria-invalid` wiring between the field and its error message. *WCAG 3.3.1, 1.3.1.* **Fix:** wire `aria-describedby`/`aria-invalid`.

### Responsive / cross-device
- **P1-R1 · Dashboard action row overflows at 320–412px.** `Dashboard.jsx:640` + `globals.css:920` — up to 7 buttons (Pro+withdrawal) wrap unpredictably; long labels ("Withdraw from contract here", "Manage subscription") don't truncate; scattered inline `marginLeft:auto` reflows erratically. *WCAG 1.4.10 Reflow.* **Fix:** `.np-dash-actbtn { flex: 1 1 100% }` below ~560px; remove inline `marginLeft:auto`.
- **P1-R2 · Diagnostic composer footer can clip Submit at 320px.** `Noobtopro.jsx:316/330` — the inner skip+submit `<div>` has no `flex-wrap`, so "I don't know (10s)" + "Get ranked →" overflow the card. *WCAG 1.4.10.* **Fix:** `flexWrap:"wrap"` on the inner div; drop `white-space:nowrap` from `.np-skip` on phones.
- **P1-R3 · LLM-generated text lacks overflow-wrap (only `.np-question` was hardened).** `globals.css:540-545` — `.np-lessontext`, `.np-socratictext`, `.np-guideproblem`, `.np-guideanswer`, `.np-errwhat`, plus the worked-solution `whiteSpace:pre-wrap` (`Noobtopro.jsx:2418`). A long formula/URL/SMILES token forces horizontal scroll. *WCAG 1.4.10.* **Fix:** add `overflow-wrap:anywhere` to those recipes.
- **P1-R4 · Centered modals can't scroll in landscape / short viewports.** `globals.css:655-668` — `.np-modal-backdrop` is `display:flex; align-items:center` with no `overflow-y:auto`, and `.np-modal` has no `max-height`. Tall dialogs (consent, withdrawal confirmation, age gate) clip top/bottom with no scroll. *WCAG 1.4.10/1.4.4.* **Fix:** `overflow-y:auto` + `align-items:flex-start` (or `max-height` + internal scroll).
- **P1-R5 · Rank-scale tier labels clip under text-spacing override.** `globals.css:348` `.np-scale-name { min-height:2.4em }` fixed box; the 5-column scale never collapses. Forcing line-height 1.5 / word-spacing .16em (WCAG 1.4.12) overflows and overlaps the range below. *WCAG 1.4.12.* **Fix:** drop the fixed height (let it grow) or stack to 2–3 columns under 480px.
- **P1-R6 · Long practice topic pill overflows.** `globals.css:404` `.np-topic` has no `max-width`/`overflow`; a long LLM `targetConcept` forces horizontal scroll. *WCAG 1.4.10.* **Fix:** `max-width:100%; overflow:hidden; text-overflow:ellipsis`.

### Performance (Core Web Vitals)
- **P1-P1 · Monolithic shell re-renders ~2,487 lines on every state change (INP).** `Noobtopro.jsx:380` holds ~50 hooks; `setScoreDelta`/`setDiagAnswered`/`Loader` interval/`attachCur` all reconcile TopNav + every modal + every stage branch + footer. Only `AnswerComposer` is isolated. *INP >200ms on mid/low-end mobile during submit/advance.* **Fix:** split `DiagnosticView`/`PracticeView`/`FeedbackView` into memoized children owning their transient state; `useMemo` the blended scores once.
- **P1-P2 · Web-font reflow CLS.** `app/layout.js:3-4` + `geist/dist/font.js` use `adjustFontFallback:false` with `display:swap` → no metric-matched fallback, so Geist swap-in reflows the hero (likely LCP). *CLS/LCP.* **Fix:** allow next/font's metric fallback, or `display:"optional"` for body. *(Verify against field data — variable self-hosted fonts mitigate somewhat.)*
- **P1-P3 · Avatar `<img>` has no dimensions + `onError` element swap → CLS in the sticky nav.** `TopNav.jsx:132`, `Dashboard.jsx:574` (size is CSS-only; fallback flips `<img>`→`<div>` after the failed load). *CLS (sticky nav weighted).* **Fix:** explicit `width`/`height` attrs on img+fallback, or `next/image`; render the initial fallback immediately.
- **P1-P4 · Synchronous canvas decode + `toDataURL` JPEG encode at photo-attach blocks the main thread.** `Noobtopro.jsx:132-180` (`attachCur`/`attachP`). On low-end phones — the exact device class for photo-of-work — this freezes interaction for hundreds of ms. *INP spike.* **Fix:** `createImageBitmap`+`OffscreenCanvas` in a Worker, or async `canvas.toBlob`; show a "processing" state.
- **P1-P5 · Dual scroll-repainting backdrop-filters.** `globals.css:260` (`.np-topnav` sticky blur) + `:1046` (`.np-bottomnav` fixed blur) re-rasterize the blurred backdrop every scroll frame — two on mobile. *INP/scroll jank on budget Android.* **Fix:** drop the blur on mobile for a higher-opacity solid `background` (esp. the bottom bar).
- **P1-P6 · Lazy Dashboard/Learn/Admin chunks reserve no space → CLS on tab switch.** `Noobtopro.jsx:39-41` — the small `Loader` fallback is replaced by a tall bento grid. *CLS.* **Fix:** reserve `min-height` / skeleton matching the loaded view.
- **P1-P7 · Charts/`RecentMoves` recompute every dashboard interaction.** `charts.jsx:206` (`RadarChart` trig + aria string, unmemoized) and `Dashboard.jsx:290-297` (`history.filter().slice().reverse().map()` in render). *INP.* **Fix:** `React.memo` the charts; `useMemo` the moves array.

### UX-writing / IA / Flow
- **P1-C1 · "Level" vs "rank" terminology split across the two biggest surfaces.** `app/learn/page.js:87/136` ("four levels") vs the app's "five ranks" everywhere (`Landing.jsx:62`, dashboard chips, `RANK_LABELS`). *Nielsen H4.* **Fix:** standardize on "rank"; reconcile the count with the Doctorate decision (P0-9).
- **P1-C2 · Five different verbs for the one primary action.** "Prove it" / "Get started" / "Start free" / "Try it" / "Get my rank" (`Landing.jsx:29/221/397/470/484`). *Conversion / H4.* **Fix:** make "Prove it" canonical for starting the diagnostic; keep "Start free" only on the pricing Free card.
- **P1-C3 · "Withdraw from contract here" — the highest-stakes money button is the least readable.** `Dashboard.jsx:687`. *Trust / content design.* **Fix:** "Cancel & get a refund" (keep precise CRD wording in the dialog body, which is already good).
- **P1-C4 · Diagnostic length/effort + adaptive nature only disclosed in the FAQ.** `Landing.jsx:98` (FAQ "10–15 min") vs intro `Noobtopro.jsx:2027` and `Dashboard.jsx:604` which mis-describe it as fixed "beginner/intermediate/hard" while the live flow shows five adaptive bands (`scoring.js:310`). *First-run completion.* **Fix:** add "9 problems, ~10–15 min, adapts to you" near the hero CTA + intro; drop the "three difficulties" fiction.
- **P1-C5 · Generic, unactionable errors.** `Noobtopro.jsx:1069/1583` fall back to "Something went wrong." / "Grading failed."; `app/error.jsx:29` the same; banner offers only "dismiss" (`:1941`). Practice text is preserved but the banner doesn't say so. *Nielsen H9.* **Fix:** add "Try again" to the banner; state work is preserved; replace bare fallbacks with the specific message already used at `:1053`.
- **P1-C6 · Three diverging "save your progress" prompts.** `Noobtopro.jsx:1759` (modal) vs `:2164` (inline) vs `Dashboard.jsx:554` (gate) — three bodies, three button labels, three value framings. *H4 / trust.* **Fix:** one value sentence + one button label, reused verbatim.
- **P1-C7 · OAuth-only sign-in with no email fallback and generic failure handling.** `SignIn.jsx:31-67`; failure → generic banner (`Noobtopro.jsx:1962`). Popup-blocked or no Google/GitHub/Discord = hard conversion block. *Nielsen H3/H9.* **Fix:** detect popup-blocked/OAuth errors with specific guidance; consider an email magic-link.
- **P1-C8 · AgeGate tone too casual for a legal 18+ gate.** `AgeGate.jsx:89` "One quick thing" never states the 18+ rule until rejection. *Trust / legal clarity.* **Fix:** "Confirm you're 18 or older" + state the requirement and data use up front.

---

# P2 — Polish

### Design-system consistency (token discipline)
- **P2-D1 · ~70 token bypasses (inline raw values).** ~22 hardcoded `fontSize` literals (`Dashboard.jsx:144/150/184`, `Noobtopro.jsx:312/365/368/2358/2369`, `ReviewList.jsx:76`, all `app/learn/*` SEO pages), ~30 off-scale `gap/margin/padding/width` literals, ~8 raw radius literals (`borderRadius:8/10/12` = exact `--radius-*` matches). The `--fs-*`/`--space-*`/`--radius-*` tokens exist for exactly this. **Fix:** snap to tokens; introduce a section-spacing token (36/40/44 drift).
- **P2-D2 · Subject accent used as page chrome on the concept page `<h1>`.** `LearnTab.jsx:430` `style={{ color }}` paints the heading gold/teal/rust — the loudest greyscale-policy break. **Fix:** drop the inline color (the `SubjectGlyph` already supplies the sanctioned subject cue).
- **P2-D3 · Dead `np-btn--subject` / `--subject` hook.** `LearnTab.jsx:521`, `Noobtopro.jsx:2255` set a `--subject` custom prop that nothing reads (`.np-btn--subject` only recolors `svg`). **Fix:** remove the dead modifier + inline var.
- **P2-D4 · Brand-signature gap: ad-hoc mono numbers omit `tabular-nums`.** `Dashboard.jsx:184/314`, `ReviewList.jsx:66` re-declare mono+700 inline without `font-variant-numeric: tabular-nums` — so several headline stats are NOT tabular. **Fix:** a shared mono-number class.
- **P2-D5 · `.np-input` (textarea recipe) reused for the Learn search input.** `LearnTab.jsx:283`. **Fix:** use `.np-field`/`.np-hub-search`.
- **P2-D6 · ScoreBreakdown bars default to a subject accent (`--math`) decoratively.** `ScoreBreakdown.jsx:77`. **Fix:** default to `--text`/`--line-strong`.
- **P2-D7 · `np-cardicon` colored ad-hoc (subject/danger/phys/math) at every call site.** **Fix:** add `.np-cardicon--danger/--good/--improve` modifiers (mirror `.np-eyebrow--*`).
- **P2-D8 · `np-h1` vs `np-h2` chosen inconsistently for equivalent page heads.** (Harmless today — recipes are aliased — but signals no convention.) **Fix:** standardize in-app page heads on `.np-h1`.
- **P2-D9 · OG/manifest hex `#0e0e12` drifts from `--panel #0a0a0a`.** `lib/ogImage.jsx`. (Satori can't read CSS vars, but the frozen value should mirror the token.) **Fix:** align to `#0a0a0a`.
- **P2-D10 · LegalLayout re-implements `.np-card`/`.np-fineprint` inline** (`LegalLayout.jsx:37-50`). **Fix:** use the primitives + `--radius-card`/`--fs-sm`.
- **P2-D11 · `Loader` heading is a bespoke `fontSize:22` display line** (`Noobtopro.jsx:368`). **Fix:** use `.np-emptytitle`/`--fs-title`.

### Usability
- **P2-U1 · Practice "I don't know" submits a scored dock with no confirm** (`Noobtopro.jsx:1597`). **Fix:** confirm or clearly mark it as a graded dock.
- **P2-U2 · Hash routing uses `replaceState` → browser Back exits the app instead of switching tabs** (`Noobtopro.jsx:585-593`; no `popstate` handler). **Fix:** `pushState` + a `popstate` listener.
- **P2-U3 · `checkoutDone` banner can read "activating…" forever** if the webhook misses the 5×1.5s poll (`Noobtopro.jsx:810-817`). **Fix:** after polling, offer manual refresh / support.
- **P2-U4 · AgeGate mistyped-DOB has no recovery** (blocked screen only offers "Back to home"; signed-in users get signed out) (`AgeGate.jsx:64-82`). **Fix:** "Re-enter date of birth" before any destructive action.
- **P2-U5 · Trends/Reviews drawer errors are dead-ends (no retry)** unlike the practice retry card (`Dashboard.jsx:370`, `ReviewList.jsx:51`). **Fix:** add retry buttons; standardize empty/error components.
- **P2-U6 · No upload-progress on photo attach** (`prepareImage`); large photos appear to freeze. **Fix:** "Processing photo…" state.
- **P2-U7 · `app/error.jsx:30` "Your saved progress is safe" is false for an unsaved guest mid-diagnostic.** **Fix:** soften to "previously saved progress".
- **P2-U8 · Three disclosure patterns** for the same affordance (native `<details>` vs custom `aria-expanded` buttons) — `ScoreBreakdown`/`ReviewList` vs `Landing` FAQ vs `LearnTab` rank heads. **Fix:** pick one.
- **P2-U9 · Empty Learn search doesn't reveal that an active status filter is also constraining results** (`LearnTab.jsx:316`). **Fix:** "No matches for 'X' in [filter] — clear the filter?"
- **P2-U10 · Disabled Submit gives no reason** (`AnswerComposer:343`). **Fix:** helper text "Add your reasoning or a photo to submit".

### Accessibility (minor / pattern)
- **P2-A6 · `role="tab"`/`tablist` on the Learn subject switcher with no `tabpanel`/arrow-key roving** (`LearnTab.jsx:267-280`). **Fix:** complete the pattern or use `radiogroup`/`aria-pressed`.
- **P2-A7 · Theme switcher `radiogroup` has no arrow-key navigation** (`ThemeToggle.jsx:71-87`). **Fix:** roving tabindex + arrow keys, or `aria-pressed` toggle buttons.
- **P2-A8 · Live-score region announces on background mastery-load, not just on a grade** (`Noobtopro.jsx:2312-2327`). *WCAG 4.1.3 over-announcement.* **Fix:** gate announcements on `scoreDelta !== null`.
- **P2-A9 · Guest dashboard gate uses `role="dialog"` for inline (non-modal) content** (`Dashboard.jsx:551`). **Fix:** use a labeled `<section>`.
- **P2-A10 · FAQ `aria-controls` points to a conditionally-rendered (absent) region** (`Landing.jsx:452`). **Fix:** always render the region (CSS-hide) or drop `aria-controls` when collapsed.
- **P2-A11 · Theme buttons 30×30px with 2px spacing** (`globals.css:439`) — passes WCAG 24px but below Apple/Material ergonomic targets and tight. **Fix:** 36–40px on touch.

### UX-writing / content
- **P2-C9 · Engineer jargon at first contact** — "Glicko-2", "HMAC-signed step chain", "nine reasoning axes" with no gloss (`Landing.jsx:42/45/316`). **Fix:** one-line plain-language glosses.
- **P2-C10 · "Doctorate index" KPI undefined** (`Dashboard.jsx:144`). **Fix:** add a `title`/definition or rename "Overall rank score".
- **P2-C11 · i18n gaps for an EU/German product** — hardcoded "€", `locale:"en_US"` (`layout.js:48`), `toLocaleString()` vs raw ISO for the same withdrawal timestamp on-screen vs durable record. **Fix:** `Intl.*` with explicit locale; one date format per concept.
- **P2-C12 · "~5 graded practice / day" tilde on a concrete quota** (`Landing.jsx:77`). **Fix:** state the exact cap ("up to 5").
- **P2-C13 · Photo-grading scope under-disclosed** — card says "Free on your diagnostic", FAQ clarifies "once" (`Landing.jsx:47` vs `:150`). **Fix:** "One free photo-of-work grade on your diagnostic."
- **P2-C14 · Loader microcopy mismatches the operation** — "EVALUATING ALL THREE" is cryptic; chunk-load uses grading lines (`Noobtopro.jsx:357/2150/2156`). **Fix:** per-context eyebrow + lines; neutral "Loading…" for chunk loads.
- **P2-C15 · Final diagnostic step silently swaps "Next question"→"Get ranked"** with no signal of the consequence (`Noobtopro.jsx:2116`). **Fix:** "Last one — submit to see your ranks."

### Dark-theme trade-off (informed deviation — not a defect)
- **P2-X1 · True-black `#000` base + hairline-only elevation.** The design system deliberately uses `--bg #000000` and off-white `--text #ededed` (already not pure white — good for halation). Material guidance prefers ~`#121212` + tint-overlay elevation; noobtopro's instrument-like greyscale is a conscious brand choice. **Recommendation (not a fix):** validate the faintest greys and the empty progress pip (`--tint-2 #141414` ≈ 1.14:1 on black) for sighted clarity, and confirm elevation reads on OLED. *(See Appendix A §6.)*

---

# Recommended remediation roadmap

**Phase 1 — Conformance & flow resilience (P0):** P0-7 (contrast → `-text` tokens, ~1 CSS pass), P0-8 (consent equal-weight + inert/focus-trap), P0-1/2/3/4/5/6 (diagnostic resilience: per-step status, 402 handling, submit lock, navigation-confirm, migration retry, fetch timeout), P0-9 (Doctorate claim).
**Phase 2 — High-impact UX & perf (P1):** icon `aria-hidden`, overflow-wrap + composer/dash-action reflow, modal scroll, sticky-nav `scroll-padding-top`, CLS (avatar dims, lazy-chunk min-height, font fallback), then the INP monolith split (largest effort — schedule deliberately).
**Phase 3 — Consistency & content (P2):** token-bypass sweep, terminology unification (rank/level, CTA verbs), microcopy fixes, disclosure-pattern unification.

Each P0/P1 above is independently shippable. The two largest efforts are the **monolith split (P1-P1)** and the **token-bypass sweep (P2-D1)** — recommend dedicated PRs.

---

# Appendix A — Standards backbone (cited)

Authoritative thresholds used to grade every finding. Full citations and a 38-item master checklist are reproduced from the deep-research pass.

- **WCAG 2.2 AA** (W3C Rec, 2023-10-05; 4.1.1 Parsing removed). Key SCs: 1.4.3 contrast **4.5:1 / 3:1**; 1.4.10 reflow **320px / 400%**; 1.4.11 non-text **3:1**; 1.4.12 text-spacing (1.5×/2×/0.12×/0.16×); 2.4.7 focus visible; **2.4.11 focus not obscured (new)**; **2.5.8 target size ≥24px (new)**; 3.3.4 error prevention; **3.3.7 redundant entry (new)**; **3.3.8 accessible auth (new)**; 4.1.2 name/role/value; 4.1.3 status messages. — w3.org/WAI/WCAG22.
- **Core Web Vitals (p75):** LCP **≤2.5s**, CLS **≤0.1**, **INP ≤200ms** (INP replaced FID 2024-03-12). Drivers: long tasks >50ms (INP), undimensioned media/font swap (CLS). — web.dev.
- **Nielsen's 10 heuristics** — nngroup.com/articles/ten-usability-heuristics.
- **Touch targets:** Apple HIG **44pt**, Material 3 **48dp** (≥8dp spacing), WCAG **24px** floor.
- **Forms:** validate on blur; error summary + inline; never placeholder-as-label; correct `type`/`inputmode`/`autocomplete` (WCAG 1.3.5). — GOV.UK Design System, web.dev, NN/g.
- **Dark theme:** avoid pure-black/pure-white (halation); body text ≥4.5:1; elevation via lighter tint overlay; desaturate accents. — Material, Apple HIG.
- **States:** feedback >1s, determinate progress >10s; skeletons for content loads; `aria-live` for async; empty states teach + CTA; errors human/recoverable. — NN/g, web.dev.
- **EU consent:** Reject equal prominence on first layer; no pre-ticked boxes (*Planet49* C-673/17); withdrawal as easy as giving; opt-in only; no deceptive design. — GDPR Art. 4/7, EDPB Cookie-Banner Taskforce & Guidelines 03/2022.
- **Motion:** honor `prefers-reduced-motion` (CSS + JS); no flashing >3×/s; auto-motion >5s needs pause/stop/hide. — WCAG 2.2.2/2.3.1/2.3.3, MDN.
- **Microcopy:** plain/concise; one term per concept; verb+noun button labels; actionable errors; sentence case. — Shopify Polaris, Material 3, NN/g.

# Appendix B — Verified clean (re-checked, no action)

- Brand name is correctly lowercase in all user-facing copy; capitalized only in code/imports. No emoji in user-facing copy (▲/▼/■ are deliberate non-color valence cues per WCAG 1.4.1; check/arrow/etc. are SVG `Icon`s, not emoji).
- WCAG 3.3.8 (accessible auth) **passes** — OAuth-only, no cognitive test; the age gate is a date field, not a CAPTCHA. 3.3.7 (redundant entry) passes.
- `prefers-reduced-motion` is comprehensive — the global kill-switch neutralizes the infinite `.np-pulse` and the inline Ring transition.
- The hero glow was correctly made static (prior INP fix holds); `useScrollReveal` uses one IntersectionObserver with `unobserve` (no leak); `useScrolled` is ref-guarded to 2 transitions.
- `.np-input`/`.np-hub-search`/`.np-field` are all 16px (no iOS zoom-on-focus). Content caps at 1080px with `ch`-bounded line lengths (no 4K runaway).
- Refund/withdrawal legal copy is thorough, accurate, and consumer-favorable; pricing is tax-inclusive and disclosed before pay.

# Appendix C — Method & agent roster

Seven adversarial agents (file:line-grounded, read-only): (1) Accessibility/WCAG 2.2, (2) Responsive/cross-device, (3) Design-system consistency, (4) Usability heuristics/states, (5) Front-end performance/CWV, (6) UX-writing/IA/flows, (7) Deep-research standards (web-sourced, primary-citation-verified, incl. a sub-agent for forms/dark-theme/states). Findings were deduplicated and re-severitized against the Appendix A backbone.
