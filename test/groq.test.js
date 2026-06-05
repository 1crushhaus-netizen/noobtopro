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

  it("parses valid JSON whose string values contain braces", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply('{"microLesson":"use the set {a, b}","score":80}'))
    );
    const out = await groqJSON({ system: "s", user: "u" });
    expect(out).toEqual({ microLesson: "use the set {a, b}", score: 80 });
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
});
