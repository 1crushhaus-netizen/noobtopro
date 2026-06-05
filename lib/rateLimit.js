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
  if (buckets.size <= MAX_TRACKED_KEYS) return;
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

// Test-only helpers.
export function _resetRateLimits() {
  buckets.clear();
}
export function _rateLimitSize() {
  return buckets.size;
}
