import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "@/app/api/grade/route";
import { _resetRateLimits } from "@/lib/rateLimit";

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
      req({ kind: "diagnostic", subject: "math", question: "Q", reasoning: "x" })
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
    mockGroqReturning({ subject: "math", score: 150, weakConcepts: [], comment: "ok" });
    const res = await POST(
      req({ kind: "diagnostic", subject: "math", question: "Q", reasoning: "because" })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.score).toBe(100);
  });

  it("normalizes a malformed practice grade (reasoningScore, rubric, suggestion)", async () => {
    mockGroqReturning({
      reasoningScore: "not-a-number",
      rubric: { conceptual_understanding: 9, logical_structure: -3 },
      // newScoreSuggestion intentionally omitted
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
        reasoning: "work",
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reasoningScore).toBe(0); // unparseable -> 0
    expect(json.rubric.conceptual_understanding).toBe(4); // 9 -> clamped to 4
    expect(json.rubric.logical_structure).toBe(0); // -3 -> clamped to 0
    expect(json.rubric.strategy).toBe(0); // missing -> 0
    expect(json.newScoreSuggestion).toBe(null); // omitted -> null (blend keeps prev)
  });

  it("caps oversized free-text before sending it upstream", async () => {
    const fetchMock = mockGroqReturning({
      subject: "math",
      score: 50,
      weakConcepts: [],
      comment: "",
    });
    const giant = "x".repeat(50_000);
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
