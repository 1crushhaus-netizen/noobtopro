// ---------------------------------------------------------------------------
// SERVER-ISSUED QUESTION TOKENS — the binding between "a question the server
// generated" and "an answer the server scores" (audit P1-1).
//
// Before this, /api/score trusted the client's question text, difficulty band,
// and topicSlug — so a signed-in user could submit an easy self-authored
// question labeled `phd`, inflate their Glicko rating, dodge the anti-farm
// repeat damper by rotating the claimed (topic, band) bucket, and poison the
// shared item_difficulty calibration for everyone. Now /api/generate (and
// /api/learn's "try this") SIGN every practice question they serve, and
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
  if (!Number.isFinite(payload.exp) || Date.now() > payload.exp) {
    return { ok: false, error: "This question has expired — please generate a new question." };
  }
  return { ok: true, q: payload };
}
