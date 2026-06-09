"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  SUBJECTS,
  ORDER,
  SCALE_NOTE,
  band,
  totalPoints,
  phdIndex,
  DIAGNOSTIC_DIFFICULTIES,
  DIFFICULTY_LABELS,
  updateAxisRatings,
  repeatFactorFromHistory,
  defaultDifficultyForBand,
  explainRankMove,
} from "@/lib/scoring";
import { loadState, saveProgress, resetAll, migrateGuestToAccount, deleteAllUserData, loadReviews } from "@/lib/store";
import { getSupabase, isSupabaseConfigured, signInWithProvider, signOutUser, PROVIDERS } from "@/lib/supabase";
import Icon from "@/components/Icon";
import Dashboard from "@/components/Dashboard";
import SignIn from "@/components/SignIn";
import LearnTab from "@/components/LearnTab";
import AdminDashboard from "@/components/AdminDashboard";
import ScoreBreakdown, { ErrorList, hasReasoningError } from "@/components/ScoreBreakdown";
import { SubjectGlyph, deltaColor } from "@/components/ui";

/* ----------------------------- helpers ----------------------------- */
async function api(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok || data.error) {
    let msg = data.error || `Request failed (${res.status})`;
    if (res.status === 429) {
      // Surface the server's Retry-After so the user knows how long to wait.
      const retry = Number(res.headers.get("Retry-After"));
      if (Number.isFinite(retry) && retry > 0) {
        msg = `Too many requests — please wait ${retry}s and try again.`;
      }
    }
    throw new Error(msg);
  }
  return data;
}

// Like api(), but attaches the signed-in user's Supabase access token so the server
// can verify the caller's identity from the JWT. Used by the authenticated routes:
// the Admin tab (/api/admin/*) and server-authoritative scoring (/api/score), which
// both re-verify the token on every call and never trust a client-supplied identity.
async function authApi(path, body) {
  const sb = getSupabase();
  let token = null;
  if (sb) {
    const { data } = await sb.auth.getSession();
    token = (data && data.session && data.session.access_token) || null;
  }
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body || {}),
  });
  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

const now = () => new Date().toISOString();

// Stable per-question key for the 2-tier diagnostic (each subject has an
// easy + a hard question), so the answers map can hold all 6 answers.
const qid = (q) => (q ? `${q.subject}:${q.difficulty}` : "");

// NEXT_PUBLIC_* is inlined at build time. When "true", the Learn tab becomes the
// browsable Concept Hub (full catalog); otherwise it stays the weak-concept picker.
const HUB_ENABLED = process.env.NEXT_PUBLIC_ENABLE_CONCEPT_HUB === "true";

// Object URLs created for image previews must be revoked or they leak memory
// for the life of the page. Safe to call with a missing/blob-less image.
function revokePreview(img) {
  if (img && img.preview) {
    try {
      URL.revokeObjectURL(img.preview);
    } catch {
      /* already revoked / not an object URL */
    }
  }
}

/* ----------------------------- small ui ----------------------------- */
function Ring({ value, color, size = 96, stroke = 9, label }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${label ? `${label}: ` : ""}Score ${Math.round(Math.max(0, Math.min(100, value)))} of 100`}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.09)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={off}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 1s cubic-bezier(.2,.7,.2,1)" }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill="var(--text)" style={{ fontFamily: "var(--mono)", fontSize: size * 0.3, fontWeight: 700 }}>
        {Math.round(value)}
      </text>
    </svg>
  );
}

const SKIP_LOCK_SECONDS = 10;
function AnswerComposer({ value, onText, img, onAttach, onRemoveImg, onSubmit, onSkip, submitLabel, loading, placeholder, lockKey }) {
  const fileRef = useRef(null);
  const canSubmit = (value && value.trim().length > 0) || img;
  // The "I don't know" skip is TIME-LOCKED for SKIP_LOCK_SECONDS after each new question,
  // so a learner can't reflexively skip without giving it a moment's thought. The countdown
  // resets when lockKey (the question identity) changes.
  const [skipIn, setSkipIn] = useState(onSkip ? SKIP_LOCK_SECONDS : 0);
  useEffect(() => {
    if (!onSkip) return undefined;
    setSkipIn(SKIP_LOCK_SECONDS);
    const id = setInterval(() => setSkipIn((n) => {
      if (n <= 1) { clearInterval(id); return 0; }
      return n - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [lockKey, onSkip]);
  const skipLocked = skipIn > 0;
  return (
    <div className="np-card np-input-card">
      <textarea
        className="np-input"
        aria-label="Your reasoning"
        value={value}
        onChange={(e) => onText(e.target.value)}
        placeholder={placeholder || "Show your full reasoning — every step, not just the answer."}
        rows={6}
      />
      {img && (
        <div style={{ padding: "0 16px 8px", display: "flex", alignItems: "center", gap: 10 }}>
          <img src={img.preview} alt="your work" style={{ height: 56, borderRadius: 8, border: "1px solid var(--line)" }} />
          <span style={{ fontSize: 13, color: "var(--muted)" }}>{img.name}</span>
          <button className="np-iconbtn" onClick={onRemoveImg} aria-label="remove image"><Icon name="x" size={15} /></button>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 12px", borderTop: "1px solid var(--line)", background: "rgba(255,255,255,.015)", flexWrap: "wrap" }}>
        <button className="np-ghost" onClick={() => fileRef.current && fileRef.current.click()}><Icon name="clip" size={15} /> Attach your work</button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={async (e) => {
            const f = e.target.files && e.target.files[0];
            if (f) await onAttach(f);
            e.target.value = "";
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {onSkip && (
            <button
              type="button"
              className="np-ghost np-skip"
              disabled={skipLocked || loading}
              onClick={onSkip}
              aria-label={skipLocked ? `I don't know — available in ${skipIn} seconds` : "I don't know — skip this question"}
              title={skipLocked ? "Take a moment to think it through first" : "Skip — I don't know this one"}
            >
              {skipLocked ? `I don't know (${skipIn}s)` : "I don't know"}
            </button>
          )}
          <button className="np-btn np-primary" disabled={!canSubmit || loading} onClick={onSubmit}>
            {loading ? "Working…" : submitLabel} {!loading && <Icon name="arrow" size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function Loader({ subject }) {
  const lines = ["Reading your reasoning line by line", "Weighing the thinking, not just the answer", "Scoring against the rubric"];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % lines.length), 1400);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="np-card fade-up" role="status" aria-live="polite" style={{ textAlign: "center", padding: "48px 24px" }}>
      <div className="np-pulse" style={{ fontFamily: "var(--mono)", fontSize: 13, letterSpacing: 1, color: "var(--muted)" }}>
        {subject ? subject.toUpperCase() : "EVALUATING"}
      </div>
      <div style={{ fontFamily: "var(--display)", fontSize: 22, marginTop: 10 }}>{lines[i]}…</div>
    </div>
  );
}

