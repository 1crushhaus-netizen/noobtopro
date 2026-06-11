import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { signQuestion, verifyQuestionToken, canSignQuestions, TOKEN_TTL_MS } from "@/lib/questionToken";

// The server-issued question token (audit P1-1): /api/generate signs every served
// practice question; /api/score derives all rating-relevant fields from the VERIFIED
// payload. These tests pin the crypto contract the trust boundary now leans on.

const Q = {
  subject: "math",
  question: "Solve 3x + 4 = 19 and explain each step.",
  targetConcept: "linear equations",
  difficulty: "intermediate",
  topicSlug: "algebra",
  reasoningSurface: "multi-step",
  trap: "",
};

beforeEach(() => {
  process.env.QUESTION_TOKEN_SECRET = "unit-test-secret";
});
afterEach(() => {
  delete process.env.QUESTION_TOKEN_SECRET;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  vi.useRealTimers();
});

describe("signQuestion / verifyQuestionToken", () => {
  it("round-trips every rating-relevant field and stamps a unique jti + expiry", () => {
    const t1 = signQuestion(Q);
    const t2 = signQuestion(Q);
    const v = verifyQuestionToken(t1);
    expect(v.ok).toBe(true);
    expect(v.q).toMatchObject({
      subject: "math",
      question: Q.question,
      targetConcept: "linear equations",
      difficulty: "intermediate",
      topicSlug: "algebra",
      reasoningSurface: "multi-step",
    });
    expect(typeof v.q.jti).toBe("string");
    expect(v.q.exp - v.q.iat).toBe(TOKEN_TTL_MS);
    // Same question, DIFFERENT token identity — jti dedupe needs per-serve uniqueness.
    expect(verifyQuestionToken(t2).q.jti).not.toBe(v.q.jti);
  });

  it("rejects a TAMPERED payload (forged difficulty band can't survive the MAC)", () => {
    const t = signQuestion(Q);
    const [body, mac] = t.split(".");
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    payload.difficulty = "phd"; // the exact forgery the audit's P1-1 used
    const forged = `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${mac}`;
    const v = verifyQuestionToken(forged);
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/generate a new question/i);
  });

  it("rejects a token signed under a DIFFERENT key", () => {
    const t = signQuestion(Q);
    process.env.QUESTION_TOKEN_SECRET = "rotated-secret";
    expect(verifyQuestionToken(t).ok).toBe(false);
  });

  it("rejects an EXPIRED token (but accepts within the TTL)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T12:00:00Z"));
    const t = signQuestion(Q);
    vi.setSystemTime(new Date("2026-06-11T12:00:00Z").getTime() + TOKEN_TTL_MS - 1000);
    expect(verifyQuestionToken(t).ok).toBe(true);
    vi.setSystemTime(new Date("2026-06-11T12:00:00Z").getTime() + TOKEN_TTL_MS + 1000);
    const v = verifyQuestionToken(t);
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/expired/i);
  });

  it("rejects garbage shapes without throwing (missing, non-string, no dot, huge)", () => {
    for (const bad of [undefined, null, 42, "", "no-dot", "a.b.c.d!", "x".repeat(20000)]) {
      const v = verifyQuestionToken(bad);
      expect(v.ok).toBe(false);
      expect(typeof v.error).toBe("string");
    }
  });

  it("embeds ONLY the allow-listed fields (nothing else rides into the trusted payload)", () => {
    const t = signQuestion({ ...Q, evil: "x", score: 100, newScore: 100 });
    const v = verifyQuestionToken(t);
    expect(v.ok).toBe(true);
    expect(v.q.evil).toBeUndefined();
    expect(v.q.score).toBeUndefined();
    expect(v.q.newScore).toBeUndefined();
  });

  it("without any signing key: canSignQuestions false, sign returns null, verify fails closed", () => {
    delete process.env.QUESTION_TOKEN_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(canSignQuestions()).toBe(false);
    expect(signQuestion(Q)).toBeNull();
    expect(verifyQuestionToken("anything.anything").ok).toBe(false);
  });

  it("falls back to a SUPABASE_SERVICE_ROLE_KEY-derived key when no explicit secret is set", () => {
    delete process.env.QUESTION_TOKEN_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    const t = signQuestion(Q);
    expect(verifyQuestionToken(t).ok).toBe(true);
  });
});
