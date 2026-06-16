import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// The PRO ENFORCEMENT gates on the grading routes:
//   - the free DAILY PRACTICE CAP (/api/score, non-Pro accounts), and
//   - PHOTO-OF-WORK grading being Pro-only (/api/score signed-in + /api/grade guest).
// Both only bite when Pro is actually SELLABLE (lib/polar#proIsAvailable) — we mock that
// flag here. requireUser / getSupabaseAdmin / abuseDetection are mocked at the boundary.
// ---------------------------------------------------------------------------
const auth = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/adminAuth", () => ({ requireUser: (...a) => auth.requireUser(...a) }));

const storage = vi.hoisted(() => ({ getAdmin: vi.fn(() => null) }));
vi.mock("@/lib/supabaseAdmin", () => ({ getSupabaseAdmin: () => storage.getAdmin() }));

vi.mock("@/lib/abuseDetection", () => ({
  reportInjection: vi.fn(() => ({ flagged: false, severity: null, matches: [] })),
  reportRateLimit: vi.fn(),
  shouldDockForInjection: () => false,
}));

const polarMock = vi.hoisted(() => ({ proIsAvailable: vi.fn(() => true) }));
vi.mock("@/lib/polar", () => ({ proIsAvailable: (...a) => polarMock.proIsAvailable(...a) }));

import { POST as scorePOST } from "@/app/api/score/route";
import { POST as gradePOST } from "@/app/api/grade/route";
import { signQuestion } from "@/lib/questionToken";
import { _resetRateLimits } from "@/lib/rateLimit";

// A fake service-role client whose subscriptions read resolves to "no row" (not Pro).
function fakeSb() {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: null, error: null }),
    then: (resolve, reject) => Promise.resolve({ data: null, error: null }).then(resolve, reject),
  };
  return { from: () => chain, rpc: vi.fn(async () => ({ data: null, error: null })) };
}

// A fake service-role client whose subscriptions read resolves to an ACTIVE row (Pro).
// (No POLAR_PRODUCT_ID_PRO is set in these tests, so the product check is skipped and the
// status-only predicate applies — isProUserId returns true.)
function fakeSbPro() {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: { status: "active" }, error: null }),
    then: (resolve, reject) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
  };
  return { from: () => chain, rpc: vi.fn(async () => ({ data: null, error: null })) };
}

// Stub Groq (key + fetch) so /api/grade completes a real (non-docked) grade locally,
// returning the given feedback fields. Caller restores GROQ_API_KEY + globals.
function stubGradeFetch({ workedSolution = "Step 1: differentiate. Step 2: solve.", improvements = ["State the units"], strengths = ["Correct setup"] } = {}) {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({ subject: "math", rubric: { principle: 3, logic: 3 }, weakConcepts: [], comment: "ok", strengths, improvements, workedSolution }) } }],
      usage: {},
    }),
    text: async () => "",
  })));
}

const PNG_B64 = "iVBORw0KGgo="; // 8-byte PNG magic signature (passes normalizeImage)