/* ----------------------------- app ----------------------------- */
export default function Noobtopro() {
  const [stage, setStage] = useState("intro"); // intro | signin | diagnostic | scoring | dashboard | practice
  const [view, setView] = useState("practice"); // practice | learn | dashboard
  // True while a Dashboard slide-over drawer is open, so the page background can be
  // made inert (proper modal focus containment). Set via Dashboard.onOverlayActiveChange.
  const [overlayActive, setOverlayActive] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAuthNote, setShowAuthNote] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false); // server-verified via /api/admin/me; gates the Admin tab

  const [questions, setQuestions] = useState([]);
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState({});

  const [scores, setScores] = useState(null);
  const [history, setHistory] = useState([]);

  const [pSubject, setPSubject] = useState(null);
  const [pQuestion, setPQuestion] = useState(null);
  const [pText, setPText] = useState("");
  const [pImg, setPImg] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [scoreDelta, setScoreDelta] = useState(null);

  // Learn tab: a selected weak concept + its Socratic guidance.
  const [learnConcept, setLearnConcept] = useState(null); // { subject, concept }
  const [learnContent, setLearnContent] = useState(null);
  const [learnBusy, setLearnBusy] = useState(false);
  const [learnError, setLearnError] = useState("");
  // The active "try this" practice question for the open concept ({question,
  // targetConcept, difficulty}) — seeded from the cached guide, replaceable via
  // "Regenerate" (session-only). And a flag for that regenerate request.
  const [learnQuestion, setLearnQuestion] = useState(null);
  const [learnRegen, setLearnRegen] = useState(false);

  // Monotonic token so overlapping hydrate() calls (mount + onAuthStateChange
  // both fire on load) can't clobber each other: only the newest result wins.
  const hydrateRun = useRef(0);

  // Where to return when the sign-in menu is dismissed (so opening it mid-flow
  // and pressing Back doesn't discard an in-progress diagnostic or wrong tab).
  const signinReturn = useRef({ stage: "intro", view: "practice" });

  // Save-progress modal: focus the dialog on open, restore focus on close.
  const saveModalFocusRef = useRef(null);
  const saveModalPrevFocus = useRef(null);

  // Monotonic token so a slow /api/learn response can't overwrite a newer
  // concept the user has since clicked.
  const learnRun = useRef(0);

  // Monotonic token so an in-flight diagnostic grade (a multi-second Promise.all
  // over /api/grade) can't land a stale write after the user abandons the flow
  // — sign-out (SIGNED_OUT) or "Restart" (reset()) bump this so the resolving
  // submitDiagnostic bails instead of re-persisting the baseline and bouncing
  // the freshly-reset UI back onto the dashboard.
  const diagRun = useRef(0);

  // Monotonic token so a slow in-flight startPractice generation can't land its
  // question after the user has moved to a different practice question/subject —
  // e.g. via the Learn tab's "Practice this problem" (startPracticeWithQuestion) —
  // which would otherwise grade the wrong concept and update the wrong subject's
  // score. Bumped by startPractice (per call) and by startPracticeWithQuestion.
  const practiceRun = useRef(0);

  // Per-session memo of fetched concept guides, keyed "subject::concept". Concept
  // guides are deterministic + standardized, so once fetched we render instantly
  // on a revisit with NO server round-trip (and the server's shared cache means
  // the LLM only ever generates each guide once across all users).
  const learnCacheRef = useRef({});
  // In-flight /api/learn promises by key, so concurrent opens of the SAME concept
  // (double-click, or open-A → leave → reopen-A before it lands) share ONE billable
  // request instead of firing a second Groq generation.
  const learnInflightRef = useRef(new Map());

  // Session ring-buffer of recently-SHOWN practice/regenerate question texts, keyed
  // (e.g. "practice:math" or "learn:math::solving linear equations"). Sent to
  // /api/generate as an avoid-list so a new question / "Regenerate" doesn't keep
  // re-deriving the same canonical problem. Session-only (a ref, not persisted).
  const recentQuestionsRef = useRef(new Map());
  function pushRecentQuestion(key, q) {
    if (!key || typeof q !== "string" || !q.trim()) return;
    const m = recentQuestionsRef.current;
    const prev = m.get(key) || [];
    // De-dupe, keep the most recent 6 (newest last).
    m.set(key, [...prev.filter((x) => x !== q), q].slice(-6));
  }
  const getRecentQuestions = (key) => recentQuestionsRef.current.get(key) || [];
  function openSignIn() {
    if (stage === "signin") return; // don't overwrite the return target with "signin"
    signinReturn.current = { stage, view };
    setStage("signin");
  }
  function closeSignIn() {
    setView(signinReturn.current.view);
    setStage(signinReturn.current.stage);
  }

  // load progress from the data layer (Supabase when signed in, else local)
  async function hydrate() {
    const myRun = ++hydrateRun.current;
    // If the user just signed in and has guest progress, fold it into the
    // account before loading (no-op when not signed in / nothing to migrate).
    const mig = await migrateGuestToAccount();
    if (myRun !== hydrateRun.current) return;
    if (mig && mig.error) {
      // Migration failed atomically (nothing written); the guest copy is kept
      // for a retry on the next load. Let the user know.
      setError("We couldn't save your guest progress just now. Please try again.");
    }
    const st = await loadState();
    if (myRun !== hydrateRun.current) return; // superseded by a newer hydrate
    // A failed load (transient DB error, paused project) must NOT be treated as
    // "no data" — keep current state instead of bouncing the user to the intro,
    // and tell the user so they can retry rather than facing a silent stall.
    if (st && st.error) {
      setError("We couldn't load your saved progress. Check your connection and try again.");
      return;
    }
    if (st && st.scores) {
      setScores(st.scores);
      setHistory(st.history || []);
      setStage((p) => (p === "intro" || p === "scoring" ? "dashboard" : p));
    } else {
      setScores(null);
      setHistory((st && st.history) || []);
      setStage((p) => (p === "dashboard" || p === "practice" ? "intro" : p));
      setView("practice");
    }
  }

  // Mirror the latest in-progress image previews so the auth listener (set up once
  // on mount, with a stale closure) can revoke them when a sign-out abandons the
  // current diagnostic/practice — otherwise those object URLs leak until reload.
  const answersRef = useRef(answers);
  const pImgRef = useRef(pImg);
  useEffect(() => {
    answersRef.current = answers;
    pImgRef.current = pImg;
  });

  // Ask the server whether the signed-in user is an admin (deny-by-default). The
  // result only REVEALS the Admin tab — every admin action re-verifies server-side.
  async function checkAdmin() {
    try {
      const d = await authApi("/api/admin/me");
      setIsAdmin(!!(d && d.isAdmin));
    } catch {
      setIsAdmin(false);
    }
  }

  useEffect(() => {
    const sb = getSupabase();
    hydrate();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => {
      const u = (data && data.user) || null;
      setUser(u);
      if (u) checkAdmin();
    }).catch(() => setUser(null));
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      setUser((session && session.user) || null);
      // Only reload data when the identity actually changes. TOKEN_REFRESHED /
      // USER_UPDATED / INITIAL_SESSION fire routinely and would otherwise re-run
      // hydrate mid-attempt (the mount call above already covers session restore).
      if (event === "SIGNED_IN") {
        setShowSaveModal(false);
        setStage((p) => (p === "signin" ? "dashboard" : p)); // leave the sign-in menu
        hydrate(); // migrates guest progress, then loads the account
        checkAdmin(); // reveal the Admin tab if this account is an admin
      } else if (event === "SIGNED_OUT") {
        // Signing out abandons any in-progress diagnostic/practice. Free its image
        // previews and clear the composer state, then drop to "intro" so the
        // abandoned flow unmounts cleanly — without the explicit stage reset, a
        // sign-out mid-diagnostic leaves stage="diagnostic" with no questions (a
        // blank screen), since hydrate()'s no-data branch only resets dashboard/
        // practice. hydrate() then loads the guest view (intro -> dashboard if the
        // guest already has scores).
        Object.values(answersRef.current || {}).forEach((a) => revokePreview(a && a.img));
        revokePreview(pImgRef.current);
        diagRun.current++; // supersede any in-flight diagnostic grade so it can't land a stale write
        practiceRun.current++; // and any in-flight practice grade (so it can't write the prior identity's score into the guest store)
        setBusy(false); // clear any busy left by a now-superseded in-flight grade
        setAnswers({});
        setQuestions([]);
        setQi(0);
        setPImg(null);
        setPText("");
        setPQuestion(null);
        setFeedback(null);
        setStage("intro");
        setView("practice");
        // Drop the prior user's in-memory copy of scores/history/learn IMMEDIATELY
        // (defense-in-depth on shared devices). hydrate()'s no-data branch clears
        // these too, but only after an awaited getSession() — that async gap leaves a
        // sub-second window where the next person could click Learn/Progress and see
        // the prior user's data. These synchronous resets close that window so the
        // stale data can't render during the async hydrate.
        setScores(null);
        setHistory([]);
        setScoreDelta(null);
        setLearnConcept(null);
        setLearnContent(null);
        setLearnQuestion(null);
        setLearnError("");
        setIsAdmin(false); // hide the Admin tab immediately on sign-out
        // Clear the local guest blob on sign-out so the prior user's scores/weak
        // concepts aren't exposed to the next person on a shared device.
        resetAll();
        hydrate();
      }
    });
    return () => sub && sub.subscription && sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The "Restart" logo. Clears the transient diagnostic/practice/learn flow state
  // and returns home. Crucially, it must NOT make a signed-in user's PERSISTED
  // progress disappear: scores/history live in the DB (only Profile → "Reset my
  // progress" deletes them). For a signed-in user we keep that data and re-hydrate;
  // only a guest's local-only session is cleared.
  async function reset() {
    diagRun.current++; // supersede any in-flight diagnostic grade so it can't land a stale write
    practiceRun.current++; // and any in-flight practice grade (see submitPractice's guard)
    setBusy(false); // a superseded in-flight grade won't clear its own busy flag (its finally is run-guarded)
    // Release any outstanding image previews and clear the transient flow state
    // (applies whether signed in or guest).
    Object.values(answers).forEach((a) => revokePreview(a && a.img));
    revokePreview(pImg);
    setShowSaveModal(false);
    setLearnConcept(null);
    setLearnContent(null);
    setLearnError("");
    setLearnQuestion(null);
    setQuestions([]);
    setQi(0);
    setAnswers({});
    setPSubject(null);
    setPQuestion(null);
    setPText("");
    setPImg(null);
    setFeedback(null);
    setScoreDelta(null);
    setError("");
    setView("practice");

    if (user) {
      // Signed in: do NOT blank the persisted scores. Return to the dashboard (or
      // the intro if they haven't been ranked yet) and re-hydrate from the data
      // layer so the view always matches what's stored — previously reset() dropped
      // scores to null and never reloaded, so progress vanished until a refresh.
      setStage(scores ? "dashboard" : "intro");
      hydrate();
    } else {
      // Guest: "Restart" clears the local-only session and returns to the intro.
      await resetAll();
      setScores(null);
      setHistory([]);
      setStage("intro");
    }
  }

  // Sign out. Clear the sensitive in-memory view SYNCHRONOUSLY before the async
  // signOutUser() network round-trip, so on a shared device the prior user's scores,
  // email, leaderboard position, and Learn data can't linger on screen during that
  // round-trip — or forever if signOut() hangs/fails offline. The onAuthStateChange
  // SIGNED_OUT handler then runs the full reset (previews, guest blob, re-hydrate).
  function handleSignOut() {
    setUser(null); // hide identity-bearing surfaces (Profile/Admin/email) immediately
    setIsAdmin(false);
    setScores(null);
    setHistory([]);
    setScoreDelta(null);
    setFeedback(null);
    setLearnConcept(null);
    setLearnContent(null);
    setLearnQuestion(null);
    setLearnError("");
    setView("practice");
    setStage("intro");
    signOutUser();
  }

  // Profile → "Reset my progress": permanently delete the signed-in user's data.
  async function resetProgress() {
    diagRun.current++; // supersede any in-flight grade so it can't re-persist deleted data
    practiceRun.current++;
    setBusy(false);
    try {
      await deleteAllUserData();
      setScores(null);
      setHistory([]);
      setLearnConcept(null);
      setLearnContent(null);
      setLearnError("");
      setLearnQuestion(null);
      setView("practice");
      setStage("intro");
      setError("");
    } catch (e) {
      setError(e.message || "Could not reset your progress.");
    }
  }

  /* --- diagnostic --- */
  async function beginDiagnostic() {
    setError("");
    setBusy(true);
    try {
      const data = await api("/api/generate", { kind: "diagnostic" });
      // Index by subject+difficulty, then require ALL 3 subjects × ALL tiers
      // (6 questions: easy+hard per subject). Guards against duplicates / unknown
      // subject or difficulty / a partial set. ORDER.includes is prototype-safe.
      const byKey = {};
      for (const q of data.questions || []) {
        if (
          q &&
          ORDER.includes(q.subject) &&
          DIAGNOSTIC_DIFFICULTIES.includes(q.difficulty) &&
          typeof q.question === "string" &&
          q.question.trim() &&
          !byKey[qid(q)]
        ) {
          byKey[qid(q)] = q;
        }
      }
      // Order subject-major, easy → hard.
      const qs = [];
      for (const s of ORDER) for (const d of DIAGNOSTIC_DIFFICULTIES) if (byKey[`${s}:${d}`]) qs.push(byKey[`${s}:${d}`]);
      if (qs.length < ORDER.length * DIAGNOSTIC_DIFFICULTIES.length) {
        throw new Error("Could not generate a full diagnostic. Please try again.");
      }
      const init = {};
      qs.forEach((q) => (init[qid(q)] = { text: "", img: null }));
      // Release any previews left over from a previous diagnostic before replacing
      // the answers map, so re-taking the diagnostic can't leak the old blob URLs.
      Object.values(answers).forEach((a) => revokePreview(a && a.img));
      setQuestions(qs);
      setAnswers(init);
      setQi(0);
      setStage("diagnostic");
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const curQ = questions[qi] || null;
  const curKey = qid(curQ);
  const curSubject = curQ ? curQ.subject : null;
  const curAns = curKey ? answers[curKey] || { text: "", img: null } : { text: "", img: null };

  function setCurText(t) {
    setAnswers((a) => ({ ...a, [curKey]: { ...a[curKey], text: t } }));
  }
  async function attachCur(file) {
    let data;
    try {
      data = await fileToBase64(file);
    } catch {
      setError("Couldn't read that image. Please try a different file.");
      return;
    }
    // Create the object URL OUTSIDE the updater (Strict Mode runs updaters twice
    // and would mint a discarded, leaked blob URL each time). Revoke the previous
    // preview from INSIDE the updater, reading the latest state — so two rapid
    // attaches (whose render-time closures both see the original img) can't leak
    // the first blob. Revoking is idempotent, so the double invocation is safe.
    const preview = URL.createObjectURL(file);
    setAnswers((a) => {
      const prev = a[curKey] && a[curKey].img;
      if (prev && prev.preview !== preview) revokePreview(prev);
      return { ...a, [curKey]: { ...a[curKey], img: { data, mime: file.type, name: file.name, preview } } };
    });
  }
  function removeCurImg() {
    revokePreview(curAns.img);
    setAnswers((a) => ({ ...a, [curKey]: { ...a[curKey], img: null } }));
  }

  function nextDiagnostic() {
    if (qi < questions.length - 1) setQi(qi + 1);
    else submitDiagnostic();
  }

  // "I don't know" on the diagnostic: record the current question as a SKIP (empty answer,
  // image discarded) and advance — the empty answer is docked server-side with NO Groq
  // grade. Pass the freshly-cleared map straight to submitDiagnostic on the last question
  // so it doesn't read the pre-clear state (setState is async).
  function skipDiagnostic() {
    if (curAns.img) revokePreview(curAns.img);
    const cleared = { ...answers, [curKey]: { text: "", img: null } };
    setAnswers(cleared);
    if (qi < questions.length - 1) setQi(qi + 1);
    else submitDiagnostic(cleared);
  }

  async function submitDiagnostic(answersArg) {
    const ans = answersArg || answers;
    const myRun = ++diagRun.current;
    setError("");
    setStage("scoring");
    try {
      // Build the answers payload (one per question). Grading + difficulty-weighted
      // aggregation now happen SERVER-SIDE in ONE /api/score request (bounded
      // concurrency + retry-once-on-429 + allSettled), replacing the old 9-parallel-
      // call burst where a single 429 sank the whole diagnostic.
      const payload = questions.map((q) => {
        const a = ans[qid(q)] || { text: "", img: null };
        return {
          subject: q.subject,
          question: q.question,
          difficulty: q.difficulty,
          // reasoningSurface/trap are NOT sent — the server derives them from the curated
          // bank by (subject, difficulty), so a crafted payload can't spoof the grader.
          reasoning: a.text,
          image: a.img ? { mime: a.img.mime, data: a.img.data } : undefined,
        };
      });

      let scoresObj;
      if (user) {
        // Signed-in: the server grades, aggregates, AND persists the baseline for the
        // verified user (server-authoritative — the client supplies no score).
        const data = await authApi("/api/score", { kind: "diagnostic", answers: payload });
        // Abandoned mid-grade (signed out / Restart): bail before touching state.
        if (myRun !== diagRun.current) return;
        scoresObj = data.scores || {};
        setScores(scoresObj);
        if (data.attempt) setHistory((h) => [...h, data.attempt]);
      } else {
        // Guest: the server grades + aggregates (no account to persist to); the
        // baseline is saved to localStorage here.
        const data = await api("/api/score", { kind: "diagnostic", answers: payload });
        if (myRun !== diagRun.current) return;
        scoresObj = data.scores || {};
        const evt = { type: "baseline", t: now(), totalAfter: totalPoints(scoresObj), phdAfter: phdIndex(scoresObj) };
        const st = await saveProgress(scoresObj, evt);
        if (myRun !== diagRun.current) return; // abandoned during the save round-trip
        if (st && st.history) setHistory(st.history); // null = couldn't refresh; keep current
        setScores(scoresObj);
      }

      setStage("dashboard");
      // The diagnostic answer images are no longer rendered once we move to the
      // dashboard; release their preview blob URLs (the base64 was already sent to
      // the grader) so a completed diagnostic doesn't leak them for the page's life.
      Object.values(answers).forEach((a) => revokePreview(a && a.img));
      // Guest just finished the diagnostic — prompt them to sign in to keep it.
      if (!user && isSupabaseConfigured) setShowSaveModal(true);
    } catch (e) {
      if (myRun !== diagRun.current) return; // abandoned — don't surface a stale error or stage
      setError(e.message || "Grading failed.");
      setStage("diagnostic");
    }
  }

  /* --- learn --- */
  // Open the Learn tab on a concept and show a Socratic, answer-free guide. Served
  // from the per-session memo when already fetched (instant, no server call); the
  // server's shared cache means the LLM generates each guide at most once, ever.
  async function openLearn(subject, concept) {
    const myRun = ++learnRun.current;
    setView("learn");
    setLearnConcept({ subject, concept });
    setLearnError("");
    setLearnQuestion(null);
    setLearnRegen(false); // clear any "Generating…" inherited from a prior concept's in-flight regenerate

    const key = `${subject}::${concept}`;
    const cached = learnCacheRef.current[key];
    if (cached) {
      setLearnContent(cached);
      setLearnQuestion(cached.tryThisQuestion || null);
      setLearnBusy(false);
      return;
    }

    setLearnContent(null);
    setLearnBusy(true);
    try {
      // Reuse an in-flight request for this concept if one exists, so a duplicate
      // open can't trigger a second Groq generation (the costliest call shape).
      let req = learnInflightRef.current.get(key);
      if (!req) {
        req = api("/api/learn", { subject, concept });
        learnInflightRef.current.set(key, req);
        req.finally(() => learnInflightRef.current.delete(key)).catch(() => {});
      }
      const data = await req;
      // Warm the memo even if this open was superseded, so revisiting the concept
      // is served from cache instead of re-generating. (A failed request rejects
      // above and never reaches here, so the memo is never poisoned.)
      learnCacheRef.current[key] = data;
      if (myRun !== learnRun.current) return; // a newer concept is active — don't touch UI state
      setLearnContent(data);
      setLearnQuestion(data.tryThisQuestion || null);
    } catch (e) {
      if (myRun !== learnRun.current) return;
      setLearnError(e.message || "Could not load the concept guide.");
    } finally {
      if (myRun === learnRun.current) setLearnBusy(false);
    }
  }

  // Regenerate the "try this" question for the open concept — a fresh, level-
  // calibrated problem (this DOES call the LLM, only on explicit request) shown
  // for the session only; the shared cached guide/question is left untouched.
  async function regenerateLearnQuestion() {
    if (!learnConcept) return;
    const { subject, concept } = learnConcept;
    // Capture the concept's run token (openLearn bumps it on every switch) so a slow
    // regenerate can't land a stale question on a concept the user has since moved
    // away from — which would otherwise mis-grade the attempt under the wrong
    // concept/subject. No increment: regenerate stays on the current concept.
    const myRun = learnRun.current;
    const recentKey = `learn:${subject}::${concept}`;
    // Steer away from the currently-shown question too (the cached guide one isn't in
    // the buffer yet on the first regenerate), so the very first "Regenerate" already differs.
    if (learnQuestion?.question) pushRecentQuestion(recentKey, learnQuestion.question);
    setLearnError("");
    setLearnRegen(true);
    try {
      const data = await api("/api/generate", {
        kind: "practice",
        subject,
        score: scores?.[subject]?.score ?? 0,
        weakConcepts: [concept],
        recentQuestions: getRecentQuestions(recentKey),
      });
      if (myRun !== learnRun.current) return; // a newer concept was selected
      if (!data || typeof data.question !== "string" || !data.question.trim()) {
        throw new Error("Could not generate a question. Please try again.");
      }
      // Normalize the generator's difficulty to a known band (default "intermediate"),
      // matching the server's normalizeTryThisQuestion, so an off-band string can't
      // flow to /api/grade and the score model as an unrecognized difficulty.
      const BANDS = new Set(["beginner", "foundational", "intermediate", "advanced", "phd"]);
      const d = typeof data.difficulty === "string" ? data.difficulty.trim().toLowerCase() : "";
      const difficulty = BANDS.has(d) ? d : "intermediate";
      pushRecentQuestion(recentKey, data.question); // remember it so the next regenerate differs again
      // Preserve the reasoning-surface metadata (server-normalized) so a Learn-tab practice
      // attempt carries the grader calibration too; harmlessly absent for cached-guide questions.
      setLearnQuestion({ question: data.question, targetConcept: data.targetConcept || concept, difficulty, reasoningSurface: data.reasoningSurface, trap: data.trap });
    } catch (e) {
      if (myRun !== learnRun.current) return; // don't surface a stale error on a newer concept
      setLearnError(e.message || "Could not regenerate the question.");
    } finally {
      if (myRun === learnRun.current) setLearnRegen(false);
    }
  }

  /* --- practice --- */
  async function startPractice(subject) {
    const myRun = ++practiceRun.current;
    setError("");
    setPSubject(subject);
    setFeedback(null);
    setScoreDelta(null);
    setPText("");
    revokePreview(pImg); // release any preview from a previous practice question
    setPImg(null);
    setPQuestion(null);
    setStage("practice");
    setBusy(true);
    try {
      // A subject may be missing from `scores` (e.g. a partial-baseline diagnostic
      // where one subject's grades all failed) — fall back to a beginner default so
      // practicing it just generates an easy question instead of crashing.
      const s = scores?.[subject] || { score: 0, weakConcepts: [] };
      const recentKey = `practice:${subject}`;
      const data = await api("/api/generate", {
        kind: "practice",
        subject,
        score: s.score,
        weakConcepts: s.weakConcepts || [],
        recentQuestions: getRecentQuestions(recentKey),
      });
      // A newer practice (another startPractice, or "Practice this problem" from
      // Learn) started while this generation was in flight — drop this stale
      // question so submitPractice can't grade it against the wrong subject/concept.
      if (myRun !== practiceRun.current) return;
      // Guard against malformed model output so we don't render an empty prompt.
      if (!data || typeof data.question !== "string" || !data.question.trim()) {
        throw new Error("Could not generate a question. Please try again.");
      }
      // Normalize the generator's difficulty to a canonical band BEFORE it's stored —
      // it becomes the anti-farm repeat-window key and the persisted attempts.band, and
      // must match the server's bandKey (normalizeDifficulty → intermediate default) so a
      // capitalized/off-band token can't fragment the repeat window or be dropped to NULL
      // by migrate_guest_data's case-sensitive band CHECK on sign-in.
      const PBANDS = new Set(["beginner", "foundational", "intermediate", "advanced", "phd"]);
      const pd = typeof data.difficulty === "string" ? data.difficulty.trim().toLowerCase() : "";
      pushRecentQuestion(recentKey, data.question); // remember it so the next practice in this subject differs
      setPQuestion({ ...data, difficulty: PBANDS.has(pd) ? pd : "intermediate" });
    } catch (e) {
      if (myRun !== practiceRun.current) return; // superseded — don't surface a stale error
      setError(e.message || "Could not generate a question.");
    } finally {
      if (myRun === practiceRun.current) setBusy(false);
    }
  }

  // Enter the practice flow with an ALREADY-KNOWN question (the cached "try this"
  // problem from a concept guide, or a regenerated one) — no /api/generate call,
  // so practicing a concept costs zero generation tokens. Grading is unchanged.
  function startPracticeWithQuestion(subject, questionObj) {
    if (!questionObj || !questionObj.question) return;
    practiceRun.current++; // supersede any in-flight startPractice generation
    setError("");
    setView("practice");
    setPSubject(subject);
    setFeedback(null);
    setScoreDelta(null);
    setPText("");
    revokePreview(pImg);
    setPImg(null);
    setBusy(false);
    setStage("practice");
    setPQuestion(questionObj); // use the supplied question directly
  }

  async function attachP(file) {
    let data;
    try {
      data = await fileToBase64(file);
    } catch {
      setError("Couldn't read that image. Please try a different file.");
      return;
    }
    // URL created outside the updater; previous preview revoked inside it from the
    // latest state, so rapid double-attaches can't leak the first blob (see attachCur).
    const preview = URL.createObjectURL(file);
    setPImg((prev) => {
      if (prev && prev.preview !== preview) revokePreview(prev);
      return { data, mime: file.type, name: file.name, preview };
    });
  }

  async function submitPractice(skip = false) {
    // Capture the practice run token: sign-out / Restart / "Reset my progress" /
    // starting another practice all bump practiceRun. If any happens while this grade
    // is in flight, bail BEFORE persisting — otherwise saveProgress re-resolves the
    // (now signed-out) identity and writes this score into the guest store, and the
    // setScores/setFeedback below repopulate the just-cleared UI. Mirrors diagRun in
    // submitDiagnostic.
    const myRun = practiceRun.current;
    setError("");
    setBusy(true);
    try {
      // "I don't know" skip: submit an EMPTY answer (no reasoning, no image) so the server
      // docks it with NO Groq grade — saving tokens and letting the learner move on rather
      // than being forced to type a throwaway answer.
      const reasoning = skip ? "" : pText;
      const imagePayload = skip || !pImg ? undefined : { mime: pImg.mime, data: pImg.data };
      // Default for a subject not yet in scores (e.g. practicing an un-baselined
      // subject after a partial diagnostic) — guards the guest blend path below.
      const prev = scores?.[pSubject] || { score: 0, weakConcepts: [], comment: "", rubric: null };
      if (user) {
        // Signed-in: SERVER-AUTHORITATIVE. The server grades, computes the new score
        // from the user's STORED level, and persists it for the verified uid; the
        // client renders the trusted result and cannot substitute a score.
        const data = await authApi("/api/score", {
          kind: "practice",
          subject: pSubject,
          question: pQuestion.question,
          targetConcept: pQuestion.targetConcept,
          difficulty: pQuestion.difficulty,
          topicSlug: pQuestion.topicSlug, // taxonomy slug → the difficulty-bucket key (normalized server-side)
          reasoningSurface: pQuestion.reasoningSurface, // grader calibration (server normalizes)
          trap: pQuestion.trap,
          reasoning,
          image: imagePayload,
        });
        if (myRun !== practiceRun.current) return; // abandoned mid-grade
        // Defensive: a malformed response must not put an undefined subjectScore into
        // state (which would crash the dashboard/livescore reads) — surface an error.
        if (!data || !data.subjectScore) throw new Error("Grading failed. Please try again.");
        setScores((s) => ({ ...s, [pSubject]: data.subjectScore }));
        if (data.attempt) setHistory((h) => [...h, data.attempt]);
        setScoreDelta(data.delta);
        setFeedback(data); // coaching fields (reasoningScore/rubric/hints) are top-level
      } else {
        // Guest: grade only, then run the SAME unified Glicko-2 axis update LOCALLY and
        // persist to localStorage (no account to protect, so a client-computed score is
        // fine here). The guest has no persisted item-difficulty bucket, so the item's
        // difficulty is the static band anchor (no population calibration off-device).
        const r = await api("/api/grade", {
          kind: "practice",
          subject: pSubject,
          question: pQuestion.question,
          targetConcept: pQuestion.targetConcept,
          score: prev.score,
          reasoning,
          difficulty: pQuestion.difficulty,
          reasoningSurface: pQuestion.reasoningSurface, // grader calibration (server normalizes)
          trap: pQuestion.trap,
          image: imagePayload,
        });
        if (myRun !== practiceRun.current) return; // abandoned mid-grade — don't persist a stale write
        const reasoningScore = r.reasoningScore ?? 0;
        // UNIFIED GLICKO-2 (mirrors /api/score): update the 9 per-axis ratings against the
        // question difficulty (the static band anchor for guests — no population-calibrated
        // bucket off-device), derive the subject score + radar. Anti-farm: damp the gain
        // when this (subject, topic, band) bucket repeats in the recent local history. A dock
        // (all-zero rubric) is a real low outcome → drops the axes. Lazy-seed from prev for
        // continuity.
        const repeatFactor = repeatFactorFromHistory(history, pSubject, pQuestion.topicSlug, pQuestion.difficulty);
        const { glicko: newGlicko, rubric: newRubric, score: updatedScore, expected } = updateAxisRatings({
          prevGlicko: prev.glicko || null,
          prevRubric: prev.rubric || null,
          prevScore: prev.score,
          attemptRubric: r.rubric,
          difficulty: defaultDifficultyForBand(pQuestion.difficulty),
          repeatFactor,
        });
        const delta = updatedScore - prev.score;
        const rationale = explainRankMove({
          delta,
          reasoningScore,
          expected,
          difficultyBand: pQuestion.difficulty,
          docked: !!r.docked,
        });
        const updatedSubject = {
          score: updatedScore,
          weakConcepts: r.weakConcepts && r.weakConcepts.length ? r.weakConcepts : prev.weakConcepts,
          comment: prev.comment,
          rubric: newRubric,
          glicko: newGlicko,
        };
        const updatedScores = { ...scores, [pSubject]: updatedSubject };
        // Atomic local write of the changed subject + its attempt. Send ONLY the
        // changed subject (mirrors the server upsert) so the other two aren't rewritten.
        const st = await saveProgress({ [pSubject]: updatedSubject }, {
          type: "attempt",
          t: now(),
          subject: pSubject,
          reasoningScore,
          delta,
          newScore: updatedScore,
          totalAfter: totalPoints(updatedScores),
          phdAfter: phdIndex(updatedScores),
          rationale,
          // The practiced bucket — read back by repeatFactorFromHistory on later attempts.
          topic: pQuestion.topicSlug,
          band: pQuestion.difficulty,
          // Embed the answer-review detail so guests can review past answers too
          // (signed-in users get it persisted server-side in attempt_reviews).
          review: {
            question: pQuestion.question,
            answer: reasoning,
            targetConcept: pQuestion.targetConcept,
            difficulty: pQuestion.difficulty,
            rubric: r.rubric,
            feedback: {
              strengths: r.strengths || [],
              improvements: r.improvements || [],
              workedSolution: r.docked ? "" : r.workedSolution || "",
              correctnessNote: r.correctnessNote || "",
              socraticHint: r.socraticHint || "",
              microLesson: r.microLesson || "",
              solve: r.docked ? null : r.solve || null,
              errors: r.docked ? [] : r.errors || [],
              finalAnswerMatches: !!r.finalAnswerMatches,
            },
          },
        });
        if (myRun !== practiceRun.current) return; // abandoned during the save round-trip
        if (st && st.history) setHistory(st.history); // null = couldn't refresh; keep current
        setScores(updatedScores);
        setScoreDelta(delta);
        setFeedback({ ...r, rationale });
      }
      // The composer/img unmounts once feedback is truthy (the graded view renders),
      // so the attached photo is no longer shown; release its preview blob URL (the
      // base64 was already sent to the grader) instead of leaking it until the next action.
      revokePreview(pImg);
      setPImg(null);
    } catch (e) {
      if (myRun !== practiceRun.current) return; // abandoned — don't surface a stale error on the reset UI
      setError(e.message || "Grading failed.");
    } finally {
      if (myRun === practiceRun.current) setBusy(false);
    }
  }

  // Save-progress modal: Escape to close, move focus into the dialog on open,
  // and restore focus to the triggering element on close (ARIA dialog pattern).
  useEffect(() => {
    if (!showSaveModal) return;
    saveModalPrevFocus.current = typeof document !== "undefined" ? document.activeElement : null;
    saveModalFocusRef.current?.focus();
    // Lock background scroll while the modal is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") setShowSaveModal(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      const prev = saveModalPrevFocus.current;
      if (prev && typeof prev.focus === "function") prev.focus();
    };
  }, [showSaveModal]);

  // While the save modal or a dashboard drawer is open, make the rest of the page
  // inert so keyboard/screen-reader users can't reach background controls (proper
  // modal focus containment).
  const bgInert = (showSaveModal && !user) || overlayActive ? true : undefined;

  /* ----------------------------- render ----------------------------- */
  // np-shell--dash (the viewport-tall height-lock) applies only to the ranked bento
  // grid; the not-ranked empty state keeps normal page scroll so a short viewport
  // can't clip its "Prove it" CTA.
  return (
    <div className={"np-shell" + (view === "dashboard" && user && scores ? " np-shell--dash" : "")}>
      {showSaveModal && !user && (
        <div className="np-modal-backdrop" onClick={() => setShowSaveModal(false)}>
          <div
            className="np-surface-elevated np-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="np-save-title"
            aria-describedby="np-save-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              ref={saveModalFocusRef}
              className="np-iconbtn np-modal-close"
              aria-label="Dismiss"
              onClick={() => setShowSaveModal(false)}
            >
              <Icon name="x" size={16} />
            </button>
            <div className="np-modal-spark" aria-hidden="true"><Icon name="spark" size={22} /></div>
            <h2 id="np-save-title" className="np-h2" style={{ textAlign: "center", margin: "0 0 8px" }}>
              Save your progress
            </h2>
            <p id="np-save-desc" className="np-lede" style={{ textAlign: "center", margin: "0 auto 22px" }}>
              Nice work — you've got your starting scores. Sign in to keep them across devices; your guest
              results carry over automatically.
            </p>
            <button
              className="np-btn np-primary np-big np-btn--block"
              onClick={() => { setShowSaveModal(false); openSignIn(); }}
            >
              <Icon name="login" size={16} /> Sign in
            </button>
            <button className="np-ghost np-modal-later" onClick={() => setShowSaveModal(false)}>Not now</button>
          </div>
        </div>
      )}

      <header className={"np-top" + (view === "dashboard" && user ? " np-top--wide" : "")} inert={bgInert}>
        <button className="np-brand" onClick={reset} title="Restart">
          noob<span className="np-arrow">→</span>topro
        </button>
        <span className="np-tag">prove what you know</span>
        <div className="np-signin">
          {user ? (
            <button className="np-signinbtn" onClick={handleSignOut} title={user.email || ""}>
              <Icon name="logout" size={16} /> Sign out
            </button>
          ) : (
            // Guests on the intro see Sign in beside the primary CTA instead, so the
            // top-right button is hidden there to avoid two sign-in buttons.
            stage !== "intro" && (
              isSupabaseConfigured ? (
                <button className="np-signinbtn" onClick={openSignIn}>
                  <Icon name="login" size={16} /> Sign in
                </button>
              ) : (
                <button className="np-signinbtn" onClick={() => setShowAuthNote(true)}>
                  <Icon name="login" size={16} /> Sign in
                </button>
              )
            )
          )}
        </div>
      </header>

      {(user || scores) && stage !== "signin" && (
        <nav className={"np-nav" + (view === "dashboard" && user ? " np-nav--wide" : "")} inert={bgInert}>
          <button className={"np-tab" + (view === "practice" ? " active" : "")} onClick={() => setView("practice")}>Practice</button>
          {scores && (
            <button className={"np-tab" + (view === "learn" ? " active" : "")} onClick={() => setView("learn")}>Learn</button>
          )}
          {/* One merged Dashboard tab (was Progress + Profile). Shown whenever the
              nav shows; a guest who clicks it gets the sign-in gate. */}
          <button className={"np-tab" + (view === "dashboard" ? " active" : "")} onClick={() => setView("dashboard")}>Dashboard</button>
          {user && isAdmin && (
            <button className={"np-tab" + (view === "admin" ? " active" : "")} onClick={() => setView("admin")}>Admin</button>
          )}
        </nav>
      )}

      <main className={"np-main" + (view === "dashboard" && user ? " np-main--wide" : "")} inert={bgInert}>
        {showAuthNote && (
          <div className="np-banner fade-up">
            <span>Google sign-in runs through Supabase. Add your Supabase URL + anon key and enable the Google provider by following the README ("Supabase setup"). The app works fully as a guest in the meantime.</span>
            <button className="np-ghost" onClick={() => setShowAuthNote(false)}><Icon name="x" size={14} /> dismiss</button>
          </div>
        )}
        {error && (
          <div className="np-error fade-up" role="alert">
            <span>{error}</span>
            <button className="np-ghost" onClick={() => setError("")}><Icon name="x" size={14} /> dismiss</button>
          </div>
        )}

        {stage === "signin" ? (
          <SignIn
            providers={PROVIDERS}
            onProvider={async (id) => {
              try {
                const res = await signInWithProvider(id);
                if (res && res.error) setError(res.error.message || "Sign-in failed. Please try again.");
              } catch (e) {
                setError(e.message || "Sign-in failed. Please try again.");
              }
            }}
            onBack={closeSignIn}
          />
        ) : view === "admin" && user && isAdmin ? (
          <AdminDashboard adminApi={authApi} />
        ) : view === "dashboard" ? (
          <Dashboard
            user={user}
            scores={scores}
            history={history}
            loadLeaderboard={() => authApi("/api/leaderboard", {})}
            loadReviews={loadReviews}
            onStartDiagnostic={() => { setView("practice"); beginDiagnostic(); }}
            onPractice={(s) => { setView("practice"); startPractice(s); }}
            onLearn={openLearn}
            onReset={resetProgress}
            onSignIn={() => (isSupabaseConfigured ? openSignIn() : setShowAuthNote(true))}
            onClose={() => setView("practice")}
            onOverlayActiveChange={setOverlayActive}
          />
        ) : view === "learn" && scores ? (
          <LearnTab
            hubEnabled={HUB_ENABLED}
            user={user}
            isAdmin={isAdmin}
            adminApi={authApi}
            scores={scores}
            active={learnConcept}
            content={learnContent}
            busy={learnBusy}
            error={learnError}
            question={learnQuestion}
            regenerating={learnRegen}
            onSelect={openLearn}
            onPracticeQuestion={startPracticeWithQuestion}
            onRegenerate={regenerateLearnQuestion}
            onPractice={(s) => { setView("practice"); startPractice(s); }}
          />
        ) : (
          <>
            {/* INTRO */}
            {stage === "intro" && (
              <div className="fade-up">
                <h1 className="np-h1">Stop memorizing.<br />Start thinking. Climb.</h1>
                <p className="np-lede">
                  School makes you memorize. Most apps make you chase streaks. noobtopro does neither: it hands you real
                  problems, reads <em>how you reason</em>, and scores each subject 0–100. Stuck? It won't hand over the
                  answer — it asks the right question and teaches the one concept you're missing. For students and
                  self-learners who'd rather understand than cram.
                </p>
                <div className="np-steps">
                  {[
                    ["01", "Prove it", "Nine open problems — beginner, intermediate, and hard in each of math, physics, and chemistry. Explain every step, or tap “I don’t know” to skip."],
                    ["02", "Get ranked", "Your reasoning is graded on a 5-part rubric and mapped to a 0–100 rank per subject."],
                    ["03", "Climb", "Pick a subject. Get calibrated problems. Sound reasoning moves your score — even when the answer's wrong."],
                  ].map(([n, t, d]) => (
                    <div key={n} className="np-card np-step">
                      <div className="np-stepnum">{n}</div>
                      <div className="np-steptitle">{t}</div>
                      <div className="np-stepdesc">{d}</div>
                    </div>
                  ))}
                </div>
                <div className="np-subjectrow">
                  {ORDER.map((k) => (
                    <span key={k} className="np-chip" style={{ borderColor: SUBJECTS[k].color }}>
                      <SubjectGlyph subject={k} /> {SUBJECTS[k].label}
                    </span>
                  ))}
                </div>
                <div className="np-introcta">
                  <button className="np-btn np-primary np-big" onClick={beginDiagnostic} disabled={busy}>
                    {busy ? "Setting up your problems…" : "Prove it"} {!busy && <Icon name="arrow" size={18} />}
                  </button>
                  {/* Guests get Sign in right next to the primary action (the header
                      button is hidden on the intro). */}
                  {!user && (
                    <button
                      className="np-signinbtn"
                      onClick={() => (isSupabaseConfigured ? openSignIn() : setShowAuthNote(true))}
                    >
                      <Icon name="login" size={16} /> Sign in
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* DIAGNOSTIC */}
            {stage === "diagnostic" && curQ && (
              <div className="fade-up" key={qi}>
                {/* Progress: 3 subject groups × 2 difficulty pips (easy→hard),
                    filled up to the current question. Data-driven off
                    DIAGNOSTIC_DIFFICULTIES; relies on the subject-major,
                    easy→hard ordering set in beginDiagnostic. */}
                <div className="np-diag-progress">
                  {ORDER.map((s, si) => (
                    <div key={s} className="np-diag-proggroup">
                      {DIAGNOSTIC_DIFFICULTIES.map((d, di) => {
                        const idx = si * DIAGNOSTIC_DIFFICULTIES.length + di;
                        return <div key={d} className="np-progdot" style={{ background: idx <= qi ? SUBJECTS[s].color : "rgba(255,255,255,.12)" }} />;
                      })}
                    </div>
                  ))}
                </div>
                <div className="np-qmeta">
                  <SubjectGlyph subject={curSubject} />
                  <span className="np-metaline">
                    {SUBJECTS[curSubject].label.toUpperCase()} · {(DIFFICULTY_LABELS[curQ.difficulty] || "").toUpperCase()} · {qi + 1}/{questions.length}
                  </span>
                  {curQ.topic && <span className="np-topic">{curQ.topic}</span>}
                </div>
                <div className="np-card np-question">{curQ.question}</div>
                <AnswerComposer
                  value={curAns.text}
                  onText={setCurText}
                  img={curAns.img}
                  onAttach={attachCur}
                  onRemoveImg={removeCurImg}
                  onSubmit={nextDiagnostic}
                  onSkip={skipDiagnostic}
                  lockKey={curKey}
                  submitLabel={qi < questions.length - 1 ? "Next question" : "Get ranked"}
                  loading={false}
                />
                <p className="np-hint">noobtopro grades your <em>thinking</em>, so explain your full approach — or attach a photo of your worked notes.</p>
              </div>
            )}

            {/* SCORING */}
            {stage === "scoring" && <Loader subject="evaluating all three" />}

            {/* DASHBOARD (subject scores) */}
            {stage === "dashboard" && scores && (
              <div className="fade-up">
                {!user && isSupabaseConfigured && (
                  <div className="np-card np-savecta fade-up">
                    <div>
                      <div className="np-savetitle">Save your progress</div>
                      <div className="np-savedesc">Your results live only in this browser. Sign in to keep them across devices.</div>
                    </div>
                    <button className="np-btn np-primary" onClick={openSignIn}>
                      <Icon name="login" size={15} /> Sign in to save
                    </button>
                  </div>
                )}
                <h2 className="np-h2">Where you stand</h2>
                <p className="np-lede" style={{ marginBottom: 22 }}>{SCALE_NOTE}</p>
                <div className="np-grid3">
                  {ORDER.map((k) => {
                    const s = scores[k] || { score: 0, weakConcepts: [], comment: "" };
                    return (
                      <div key={k} className="np-card np-scorecard">
                        <div className="np-scorehead">
                          <SubjectGlyph subject={k} size={20} />
                          <span className="np-scorelabel">{SUBJECTS[k].label}</span>
                        </div>
                        <Ring value={s.score} color={SUBJECTS[k].color} label={SUBJECTS[k].label} />
                        <div className="np-bandtag" style={{ color: SUBJECTS[k].color }}>{band(s.score)}</div>
                        {s.comment && <div className="np-comment">{s.comment}</div>}
                        {s.weakConcepts && s.weakConcepts.length > 0 && (
                          <div className="np-weakwrap">
                            <div className="np-eyebrow np-eyebrow--sm">Work on</div>
                            <div className="np-weaktags">
                              {s.weakConcepts.slice(0, 3).map((w, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  className="np-weaktag np-weaktag-btn"
                                  title={`Learn: ${w}`}
                                  onClick={() => openLearn(k, w)}
                                >
                                  {w}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <button className="np-btn np-secondary np-btn--block np-btn--subject" style={{ marginTop: 14, "--subject": SUBJECTS[k].color }} onClick={() => startPractice(k)}>
                          Practice {SUBJECTS[k].label} <Icon name="arrow" size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PRACTICE */}
            {stage === "practice" && (
              <div className="fade-up">
                <button className="np-ghost" style={{ marginBottom: 14 }} onClick={() => setStage("dashboard")}>
                  <Icon name="back" size={15} /> Back to scores
                </button>

                {busy && !pQuestion && <Loader subject={pSubject ? SUBJECTS[pSubject].label : ""} />}

                {pQuestion && (
                  <>
                    <div className="np-qmeta">
                      <SubjectGlyph subject={pSubject} />
                      <span className="np-metaline">
                        {SUBJECTS[pSubject].label.toUpperCase()} · {(pQuestion.difficulty || "").toUpperCase()}
                      </span>
                      {pQuestion.targetConcept && <span className="np-topic">{pQuestion.targetConcept}</span>}
                      <span className="np-livescore" style={{ borderColor: SUBJECTS[pSubject].color }}>
                        {scores[pSubject]?.score ?? 0}<span style={{ color: "var(--muted)" }}>/100</span>
                        {scoreDelta !== null && scoreDelta !== 0 && (
                          <span style={{ color: deltaColor(scoreDelta), marginLeft: 6 }}>
                            {scoreDelta > 0 ? "+" : ""}{scoreDelta}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="np-card np-question">{pQuestion.question}</div>

                    {!feedback && (
                      <>
                        <AnswerComposer
                          value={pText}
                          onText={setPText}
                          img={pImg}
                          onAttach={attachP}
                          onRemoveImg={() => { revokePreview(pImg); setPImg(null); }}
                          onSubmit={() => submitPractice(false)}
                          onSkip={() => submitPractice(true)}
                          lockKey={pQuestion.question}
                          submitLabel="Submit reasoning"
                          loading={busy}
                        />
                        <p className="np-hint">No answer will be handed to you. Reason it out, then submit.</p>
                      </>
                    )}

                    {feedback && (
                      <div className="fade-up">
                        <div className="np-card np-feedhead">
                          <div>
                            <div className="np-eyebrow">Reasoning quality this attempt</div>
                            <div className="np-feedscore">{feedback.reasoningScore}<span style={{ color: "var(--muted)", fontSize: 18 }}>/100</span></div>
                          </div>
                          <div className="np-feedsub">Your <em>reasoning</em> is scored — not the final answer. The breakdown below shows exactly how.</div>
                        </div>

                        {/* How this score is computed — per-axis value × weight = points, summing
                            transparently to the headline (no hidden factor). */}
                        <ScoreBreakdown rubric={feedback.rubric} total={feedback.reasoningScore} color={SUBJECTS[pSubject].color} open />

                        {/* Why your rank moved — the persisted, deterministic explanation. */}
                        {feedback.rationale && (
                          <div className="np-note" style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--mono)", fontSize: 13 }}>
                            <span style={{ color: deltaColor(scoreDelta), fontWeight: 700 }}>
                              {scoreDelta > 0 ? "▲" : scoreDelta < 0 ? "▼" : "■"}
                            </span>
                            <span>{feedback.rationale}</span>
                          </div>
                        )}

                        {/* What you did well → how to reach 100 — the actionable feedback. */}
                        {(((feedback.strengths || []).length > 0) || ((feedback.improvements || []).length > 0)) && (
                          <div className="np-card">
                            {(feedback.strengths || []).length > 0 && (
                              <>
                                <div className="np-cardicon" style={{ color: "var(--phys)" }}><Icon name="spark" size={16} /> What you did well</div>
                                <ul className="np-learnlist" aria-label="What you did well" style={{ marginBottom: (feedback.improvements || []).length ? 14 : 0 }}>
                                  {feedback.strengths.map((s, i) => <li key={i} style={{ "--dot": "var(--phys)" }}>{s}</li>)}
                                </ul>
                              </>
                            )}
                            {(feedback.improvements || []).length > 0 && (
                              <>
                                <div className="np-cardicon" style={{ color: "var(--math)" }}><Icon name="arrow" size={16} /> To reach 100</div>
                                <ul className="np-learnlist" aria-label="How to reach the maximum score">
                                  {feedback.improvements.map((s, i) => <li key={i} style={{ "--dot": "var(--math)" }}>{s}</li>)}
                                </ul>
                              </>
                            )}
                          </div>
                        )}

                        {/* Where your reasoning breaks — typed errors, ordered most-costly
                            first. A reasoning error LEADS with a Socratic question (you catch it
                            yourself); slips/conceptual errors state the fix directly. */}
                        {Array.isArray(feedback.errors) && feedback.errors.length > 0 && (
                          <div className="np-card np-errors">
                            <div className="np-cardicon" style={{ color: "var(--math)" }}><Icon name="bulb" size={16} /> Where your reasoning breaks</div>
                            <ErrorList errors={feedback.errors} />
                          </div>
                        )}

                        {/* Worked solution — revealed only AFTER grading a substantive attempt
                            (a docked non-answer returns ""). Collapsed by default; when a reasoning
                            error is present it's a deliberate "reveal anyway" so the Socratic
                            question above comes first (desirable difficulty). */}
                        {feedback.workedSolution && (
                          <details className="np-card np-lesson">
                            <summary className="np-cardicon" style={{ color: SUBJECTS[pSubject].color, cursor: "pointer" }}>
                              <Icon name="bulb" size={16} /> {hasReasoningError(feedback.errors) ? "Reveal the full solution anyway" : "Worked solution (reveal the full answer)"}
                            </summary>
                            <div className="np-lessontext" style={{ whiteSpace: "pre-wrap", marginTop: 10 }}>{feedback.workedSolution}</div>
                          </details>
                        )}

                        {feedback.correctnessNote && <div className="np-note">{feedback.correctnessNote}</div>}

                        <div className="np-card np-socratic">
                          <div className="np-cardicon"><Icon name="bulb" size={16} /> A question to move you forward</div>
                          <div className="np-socratictext">{feedback.socraticHint}</div>
                        </div>

                        <div className="np-card np-lesson">
                          <div className="np-cardicon" style={{ color: SUBJECTS[pSubject].color }}><Icon name="spark" size={16} /> Concept you're missing</div>
                          <div className="np-lessontext">{feedback.microLesson}</div>
                        </div>

                        <div className="np-feedactions">
                          <button className="np-btn np-primary" onClick={() => startPractice(pSubject)} disabled={busy}>
                            <Icon name="refresh" size={15} /> Next problem
                          </button>
                          <button className="np-ghost" onClick={() => setView("dashboard")}>See your dashboard</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <footer className={"np-foot" + (view === "dashboard" && user ? " np-foot--wide" : "")} inert={bgInert}>Prototype · grading is performed live by Groq against a reasoning rubric. Scores are demonstrative.</footer>
    </div>
  );
}
