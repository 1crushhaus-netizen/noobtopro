# noobtopro — Feature Plan: Auth-Gated Diagnostic, Sign-In Menu & Profile Tab

**Status: DRAFT FOR REVIEW.** Nothing is built yet. Read it, tweak the decisions in §11, then say "go" and I'll implement (P1 first).

---

## 1. Goals

- **A. Gate the diagnostic behind sign-in.** Clicking **Begin diagnostic** on the landing page takes the user to a **sign-in menu** (not straight into a Google popup). They must sign in before the diagnostic starts.
- **B. Sign-in menu with multiple OAuth providers:**
  - **Google** — live (already configured).
  - **GitHub** — placeholder button ("Coming soon", disabled) until the provider is wired.
  - **Discord** — placeholder button ("Coming soon", disabled) until the provider is wired.
- **C. Profile tab** — signed-in users see their identity + stats, with a graceful empty state for those who haven't taken the diagnostic yet.

## 2. Guiding principle — OAuth-only, no stored credentials

**We never collect or store passwords, and we don't run a manual email/password sign-up.** Identity is delegated entirely to OAuth providers (Google / GitHub / Discord) through Supabase Auth. Supabase holds the session and the minimal profile the provider returns; we store only per-user **scores** and **attempts**, scoped by row-level security. This keeps credential handling and PII responsibility off of us by design — so **there is intentionally no "sign in with email/password" option** anywhere in the UI.

## 3. Architectural consequence (read this)

Today the app runs fully as a **guest** (localStorage): `beginDiagnostic()` (`components/Noobtopro.jsx:276`) has no auth check, and the tab bar only appears once `scores` exist. Gating the diagnostic means the **core loop now requires auth** — with no way to start without signing in, guest mode effectively disappears for new users. This forces a few decisions about the existing guest data layer in `lib/store.js` (see §11).

## 4. Current state (what we build on)

| Piece | Where | Today |
|---|---|---|
| Stages | `stage` | intro → diagnostic → scoring → dashboard → practice |
| Tabs | `view` = "learn" \| "progress" | tab bar rendered only when `scores` exist (`Noobtopro.jsx:493–496`) |
| Auth helpers | `lib/supabase.js` | `signInWithGoogle`, `signOutUser`, `getSupabase`, `isSupabaseConfigured` |
| Auth state | `Noobtopro.jsx:194,242–245` | `user` from `getUser()` + `onAuthStateChange` |
| Diagnostic start | `beginDiagnostic()` (276), button (551) | open to anyone, no gate |
| Stats UI | `components/ProgressDashboard.jsx` | PhD index, total points, problems graded, charts, by-subject — **reusable** |
| "Completed diagnostic?" | derivable | `Boolean(scores)` (null until graded) and/or a `type:"baseline"` row in `history` |
| Identity fields | the `user` object | `user.email`, `user.user_metadata.{full_name,avatar_url}`, `user.created_at` |

## 5. UX flows

### 5.1 Guest-first diagnostic, then prompt to save (IMPLEMENTED P1)

> **Decision (final):** rather than gating *before* the diagnostic, anyone can take it as a **guest**; on completion we prompt them to sign in to save. This is the friendlier "try, then convert" flow.

- **Begin diagnostic** runs immediately for everyone — no login required to start.
- On reaching the **dashboard** as a guest, a **"Sign in to save your progress"** card appears → opens the **Sign-in menu** (`stage: "signin"`).
- After sign-in, the guest's localStorage scores/attempts **migrate into the account** (`migrateGuestToAccount()`), into an empty account only, preserving the original attempt timeline.
- The Sign-in menu is also reachable from the header **Sign in** button.

### 5.2 The Sign-in menu (`stage: "signin"` → `components/SignIn.jsx`)

A focused screen with one button per provider and a short trust line ("We never see your password — sign-in is handled by your provider"):

| Provider | State | Action |
|---|---|---|
| **Continue with Google** | **Enabled** | `signInWithGoogle()` → Supabase OAuth → redirect back |
| **Continue with GitHub** | **Disabled** — "Coming soon" badge | placeholder; wired in a later phase (§7) |
| **Continue with Discord** | **Disabled** — "Coming soon" badge | placeholder; wired in a later phase (§7) |

