import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mastery-calibration seams (RANKS_PLAN §6): the route verifies a JWT and reads the
// caller's concept_mastery row ONLY when an Authorization header is present. Defaults
// mirror an unconfigured server: no valid user, no admin client (guest path).
const calib = vi.hoisted(() => ({
  requireUser: vi.fn(async () => ({ error: "Authentication required.", status: 401 })),
  adminClient: null,
}));
vi.mock("@/lib/adminAuth", async (importOriginal) => ({
  ...(await importOriginal()),
  requireUser: (...a) => calib.requireUser(...a),
}));
vi.mock("@/lib/supabaseAdmin", async (importOriginal) => ({
  ...(await importOriginal()),
  getSupabaseAdmin: () => calib.adminClient,
}));

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
  calib.requireUser.mockClear();
  calib.adminClient = null;
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
    // Over the 10×200 field cap (50 concepts × ~300 chars), but within the 64 KB
    // text-route body ceiling so this still exercises the post-parse field cap.
    const many = Array.from({ length: 50 }, (_, i) => `concept-${i}-${"x".repeat(300)}`);
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

// ---- audit fix round 2 (P1-1 / P2-9) -----------------------------------------
import { verifyQuestionToken } from "@/lib/questionToken";

describe("POST /api/generate — server-issued question tokens + stripped diagnostic metadata", () => {
  it("practice responses carry a VERIFIABLE token binding the served question (audit P1-1)", async () => {
    process.env.QUESTION_TOKEN_SECRET = "gen-test-secret";
    try {
      mockGroqReturning({
        topic: "Algebra", topicSlug: "algebra", targetConcept: "linear equations",
        difficulty: "intermediate", reasoningSurface: "multi-step",
        question: "Solve 3x + 4 = 19 and explain each step.",
      });
      const res = await POST(req({ kind: "practice", subject: "math", score: 40, weakConcepts: [] }));
      expect(res.status).toBe(200);
      const j = await res.json();
      expect(typeof j.token).toBe("string");
      const v = verifyQuestionToken(j.token);
      expect(v.ok).toBe(true);
      // The token binds EXACTLY what was served — /api/score trusts these, not the client.
      expect(v.q).toMatchObject({
        subject: "math",
        question: j.question,
        difficulty: j.difficulty,
        topicSlug: "algebra",
      });
    } finally {
      delete process.env.QUESTION_TOKEN_SECRET;
    }
  });

  it("diagnostic responses NO LONGER ship trap/reasoningSurface (audit P2-9 — placement gaming via devtools)", async () => {
    const res = await POST(req({ kind: "diagnostic" }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.questions).toHaveLength(9);
    for (const q of j.questions) {
      expect(q.trap).toBeUndefined();
      expect(q.reasoningSurface).toBeUndefined();
      expect(typeof q.question).toBe("string"); // the visible fields still ship
    }
  });
});

// ---- increment 3: AI concept-practice drill --------------------------------
import { verifyQuestionToken as _vqt } from "@/lib/questionToken";

describe("POST /api/generate — concept-practice drill (increment 3)", () => {
  it("a valid curriculum conceptKey targets the concept, forces the rank band, and tags + SIGNS the conceptKey", async () => {
    process.env.QUESTION_TOKEN_SECRET = "gen-drill-secret";
    try {
      const fetchMock = mockGroqReturning({
        topic: "Algebra", topicSlug: "algebra", targetConcept: "model wants this overridden",
        difficulty: "beginner", reasoningSurface: "multi-step",
        question: "If x^2 - 5x + 6 = 0, find x and explain each step.",
      });
      // quadratics is a math/high concept → band intermediate.
      const res = await POST(req({ kind: "practice", subject: "math", conceptKey: "quadratics" }));
      expect(res.status).toBe(200);
      const j = await res.json();

      // The prompt targeted the concept by its curated label (not a client string).
      const sentUser = JSON.parse(fetchMock.mock.calls[0][1].body).messages.find((m) => m.role === "user").content;
      expect(sentUser).toContain("Quadratic functions & equations");
      expect(sentUser).toMatch(/high real-world level/i);

      // The response is server-authoritative on the curriculum facts:
      expect(j.conceptKey).toBe("quadratics");
      expect(j.difficulty).toBe("intermediate"); // rank band, NOT the model's "beginner"
      expect(j.targetConcept).toBe("Quadratic functions & equations");

      // And the conceptKey + band are SIGNED into the token (so /api/score reads them
      // from the verified token and updates mastery).
      const v = _vqt(j.token);
      expect(v.ok).toBe(true);
      expect(v.q.conceptKey).toBe("quadratics");
      expect(v.q.difficulty).toBe("intermediate");
    } finally {
      delete process.env.QUESTION_TOKEN_SECRET;
    }
  });

  it("an UNKNOWN/forged conceptKey is ignored → ordinary level-based practice (no conceptKey on the response or token)", async () => {
    process.env.QUESTION_TOKEN_SECRET = "gen-drill-secret";
    try {
      mockGroqReturning({
        topic: "Algebra", topicSlug: "algebra", targetConcept: "linear equations",
        difficulty: "intermediate", reasoningSurface: "multi-step",
        question: "Solve 2x + 3 = 11 and explain.",
      });
      // A physics key under math, and a junk key — both fail the curriculum allowlist.
      for (const conceptKey of ["balanced_unbalanced_forces", "totally_fake", "__proto__"]) {
        const res = await POST(req({ kind: "practice", subject: "math", score: 50, conceptKey }));
        expect(res.status).toBe(200);
        const j = await res.json();
        expect(j.conceptKey).toBeUndefined();
        const v = _vqt(j.token);
        expect(v.ok).toBe(true);
        expect(v.q.conceptKey).toBeUndefined(); // nothing forged got signed
      }
    } finally {
      delete process.env.QUESTION_TOKEN_SECRET;
    }
  });

  it("the drill prompt replaces the weak-concepts line (targets the one concept, not the weak list)", async () => {
    const fetchMock = mockGroqReturning({
      topicSlug: "arithmetic_number", difficulty: "beginner", reasoningSurface: "multi-step",
      question: "How many groups of 3 are in 12? Explain.",
    });
    const res = await POST(req({ kind: "practice", subject: "math", weakConcepts: ["should not appear"], conceptKey: "counting_cardinality" }));
    expect(res.status).toBe(200);
    const sentUser = JSON.parse(fetchMock.mock.calls[0][1].body).messages.find((m) => m.role === "user").content;
    expect(sentUser).toContain("Counting & cardinality");
    expect(sentUser).not.toContain("should not appear");
    expect((await res.json()).difficulty).toBe("beginner"); // elementary → beginner
  });
});

// ---- mastery-calibrated drill difficulty (RANKS_PLAN §6 via §12.3) ----------

// Same-origin request WITH a bearer token (the signed-in drill path).
function reqAuthed(bodyObj) {
  return new Request("http://test.local/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer test-jwt" },
    body: JSON.stringify(bodyObj),
  });
}

