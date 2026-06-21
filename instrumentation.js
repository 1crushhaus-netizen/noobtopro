// Next.js instrumentation hook — runs ONCE when a server instance initializes.
//
// FAIL-FAST (audit P1-5): when SUPABASE_SERVICE_ROLE_KEY is absent, the durable rate
// limiter, abuse logging, AND the global Groq spend cap all silently degrade to weak
// per-instance / no-op limits (lib/rateLimit.js, lib/abuseDetection.js). Booting a
// production server with the entire anti-abuse stack disabled is worse than not booting,
// so crash loudly at startup — the misconfiguration shows up at deploy instead of as an
// unbounded Groq bill in prod.
export async function register() {
  // Only the Node.js server runtime reads these secrets; skip the edge runtime.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Do NOT run during `next build` (NEXT_PHASE is the build phase there): the build runs
  // with empty placeholder env and must not fail on missing runtime secrets.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  // Only enforce in production — local/test/dev legitimately run without the service-role key.
  if (process.env.NODE_ENV !== "production") return;

  const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `[instrumentation] Refusing to boot: missing required production env ${missing.join(", ")}. ` +
        "Without the service-role key the durable rate limiter, abuse logging, and the global Groq " +
        "spend cap silently disable (audit P1-5) — fix the deployment's environment configuration."
    );
  }

  // FAIL-FAST (red-team Finding 2): when QUESTION_TOKEN_SECRET is unset, lib/questionToken.js
  // DERIVES the HMAC signing key from SUPABASE_SERVICE_ROLE_KEY. That works (domain-separated
  // by a "qtoken:" prefix), but it COUPLES two secrets of very different blast radius: rotating
  // the service-role key silently invalidates every outstanding question token, and any leak of
  // one secret is a leak of both. QUESTION_TOKEN_SECRET is the anti-cheat linchpin (it signs the
  // server-issued question/diagnostic tokens the rating engine trusts), so in PRODUCTION runtime
  // refuse to boot without an explicit, independent secret rather than silently coupling it —
  // mirroring the service-role fail-fast above. The build-phase and non-prod skips at the top of
  // register() are already applied, so CI builds with empty secrets still pass; this only fires in
  // a real production server start. Set it via `openssl rand -hex 32`, marked Sensitive in Vercel.
  if (!process.env.QUESTION_TOKEN_SECRET) {
    throw new Error(
      "[instrumentation] Refusing to boot: missing required production env QUESTION_TOKEN_SECRET. " +
        "Without it, question/diagnostic token signing falls back to SUPABASE_SERVICE_ROLE_KEY " +
        "(coupled rotation + shared blast radius for the anti-cheat linchpin) — set an explicit " +
        "secret (openssl rand -hex 32), marked Sensitive, in the deployment's environment."
    );
  }
}
