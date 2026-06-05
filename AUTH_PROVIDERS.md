# Enabling GitHub & Discord sign-in

The app's sign-in menu is provider-agnostic, so turning on a new OAuth provider
is **all configuration, no app code**. Each provider is three steps:

1. Create an OAuth app at the provider, pointing its callback at Supabase.
2. Paste the Client ID + Secret into Supabase and enable the provider.
3. Set the matching `NEXT_PUBLIC_ENABLE_*` flag in Vercel and redeploy — this
   makes the button appear (until then it shows a disabled "Coming soon", so
   there's never a button that errors on click).

Steps are verified against Supabase's current docs (auth-github / auth-discord).

**Your fixed values**
- **Supabase callback URL** (the providers redirect here): `https://vwvhgnlgubctrgksyohr.supabase.co/auth/v1/callback`
- **Production URL**: `https://noobtopro-umber.vercel.app`
- The **Redirect URLs** allow-list in Supabase (Authentication → URL Configuration) was already set up for Google and covers these too — no change needed.

---

## GitHub

### 1. Register a GitHub OAuth App
1. Go to <https://github.com/settings/developers> → **OAuth Apps** → **New OAuth App** (or `Register a new application`).
2. Fill in:
   - **Application name:** `noobtopro`
   - **Homepage URL:** `https://noobtopro-umber.vercel.app`
   - **Authorization callback URL:** `https://vwvhgnlgubctrgksyohr.supabase.co/auth/v1/callback`  ← the Supabase callback, **not** your Vercel URL
   - **Enable Device Flow:** leave **unchecked**
3. **Register application.**
4. Copy the **Client ID**. Click **Generate a new client secret** → copy the **Client secret** (shown once).

### 2. Enable GitHub in Supabase
1. Supabase Dashboard → **Authentication** → **Sign In / Providers** → expand **GitHub**.
2. Toggle it **on**, paste the **Client ID** and **Client Secret**, **Save**.

### 3. Turn the button on
1. Vercel → `noobtopro` project → **Settings → Environment Variables** → add **at the project level** (the same place the Supabase vars live):
   - `NEXT_PUBLIC_ENABLE_GITHUB` = `true`  (Production + Preview + Development)
2. **Redeploy** (env changes apply to new builds). The **Continue with GitHub** button now goes live.

---

## Discord

### 1. Create a Discord Application
1. Log in at <https://discord.com>, then go to <https://discord.com/developers/applications>.
2. **New Application** → name it `noobtopro` → **Create**.
3. Left sidebar → **OAuth2** (under Settings).
4. Under **Redirects** → **Add Redirect** → paste `https://vwvhgnlgubctrgksyohr.supabase.co/auth/v1/callback` → **Save Changes**.
5. Under **Client information**, copy the **Client ID** and **Client Secret** (Reset Secret if needed to reveal it).

### 2. Enable Discord in Supabase
1. Supabase Dashboard → **Authentication** → **Sign In / Providers** → expand **Discord**.
2. Toggle it **on**, paste the **Client ID** and **Client Secret**, **Save**.

### 3. Turn the button on
1. Vercel → `noobtopro` → **Settings → Environment Variables** (project level):
   - `NEXT_PUBLIC_ENABLE_DISCORD` = `true`  (Production + Preview + Development)
2. **Redeploy.** The **Continue with Discord** button goes live.

---

## Notes & gotchas
- **Order matters:** do the Supabase step *before* flipping the env flag. The flag only controls whether the button is shown — if Supabase isn't configured, an enabled button errors on click.
- The **Supabase callback URL is stable** — it never changes per deploy, so you set it once at the provider.
- **Deployment Protection:** the OAuth redirect returns to your site, so for public users the production URL must not be behind Vercel's auth wall (you've already turned that off).
- **No new app deploy needed for the provider/Supabase steps** — only the env-flag step needs a Vercel redeploy.
- Prefer not to touch env vars? Tell me once Supabase is configured and I'll flip `enabled: true` in `lib/supabase.js` directly and deploy.
