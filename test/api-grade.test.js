import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "@/app/api/grade/route";
import { _resetRateLimits } from "@/lib/rateLimit";

// Substantive, multi-word reasoning the deterministic pre-grade dock lets through to
// the (mocked) grader. Short/"idk"/single-word answers are docked with no Groq call.
const REASONING = "I applied the limit definition and simplified the expression step by step.";
// Complete 9-axis rubrics. The headline is now scoreFromRubric (weighted mean, ΣW=25):
// all-2 → 50, all-4 → 100. The grader emits no headline; the server derives it.
const mkRubric = (v) => ({ comprehension: v, principle: v, justification: v, strategy: v, logic: v, execution_method: v, computation: v, verification: v, communication: v });
const RUBRIC_50 = mkRubric(2); // scoreFromRubric → 50
const RUBRIC_100 = mkRubric(4); // scoreFromRubric → 100

// Build a POST Request the route handler can consume.
function req(bodyObjOrString) {
  const body =
    typeof bodyObjOrString === "string" ? bodyObjOrString : JSON.stringify(bodyObjOrString);
  return new Request("http://test.local/api/grade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

// Mock Groq's HTTP call: return a single choice whose message content is the
// given JSON payload (as the model would emit it).
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

describe("POST /api/grade — request guard (CSRF / content-type)", () => {
  const raw = (headers) =>
    new Request("http://test.local/api/grade", {
      method: "POST",
      headers,
      body: JSON.stringify({ kind: "diagnostic", subject: "math", question: "Q", reasoning: REASONING }),
    });

  it("blocks a forced cross-site request with 403 (no Groq call)", async () => {
    const failFetch = vi.fn(() => { throw new Error("must not call Groq on a blocked request"); });
    vi.stubGlobal("fetch", failFetch);
    const res = await POST(raw({ "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" }));
    expect(res.status).toBe(403);
    expect(failFetch).not.toHaveBeenCalled();
  });

  it("rejects a non-JSON content-type with 415 (no Groq call)", async () => {
    const failFetch = vi.fn(() => { throw new Error("must not call Groq on a blocked request"); });
    vi.stubGlobal("fetch", failFetch);
    const res = await POST(raw({ "Content-Type": "text/plain" }));
    expect(res.status).toBe(415);
    expect(failFetch).not.toHaveBeenCalled();
  });

  it("allows a same-origin JSON request through to normal handling", async () => {
    mockGroqReturning({ subject: "math", score: 50, rubric: RUBRIC_50, weakConcepts: [], comment: "ok" });
    const res = await POST(raw({ "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.score).toBe(50);
  });
});

describe("POST /api/grade — deterministic pre-grade dock (no LLM call)", () => {
  it("docks an empty / 'idk' / gibberish answer to a single-digit score + all-zero rubric, no Groq call", async () => {
    for (const reasoning of ["", "   ", "idk", "no idea", "asdfghjklasdfghjkl"]) {
      const failFetch = vi.fn(() => { throw new Error("must not call Groq on a docked answer"); });
      vi.stubGlobal("fetch", failFetch);
      const res = await POST(req({ kind: "practice", subject: "math", question: "Q", reasoning }));
      expect(res.status).toBe(200);
      const j = await res.json();
      expect(j.docked).toBe(true);
      expect(j.reasoningScore).toBeLessThan(10);
      expect(Object.values(j.rubric).every((v) => v === 0)).toBe(true);
      expect(failFetch).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    }
  });

  it("docks a blank diagnostic answer too (score single-digit, no Groq call)", async () => {
    const failFetch = vi.fn(() => { throw new Error("must not call Groq on a docked answer"); });
    vi.stubGlobal("fetch", failFetch);
    const res = await POST(req({ kind: "diagnostic", subject: "math", question: "Q", reasoning: "pass" }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.docked).toBe(true);
    expect(j.score).toBeLessThan(10);
    expect(failFetch).not.toHaveBeenCalled();
  });

  it("reconciles a score that contradicts its rubric (all-zero rubric can't ship an 88)", async () => {
    mockGroqReturning({
      reasoningScore: 88,
      rubric: { conceptual_understanding: 0, logical_structure: 0, strategy: 0, execution_accuracy: 0, communication: 0 },
      correctnessNote: "", socraticHint: "h", microLesson: "m", weakConcepts: [], newScoreSuggestion: 88,
    });
    const res = await POST(req({ kind: "practice", subject: "math", question: "Q", targetConcept: "x", score: 50, reasoning: REASONING }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.reasoningScore).toBeLessThanOrEqual(25); // pulled toward the rubric-implied 0
    expect(j.reasoningScore).toBeLessThan(88);
  });

  it("returns strengths/improvements + the worked solution on a substantive practice attempt (PR 6)", async () => {
    mockGroqReturning({
      reasoningScore: 70, rubric: RUBRIC_50,
      strengths: ["set up the equation correctly"], improvements: ["show the intermediate sum", 42, "  "],
      workedSolution: "Step 1: ... Step 2: ... Final answer: 7.",
      correctnessNote: "n", socraticHint: "h", microLesson: "m", weakConcepts: [], newScoreSuggestion: 70,
    });
    const res = await POST(req({ kind: "practice", subject: "math", question: "Q", targetConcept: "addition", score: 50, reasoning: REASONING }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.strengths).toEqual(["set up the equation correctly"]);
    expect(j.improvements).toEqual(["show the intermediate sum"]); // non-strings/blanks filtered
    expect(j.workedSolution).toMatch(/Final answer/);
  });

  it("a docked practice answer gets NO worked solution (can't extract the answer with 'idk')", async () => {
    const failFetch = vi.fn(() => { throw new Error("no Groq on a docked answer"); });
    vi.stubGlobal("fetch", failFetch);
    const res = await POST(req({ kind: "practice", subject: "math", question: "Q", targetConcept: "x", reasoning: "idk" }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.docked).toBe(true);
    expect(j.workedSolution).toBe("");
    expect(j.improvements.length).toBeGreaterThan(0); // still gets the "attempt it first" nudge
    expect(failFetch).not.toHaveBeenCalled();
  });
});

describe("POST /api/grade — input validation (no network)", () => {
  it("rejects a non-JSON body with 400", async () => {
    const failFetch = vi.fn(() => {
      throw new Error("network should not be called");
    });
    vi.stubGlobal("fetch", failFetch);
    const res = await POST(req("{ not json"));
    expect(res.status).toBe(400);
    expect(failFetch).not.toHaveBeenCalled();
  });

  it("rejects an unknown kind with 400", async () => {
    const res = await POST(req({ kind: "nope", subject: "math", question: "Q" }));
    expect(res.status).toBe(400);
  });

  it("rejects an oversized request body with 413 before any Groq call (memory-DoS guard)", async () => {
    const failFetch = vi.fn(() => { throw new Error("must not call Groq on an oversized body"); });
    vi.stubGlobal("fetch", failFetch);
    // A JSON body larger than the 10 MB image-route ceiling.
    const huge = JSON.stringify({ kind: "diagnostic", subject: "math", question: "Q", reasoning: "z".repeat(10_000_001) });
    const res = await POST(req(huge));
    expect(res.status).toBe(413);
    expect((await res.json()).error).toMatch(/too large/i);
    expect(failFetch).not.toHaveBeenCalled();
  });

  it("rejects a missing subject/question with 400", async () => {
    const res = await POST(req({ kind: "diagnostic" }));
    expect(res.status).toBe(400);
  });

  it("rejects an unknown subject with 400", async () => {
    const res = await POST(
      req({ kind: "diagnostic", subject: "astrology", question: "Q" })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Unknown subject/);
  });

  it("rejects an inherited/prototype subject key with 400", async () => {
    for (const subject of ["constructor", "__proto__", "toString"]) {
      const res = await POST(req({ kind: "diagnostic", subject, question: "Q" }));
      expect(res.status).toBe(400);
    }
  });

  it("rejects non-base64 image data with 400", async () => {
    const res = await POST(
      req({
        kind: "diagnostic",
        subject: "math",
        question: "Q",
        image: { mime: "image/png", data: "not*valid*base64!" },
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/base64/i);
  });

  it("returns a generic 500 that does not leak upstream Groq detail", async () => {
    // Groq replies non-OK with a revealing body; the route must not echo it.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
        text: async () => '{"error":{"message":"Invalid API Key sk-secret-123"}}',
      }))
    );
    const res = await POST(
      req({ kind: "diagnostic", subject: "math", question: "Q", reasoning: REASONING })
    );
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).not.toMatch(/401|Invalid API Key|sk-secret/);
    expect(json.error).toMatch(/temporarily unavailable/i);
  });

  it("rejects an oversized image with 400", async () => {
    const huge = "a".repeat(7_500_001);
    const res = await POST(
      req({
        kind: "diagnostic",
        subject: "math",
        question: "Q",
        image: { mime: "image/png", data: huge },
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/too large/i);
  });

  it("rejects a disallowed image MIME with 400", async () => {
    const res = await POST(
      req({
        kind: "diagnostic",
        subject: "math",
        question: "Q",
        image: { mime: "text/html", data: "abc" },
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Unsupported image type/i);
  });
});

describe("POST /api/grade — rate limiting", () => {
  it("returns 429 with Retry-After once the per-IP limit is exceeded", async () => {
    mockGroqReturning({ subject: "math", score: 50, weakConcepts: [], comment: "" });
    const headers = { "Content-Type": "application/json", "x-real-ip": "5.5.5.5" };
    const mk = () =>
      new Request("http://test.local/api/grade", {
        method: "POST",
        headers,
        body: JSON.stringify({ kind: "diagnostic", subject: "math", question: "Q" }),
      });
    let res;
    // 30/min is the limit; fire 31 from one IP. Bad-input requests still count.
    for (let i = 0; i < 31; i++) res = await POST(mk());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });
});

describe("POST /api/grade — model output is normalized", () => {
  it("clamps an out-of-range diagnostic score to [0, 100]", async () => {
    mockGroqReturning({ subject: "math", score: 150, rubric: RUBRIC_100, weakConcepts: [], comment: "ok" });
    const res = await POST(
      req({ kind: "diagnostic", subject: "math", question: "Q", reasoning: REASONING })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.score).toBe(100);
  });

  it("normalizes a malformed practice grade (rubric clamped; headline = transparent weighted mean)", async () => {
    mockGroqReturning({
      rubric: { principle: 9, logic: -3 }, // out of range; other axes missing
      correctnessNote: "n",
      socraticHint: "h",
      microLesson: "m",
      weakConcepts: ["x"],
    });
    const res = await POST(
      req({
        kind: "practice",
        subject: "physics",
        question: "Q",
        targetConcept: "vectors",
        score: 50,
        reasoning: REASONING,
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.rubric.principle).toBe(4); // 9 -> clamped to 4
    expect(json.rubric.logic).toBe(0); // -3 -> clamped to 0
    expect(json.rubric.strategy).toBe(0); // missing -> 0
    // scoreFromRubric: only principle scores (weight 5 × value 4) = 20 points.
    expect(json.reasoningScore).toBe(20);
    expect(json.newScoreSuggestion).toBe(20); // = the axis-derived score (no separate model number)
  });

  it("caps oversized free-text before sending it upstream", async () => {
    const fetchMock = mockGroqReturning({
      subject: "math",
      score: 50,
      rubric: RUBRIC_50,
      weakConcepts: [],
      comment: "",
    });
    // Long but VARIED text (a repeated sentence) so the gibberish dock doesn't catch it.
    const giant = "The derivative of x squared is two x. ".repeat(2_000);
    const res = await POST(
      req({ kind: "diagnostic", subject: "math", question: "Q", reasoning: giant })
    );
    expect(res.status).toBe(200);
    // Inspect the body actually sent to Groq: the reasoning must be capped well
    // below 50k chars (cap is 12k) so the prompt can't blow past the context window.
    const sentBody = fetchMock.mock.calls[0][1].body;
    expect(sentBody.length).toBeLessThan(20_000);
  });
});

describe("POST /api/grade — difficulty band threading (practice)", () => {
  // Pull the user-message string actually sent upstream to Groq (no image -> string).
  function sentUserMessage(fetchMock) {
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userMsg = sentBody.messages.find((m) => m.role === "user");
    return typeof userMsg.content === "string" ? userMsg.content : "";
  }

  const practiceBody = (extra) => ({
    kind: "practice",
    subject: "math",
    question: "Q",
    targetConcept: "limits",
    score: 50,
    reasoning: REASONING,
    ...extra,
  });

  const gradePayload = {
    reasoningScore: 60,
    rubric: RUBRIC_50,
    correctnessNote: "n",
    socraticHint: "h",
    microLesson: "m",
    weakConcepts: [],
    newScoreSuggestion: 55,
  };

  it("threads a valid difficulty band into the grader prompt (case/space-normalized)", async () => {
    const fetchMock = mockGroqReturning(gradePayload);
    const res = await POST(req(practiceBody({ difficulty: "PhD " })));
    expect(res.status).toBe(200);
    expect(sentUserMessage(fetchMock)).toMatch(/difficulty band: phd/i);
  });

  it("normalizes an unknown/garbage difficulty to (unspecified) before prompting", async () => {
    const fetchMock = mockGroqReturning(gradePayload);
    await POST(req(practiceBody({ difficulty: "super-impossible" })));
    expect(sentUserMessage(fetchMock)).toMatch(/difficulty band: \(unspecified\)/i);
  });

  it("normalizes a missing/non-string difficulty to (unspecified)", async () => {
    const fetchMock = mockGroqReturning(gradePayload);
    await POST(req(practiceBody({ difficulty: 123 })));
    expect(sentUserMessage(fetchMock)).toMatch(/difficulty band: \(unspecified\)/i);
  });

  it("threads a trap reasoning surface + the naive wrong path into the grader prompt", async () => {
    const fetchMock = mockGroqReturning(gradePayload);
    await POST(req(practiceBody({ reasoningSurface: "trap", trap: "reporting weight as the net force" })));
    const msg = sentUserMessage(fetchMock);
    expect(msg).toMatch(/Reasoning surface: trap/);
    expect(msg).toContain("Common wrong path (trap): reporting weight as the net force");
  });

  it("threads a non-trap surface with NO trap line, and drops a stray trap", async () => {
    const fetchMock = mockGroqReturning(gradePayload);
    await POST(req(practiceBody({ reasoningSurface: "branch", trap: "should not appear" })));
    const msg = sentUserMessage(fetchMock);
    expect(msg).toMatch(/Reasoning surface: branch/);
    expect(msg).not.toContain("Common wrong path");
    expect(msg).not.toContain("should not appear");
  });

  it("omits the surface line entirely for an off-list/absent surface", async () => {
    const fetchMock = mockGroqReturning(gradePayload);
    await POST(req(practiceBody({ reasoningSurface: "atomic", trap: "x" })));
    expect(sentUserMessage(fetchMock)).not.toMatch(/Reasoning surface:/);
  });
});

describe("POST /api/grade — difficulty band threading (diagnostic)", () => {
  // Pull the user-message string actually sent upstream to Groq (no image -> string).
  function sentUserMessage(fetchMock) {
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userMsg = sentBody.messages.find((m) => m.role === "user");
    return typeof userMsg.content === "string" ? userMsg.content : "";
  }

  const diagnosticBody = (extra) => ({
    kind: "diagnostic",
    subject: "math",
    question: "What is the limit of (sin x)/x as x->0?",
    reasoning: "It approaches 1 because sin x is approximately x for small angles, so the ratio tends to 1.",
    ...extra,
  });

  it("threads a valid difficulty band into the grader prompt and returns the normalized {score, weakConcepts} shape", async () => {
    const fetchMock = mockGroqReturning({
      subject: "math",
      score: 150, // a stray model score is now IGNORED — the headline is derived from the rubric
      rubric: RUBRIC_100, // all-4 → scoreFromRubric = 100
      weakConcepts: ["limits", "  ", "epsilon-delta"],
      comment: "ok",
    });
    const res = await POST(req(diagnosticBody({ difficulty: "advanced" })));
    expect(res.status).toBe(200);
    // The captured upstream prompt carries the difficulty band line.
    expect(sentUserMessage(fetchMock)).toMatch(/difficulty band: advanced/i);
    const json = await res.json();
    expect(json.score).toBe(100); // = scoreFromRubric(all-4)
    expect(json.weakConcepts).toEqual(["limits", "epsilon-delta"]); // blank dropped
  });

  it("normalizes a missing difficulty to (unspecified) in the diagnostic prompt", async () => {
    const fetchMock = mockGroqReturning({ subject: "math", score: 50, rubric: { principle: 2 }, weakConcepts: [], comment: "ok" });
    const res = await POST(req(diagnosticBody())); // no difficulty key
    expect(res.status).toBe(200);
    expect(sentUserMessage(fetchMock)).toMatch(/difficulty band: \(unspecified\)/i);
  });
});

describe("POST /api/grade — image validation + vision forwarding", () => {
  // base64 of the 8-byte PNG magic signature (89 50 4E 47 0D 0A 1A 0A).
  const PNG_B64 = "iVBORw0KGgo=";

  it("accepts a real image (magic bytes match) and sends it as a data: URL on the multimodal model", async () => {
    const fetchMock = mockGroqReturning({ subject: "math", score: 70, rubric: { principle: 2 }, weakConcepts: [], comment: "ok" });
    const res = await POST(
      req({ kind: "diagnostic", subject: "math", question: "Q", reasoning: "see my photo", image: { mime: "image/png", data: PNG_B64 } })
    );
    expect(res.status).toBe(200);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.model).toBe("meta-llama/llama-4-scout-17b-16e-instruct");
    const userMsg = sent.messages.find((m) => m.role === "user");
    const imgPart = userMsg.content.find((p) => p.type === "image_url");
    expect(imgPart.image_url.url).toBe(`data:image/png;base64,${PNG_B64}`);
  });

  it("does NOT dock an image-only practice answer (empty text + photo of work) — it reaches the vision grader", async () => {
    // Regression: preGradeDock only inspects TEXT, so an image-only submission (empty
    // text box, worked notes in the photo) must NOT be docked to a non-attempt — the
    // route skips the dock when an image is attached and grades the photo instead.
    const fetchMock = mockGroqReturning({
      reasoningScore: 70, rubric: RUBRIC_50, strengths: [], improvements: [],
      workedSolution: "solution", correctnessNote: "n", socraticHint: "h", microLesson: "m",
      weakConcepts: [], newScoreSuggestion: 60,
    });
    const res = await POST(
      req({ kind: "practice", subject: "math", question: "Q", targetConcept: "x", reasoning: "", image: { mime: "image/png", data: PNG_B64 } })
    );
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.docked).toBeFalsy(); // empty text + image must NOT be docked
    expect(fetchMock).toHaveBeenCalled(); // the (vision) grader ran
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.model).toBe("meta-llama/llama-4-scout-17b-16e-instruct");
  });

  it("rejects arbitrary base64 bytes that are not a real image (magic-byte sniff)", async () => {
    const failFetch = vi.fn(() => { throw new Error("Groq must not be called for a non-image"); });
    vi.stubGlobal("fetch", failFetch);
    const res = await POST(
      req({ kind: "diagnostic", subject: "math", question: "Q", image: { mime: "image/png", data: "aGVsbG8=" } }) // "hello", not an image
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not a supported image/i);
    expect(failFetch).not.toHaveBeenCalled();
  });

  it("rejects a forged MIME (declared type != actual bytes)", async () => {
    const res = await POST(
      req({ kind: "diagnostic", subject: "math", question: "Q", image: { mime: "image/jpeg", data: PNG_B64 } }) // PNG bytes, claims JPEG
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/do not match/i);
  });
});

describe("POST /api/grade — hostile input handling", () => {
  it("treats a non-string `reasoning` as empty instead of throwing a 500", async () => {
    mockGroqReturning({ subject: "math", score: 50, weakConcepts: [], comment: "" });
    const res = await POST(req({ kind: "diagnostic", subject: "math", question: "Q", reasoning: { evil: true } }));
    expect(res.status).toBe(200); // previously `reasoning.trim()` threw before validation
  });
});

// ---- review round: the global Groq budget is wired on THIS unauthenticated route ----
import { _resetRateLimits as _resetRL } from "@/lib/rateLimit";

describe("POST /api/grade — global Groq budget (audit P2-3)", () => {
  it("rejects with 429 once the platform-wide window is exhausted — IP rotation doesn't help", async () => {
    process.env.GLOBAL_GROQ_BUDGET_PER_MIN = "1";
    _resetRL();
    try {
      mockGroqReturning({ subject: "math", score: 50, rubric: { principle: 2 }, weakConcepts: [], comment: "ok" });
      const mk = (ip) => new Request("http://test.local/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-real-ip": ip },
        body: JSON.stringify({ kind: "diagnostic", subject: "math", question: "Q", reasoning: "a substantive multi-step attempt at the problem" }),
      });
      expect((await POST(mk("198.51.100.1"))).status).toBe(200);
      const res2 = await POST(mk("198.51.100.2")); // DIFFERENT IP — still globally bounded
      expect(res2.status).toBe(429);
      expect(res2.headers.get("Retry-After")).toBeTruthy();
    } finally {
      delete process.env.GLOBAL_GROQ_BUDGET_PER_MIN;
      _resetRL();
    }
  });
});
