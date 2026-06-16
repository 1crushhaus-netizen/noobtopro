# Audit 07 — Frontend / React / Performance

**Scope:** React correctness, performance, hydration, broken UX states, XSS, localStorage robustness across the client surface (`components/*`, `app/page.js`, `app/layout.js`, `app/error.jsx`, `lib/store.js`). Accessibility is out of scope (separate agent).

**Verdict:** This is an unusually *careful* React codebase. Many of the obvious traps an auditor hunts for have already been closed, and the inline comments document the reasoning (run-token guards `diagRun`/`practiceRun`/`hydrateRun`, blob-URL revocation, abort/ignore flags on async effects, dynamic-import code-splitting of Dashboard/Learn/Admin, guide chunks split per cell, sanitized localStorage reads, `try/catch` around every storage access, error boundary present). I did **not** find a launch-blocking crash, an infinite render loop, an XSS sink, or an unguarded localStorage throw. The findings below are real but skew toward P1/P2: perf inefficiencies, a few state/race edges, large-component maintainability, and minor broken-state gaps.

Two suspected issues from the mandate were **investigated and cleared** (documented at the bottom so they aren't re-raised): mathjs is **not** shipped to the browser, and there is **no** `dangerouslySetInnerHTML` rendering of LLM/user content.

## Summary table

| ID | Sev | Title | File |
|----|-----|-------|------|
| P1-1 | P1 | `Noobtopro` is a 1878-line monolith holding ~40 state slices; every keystroke re-renders the whole shell | components/Noobtopro.jsx |
| P1-2 | P1 | Mastery is fetched twice on the same session (Dashboard + LearnTab), each an uncached network round-trip | components/Dashboard.jsx:345, components/LearnTab.jsx:34 |
| P1-3 | P1 | Practice livescore reads `scores[pSubject]` while `scores` can be `null` (partial-baseline path) — reachable crash to error boundary | components/Noobtopro.jsx:1745 |
| P1-4 | P1 | Diagnostic waiting state can deadlock silently if `submitDiagStep` returns a malformed-but-2xx payload with no `next`/`finalToken` after the last step | components/Noobtopro.jsx:892-919 |
| P1-5 | P1 | `window.confirm` / `window.alert`-style blocking dialog in `beginDiagnostic` blocks the main thread and is unstyled/uncontainable | components/Noobtopro.jsx:789 |
| P2-1 | P2 | Index-based `key` props across multiple dynamic lists | multiple |
| P2-2 | P2 | `Landing` (496 lines of static marketing) is a Client Component; almost none of it needs interactivity | components/Landing.jsx:1 |
| P2-3 | P2 | Expensive per-render recomputation in Dashboard/LearnTab not memoized (radar subjects, search results, curriculum maps) | components/Dashboard.jsx, components/LearnTab.jsx |
| P2-4 | P2 | `new Date().getFullYear()` called during render in two components (footer) — non-deterministic in render, theoretical hydration edge | components/Noobtopro.jsx:1871, components/Landing.jsx:490 |
| P2-5 | P2 | Practice generation failure leaves an empty practice body with no retry affordance | components/Noobtopro.jsx:1724-1734 |
| P2-6 | P2 | `useScrolled` scroll listener calls `setState` on every scroll event (no throttle/equality guard beyond boolean) — re-renders TopNav-bearing tree | components/useReveal.js:52 |
| P2-7 | P2 | `loadLeaderboard`/`loadReviews`/`loadMastery` injected as props but only `loadLeaderboard` is module-stable; effects re-run on identity churn | components/Noobtopro.jsx:182, components/Dashboard.jsx |
| P2-8 | P2 | `Icon` is a long `if/return` chain re-evaluated on every icon render; no memo, instantiated very frequently | components/Icon.jsx |
| P2-9 | P2 | FAQ JSON-LD (`JSON.stringify` + regex replace over ~3KB) recomputed on every Landing render | components/Landing.jsx:199 |
| P2-10 | P2 | Footer/`<script type="application/ld+json">` rendered inside a Client Component instead of server metadata | components/Landing.jsx:211 |

---

## P1 findings

### [P1-1] `Noobtopro` is a 1878-line client monolith; the entire app shell re-renders on every keystroke
- **File(s):** components/Noobtopro.jsx:343-1878 (component body), :265-272 (the controlled textarea), :372-428 (state cluster)
- **Category:** Performance / re-render storms / maintainability
- **Description:** `Noobtopro` is a single `"use client"` component holding ~40 `useState`/`useRef` slices and the *entire* state machine (intro/signin/diagnostic/scoring/dashboard/practice), the diagnostic flow, the practice flow, all the modals, the upgrade flow, and the render tree. The answer textarea is controlled by component-level state: diagnostic answers flow through `setAnswers((a) => ({ ...a, [curKey]: { ...a[curKey], text: t } }))` (`setCurText`, :837) and practice through `setPText` (:381). Every character typed re-renders the *whole* 1878-line tree — including `TopNav`, the footer (`new Date()`), all the sibling stage branches' closures, and `AnswerComposer`. `AnswerComposer` is not wrapped in `React.memo`, and its props include freshly-created arrows (`onSubmit`, `onSkip`, `onText`) each render, so memoization wouldn't help without also stabilizing those.
- **Impact:** Measurable typing jank / poor INP on lower-end mobile (the launch's primary device for photo-of-work), proportional to the size of the tree re-rendered per keystroke. Also a maintainability/correctness risk: this much state in one closure is exactly where the stale-closure and run-token bugs (already heavily commented) breed.
- **Recommended fix:** Extract the diagnostic flow, practice flow, and each modal into their own components so a keystroke only re-renders the composer subtree. Move the controlled textarea + its local edit state into `AnswerComposer` (lift the value up only on submit/blur, or debounce), and wrap leaf presentational components (`AnswerComposer`, `Ring`, `Loader`) in `React.memo` with stabilized (`useCallback`) handlers. At minimum, memoize the footer year and the stage-branch closures.

### [P1-2] Per-concept mastery is fetched twice per session, each uncached
- **File(s):** components/Dashboard.jsx:345-356, components/LearnTab.jsx:34-44; both call `loadMastery()` → `lib/store.js:196` (a fresh `concept_mastery` PostgREST `select *`)
- **Category:** Performance / redundant network
- **Description:** `loadMastery()` has no caching layer. The Dashboard's `BySubject` breadth-gate fetches the whole mastery map on mount (Dashboard.jsx:348), and `LearnTab` independently fetches the *same* map on its own mount (LearnTab.jsx:36). A user who visits Dashboard then Learn (the expected flow — "Learn this" chips route from the dashboard) pays for two full `select *` round-trips of every `concept_mastery` row for the user. There is no shared store/context; each tab re-fetches from scratch on every mount/unmount cycle (switching tabs unmounts the previous one).
- **Impact:** Doubled (and on repeated tab-switching, N-times) load on Supabase and added latency before chips/gates color in. On a launch with traffic, this is wasted DB capacity and visible "uncolored then colored" flashes.
- **Recommended fix:** Lift mastery into `Noobtopro` (or a small context/SWR-style cache keyed by user id) and pass it to both `Dashboard` and `LearnTab` as a prop, refetched only when it actually changes (after a graded attempt). The same applies less severely to `loadReviews` (drawer-scoped, acceptable) — mastery is the one fetched by two always-rendered surfaces.

### [P1-3] Practice livescore reads `scores[pSubject]` while `scores` can be `null` — reachable crash to the error boundary
- **File(s):** components/Noobtopro.jsx:1745 (`{scores[pSubject]?.score ?? 0}`); reached from the practice stage render at :1724
- **Category:** React correctness / broken state (crash)
- **Description:** **Confirmed reachable, not speculative.** The optional chain here guards the *property*, not the base object: `scores[pSubject]?.score` parses as `(scores[pSubject])?.score`. If `scores` is `null`, the inner index `scores[pSubject]` throws `TypeError: Cannot read properties of null` *before* the `?.` runs. The practice stage renders whenever `pQuestion` is truthy (:1736). `startPractice` (:996) sets `pQuestion` and explicitly tolerates a missing subject (`scores?.[subject] || { score: 0, … }`, :1012) — i.e. it is *designed* to run when `scores` is `null`/partial (the documented partial-baseline path where one subject's diagnostic grades all failed, comments at :1012 and :1151). In that state, entering practice and reaching the livescore line throws. The submit path is hardened (`scores?.[pSubject]`, :1151), but the *render* is not. By contrast the dashboard reads (`scores[k] || {…}`, :1679; `scores[k]?.score`, Dashboard.jsx) are reached only under a `stage === "dashboard" && scores` / non-null guard, so they're safe.
- **Impact:** A learner with a partial baseline who taps "Practice" on the un-baselined subject white-screens into `app/error.jsx` mid-flow. This is exactly the edge the surrounding code went to lengths to support, so it's a real (if narrow) crash, not a hypothetical.
- **Recommended fix:** Default `scores` to `{}` at the top of render (`const sc = scores || {}`) and read the livescore through `sc[pSubject]?.score ?? 0`, or guard the practice block with `scores &&`. Also sweep the render for any other `scores[...]`/`feedback.*` read that assumes a non-null base.

### [P1-4] Diagnostic can hang on the waiting card with no recovery if a step grade returns an unexpected 2xx shape
- **File(s):** components/Noobtopro.jsx:870-919 (`nextDiagnostic` / `submitDiagStep`), :1642-1653 (waiting/retry render)
- **Category:** React correctness / broken state / race
- **Description:** After answering the last queued question, `setQi(qi+1)` advances past `questions.length`, so `curQ` becomes `null` and the **waiting card** renders (a `Loader`). The flow only un-blocks when `submitDiagStep` either appends `data.next` (`setQuestions((qs) => [...qs, data.next])`, :907) or records a `finalToken` and calls `finalizeDiagnostic` (:908-910). The `else` branch throws `"Unexpected placement response"` (:912), which is caught and surfaced via `diagError` + a "Try again" button (good). **However**, the retry (`retryDiagnostic`, :923) re-submits the *failed* payloads from `diagFailed.current`. If the server keeps returning the same malformed 2xx body, the retry loops back to the same throw — the user is stuck on the waiting card with only a "Try again" that can't succeed, and there is no "Restart" affordance on that card (the brand-logo Restart is in TopNav, not obvious here). There is also a subtle **race**: the "Get ranked" submit label (:1628) is computed from `Object.values(diagAnswered).reduce(...)`, but `diagAnswered` is bumped optimistically in `nextDiagnostic` (:873) *before* the grade lands; the actual finalize is gated on `diagFinal` (server tokens), so the label and the real completion can disagree across the adaptive ±1 walk where `stepsTotal` per subject may vary.
- **Impact:** A class of server hiccup (valid HTTP 200, unexpected JSON) leaves a learner permanently on a spinner/"Try again" with no forward path, mid-diagnostic — a conversion-killer at launch.
- **Recommended fix:** On the waiting/error card, add an explicit "Restart diagnostic" (calls `beginDiagnostic`/`reset`) alongside "Try again", and cap retries before surfacing a hard-fail with restart. Decouple the "Get ranked" label from optimistic `diagAnswered` — derive it from `questions.length`/served-vs-answered counts.

### [P1-5] Blocking `window.confirm` in the re-baseline path
- **File(s):** components/Noobtopro.jsx:789-794
- **Category:** Performance (main-thread block) / UX consistency
- **Description:** `beginDiagnostic` gates a signed-in re-baseline behind `window.confirm(...)`. This is a synchronous, main-thread-blocking native dialog — inconsistent with the app's own custom modal pattern used everywhere else (the "Reset my progress" flow was *specifically* migrated off `window.confirm` to a styled `confirmReset` dialog, see Dashboard.jsx:333/560 and its comment). The AdminDashboard also still uses `window.confirm` for guide deletion (AdminDashboard.jsx:122).
- **Impact:** Janky, unbranded, blocks paint/interaction; on some mobile webviews native `confirm` is suppressed entirely, which would make the re-baseline either silently proceed or silently no-op depending on the suppressed return value (`confirm` returns `false` when blocked → re-baseline silently cancelled, confusing the user).
- **Recommended fix:** Replace with the existing styled-modal pattern (`confirmReset`-style) so the confirmation is reliable and on-brand. Same for AdminDashboard's delete confirm.

---

## P2 findings

### [P2-1] Index-based `key` props across dynamic lists
- **File(s):** components/Dashboard.jsx:283 (`RecentMoves` `key={i}`); components/ReviewList.jsx:60 (`key={i}`), :94/:100 (`key={j}`); components/ScoreBreakdown.jsx:35 (`key={i}`); components/Noobtopro.jsx:1693 (weakConcepts `key={i}`), :1804/:1812 (strengths/improvements `key={i}`)
- **Category:** React correctness (reconciliation)
- **Description:** Several rendered lists key by array index. These lists are mostly append-only or fully re-derived per render, so the practical bug surface is low, but `RecentMoves` (`.slice(-25).reverse()`) and `ReviewList` reorder/replace contents as new attempts land, where index keys can mis-associate `<details open>` state and animation state across updates.
- **Impact:** Occasional wrong-row expansion/animation after a new attempt; not a data-correctness bug.
- **Recommended fix:** Key by a stable field — for reviews/moves use `t` (timestamp) + subject; for rubric axes use `it.key`/`e.type`+index; for weakConcepts use the concept key string `w`.

### [P2-2] `Landing` is a 496-line Client Component for almost-entirely static content
- **File(s):** components/Landing.jsx:1 (`"use client"`)
- **Category:** Performance (bundle / first-load JS)
- **Description:** The marketing landing is the first thing every visitor downloads, and it's shipped as client JS. Its only true interactivity is the FAQ accordion (`openFaq` state) and the scroll-reveal/nav hooks. The bulk — hero, steps, engine, ranks, subjects, pricing, footer, and the large `FAQ`/`ENGINE`/`STEPS` data arrays — is static markup that could render on the server. It also pulls `TopNav` → `ThemeToggle` and `useScrollReveal`/`useScrolled` into the landing bundle.
- **Impact:** Larger First Load JS on the highest-traffic, conversion-critical page; more to parse/hydrate before the hero is interactive.
- **Recommended fix:** Make `Landing` a Server Component and isolate the interactive bits (FAQ accordion item, scroll-reveal wrapper, nav) into small `"use client"` islands. The hero/sections/pricing then ship as HTML with zero hydration cost.

### [P2-3] Unmemoized per-render recomputation in Dashboard and LearnTab
- **File(s):** components/Dashboard.jsx:210-212 (`rubricSubjects` filter/map every render), :453-456 (`linePoints`/`barItems` history maps every render); components/LearnTab.jsx:226-235 (`searchResults` cross-subject `flatMap` over the *entire* curriculum on every keystroke), :150-159/:164-204 (`currentRankFor` + `UpNext` recompute per render)
- **Category:** Performance (unmemoized expensive renders)
- **Description:** `LearnTab`'s `searchResults` rebuilds a flattened, filtered view of *all 224 concepts across 3 subjects × 5 ranks* on every render — and the search input is controlled, so this runs on **every keystroke** in the search box, alongside `stateFor`/`matchesFilter` calls that each hit `conceptState`. `UpNext` calls `currentRankFor` (a loop over RANKS calling `rankCoverage`) per subject per render. Dashboard's history-derived arrays rebuild each render even when `drawer`/`mastery`/`confirmReset` (the things that actually change) toggle. Only `assumed` (LearnTab.jsx:59) is memoized.
- **Impact:** Search typing in Learn does O(curriculum) work per keystroke; dashboard interactions redo history reduction needlessly. Noticeable on large histories / slower devices.
- **Recommended fix:** `useMemo` `searchResults` on `[q, filter, mastery]`, `UpNext`'s per-subject lists on `[mastery]`, and Dashboard's `linePoints`/`barItems`/`rubricSubjects` on `[history]`/`[scores]`. Debounce the search query.

### [P2-4] `new Date().getFullYear()` invoked during render
- **File(s):** components/Noobtopro.jsx:1871, components/Landing.jsx:490
- **Category:** Hydration / purity
- **Description:** Both footers compute the year during render. `getFullYear()` is effectively stable, so a hydration mismatch only occurs in the pathological case of server and client rendering across a New-Year boundary in different timezones — low risk — but it's an impure call in render and trips the "no Date/random in render" rule.
- **Impact:** Negligible in practice; theoretical hydration warning at year rollover.
- **Recommended fix:** Hoist to a module constant computed once (`const YEAR = new Date().getFullYear()`), or render it from server metadata. **NEEDS VERIFICATION** that no hydration warning appears in production logs.

### [P2-5] Practice generation failure leaves a blank practice body with no retry
- **File(s):** components/Noobtopro.jsx:1724-1734 (practice render), :1038-1043 (`startPractice` catch sets `error`, clears `busy`, leaves `pQuestion` null)
- **Category:** Broken UX state
- **Description:** When `startPractice` fails, it sets the global `error` banner and clears `busy`, but `pQuestion` stays `null`. The practice stage then renders only the "Back to scores" button + pagehead + (no Loader, since `busy` is false) + (no question card, since `pQuestion` is null). The body is empty apart from the top error banner. There is no in-context "Try again" — the user must navigate back and re-enter practice.
- **Impact:** A transient generation failure looks like a half-broken page; extra friction on a core loop.
- **Recommended fix:** In the practice stage, when `!busy && !pQuestion && pSubject`, render an inline error+retry card (`onClick={() => startPractice(pSubject)}`), mirroring the diagnostic waiting card's retry.

### [P2-6] `useScrolled` re-renders on every scroll event
- **File(s):** components/useReveal.js:52-61
- **Category:** Performance (scroll-linked re-render)
- **Description:** `onScroll = () => setScrolled(window.scrollY > threshold)` fires on every scroll frame. React bails out of re-render when the boolean is unchanged, so the storm is bounded to the two transitions across the threshold — but `setState` itself is still called every scroll event (the comparison happens inside React after the call), and `useScrolled` is consumed by `Noobtopro` (:370) and `Landing` (:194), so it sits above large trees. The listener is correctly `{ passive: true }` and cleaned up.
- **Impact:** Minor — calls `setScrolled` on every scroll tick; the bailout prevents most re-renders, but it's avoidable churn on the busiest page.
- **Recommended fix:** Guard with a ref (`if (next !== ref.current) { ref.current = next; setScrolled(next); }`) or rAF-throttle the handler.

### [P2-7] Injected loader props are not all stable; effects re-run on identity churn
- **File(s):** components/Noobtopro.jsx:182 (`loadLeaderboard` module-stable — good, with a comment explaining the prior re-fetch bug), but `loadReviews`/`loadMastery` are imported module functions passed directly (stable), while `onPractice`/`onLearn`/`onReset`/`onSignIn`/`onUpgrade`/`onManageSubscription`/`onClose`/`onOverlayActiveChange` (Dashboard props, :1508-1526) are **inline arrows recreated every Noobtopro render**
- **Category:** Performance (effect/identity churn)
- **Description:** The code already fixed the leaderboard double-fetch by making `loadLeaderboard` module-level (:182 comment). But the Dashboard receives many inline-arrow callbacks; `Dashboard`'s effects that depend on `onOverlayActiveChange` (:362-364) will re-run whenever `Noobtopro` re-renders (which, per P1-1, is on every keystroke anywhere that shares the tree). `onOverlayActiveChange={setOverlayActive}` is actually stable (a setter), but `onClose`, `onPractice`, etc. are not — any future effect/`memo` keyed on them would thrash.
- **Impact:** Currently mostly latent (the one effect on `onOverlayActiveChange` uses a stable setter). Becomes a real re-render multiplier as soon as children memoize on these props.
- **Recommended fix:** Wrap the Dashboard/Landing callback props in `useCallback`, or pass stable references. This is a prerequisite for the P1-1 memoization to pay off.

### [P2-8] `Icon` is an unmemoized linear `if` chain, instantiated very frequently
- **File(s):** components/Icon.jsx:9-42
- **Category:** Performance (micro) / maintainability
- **Description:** `Icon` is rendered dozens of times per screen (every button, chip, nav tab) and each call walks a sequence of up to ~25 `if (name === ...)` string comparisons before returning. It's a plain function component, re-evaluated on every parent render (and parents re-render a lot per P1-1).
- **Impact:** Small absolute cost but multiplied by render frequency and instance count; pure overhead.
- **Recommended fix:** Convert the chain to a lookup map (`const ICONS = { arrow: <path …/>, … }`) and/or wrap `Icon` in `React.memo` (its props `name`/`size` are primitives, so memo is a clean win).

### [P2-9] FAQ JSON-LD rebuilt on every Landing render
- **File(s):** components/Landing.jsx:199-207
- **Category:** Performance (unmemoized work)
- **Description:** `faqLd` does `JSON.stringify` over the full FAQ array plus a regex `.replace` across the ~3KB result on every render of `Landing`. The FAQ data is a module constant — the output never changes.
- **Impact:** Wasted work on every Landing re-render (e.g. each FAQ accordion toggle, each scroll-driven `scrolled` flip via `useScrolled`).
- **Recommended fix:** Compute `faqLd` once at module scope (it depends only on the constant `FAQ`), or `useMemo([])`. Better, emit it from server-side metadata (ties into P2-10).

### [P2-10] Structured-data `<script>` and static SEO content live in a Client Component
- **File(s):** components/Landing.jsx:211 (`<script type="application/ld+json">{faqLd}</script>`)
- **Category:** Performance / SEO correctness
- **Description:** The FAQ JSON-LD (meant for answer engines / crawlers) is injected from a Client Component. It works because it's a plain text child (no `dangerouslySetInnerHTML`, and the content is unicode-escaped — good, no XSS), but structured data ideally ships in the server-rendered HTML head/body without depending on client hydration, and it's recomputed client-side (P2-9).
- **Impact:** Minor; the script is in the SSR output so crawlers see it, but it's coupled to the client bundle unnecessarily.
- **Recommended fix:** Move FAQ structured data into route `metadata`/a server component (ties into making `Landing` server-rendered, P2-2).

---

## Investigated and CLEARED (do not re-raise)

These were explicitly checked against the mandate's hunt list and found to be non-issues:

- **mathjs shipped to browser — FALSE.** `mathjs` (`package.json:21`) is imported **only** by `lib/numericVerify.js:38`, which is imported **only** by `app/api/grade/route.js` and `app/api/score/route.js` (server routes). It never reaches a `"use client"` module, so it is not in the browser bundle.
- **XSS via `dangerouslySetInnerHTML` / raw LLM output — NONE.** The only `dangerouslySetInnerHTML` in the app is the theme-init script in `app/layout.js:64` (a static, author-controlled string, not user/LLM content). All LLM/user content (questions, feedback, worked solutions, rationales, weak concepts, guide text, review answers) is rendered as React children and thus auto-escaped. The Landing JSON-LD is explicitly unicode-escaped and rendered as a text child (Landing.jsx:207).
- **localStorage throw crashing the app — GUARDED.** Every localStorage access is wrapped: `readLocal` (store.js:19-26), `writeLocal` (:59-70), `ThemeToggle` reads/writes (:38, :64), `sessionStorage` for pending-upgrade (Noobtopro.jsx:571, :620). `saveProgress` surfaces a quota/blocked failure as a thrown error the caller banners (store.js:314). No localStorage read happens during render — only inside effects (`hydrate`→`loadState`) — so private-mode/quota won't cause a hydration crash.
- **Async effect races — GUARDED.** Mount/auth hydrate uses a monotonic `hydrateRun` token (Noobtopro.jsx:455-485); diagnostic and practice grading use `diagRun`/`practiceRun` to bail stale writes; `Leaderboard`/`ReviewList`/`LearnTab`/`Dashboard(mastery)` async effects all use a `cancelled`/`alive` flag with cleanup. Blob object-URLs are revoked on replace, removal, sign-out, restart, and diagnostic completion.
- **Code-splitting — PRESENT.** Dashboard/Learn/Admin are `next/dynamic` lazy chunks with loaders (Noobtopro.jsx:34-36); concept guides are statically split one chunk per (subject,rank) cell (lib/guides/index.js:14-44). The leaderboard is a single bounded SVG (not an unvirtualized list); review/moves lists are capped at 50/25.
- **Error boundary — PRESENT.** `app/error.jsx` catches render/runtime errors and offers `reset()`.

## Recommendation priority for launch
1. P1-3 (audit every `scores.*`/`feedback.*` render read for missing `?.` — cheap, prevents a mid-flow white-screen).
2. P1-4 + P2-5 (add restart/retry affordances to the diagnostic-waiting and practice-failure dead-ends).
3. P1-2 (stop double-fetching mastery — quick win, real DB savings at launch traffic).
4. P1-1 + P2-3 (the perf/jank work: extract the composer, memoize the hot recomputations) — biggest INP/typing-jank lever, larger effort.