// Minimal concept_mastery read chain: from().select().eq().eq().eq().maybeSingle().
const masteryClient = (row) => ({
  from: () => ({
    select: () => ({
      eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row }) }) }) }),
    }),
  }),
});

describe("POST /api/generate — mastery-calibrated drill band (RANKS_PLAN §6)", () => {
  const drillPayload = {
    topic: "Algebra", topicSlug: "algebra", targetConcept: "x",
    difficulty: "beginner", reasoningSurface: "multi-step",
    question: "Solve x² - 5x + 6 = 0 and explain each step.",
  };

  it("guest masteryState shifts the band ±1 around the rank band (quadratics: intermediate base)", async () => {
    mockGroqReturning(drillPayload);
    let j = await (await POST(req({ kind: "practice", subject: "math", conceptKey: "quadratics", masteryState: "green" }))).json();
    expect(j.difficulty).toBe("advanced"); // stretch one notch up

    mockGroqReturning(drillPayload);
    j = await (await POST(req({ kind: "practice", subject: "math", conceptKey: "quadratics", masteryState: "red" }))).json();
    expect(j.difficulty).toBe("foundational"); // gentler one notch down

    mockGroqReturning(drillPayload);
    j = await (await POST(req({ kind: "practice", subject: "math", conceptKey: "quadratics", masteryState: "yellow" }))).json();
    expect(j.difficulty).toBe("intermediate"); // in progress → rank band
  });

  it("clamps at the ladder edges and ignores junk/grey states (no widening beyond ±1)", async () => {
    mockGroqReturning(drillPayload);
    let j = await (await POST(req({ kind: "practice", subject: "math", conceptKey: "counting_cardinality", masteryState: "red" }))).json();
    expect(j.difficulty).toBe("beginner"); // elementary red: nothing below beginner

    mockGroqReturning(drillPayload);
    j = await (await POST(req({ kind: "practice", subject: "math", conceptKey: "derivatives", masteryState: "green" }))).json();
    expect(j.difficulty).toBe("phd"); // university green: advanced +1

    for (const masteryState of ["grey", "purple", "GREEN", 42, { evil: true }]) {
      mockGroqReturning(drillPayload);
      j = await (await POST(req({ kind: "practice", subject: "math", conceptKey: "quadratics", masteryState }))).json();
      expect(j.difficulty, `state ${JSON.stringify(masteryState)}`).toBe("intermediate");
    }
  });

  it("steers the prompt: red asks for a gentler problem, green for a stretch, neutral for neither", async () => {
    let fetchMock = mockGroqReturning(drillPayload);
    await POST(req({ kind: "practice", subject: "math", conceptKey: "quadratics", masteryState: "red" }));
    let sentUser = JSON.parse(fetchMock.mock.calls[0][1].body).messages.find((m) => m.role === "user").content;
    expect(sentUser).toMatch(/gentler, confidence-building/i);

    fetchMock = mockGroqReturning(drillPayload);
    await POST(req({ kind: "practice", subject: "math", conceptKey: "quadratics", masteryState: "green" }));
    sentUser = JSON.parse(fetchMock.mock.calls[0][1].body).messages.find((m) => m.role === "user").content;
    expect(sentUser).toMatch(/stretch problem/i);

    fetchMock = mockGroqReturning(drillPayload);
    await POST(req({ kind: "practice", subject: "math", conceptKey: "quadratics" }));
    sentUser = JSON.parse(fetchMock.mock.calls[0][1].body).messages.find((m) => m.role === "user").content;
    expect(sentUser).not.toMatch(/gentler, confidence-building|stretch problem/i);
  });

  it("signed-in: the band comes from the SERVER-read concept_mastery row — the body hint is IGNORED", async () => {
    calib.requireUser.mockResolvedValueOnce({ user: { id: "user-1" } });
    calib.adminClient = masteryClient({ attempts: 3, green_hits: 2, last_quality: 90, best_quality: 95 }); // → green
    mockGroqReturning(drillPayload);
    const j = await (await POST(reqAuthed({ kind: "practice", subject: "math", conceptKey: "quadratics", masteryState: "red" }))).json();
    expect(j.difficulty).toBe("advanced"); // server-derived green (+1), NOT the claimed red (−1)
    expect(calib.requireUser).toHaveBeenCalledTimes(1);
  });

  it("signed-in with no mastery row yet → neutral rank band", async () => {
    calib.requireUser.mockResolvedValueOnce({ user: { id: "user-1" } });
    calib.adminClient = masteryClient(null);
    mockGroqReturning(drillPayload);
    const j = await (await POST(reqAuthed({ kind: "practice", subject: "math", conceptKey: "quadratics", masteryState: "green" }))).json();
    expect(j.difficulty).toBe("intermediate"); // untouched concept; the hint is still ignored
  });

  it("an INVALID token degrades to the neutral rank band and the route stays open (200)", async () => {
    calib.requireUser.mockResolvedValueOnce({ error: "Invalid or expired session.", status: 401 });
    mockGroqReturning(drillPayload);
    const res = await POST(reqAuthed({ kind: "practice", subject: "math", conceptKey: "quadratics", masteryState: "green" }));
    expect(res.status).toBe(200);
    expect((await res.json()).difficulty).toBe("intermediate"); // a presented-but-bad token never honors the hint
  });

  it("the CALIBRATED band (not the rank band) is what gets signed into the token", async () => {
    process.env.QUESTION_TOKEN_SECRET = "calib-test-secret";
    try {
      mockGroqReturning(drillPayload);
      const j = await (await POST(req({ kind: "practice", subject: "math", conceptKey: "quadratics", masteryState: "green" }))).json();
      const v = _vqt(j.token);
      expect(v.ok).toBe(true);
      expect(v.q.conceptKey).toBe("quadratics");
      expect(v.q.difficulty).toBe("advanced"); // /api/score reads THIS (then applies its own ≤1-above-level clamp)
    } finally {
      delete process.env.QUESTION_TOKEN_SECRET;
    }
  });
});