- A **Back** affordance returns to intro.
- **No email/password field** — by design (§2).
- **Post-redirect intent:** `signInWithOAuth` does a full-page redirect, so React state (including `stage: "signin"`) is lost on return. To auto-resume into the diagnostic after Google sign-in, persist intent before redirecting — `sessionStorage["noobtopro:pendingDiagnostic"] = "1"` — and on mount, if `user` is present, no `scores`, and the flag is set, clear it and auto-run `beginDiagnostic()`. (P1 can skip auto-resume and just land on an enabled intro; see Decision #3.)

### 5.3 Profile tab

- New **Profile** tab beside Learn/Progress. **Tab-bar visibility changes** from "`scores` exist" to "**`user || scores`**", so a freshly-signed-in user who hasn't tested yet still gets Profile.
- **Contents:**
  - **Identity card** — avatar, name, email, "member since" (all from `user`), and **Sign out**.
  - **Diagnostic status:**
    - *Not completed* → empty state: "You haven't taken the diagnostic yet" + a **Begin diagnostic** CTA.
    - *Completed* → stats summary (PhD index, total points, per-subject bands, problems graded, last active) — reuse `lib/scoring.js`; optionally embed a condensed `ProgressDashboard` or link to the Progress tab.
  - **Account actions** — Sign out; **Reset my progress** (a real Supabase delete); *(P2)* Export my data (JSON).
- **Not signed in** → Profile tab hidden.

## 6. Implementation (file-by-file)

1. **`lib/supabase.js`**
   - Generalise to `signInWithProvider(provider)` (google/github/discord) using `signInWithOAuth({ provider, options:{ redirectTo: window.location.origin } })`; keep `signInWithGoogle` as a thin wrapper.
   - Export `PROVIDERS` metadata: `{ id, label, enabled }` so the UI renders buttons declaratively and flips GitHub/Discord on by changing one flag once configured.
2. **`components/SignIn.jsx`** *(new)* — renders the provider buttons from `PROVIDERS` (enabled → live, disabled → "Coming soon"), the trust line, and a Back button. Provider glyphs added to the inline `Icon` set (google exists; add github, discord).
3. **`components/ProfileTab.jsx`** *(new)* — identity card + diagnostic-status (empty vs stats) + account actions. Presentational; takes `user, scores, history` + callbacks.
4. **`lib/store.js`** — add `deleteAllUserData()` (signed-in: delete from `scores` + `attempts` where `user_id = uid`, with the same `{ error }` checks added in the round-3 hardening; guest: clear local). *(Today's `resetAll()` only clears localStorage — Profile's "Reset" needs a true delete.)*
5. **`components/Noobtopro.jsx`**
   - Gate: if `isSupabaseConfigured && !user`, **Begin diagnostic** sets `stage = "signin"` (instead of generating). If `!isSupabaseConfigured`, fall back to current behaviour (Decision #4).
   - Render the sign-in screen when `stage === "signin"`.
   - `view` adds `"profile"`; tab bar renders on `user || scores`; add the Profile tab and render `<ProfileTab/>`.
   - On `SIGNED_OUT`, if `view === "profile"`, reset to `"learn"`.
   - *(Optional)* set/read the `sessionStorage` pending-diagnostic flag for auto-resume (§5.2).
6. **`app/globals.css`** — `np-`-style classes for the sign-in buttons and the profile card (reuse existing tokens).
7. **Tests** — `deleteAllUserData` (mock Supabase); gating logic (when `!user`, Begin diagnostic opens the sign-in menu and does **not** call `/api/generate`); `SignIn` renders Google enabled + GitHub/Discord disabled; `ProfileTab` renders its three states.

## 7. Adding GitHub & Discord later (turning the placeholders on)

Each is the same shape as the Google setup — create an OAuth app at the provider, point its callback at Supabase, enable the provider in Supabase, then flip `enabled: true` in `PROVIDERS`. The Supabase callback is stable: `https://vwvhgnlgubctrgksyohr.supabase.co/auth/v1/callback`.

- **GitHub:** GitHub → Settings → Developer settings → **OAuth Apps → New** → Authorization callback URL = the Supabase callback → copy Client ID/Secret → Supabase → Auth → Providers → **GitHub** → enable + paste.
- **Discord:** Discord Developer Portal → **New Application** → OAuth2 → add the Supabase callback as a redirect → copy Client ID/Secret → Supabase → Auth → Providers → **Discord** → enable + paste.
- Same redirect allow-list as Google (Supabase → Auth → URL Configuration) already covers them.

Until then the buttons stay disabled with a "Coming soon" badge — no dead ends.

## 8. Optional: enforce the gate server-side

The sign-in menu is a **UX** gate; `/api/generate` and `/api/grade` can still be called directly. If you want real enforcement, have the client send the Supabase access token (`Authorization: Bearer …`) and verify it in the route (`supabase.auth.getUser(token)` → 401 if invalid). More work; the routes are already rate-limited and data is RLS-scoped, so this is optional (Decision #5).

## 9. Testing & verification

`npm test` + build locally → PR (CI **Test and build** gate + Greptile) → merge → Vercel deploy → verify on the live URL: signed-out **Begin diagnostic** opens the sign-in menu; Google completes and starts the diagnostic; GitHub/Discord show "Coming soon"; Profile shows the right status; Reset clears data.

## 10. Rollout / phases

- **P1** — Sign-in menu (Google live, GitHub/Discord placeholders) + diagnostic gate + minimal Profile (identity, status, stats summary, sign out). Ship & verify.
- **P2** — Reset/delete data, Export, guest→account migration, optional auto-resume after sign-in, and (when you're ready) enabling GitHub + Discord.

## 11. Decisions (defaults shown; change any before I code)

| # | Decision | Default |
|---|---|---|
| 1 | **Guest mode** | ✅ **Decided:** keep it — diagnostic runs in guest mode, then we prompt to sign in to save (§5.1) |
| 2 | **Existing guest progress** on first sign-in | ✅ **Decided & implemented:** `migrateGuestToAccount()` folds guest scores/attempts into an empty account on sign-in |
| 3 | **After sign-in** | Land on the dashboard with migrated data; full-page OAuth redirect resets state (auto-resume via sessionStorage deferred to P2) |
| 4 | **If Supabase isn't configured** (dev/local) | Fall back to today's open behaviour rather than blocking |
| 5 | **Enforcement** | Client-side gate only for now; add the server JWT check later if abuse appears |
| 6 | **No manual email/password auth** | **Fixed by you** — OAuth-only, never store credentials (§2) |