const scoreReq = (body) =>
  new Request("http://test.local/api/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const gradeReq = (body) =>
  new Request("http://test.local/api/grade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const OLD_CAP = process.env.FREE_DAILY_PRACTICE_CAP;
const OLD_SECRET = process.env.QUESTION_TOKEN_SECRET;

beforeEach(() => {
  _resetRateLimits();
  auth.requireUser.mockReset();
  storage.getAdmin.mockReset().mockReturnValue(null);
  polarMock.proIsAvailable.mockReset().mockReturnValue(true);
  process.env.QUESTION_TOKEN_SECRET = "pro-gate-test-secret";
});
afterEach(() => {
  if (OLD_CAP === undefined) delete process.env.FREE_DAILY_PRACTICE_CAP;
  else process.env.FREE_DAILY_PRACTICE_CAP = OLD_CAP;
  if (OLD_SECRET === undefined) delete process.env.QUESTION_TOKEN_SECRET;
  else process.env.QUESTION_TOKEN_SECRET = OLD_SECRET;
});

describe("/api/score — free daily practice cap (Pro = unlimited)", () => {
  it("402s a non-Pro account once the daily cap is exceeded", async () => {
    process.env.FREE_DAILY_PRACTICE_CAP = "2";
    auth.requireUser.mockResolvedValue({ user: { id: "capuser" } }); // not Pro (no admin store)
    const mk = () => scoreReq({ kind: "practice", token: "x", reasoning: "anything" });
    // Calls within the cap pass the gate (then 503 on the null store — NOT 402).
    expect((await scorePOST(mk())).status).not.toBe(402);
    expect((await scorePOST(mk())).status).not.toBe(402);
    // The cap+1th practice grade is 402 (Payment Required) with the upgrade flag.
    const over = await scorePOST(mk());
    expect(over.status).toBe(402);
    const body = await over.json();
    expect(body.upgrade).toBe(true);
    expect(body.error).toMatch(/upgrade to pro/i);
  });

  it("does NOT cap when Pro is not sold (proIsAvailable=false)", async () => {
    process.env.FREE_DAILY_PRACTICE_CAP = "2";
    polarMock.proIsAvailable.mockReturnValue(false);
    auth.requireUser.mockResolvedValue({ user: { id: "freeuser" } });
    const mk = () => scoreReq({ kind: "practice", token: "x", reasoning: "anything" });
    for (let i = 0; i < 4; i++) {
      expect((await scorePOST(mk())).status).not.toBe(402); // cap is inert
    }
  });
});

describe("photo-of-work grading is Pro-only", () => {
  it("/api/score 402s a non-Pro signed-in user who attaches a photo", async () => {
    process.env.FREE_DAILY_PRACTICE_CAP = "100"; // don't let the daily cap fire first
    storage.getAdmin.mockReturnValue(fakeSb()); // non-null store; subscriptions → not Pro
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const token = signQuestion({ subject: "math", question: "Evaluate the limit.", difficulty: "intermediate" });
    const res = await scorePOST(scoreReq({ kind: "practice", token, reasoning: "I worked it out.", image: { mime: "image/png", data: PNG_B64 } }));
    expect(res.status).toBe(402);
    expect((await res.json()).upgrade).toBe(true);
  });

  it("/api/grade 402s a guest who attaches a photo on practice", async () => {
    auth.requireUser.mockResolvedValue({ error: "Authentication required.", status: 401 }); // guest
    const res = await gradePOST(gradeReq({ kind: "practice", subject: "math", question: "Q?", reasoning: "work", image: { mime: "image/png", data: PNG_B64 } }));
    expect(res.status).toBe(402);
    expect((await res.json()).upgrade).toBe(true);
  });

  it("/api/grade does NOT gate a photo when Pro is not sold", async () => {
    polarMock.proIsAvailable.mockReturnValue(false);
    auth.requireUser.mockResolvedValue({ error: "Authentication required.", status: 401 });
    // With the gate inert it falls through to grading; stub Groq (key + fetch) so the
    // grade completes locally instead of erroring on a missing key / hitting the network.
    const OLD_KEY = process.env.GROQ_API_KEY;
    process.env.GROQ_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ subject: "math", rubric: { principle: 2 }, weakConcepts: [], comment: "ok", strengths: [], improvements: [] }) } }], usage: {} }),
      text: async () => "",
    })));
    try {
      const res = await gradePOST(gradeReq({ kind: "practice", subject: "math", question: "Q?", reasoning: "a real worked attempt here", image: { mime: "image/png", data: PNG_B64 } }));
      expect(res.status).not.toBe(402);
    } finally {
      vi.unstubAllGlobals();
      if (OLD_KEY === undefined) delete process.env.GROQ_API_KEY;
      else process.env.GROQ_API_KEY = OLD_KEY;
    }
  });
});

describe("worked solutions + 'how to reach 100' are Pro-only (P0-3)", () => {
  const OLD_KEY = process.env.GROQ_API_KEY;
  afterEach(() => {
    vi.unstubAllGlobals();
    if (OLD_KEY === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = OLD_KEY;
  });

  it("/api/grade withholds the worked solution + improvements from a non-Pro caller (and flags the lock)", async () => {
    auth.requireUser.mockResolvedValue({ error: "Authentication required.", status: 401 }); // guest = not Pro
    process.env.GROQ_API_KEY = "test-key";
    stubGradeFetch();
    const res = await gradePOST(gradeReq({ kind: "practice", subject: "math", question: "Find dy/dx.", reasoning: "I differentiated term by term and simplified." }));
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.workedSolution).toBe("");
    expect(b.improvements).toEqual([]);
    expect(b.workedSolutionLocked).toBe(true);
    // Free feedback is retained — only the Pro fields are withheld.
    expect(b.strengths.length).toBeGreaterThan(0);
    expect(b.rubric).toBeTruthy();
  });

  it("/api/grade returns the full worked solution + improvements to a Pro caller", async () => {
    storage.getAdmin.mockReturnValue(fakeSbPro());
    auth.requireUser.mockResolvedValue({ user: { id: "prouser" } });
    process.env.GROQ_API_KEY = "test-key";
    stubGradeFetch({ workedSolution: "Step 1: differentiate.", improvements: ["Show the units"] });
    const res = await gradePOST(gradeReq({ kind: "practice", subject: "math", question: "Find dy/dx.", reasoning: "I differentiated term by term and simplified." }));
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.workedSolution).toContain("Step 1");
    expect(b.improvements.length).toBeGreaterThan(0);
    expect(b.workedSolutionLocked).toBe(false);
  });

  it("/api/grade keeps worked solutions OPEN when Pro is not sold", async () => {
    polarMock.proIsAvailable.mockReturnValue(false);
    auth.requireUser.mockResolvedValue({ error: "Authentication required.", status: 401 });
    process.env.GROQ_API_KEY = "test-key";
    stubGradeFetch({ workedSolution: "Step 1: differentiate." });
    const res = await gradePOST(gradeReq({ kind: "practice", subject: "math", question: "Find dy/dx.", reasoning: "I differentiated term by term and simplified." }));
    const b = await res.json();
    expect(b.workedSolution).toContain("Step 1");
    expect(b.workedSolutionLocked).toBe(false);
  });
});
