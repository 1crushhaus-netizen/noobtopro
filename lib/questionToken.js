// ---------------------------------------------------------------------------
// SERVER-ISSUED QUESTION TOKENS — the binding between "a question the server
// generated" and "an answer the server scores" (audit P1-1).
//
// Before this, /api/score trusted the client's question text, difficulty band,
// and topicSlug — so a signed-in user could submit an easy self-authored
// question labeled `phd`, inflate their Glicko rating, dodge the anti-farm
// repeat damper by rotating the claimed (topic, band) bucket, and poison the
// shared item_difficulty calibration for everyone. Now /api/generate SIGNS
// every practice question it serves, and
// /api/score practice accepts ONLY a valid token: every rating-relevant field
// (subject, question, band, topic, surface, trap, concept) comes from the
// verified payload, never the request body.
//
// Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload)).
// Stateless — no DB. The payload carries a `jti` (unique id) that
// save_progress_for dedupes on, so the same served question can be SCORED at
// most once (replay/double-delivery protection, audit P2-5), and an `exp`
// (TOKEN_TTL_MS) bounding how long a served question stays scoreable.
//
// Key: QUESTION_TOKEN_SECRET if set, else derived from
// SUPABASE_SERVICE_ROLE_KEY (which /api/score already requires — no new env
// var needed). Server-only: never import from client components.
// ---------------------------------------------------------------------------

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const TOKEN_TTL_MS = 6 * 60 * 60 * 1000; // 6h — outlasts any real practice session

// The fields a token carries — everything /api/score derives the rating from.
// `conceptKey` is the lib/curriculum.js concept a concept-targeted drill evidences
// (mastery coloring, RANKS_PLAN §12.1) — signed at generation so /api/score reads it
// from the verified token, never the request body; absent on generic practice.
const PAYLOAD_FIELDS = ["subject", "question", "targetConcept", "difficulty", "topicSlug", "reasoningSurface", "trap", "conceptKey", "jti", "iat", "exp"];

function secret() {
  const s = process.env.QUESTION_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return s ? `qtoken:${s}` : null;
}

const b64url = (buf) => Buffer.from(buf).toString("base64url");

function hmac(data, key) {
  return createHmac("sha256", key).update(data).digest();
}

// Is token signing available? (No service-role key → guest-only deployment →
// /api/score practice is 503 anyway, so unsigned generation is fine.)
export function canSignQuestions() {
  return secret() !== null;
}

// Sign a served practice question. `q` carries the generation-route fields;
// only PAYLOAD_FIELDS are embedded (allowlist — nothing else rides along).
// Returns the token string, or null when no signing key is configured.
export function signQuestion(q) {
  const key = secret();
  if (!key || !q || typeof q !== "object") return null;
  const now = Date.now();
  const payload = { jti: randomUUID(), iat: now, exp: now + TOKEN_TTL_MS };
  for (const f of PAYLOAD_FIELDS) {
    if (f === "jti" || f === "iat" || f === "exp") continue;
    if (typeof q[f] === "string" && q[f]) payload[f] = q[f];
  }
  const body = b64url(JSON.stringify(payload));
  return `${body}.${b64url(hmac(body, key))}`;
}

// Verify a token. Returns { ok:true, q } with the trusted payload, or
// { ok:false, error } with a learner-presentable reason. Constant-time MAC
// comparison; expiry checked AFTER the MAC (an attacker learns nothing from
// timing the parse).
export function verifyQuestionToken(token) {
  const key = secret();
  if (!key) return { ok: false, error: "Scoring is temporarily unavailable." };
  if (typeof token !== "string" || token.length > 16384) {
    return { ok: false, error: "This question is missing its signature — please generate a new question." };
  }
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return { ok: false, error: "This question is missing its signature — please generate a new question." };
  const body = token.slice(0, dot);
  let mac;
  try {
    mac = Buffer.from(token.slice(dot + 1), "base64url");
  } catch {
    return { ok: false, error: "This question is missing its signature — please generate a new question." };
  }
  const expected = hmac(body, key);
  if (mac.length !== expected.length || !timingSafeEqual(mac, expected)) {
    return { ok: false, error: "This question could not be verified — please generate a new question." };
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, error: "This question could not be verified — please generate a new question." };
  }
  if (!payload || typeof payload !== "object" || typeof payload.jti !== "string") {
    return { ok: false, error: "This question could not be verified — please generate a new question." };
  }
  // Kind separation: a DIAGNOSTIC step token (k:"diag", below) must never be
  // accepted as a practice-question token (its payload has no signed question
  // text/band, so the practice grader would run on undefined fields).
  if (payload.k !== undefined) {
    return { ok: false, error: "This question could not be verified — please generate a new question." };
  }
  if (!Number.isFinite(payload.exp) || Date.now() > payload.exp) {
    return { ok: false, error: "This question has expired — please generate a new question." };
  }
  return { ok: true, q: payload };
}

// ---------------------------------------------------------------------------
// DIAGNOSTIC STEP TOKENS (adaptive placement, RANKS_PLAN §8) — the same HMAC
// envelope, but a STRUCTURED payload: the signed per-subject placement state
// ({ subject, step, itemId, asked[], transcript[] } mid-run; { subject, done,
// transcript[] } when the subject completes). The chain is what makes the
// adaptive walk server-authoritative with no DB: each step's SERVER-computed
// grade is folded into the next token, so a client can neither forge a grade,
// skip a step, nor pick its own band — it can only echo the latest token back.
// k:"diag" separates kinds both ways (verifyQuestionToken rejects k-bearing
// payloads; verifyDiagToken requires k === "diag"). No jti DEDUPE is enforced:
// replaying a step token just re-grades the same item (rate-limited, no
// rating/mastery effect until finalize), and replaying a finalize re-runs the
// same idempotent baseline upsert — the same semantics as re-taking the
// diagnostic, which is free by design.
// ---------------------------------------------------------------------------

// Sign an adaptive-diagnostic state. Returns null when no key is configured
// (the diagnostic start route 503s in that case — the chain can't be unsigned).
export function signDiagState(state) {
  const key = secret();
  if (!key || !state || typeof state !== "object") return null;
  const now = Date.now();
  const payload = { ...state, k: "diag", jti: randomUUID(), iat: now, exp: now + TOKEN_TTL_MS };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${b64url(hmac(body, key))}`;
}

// Verify a diagnostic step/final token. Returns { ok:true, state } with the
// trusted payload, or { ok:false, error }. Same constant-time MAC + expiry
// handling as verifyQuestionToken; the learner-facing copy says "placement".
export function verifyDiagToken(token) {
  const key = secret();
  if (!key) return { ok: false, error: "Placement is temporarily unavailable." };
  const invalid = { ok: false, error: "This placement step could not be verified — please restart the diagnostic." };
  if (typeof token !== "string" || token.length > 16384) return invalid;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return invalid;
  const body = token.slice(0, dot);
  let mac;
  try {
    mac = Buffer.from(token.slice(dot + 1), "base64url");
  } catch {
    return invalid;
  }
  const expected = hmac(body, key);
  if (mac.length !== expected.length || !timingSafeEqual(mac, expected)) return invalid;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return invalid;
  }
  if (!payload || typeof payload !== "object" || payload.k !== "diag" || typeof payload.jti !== "string") return invalid;
  if (!Number.isFinite(payload.exp) || Date.now() > payload.exp) {
    return { ok: false, error: "This placement session has expired — please restart the diagnostic." };
  }
  return { ok: true, state: payload };
}
