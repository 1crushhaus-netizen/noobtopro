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

// Decrement an in-memory bucket's count by `n` (floored at 0), without touching its
// window/resetAt. Used by the refund path (a charged-but-unused Groq token) so a
// transient upstream failure doesn't permanently consume a slot. No-op if the bucket
// has already rolled over (its count is irrelevant once the window expired).
function refundBucket(key, n = 1, now = Date.now()) {
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) return;
  bucket.count = Math.max(0, bucket.count - Math.max(0, Math.floor(n)));
}

// Derive a client key from request headers. Prefer the PLATFORM-set client IP that the
// proxy overwrites and a client can't spoof: `x-vercel-forwarded-for` (Vercel) then
// `x-real-ip`. `x-forwarded-for`'s leftmost hop is client-CONTROLLABLE (a caller can
// prepend a fake), so it's only a last resort for non-Vercel/self-hosted deploys. Unknown
// IPs share one bucket, which is acceptable for a best-effort limiter. (audit 06 P1-3)
export function clientKey(req) {
  const vercel = req.headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0].trim();
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
export async function checkRateLimit(bucket, { max = MAX_PER_WINDOW, windowMs = WINDOW_MS, now = Date.now(), failClosed = false } = {}) {
  const sb = rlClient();
  if (sb) {
    let durableFailed = false;
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
      console.warn("[rateLimit] durable store degraded", error?.message || "bad rpc shape");
      durableFailed = true;
    } catch (e) {
      console.warn("[rateLimit] durable store threw", e?.message || e);
      durableFailed = true;
    }
    // FAIL-CLOSED buckets (the global Groq SPEND ceiling): when the durable store is
    // configured but fails, do NOT silently downgrade to the per-instance in-memory limiter
    // — that doesn't bound platform-wide cost, so a Supabase incident would quietly remove
    // the spend cap. Deny instead: a bounded availability hit beats an unbounded Groq bill.
    // (audit 03 P1-D) Per-IP / per-account fairness buckets stay fail-OPEN (availability).
    if (durableFailed && failClosed) {
      return { ok: false, remaining: 0, retryAfter: Math.ceil(windowMs / 1000), degraded: true };
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
  const want = Math.max(1, n);
  // Track what we actually consumed so a MID-LOOP denial refunds the slots already taken
  // (audit 03 P1-B): otherwise a charge that gets 1 groq slot then is denied the image
  // slot would leak that groq slot for the rest of the window, accelerating the DoS. The
  // global budget is FAIL-CLOSED (failClosed:true) so a durable-store outage can't drop
  // the spend ceiling to a per-instance counter.
  let chargedGroq = 0;
  let chargedImg = 0;
  let res = { ok: true, retryAfter: 0 };
  for (let i = 0; i < want; i++) {
    res = await checkRateLimit("global:groq", { max: maxGroq, failClosed: true });
    if (!res.ok) {
      await refundGlobalGroq(chargedGroq, { img: chargedImg });
      return res;
    }
    chargedGroq += 1;
  }
  for (let i = 0; i < img; i++) {
    res = await checkRateLimit("global:img", { max: maxImg, failClosed: true });
    if (!res.ok) {
      await refundGlobalGroq(chargedGroq, { img: chargedImg });
      return res;
    }
    chargedImg += 1;
  }
  return res;
}

/**
 * REFUND `n` Groq calls (and optionally `img` vision calls) to the global budget
 * (audit P2-2 fix). chargeGlobalGroq charges the platform-wide window BEFORE grading;
 * when the charged Groq call does NOT succeed (an upstream failure / outage), the
 * budget should be given back so a wave of failures during an outage doesn't keep
 * over-throttling everyone for the rest of the window. Best-effort + floored at 0:
 * decrement the durable counter via the rate_limit_refund RPC when configured, and
 * always mirror the decrement in the in-memory bucket (the fallback path + the no-key
 * dev/CI/test path). A missing RPC / RPC error is swallowed — a failed refund only
 * means the slot stays consumed until the window rolls, never an error to the caller.
 */
export async function refundGlobalGroq(n = 1, { img = 0 } = {}) {
  const groqN = Math.max(0, Math.floor(n));
  const imgN = Math.max(0, Math.floor(img));
  await refundRateLimit("global:groq", groqN);
  if (imgN > 0) await refundRateLimit("global:img", imgN);
}

// Durable + in-memory refund of `n` from a bucket's window. Mirrors checkRateLimit's
// durable/fallback split: try the rate_limit_refund RPC (service-role store), and
// always apply the in-memory decrement too so the fallback/test path is corrected.
async function refundRateLimit(bucket, n = 1) {
  if (n <= 0) return;
  const sb = rlClient();
  if (sb) {
    try {
      await sb.rpc("rate_limit_refund", { p_bucket: bucket, p_n: n });
    } catch (e) {
      console.warn("[rateLimit] durable refund failed — slot stays consumed until the window rolls", e?.message || e);
    }
  }
  refundBucket(bucket, n);
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
