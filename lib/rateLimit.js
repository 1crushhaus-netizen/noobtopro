// ---------------------------------------------------------------------------
// Rate limiting for the Groq-backed API routes. TWO layers:
//
//   1. checkRateLimit() (the entry point used by every route) — a DURABLE, shared
//      Postgres counter (the rate_limit_hit RPC), so the limit is enforced ACROSS all
//      serverless instances and survives cold starts, and can be keyed per-ACCOUNT
//      (acct:<auth.uid()>) for signed-in callers. This is the real protection; see the
//      bottom of this file.
//   2. The in-memory fixed-window limiter below (rateLimit/enforceCap) — the FALLBACK
//      used only when SUPABASE_SERVICE_ROLE_KEY is unset (local/dev/CI/tests). Caveats
//      of the fallback: state is per serverless instance (effective limit = max ×
//      instances) and keyed by client IP (rotatable/spoofable, though enforceCap bounds
//      memory). Acceptable for the keyless dev path; production runs on the durable layer.
// ---------------------------------------------------------------------------

import { createClient } from "@supabase/supabase-js";

const WINDOW_MS = 60_000; // 1 minute
const MAX_PER_WINDOW = 30; // requests per IP per window
export const MAX_TRACKED_KEYS = 10_000; // hard upper bound on tracked keys
const EVICT_TARGET = 9_000; // low-water mark after an eviction sweep

const buckets = new Map(); // key -> { count, resetAt }

// Reclaim buckets whose window has already rolled over (cheap, frees dead keys).
function prune(now) {
  for (const [key, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(key);
  }
}

// Keep the Map size bounded. First reclaim expired entries; if a flood of
// still-live distinct keys (e.g. rotated IPs, or high-cardinality traffic) is
// pushing past the cap, hard-evict the OLDEST entries (Map preserves insertion
// order) down to a low-water mark. Evicting a live bucket only lets that key's
// window reset early — acceptable for a best-effort limiter, and far better than
// unbounded per-instance memory growth. Batching to EVICT_TARGET makes this run
// as an occasional sweep (amortized O(1)/request) rather than an O(n) scan on
// every over-cap call.
function enforceCap(now) {
  prune(now);
  // Strict `<`: when called at exactly MAX_TRACKED_KEYS (the gate in rateLimit fires
  // at `>=`), still evict so the subsequent insert can't push the Map to cap+1 —
  // keeping it within the documented hard upper bound rather than transiently over.
  if (buckets.size < MAX_TRACKED_KEYS) return;
  while (buckets.size > EVICT_TARGET) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }
}

/**
 * Fixed-window counter. Returns { ok, remaining, resetAt, retryAfter }.
 * `now` is injectable so the behaviour is deterministic in tests.
 */
