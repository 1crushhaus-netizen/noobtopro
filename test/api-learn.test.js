import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "@/app/api/learn/route";
import { _resetRateLimits } from "@/lib/rateLimit";

function req(bodyObjOrString) {
  const body = typeof bodyObjOrString === "string" ? bodyObjOrString : JSON.stringify(bodyObjOrString);
  return new Request("http://test.local/api/learn", {
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

describe("POST /api/learn — validation", () => {
  it("rejects an unknown/prototype subject with 400", async () => {
    for (const subject of ["astrology", "constructor", "__proto__"]) {
      const res = await POST(req({ subject, concept: "limits" }));
      expect(res.status).toBe(400);
    }
  });

  it("rejects a missing concept with 400", async () => {
    const res = await POST(req({ subject: "math" }));
    expect(res.status).toBe(400);
  });

  it("rejects a non-JSON body with 400", async () => {
    const res = await POST(req("nope"));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/learn — guidance", () => {
  it("returns normalized, capped guidance for a concept", async () => {
    mockGroqReturning({
      overview: "Limits describe behavior near a point.",
      keyIdeas: ["approach, not arrival", 42, "  ", "epsilon-delta"],
      socraticQuestions: ["What happens as x nears a?"],
      pitfalls: ["confusing value with limit"],
      tryThis: "Sketch f near the point and watch both sides.",
    });
    const res = await POST(req({ subject: "math", concept: "limits", score: 30 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.subject).toBe("math");
    expect(json.concept).toBe("limits");
    expect(json.overview).toMatch(/Limits/);
    // non-strings/blanks filtered out of arrays
    expect(json.keyIdeas).toEqual(["approach, not arrival", "epsilon-delta"]);
    expect(json.socraticQuestions.length).toBe(1);
    expect(json.tryThis).toMatch(/Sketch/);
  });

  it("tolerates malformed model output (arrays default to [])", async () => {
    mockGroqReturning({ overview: "x", keyIdeas: "not-an-array" });
    const res = await POST(req({ subject: "physics", concept: "work-energy" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.keyIdeas).toEqual([]);
    expect(Array.isArray(json.socraticQuestions)).toBe(true);
  });

  it("returns a generic 500 that does not leak upstream detail", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, text: async () => "Invalid API Key sk-x" })));
    const res = await POST(req({ subject: "chemistry", concept: "equilibrium" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).not.toMatch(/401|Invalid API Key|sk-x/);
    expect(json.error).toMatch(/temporarily unavailable/i);
  });
});
