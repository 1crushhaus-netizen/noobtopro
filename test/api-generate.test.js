import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "@/app/api/generate/route";

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
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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
});

describe("POST /api/generate — happy paths", () => {
  it("returns three diagnostic questions", async () => {
    const payload = {
      questions: [
        { subject: "math", topic: "t", question: "q1" },
        { subject: "physics", topic: "t", question: "q2" },
        { subject: "chemistry", topic: "t", question: "q3" },
      ],
    };
    mockGroqReturning(payload);
    const res = await POST(req({ kind: "diagnostic" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.questions).toHaveLength(3);
  });

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
});
