import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { groqJSON } from "@/lib/groq";

function reply(content) {
  return { ok: true, json: async () => ({ choices: [{ message: { content } }] }), text: async () => "" };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("groqJSON", () => {
  beforeEach(() => {
    process.env.GROQ_API_KEY = "test-key";
  });

  it("throws a helpful error when GROQ_API_KEY is unset", async () => {
    delete process.env.GROQ_API_KEY;
    await expect(groqJSON({ system: "s", user: "u" })).rejects.toThrow(/GROQ_API_KEY/);
  });

  it("parses JSON wrapped in markdown code fences", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply('```json\n{"score": 42}\n```'))
    );
    const out = await groqJSON({ system: "s", user: "u" });
    expect(out).toEqual({ score: 42 });
  });

  it("extracts the JSON object even with surrounding prose", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply('Sure! Here you go: {"a":1,"b":2} — hope that helps'))
    );
    const out = await groqJSON({ system: "s", user: "u" });
    expect(out).toEqual({ a: 1, b: 2 });
  });

  it("parses JSON with braces in a string value amid prose with stray braces", async () => {
    // Pins the fix on a single input: the leading "{a,b}" defeats the old
    // indexOf("{") start, and the "{x, y}" inside the string value would defeat
    // a non-string-aware brace counter. Old extractJSON throws on this; new passes.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply('Concept {a,b}: {"microLesson":"use the set {x, y}","score":80}'))
    );
    const out = await groqJSON({ system: "s", user: "u" });
    expect(out).toEqual({ microLesson: "use the set {x, y}", score: 80 });
  });

  it("extracts the object when trailing prose contains a stray brace", async () => {
    // The genuinely-broken case: a naive first-"{"/last-"}" slice grabs the "}"
    // from "{1}" in the trailing prose and fails to parse. The balanced scan
    // stops at the object's real closing brace.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply('{"score":80,"microLesson":"see fig 1"} see figure {1}'))
    );
    const out = await groqJSON({ system: "s", user: "u" });
    expect(out).toEqual({ score: 80, microLesson: "see fig 1" });
  });

  it("ignores a stray brace in leading prose", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply('note {see below}: {"a":1}'))
    );
    const out = await groqJSON({ system: "s", user: "u" });
    expect(out).toEqual({ a: 1 });
  });

  it("falls back to a non-JSON-mode retry when the first response is unparseable", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply("no json here at all"))
      .mockResolvedValueOnce(reply('{"ok":true}'));
    vi.stubGlobal("fetch", fetchMock);
    const out = await groqJSON({ system: "s", user: "u" });
    expect(out).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces an upstream HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 429, text: async () => "rate limited" }))
    );
    await expect(groqJSON({ system: "s", user: "u" })).rejects.toThrow(/429/);
  });

  it("does NOT retry on a hard HTTP error (429) — fails fast after one call", async () => {
    // Regression: a 429/401/5xx is not fixed by retrying without response_format;
    // the old code retried, doubling cost and 429 pressure. It must fail after ONE call.
    const fetchMock = vi.fn(async () => ({ ok: false, status: 429, text: async () => "rate limited" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(groqJSON({ system: "s", user: "u" })).rejects.toThrow(/429/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("DOES retry without response_format on an HTTP 400 (model rejected json mode)", async () => {
    // A 400 can mean the model rejected response_format; retrying plain is worth it.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => "response_format unsupported" })
      .mockResolvedValueOnce(reply('{"ok":true}'));
    vi.stubGlobal("fetch", fetchMock);
    const out = await groqJSON({ system: "s", user: "u" });
    expect(out).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to a text-only grade on the text model when a vision call hits a hard error (429)", async () => {
    // A 429/5xx on the VISION model is model-specific; TEXT_MODEL is a separate
    // endpoint, so a degraded text-only grade is still a valid recovery (not a
    // total failure). First (vision) call 429 → second call must be text-only.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => "vision rate limited" })
      .mockResolvedValueOnce(reply('{"reasoningScore":50}'));
    vi.stubGlobal("fetch", fetchMock);
    const out = await groqJSON({ system: "s", user: "u", image: { data: "abc", mime: "image/png" } });
    expect(out).toEqual({ reasoningScore: 50 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(secondBody.model).toBe("llama-3.3-70b-versatile"); // TEXT_MODEL
    expect(typeof secondBody.messages[1].content).toBe("string"); // text-only, no image array
  });

  it("fails fast on a vision 401/403 (shared key) without a pointless text-only retry", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401, text: async () => "bad key" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      groqJSON({ system: "s", user: "u", image: { data: "abc", mime: "image/png" } })
    ).rejects.toThrow(/401/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("on an image PARSE failure, falls back to ONE text-only call — never re-calls the vision model (cost cap)", async () => {
    // Cost-amplification regression: the old chain retried the vision model a second
    // time with the full image on a parse failure (up to 2 multi-MB vision calls).
    // Now an image makes at most ONE vision call, then a single text-only fallback.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply("not json — vision model rambled")) // 1st = vision, unparseable
      .mockResolvedValueOnce(reply('{"reasoningScore":60}')); // 2nd = text fallback
    vi.stubGlobal("fetch", fetchMock);
    const out = await groqJSON({ system: "s", user: "u", image: { data: "abc", mime: "image/png" } });
    expect(out).toEqual({ reasoningScore: 60 });
    expect(fetchMock).toHaveBeenCalledTimes(2); // exactly one retry, not a 2nd vision call
    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(firstBody.model).toBe("meta-llama/llama-4-scout-17b-16e-instruct"); // VISION
    expect(Array.isArray(firstBody.messages[1].content)).toBe(true); // 1st carried the image
    expect(secondBody.model).toBe("llama-3.3-70b-versatile"); // TEXT_MODEL
    expect(typeof secondBody.messages[1].content).toBe("string"); // 2nd is text-only (no image)
  });

  it("threads a per-call maxTokens into the request body, defaulting to 1200", async () => {
    const fetchMock = vi.fn(async () => reply('{"ok":true}'));
    vi.stubGlobal("fetch", fetchMock);
    await groqJSON({ system: "s", user: "u", maxTokens: 3000 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).max_tokens).toBe(3000);
    fetchMock.mockClear();
    await groqJSON({ system: "s", user: "u" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).max_tokens).toBe(1200);
  });

  it("routes grade:true to the (cheaper) GRADE_MODEL with reasoning_effort low", async () => {
    const fetchMock = vi.fn(async () => reply('{"reasoningScore":50}'));
    vi.stubGlobal("fetch", fetchMock);
    await groqJSON({ system: "s", user: "u", grade: true });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toMatch(/gpt-oss/); // GRADE_MODEL defaults to openai/gpt-oss-120b
    expect(body.reasoning_effort).toBe("low"); // pin reasoning low so it stays cheap
  });

  it("uses the default text model with NO reasoning_effort for non-grade calls", async () => {
    const fetchMock = vi.fn(async () => reply('{"ok":true}'));
    vi.stubGlobal("fetch", fetchMock);
    await groqJSON({ system: "s", user: "u" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("llama-3.3-70b-versatile");
    expect(body.reasoning_effort).toBeUndefined();
  });
});