export function rateLimit(key, { windowMs = WINDOW_MS, max = MAX_PER_WINDOW, now = Date.now() } = {}) {
  if (buckets.size >= MAX_TRACKED_KEYS) enforceCap(now);

  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: max - 1, resetAt, retryAfter: 0 };
  }

  if (bucket.count >= max) {
    return {
      ok: false,
      remaining: 0,
      resetAt: bucket.resetAt,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { ok: true, remaining: max - bucket.count, resetAt: bucket.resetAt, retryAfter: 0 };
}

// Derive a client key from request headers. On Vercel, `x-real-ip` is set by the
// platform; `x-forwarded-for` is a fallback (first hop = client). Unknown IPs
// share one bucket, which is acceptable for a best-effort limiter.
export function clientKey(req) {
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}

// ---------------------------------------------------------------------------
// Durable limiter: a Postgres-backed shared counter (rate_limit_hit RPC) so the
// limit is enforced ACROSS all serverless instances and survives cold starts —
// fixing the in-memory limiter's per-instance multiplication and IP-spoof headroom.
// Uses its OWN service-role client (read straight from env, NOT getSupabaseAdmin)
// so it's independent of any per-route mock; when SUPABASE_SERVICE_ROLE_KEY is unset
// (local/dev/CI/tests) it transparently FALLS BACK to the in-memory limiter above.
// ---------------------------------------------------------------------------
let _rlClient = null;
function rlClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null; // no durable store -> caller falls back to in-memory
  if (!_rlClient) {
    _rlClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return _rlClient;
}

/**
 * Durable, shared-store rate-limit check. Same return shape as rateLimit()
 * ({ ok, remaining, retryAfter }). `bucket` should encode the dimension —
 * "acct:<uid>" for a signed-in caller (per-ACCOUNT, follows them across IPs) or the
 * client IP for guests, optionally suffixed (":diag", ":img", ":learn"). Falls back
 * to the per-instance in-memory limiter when no service-role store is configured or
 * the RPC errors, so the app is always protected (just less strictly without the key).
 */
export async function checkRateLimit(bucket, { max = MAX_PER_WINDOW, windowMs = WINDOW_MS, now = Date.now() } = {}) {
  const sb = rlClient();
  if (sb) {
    try {
      const { data, error } = await sb.rpc("rate_limit_hit", {
        p_bucket: bucket,
        p_max: max,
        p_window_seconds: Math.ceil(windowMs / 1000),
      });
      if (!error && data && typeof data.allowed === "boolean") {
        return {
          ok: data.allowed,
          remaining: typeof data.remaining === "number" ? data.remaining : 0,
          retryAfter: typeof data.retry_after === "number" ? data.retry_after : 0,
          durable: true,
        };
      }
      // Store IS configured but the RPC errored / returned a bad shape. We still fall
      // back to the (weaker, per-instance) in-memory limiter so the app stays up, but
      // this is a SILENT downgrade of the real protection — log it so the degradation is
      // visible (e.g. a Supabase hiccup) instead of an invisible weakening of the limiter.
      console.warn("[rateLimit] durable store degraded — falling back to in-memory limiter", error?.message || "bad rpc shape");
    } catch (e) {
      console.warn("[rateLimit] durable store threw — falling back to in-memory limiter", e?.message || e);
    }
  }
  return rateLimit(bucket, { max, windowMs, now });
}

// ---------------------------------------------------------------------------
// GLOBAL Groq budgets (audit P2-3). The per-IP limiter is the fairness layer,
// but it is rotation-defeatable: an attacker with cheap IPs gets max×IPs paid
// Groq calls per minute on the unauthenticated routes. These PLATFORM-WIDE
// fixed-window budgets convert "unbounded spend under rotation" into a bounded
// worst case: once the global window is exhausted everyone gets a 429 until it
// rolls (a bounded availability hit instead of an unbounded bill — and a real
// surge from legitimate users looks the same to the wallet). Sized ~10× the
// single-IP cap so honest concurrent users never feel it. Env-overridable.
// ---------------------------------------------------------------------------
// Env read PER CALL (not at import) so deployments can retune without a rebuild
// and tests can exercise the cap.
const envBudget = (name, dflt) => (Number(process.env[name]) > 0 ? Number(process.env[name]) : dflt);

/**
 * Charge `n` Groq calls (and optionally `img` vision calls) against the global
 * budget. Returns { ok, retryAfter }. Same durable/fallback semantics as
 * checkRateLimit; the buckets are "global:groq" / "global:img".
 */
export async function chargeGlobalGroq(n = 1, { img = 0 } = {}) {
  const maxGroq = envBudget("GLOBAL_GROQ_BUDGET_PER_MIN", 300);
  const maxImg = envBudget("GLOBAL_IMG_BUDGET_PER_MIN", 60);
  let res = { ok: true, retryAfter: 0 };
  for (let i = 0; i < Math.max(1, n); i++) {
    res = await checkRateLimit("global:groq", { max: maxGroq });
    if (!res.ok) return res;
  }
  for (let i = 0; i < img; i++) {
    res = await checkRateLimit("global:img", { max: maxImg });
    if (!res.ok) return res;
  }
  return res;
}

// Test-only helpers.
export function _resetRateLimits() {
  buckets.clear();
}
export function _rateLimitSize() {
  return buckets.size;
}
export function _resetRateLimitClient() {
  _rlClient = null;
}
