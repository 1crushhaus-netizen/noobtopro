import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { POST } from "@/app/api/generate/route";
import { _resetRateLimits } from "@/lib/rateLimit";
import { ORDER, DIAGNOSTIC_DIFFICULTIES } from "@/lib/scoring";

function req(bodyObjOrString) {
  const body =
    typeof bodyObjOrString === "string" ? bodyObjOrString : JSON.stringify(bodyObjOrString);
  return new Request("http://test.local/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

function mockGroqReturning(payload) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
    text: async () => "",
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  process.env.GROQ_API_KEY = "test-key";
  _resetRateLimits();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/generate — request guard (CSRF / content-type)", () => {
  const raw = (headers) =>
    new Request("http://test.local/api/generate", {
      method: "POST",
      headers,
      body: JSON.stringify({ kind: "diagnostic" }),
    });

  it("blocks a forced cross-site request with 403 (no Groq call)", async () => {
    const failFetch = vi.fn(() => { throw new Error("must not call Groq on a blocked request"); });
    vi.stubGlobal("fetch", failFetch);
    const res = await POST(raw({ "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" }));
    expect(res.status).toBe(403);
    expect(failFetch).not.toHaveBeenCalled();
  });

  it("rejects a non-JSON content-type with 415", async () => {
    const res = await POST(raw({ "Content-Type": "text/plain" }));
    expect(res.status).toBe(415);
  });

  it("allows a same-origin JSON request", async () => {
    const res = await POST(raw({ "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin" }));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/generate — validation", () => {
  it("rejects a non-JSON body with 400", async () => {
    const res = await POST(req("nope"));
    expect(res.status).toBe(400);
  });

  it("rejects an unknown kind with 400", async () => {
    const res = await POST(req({ kind: "foo" }));
    expect(res.status).toBe(400);
  });

  it("rejects practice with an unknown subject with 400", async () => {
    const res = await POST(req({ kind: "practice", subject: "astrology", score: 40 }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Unknown subject/);
  });

  it("rejects an inherited/prototype subject key with 400", async () => {
    for (const subject of ["constructor", "__proto__", "toString"]) {
      const res = await POST(req({ kind: "practice", subject, score: 40 }));
      expect(res.status).toBe(400);
    }
  });

  it("returns a generic 500 that does not leak upstream Groq detail (practice generation)", async () => {
    // The diagnostic is served from the curated bank (no Groq); the PRACTICE path still
    // calls Groq, so it's the one that can surface an upstream error.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 429, text: async () => "rate limited: project xyz" }))
    );
    const res = await POST(req({ kind: "practice", subject: "math", score: 50 }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).not.toMatch(/429|rate limited|project xyz/);
    expect(json.error).toMatch(/temporarily unavailable/i);
  });
});

describe("POST /api/generate — diagnostic (curated bank, zero Groq)", () => {
  it("serves the curated 9-question diagnostic bank WITHOUT calling Groq", async () => {
    const failFetch = vi.fn(() => { throw new Error("the diagnostic must not call Groq — it's a curated bank"); });
    vi.stubGlobal("fetch", failFetch);
    const res = await POST(req({ kind: "diagnostic" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.curated).toBe(true);
    expect(json.questions).toHaveLength(9); // 3 subjects × 3 levels
    expect(failFetch).not.toHaveBeenCalled(); // zero generation tokens
  });

  it("covers every subject at every level (beginner/intermediate/hard), each with a non-empty question", async () => {
    const res = await POST(req({ kind: "diagnostic" }));
    const { questions } = await res.json();
    const slots = new Set(questions.map((q) => `${q.subject}:${q.difficulty}`));
    for (const s of ORDER) {
      for (const d of DIAGNOSTIC_DIFFICULTIES) expect(slots.has(`${s}:${d}`)).toBe(true);
    }
    for (const q of questions) expect(typeof q.question === "string" && q.question.trim().length > 0).toBe(true);
  });

  it("returns a fresh copy each call (the bank can't be mutated by a caller)", async () => {
    const a = await (await POST(req({ kind: "diagnostic" }))).json();
    a.questions[0].question = "MUTATED";
    const b = await (await POST(req({ kind: "diagnostic" }))).json();
    expect(b.questions[0].question).not.toBe("MUTATED");
  });
});

describe("POST /api/generate — practice (Groq-generated)", () => {
  it("generates a practice question for a known subject", async () => {
    mockGroqReturning({
      subject: "chemistry",
      topic: "stoichiometry",
      targetConcept: "limiting reagents",
      difficulty: "intermediate",
      question: "q",
    });
    const res = await POST(
      req({ kind: "practice", subject: "chemistry", score: 55, weakConcepts: ["limiting reagents"] })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.subject).toBe("chemistry");
  });

  it("caps weakConcepts (count + length) before sending them upstream", async () => {
    const fetchMock = mockGroqReturning({ subject: "math", topic: "t", targetConcept: "c", difficulty: "intermediate", question: "q" });
    const many = Array.from({ length: 500 }, (_, i) => `concept-${i}-${"x".repeat(500)}`);
    const res = await POST(req({ kind: "practice", subject: "math", score: 50, weakConcepts: many }));
    expect(res.status).toBe(200);
    // The 500 × 500 ≈ 250k-char raw concept list must be capped to ~10 × 200 before the
    // prompt; the rest of the body is the (constant) system prompt + variety/surface text.
    // Assert directly on the concept cap so the bound survives prompt growth.
    const userMsg = JSON.parse(fetchMock.mock.calls[0][1].body).messages.find((m) => m.role === "user").content;
    expect((userMsg.match(/concept-\d+/g) || []).length).toBeLessThanOrEqual(10); // ≤10 concepts survive
    expect(userMsg).not.toContain("x".repeat(201)); // each truncated to ≤200 chars
  });

  it("injects an AVOID-list from recentQuestions and rolls variation directives into the prompt", async () => {
    const fetchMock = mockGroqReturning({ subject: "math", topic: "t", targetConcept: "c", difficulty: "foundational", question: "q" });
    const res = await POST(
      req({
        kind: "practice",
        subject: "math",
        score: 43,
        weakConcepts: ["equation balancing"],
        recentQuestions: ["Consider the equation 2x + 5 = 11. Explain the steps to isolate x."],
      })
    );
    expect(res.status).toBe(200);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userMsg = sent.messages.find((m) => m.role === "user").content;
    expect(userMsg).toMatch(/AVOID repeating/i);
    expect(userMsg).toContain("2x + 5 = 11"); // the recent question is echoed into the avoid-list
    expect(userMsg).toMatch(/Variation directives/);
    expect(userMsg).toMatch(/Variation key:/);
  });

  it("normalizes the reasoning-surface metadata in the practice output (allow-list + trap-only-on-trap)", async () => {
    // valid trap surface → surface kept, trap kept
    mockGroqReturning({ subject: "math", topic: "t", topicSlug: "algebra", targetConcept: "c", difficulty: "intermediate", question: "q", reasoningSurface: "trap", trap: "inverted the ratio" });
    let json = await (await POST(req({ kind: "practice", subject: "math", score: 50, weakConcepts: ["x"] }))).json();
    expect(json.reasoningSurface).toBe("trap");
    expect(json.trap).toBe("inverted the ratio");

    // off-list surface → null, and a stray trap is dropped
    mockGroqReturning({ subject: "math", topic: "t", topicSlug: "algebra", targetConcept: "c", difficulty: "beginner", question: "q", reasoningSurface: "atomic", trap: "sneaky" });
    json = await (await POST(req({ kind: "practice", subject: "math", score: 30, weakConcepts: ["x"] }))).json();
    expect(json.reasoningSurface).toBe(null);
    expect(json.trap).toBe("");

    // non-trap surface → trap dropped even if the model emits one
    mockGroqReturning({ subject: "math", topic: "t", topicSlug: "algebra", targetConcept: "c", difficulty: "advanced", question: "q", reasoningSurface: "branch", trap: "should be dropped" });
    json = await (await POST(req({ kind: "practice", subject: "math", score: 70, weakConcepts: ["x"] }))).json();
    expect(json.reasoningSurface).toBe("branch");
    expect(json.trap).toBe("");
  });

  it("samples generation: sends a higher temperature and a per-call seed (so repeats diverge)", async () => {
    const fetchMock = mockGroqReturning({ subject: "math", topic: "t", targetConcept: "c", difficulty: "foundational", question: "q" });
    await POST(req({ kind: "practice", subject: "math", score: 50, weakConcepts: ["x"] }));
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.temperature).toBeGreaterThan(0.5); // not the deterministic-grade 0, not the old 0.4 default
    expect(Number.isInteger(sent.seed)).toBe(true);
  });

  it("caps recentQuestions (count + length) before echoing them into the prompt", async () => {
    const fetchMock = mockGroqReturning({ subject: "math", topic: "t", targetConcept: "c", difficulty: "foundational", question: "q" });
    const many = Array.from({ length: 50 }, (_, i) => `recent-${i}-${"y".repeat(800)}`);
    const res = await POST(req({ kind: "practice", subject: "math", score: 50, weakConcepts: ["x"], recentQuestions: many }));
    expect(res.status).toBe(200);
    const userMsg = JSON.parse(fetchMock.mock.calls[0][1].body).messages.find((m) => m.role === "user").content;
    // at most 5 items survive, each ≤240 chars → the avoid-list block stays bounded
    expect((userMsg.match(/recent-\d+/g) || []).length).toBeLessThanOrEqual(5);
    expect(userMsg).not.toContain("y".repeat(241));
  });
});
