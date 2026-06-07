// ---------------------------------------------------------------------------
// Best-effort, in-memory rate limiter for the public Groq-backed API routes.
//
// IMPORTANT — this is a lightweight stop-gap, not robust protection:
//   • State lives in this module's memory, so it is PER serverless instance and
//     resets on cold start. Two concurrent Vercel lambdas don't share counters,
//     so the effective global limit is (max × instances).
//   • Keying is by client IP, which a determined caller can rotate/spoof.
//     (Key rotation can't grow memory without bound, though — see enforceCap.)
//
// It exists to blunt casual abuse / accidental loops that would burn the Groq
// quota. Replace it with a durable, shared store (e.g. @upstash/ratelimit on
// Upstash Redis) — and ideally per-account limits — once the product is
// monetized and abuse is worth defending against properly.
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
    } catch {
      /* durable store unavailable -> fall back to in-memory below */
    }
  }
  return rateLimit(bucket, { max, windowMs, now });
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
