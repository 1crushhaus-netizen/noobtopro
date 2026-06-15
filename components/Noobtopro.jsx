"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  SUBJECTS,
  ORDER,
  SCALE_NOTE,
  band,
  rankFor,
  totalPoints,
  phdIndex,
  DIFFICULTY_LABELS,
  updateAxisRatings,
  repeatFactorFromHistory,
  defaultDifficultyForBand,
  explainRankMove,
} from "@/lib/scoring";
import { loadState, saveProgress, resetAll, migrateGuestToAccount, deleteAllUserData, loadReviews, loadMastery } from "@/lib/store";
import { getSupabase, isSupabaseConfigured, signInWithProvider, signOutUser, PROVIDERS } from "@/lib/supabase";
import Icon from "@/components/Icon";
import Dashboard from "@/components/Dashboard";
import SignIn from "@/components/SignIn";
import LearnTab from "@/components/LearnTab";
import AdminDashboard from "@/components/AdminDashboard";
import ScoreBreakdown, { ErrorList, hasReasoningError } from "@/components/ScoreBreakdown";
import Landing from "@/components/Landing";
import TopNav from "@/components/TopNav";
import { useScrolled } from "@/components/useReveal";
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
        msg = `Too many requests. Please wait ${retry}s and try again.`;
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

// Attach-time image preparation (audit P1-2). A typical phone photo is 3–10 MB;
// the server caps an image at ~3 MB decoded and Vercel caps the WHOLE request at
// ~4.5 MB — and the diagnostic ships all 9 answers in ONE request, so a single
// oversized photo used to 413 the entire completed diagnostic with no way back.
// Strategy: allow-list the type (mirrors the server's magic-byte set), then
// DOWNSCALE through a canvas (≤1280px JPEG — plenty for handwriting, typically
// a few hundred KB). If the canvas path is unavailable, accept the original only
// when it's safely small; otherwise reject AT ATTACH TIME with a clear message
// so the learner can retake/crop instead of discovering it at submit.
const IMAGE_MIME_ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_RAW_IMAGE_BYTES = 2_500_000;
const MAX_IMAGE_DIM = 1280;
async function prepareImage(file) {
  if (file.type && !IMAGE_MIME_ALLOWED.has(file.type)) {
    throw new Error("That file type isn't supported. Attach a JPEG, PNG, WebP, or GIF photo.");
  }
  // Probe 2D-canvas availability BEFORE wiring an <img> load: environments without
  // canvas (jsdom, some webviews) would otherwise leave the load promise pending
  // forever. No canvas → go straight to the size-capped original below.
  let canvasOk = false;
  try {
    canvasOk = typeof document !== "undefined" && !!document.createElement("canvas").getContext("2d");
  } catch {
    canvasOk = false;
  }
  if (canvasOk) {
    try {
      const url = URL.createObjectURL(file);
      try {
        const el = await new Promise((resolve, reject) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.onerror = reject;
          im.src = url;
        });
        const w = el.naturalWidth || el.width || 0;
        const h = el.naturalHeight || el.height || 0;
        if (w > 0 && h > 0) {
          const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(w, h));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(w * scale));
          canvas.height = Math.max(1, Math.round(h * scale));
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
            const b64 = String(canvas.toDataURL("image/jpeg", 0.8)).split(",")[1];
            if (b64) return { data: b64, mime: "image/jpeg" };
          }
        }
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      /* canvas decode failed — fall through to the size-capped original */
    }
  }
  if (file.size > MAX_RAW_IMAGE_BYTES) {
    throw new Error("That photo is too large to grade. Please retake it smaller, or crop to just your work.");
  }
  return { data: await fileToBase64(file), mime: file.type || "image/jpeg" };
}

const now = () => new Date().toISOString();

// Stable identity (audit P2-14): authApi is module-level, so this never changes —
// the Leaderboard's fetch effect depends on it, and an inline arrow re-created on
// every Noobtopro render made each drawer toggle refetch (and visibly blank) the
// leaderboard while burning the shared per-IP rate bucket.
const loadLeaderboard = () => authApi("/api/leaderboard", {});

// Stable per-question key for the 2-tier diagnostic (each subject has an
// easy + a hard question), so the answers map can hold all 6 answers.
// Key for one adaptive-diagnostic step entry (subject + step number — the band can
// repeat across a ±1 walk, so it can't key anything).
const qid = (q) => (q ? `${q.subject}:${q.stepNo}` : "");

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
  const off = circ * (1 - Math.max(0, Math.min(350, value)) / 350);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${label ? `${label}: ` : ""}Score ${Math.round(Math.max(0, Math.min(350, value)))} of 350`}
    >
      {/* Track + value strokes go through `style` (not presentation attributes) so
          theme tokens resolve and the ring stays legible on both themes. */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: "var(--line-strong)" }} strokeWidth={stroke} />
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
  // The timer must restart ONLY when the QUESTION changes (lockKey), never on a
  // parent re-render (audit P2-15): both call sites pass a freshly-created onSkip
  // each render, and with onSkip in the deps every keystroke in this controlled
  // textarea reset the 10s countdown — locking the skip for "10s since the last
  // keystroke" instead of "10s per question". hasSkip (a stable boolean) keeps the
  // mount/unmount behavior; the click handler reads the live prop.
  const hasSkip = !!onSkip;
  useEffect(() => {
    if (!hasSkip) return undefined;
    setSkipIn(SKIP_LOCK_SECONDS);
    const id = setInterval(() => setSkipIn((n) => {
      if (n <= 1) { clearInterval(id); return 0; }
      return n - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [lockKey, hasSkip]);
  const skipLocked = skipIn > 0;
  return (
    <div className="np-card np-input-card">
      <textarea
        className="np-input"
        aria-label="Your reasoning"
        value={value}
        onChange={(e) => onText(e.target.value)}
        placeholder={placeholder || "Show your full reasoning: every step, not just the answer."}
        rows={6}
      />
      {img && (
        <div style={{ padding: "0 16px 8px", display: "flex", alignItems: "center", gap: 10 }}>
          <img src={img.preview} alt="your work" style={{ height: 56, borderRadius: 8, border: "1px solid var(--line)" }} />
          <span style={{ fontSize: 13, color: "var(--muted)" }}>{img.name}</span>
          <button className="np-iconbtn" onClick={onRemoveImg} aria-label="remove image"><Icon name="x" size={15} /></button>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 12px", borderTop: "1px solid var(--line)", background: "var(--tint-1)", flexWrap: "wrap" }}>
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
              aria-label={skipLocked ? `I don't know, available in ${skipIn} seconds` : "I don't know, skip this question"}
              title={skipLocked ? "Take a moment to think it through first" : "Skip, I don't know this one"}
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

// Signed-in identity (avatar + name + email + overall rank) now lives in the
// shared TopNav (components/TopNav.jsx) — its only home, the Dashboard bento has
// no identity bar.

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

// The DEEP-LINKED concept guide (FIX 1): when a "Learn this" link from the
// dashboard radar, a review row, or a weak-concept chip is tapped, openLearn fetches
// the shared /api/learn guide into learnContent — this renders THAT guide (overview,
// key ideas, why it works, pitfalls, Socratic questions, and the bundled "try this"
// practice question) instead of the generic curriculum browser. "Browse the full
// library" clears the concept to fall back to <LearnTab>. Reuses the .np-lesson card
// system shared with LearnTab's ConceptGuide so the two surfaces read identically.
function LearnConceptGuide({ concept, content, busy, error, onPractice, onBrowse, onRetry }) {
  const subject = concept && concept.subject;
  const color = SUBJECTS[subject] ? SUBJECTS[subject].color : "var(--text)";
  const browseLink = (
    <button type="button" className="np-ghost" onClick={onBrowse}>
      <Icon name="back" size={15} /> Browse the full library
    </button>
  );

  if (busy) {
    return (
      <div className="fade-up">
        {browseLink}
        <div className="np-card fade-up" role="status" aria-live="polite" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div className="np-pulse" style={{ fontFamily: "var(--mono)", fontSize: 13, letterSpacing: 1, color: "var(--muted)" }}>
            {subject ? subject.toUpperCase() : "LEARN"}
          </div>
          <div style={{ fontFamily: "var(--display)", fontSize: 22, marginTop: 10 }}>Building your concept guide…</div>
        </div>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="fade-up">
        {browseLink}
        <div className="np-card np-lesson" role="alert">
          <div className="np-cardicon" style={{ color: "var(--danger)" }}>Couldn’t load this concept</div>
          <p className="np-lessontext">{error || "The concept guide is unavailable right now."}</p>
          <button type="button" className="np-btn np-secondary" style={{ marginTop: 10 }} onClick={onRetry}>Try again</button>
        </div>
      </div>
    );
  }

  const tryThis = content.tryThisQuestion || null;
  return (
    <div className="fade-up">
      {browseLink}

      <div className="np-qmeta" style={{ marginTop: 14, marginBottom: 12 }}>
        <SubjectGlyph subject={subject} />
        <span className="np-metaline">{SUBJECTS[subject] ? SUBJECTS[subject].label.toUpperCase() : ""}</span>
      </div>
      <h2 className="np-h1" style={{ color }}>{content.concept}</h2>

      {content.overview && (
        <div className="np-card np-lesson">
          <div className="np-cardicon" style={{ color }}>Overview</div>
          <p className="np-lessontext">{content.overview}</p>
        </div>
      )}

      {Array.isArray(content.keyIdeas) && content.keyIdeas.length > 0 && (
        <div className="np-card np-lesson">
          <div className="np-cardicon" style={{ color }}>Key ideas</div>
          <ul className="np-selfqs">
            {content.keyIdeas.map((idea, i) => <li key={i}>{idea}</li>)}
          </ul>
        </div>
      )}

      {content.whyItWorks && (
        <div className="np-card np-lesson">
          <div className="np-cardicon" style={{ color }}>Why it works</div>
          <p className="np-lessontext">{content.whyItWorks}</p>
        </div>
      )}

      {Array.isArray(content.pitfalls) && content.pitfalls.length > 0 && (
        <div className="np-card np-lesson">
          <div className="np-cardicon" style={{ color }}>Common pitfalls</div>
          <ul className="np-selfqs">
            {content.pitfalls.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}

      {Array.isArray(content.socraticQuestions) && content.socraticQuestions.length > 0 && (
        <div className="np-card np-lesson">
          <div className="np-cardicon" style={{ color }}>Ask yourself</div>
          <p className="np-lessontext" style={{ color: "var(--muted)", marginBottom: 10 }}>
            Think these through before practicing. Explaining your reasoning out loud counts.
          </p>
          <ul className="np-selfqs">
            {content.socraticQuestions.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </div>
      )}

      <div className="np-card np-lesson">
        <div className="np-cardicon" style={{ color }}>Practice this concept</div>
        {content.tryThis && (
          <p className="np-lessontext" style={{ color: "var(--muted)", marginBottom: 12 }}>{content.tryThis}</p>
        )}
        {tryThis && onPractice ? (
          <button
            type="button"
            className="np-btn np-primary np-btn--subject"
            style={{ "--subject": color }}
            onClick={() => onPractice(subject, tryThis)}
          >
            Practice this concept
          </button>
        ) : (
          <p className="np-hint" style={{ margin: 0 }}>
            A practice question for this concept is coming soon. Explore the full library below in the meantime.
          </p>
        )}
      </div>
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
  const navScrolled = useScrolled(); // drives the shared TopNav condense-on-scroll

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
  // targetConcept, difficulty, token}) — the bundled guide question wired to the
  // deep-link's "Practice this concept" button (FIX 1).
  const [learnQuestion, setLearnQuestion] = useState(null);
  // The curriculum concept key currently generating an AI practice drill (increment 3) —
  // drives the concept-page button's spinner; null when idle.
  const [drillBusy, setDrillBusy] = useState(null);

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

  // Monotonic token so an in-flight diagnostic STEP grade or finalize can't land
  // a stale write after the user abandons the flow — sign-out (SIGNED_OUT),
  // "Restart" (reset()), or a fresh beginDiagnostic bump this so resolving calls
  // bail instead of appending questions / re-persisting the baseline into a
  // newer run's UI.
  const diagRun = useRef(0);
  // The adaptive walk's per-subject completion tokens (subject → signed final
  // token; finalize fires once all three land) and any failed step/finalize
  // payloads awaiting the learner's "Try again".
  const diagFinal = useRef({});
  const diagFailed = useRef([]);
  // Steps answered per subject (drives the progress pips), and the step-flow
  // error shown on the diagnostic waiting card (kept apart from the global
  // `error` banner so a recoverable step failure doesn't look fatal).
  const [diagAnswered, setDiagAnswered] = useState({});
  const [diagError, setDiagError] = useState("");

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
  // ADAPTIVE placement start (RANKS_PLAN §8): /api/generate returns ONE signed
  // middle-band starter per subject; each graded step then returns the next item
  // on its subject's ±1-band walk. `questions` GROWS as steps land (the starters
  // arrive in round-robin order and each subject's next item appends as its grade
  // returns, so answering naturally interleaves subjects and hides grading
  // latency); a stale run is superseded via diagRun.
  async function beginDiagnostic() {
    // FIX 6: a re-baseline OVERWRITES the signed-in user's accumulated scores (the
    // diagnostic finalize upserts all three subjects — README §17). Confirm before
    // discarding existing progress; on cancel, do nothing (no navigation, no fetch).
    // Guests aren't gated (their scores are local + this is their normal first run);
    // a signed-in user with NO scores yet is taking their first diagnostic, so no prompt.
    if (user && scores && typeof window !== "undefined" && typeof window.confirm === "function") {
      const ok = window.confirm(
        "Re-taking the diagnostic will replace your current scores with a fresh baseline. Your accumulated progress will be lost. Continue?"
      );
      if (!ok) return;
    }
    setError("");
    setDiagError("");
    setBusy(true);
    try {
      const data = await api("/api/generate", { kind: "diagnostic" });
      const qs = (data && Array.isArray(data.questions) ? data.questions : []).filter(
        (q) =>
          q &&
          ORDER.includes(q.subject) &&
          typeof q.question === "string" &&
          q.question.trim() &&
          typeof q.token === "string" &&
          q.stepNo === 1
      );
      if (!data || data.adaptive !== true || qs.length !== ORDER.length) {
        throw new Error("Could not start the diagnostic. Please try again.");
      }
      const init = {};
      qs.forEach((q) => (init[qid(q)] = { text: "", img: null }));
      // Release any previews left over from a previous diagnostic before replacing
      // the answers map, so re-taking the diagnostic can't leak the old blob URLs.
      Object.values(answers).forEach((a) => revokePreview(a && a.img));
      diagRun.current++; // supersede any in-flight steps from an abandoned run
      diagFinal.current = {};
      diagFailed.current = [];
      setDiagAnswered({});
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
    let data, mime;
    try {
      ({ data, mime } = await prepareImage(file));
    } catch (e) {
      setError((e && e.message) || "Couldn't read that image. Please try a different file.");
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
      return { ...a, [curKey]: { ...a[curKey], img: { data, mime, name: file.name, preview } } };
    });
  }
  function removeCurImg() {
    revokePreview(curAns.img);
    setAnswers((a) => ({ ...a, [curKey]: { ...a[curKey], img: null } }));
  }

  // Submit the CURRENT step's answer: fire its grade in the background (the §8
  // walk's next item arrives with the grade) and advance immediately to the next
  // queued question — answering subject B while subject A grades is what hides
  // the per-step latency. Advancing past the end of `questions` is the WAITING
  // state (curQ goes null); the pending append then materializes questions[qi].
  function nextDiagnostic() {
    const q = curQ;
    const a = curAns;
    setDiagAnswered((m) => ({ ...m, [q.subject]: (m[q.subject] || 0) + 1 }));
    submitDiagStep(q, a);
    setQi(qi + 1);
  }

  // "I don't know": record a SKIP (empty answer, image discarded) — docked
  // server-side with NO Groq grade; the walk descends a band, by design.
  function skipDiagnostic() {
    if (curAns.img) revokePreview(curAns.img);
    setAnswers((m) => ({ ...m, [curKey]: { text: "", img: null } }));
    setDiagAnswered((m) => ({ ...m, [curQ.subject]: (m[curQ.subject] || 0) + 1 }));
    submitDiagStep(curQ, { text: "", img: null });
    setQi(qi + 1);
  }

  // One graded step round-trip: the signed token + this answer go up; the grade
  // folds into the server's signed chain and either the next item or the
  // subject's completion token comes back. Failures keep the token valid and
  // queue the payload for "Try again" (the waiting card shows diagError).
  async function submitDiagStep(q, a) {
    const myRun = diagRun.current;
    const payload = {
      kind: "diagnostic",
      token: q.token,
      reasoning: a.text,
      image: a.img ? { mime: a.img.mime, data: a.img.data } : undefined,
    };
    try {
      // authApi when signed in (the per-account budget + finalize persistence are
      // bound to the verified JWT); plain api as a guest.
      const data = user ? await authApi("/api/score", payload) : await api("/api/score", payload);
      if (myRun !== diagRun.current) return; // superseded (restart/sign-out/new run)
      if (data && data.next && typeof data.next.question === "string" && typeof data.next.token === "string") {
        setAnswers((m) => ({ ...m, [qid(data.next)]: { text: "", img: null } }));
        setQuestions((qs) => [...qs, data.next]); // a waiting curQ materializes here
      } else if (data && data.subjectComplete && typeof data.finalToken === "string") {
        diagFinal.current[q.subject] = data.finalToken;
        if (ORDER.every((s) => typeof diagFinal.current[s] === "string")) finalizeDiagnostic();
      } else {
        throw new Error("Unexpected placement response. Please try again.");
      }
    } catch (e) {
      if (myRun !== diagRun.current) return;
      diagFailed.current.push({ q, a });
      setDiagError(e.message || "Grading hit a snag. Please try again.");
    }
  }

  // Re-fire everything that failed (step grades and/or the finalize) — the signed
  // tokens are still valid, so a transient outage costs nothing but the retry.
  function retryDiagnostic() {
    setDiagError("");
    const failed = diagFailed.current.splice(0);
    for (const f of failed) submitDiagStep(f.q, f.a);
    if (failed.length === 0 && ORDER.every((s) => typeof diagFinal.current[s] === "string")) {
      finalizeDiagnostic();
    }
  }

  // All three subjects' walks are complete: one ZERO-Groq finalize call verifies
  // the three signed transcripts, aggregates the path-weighted baseline, and (for
  // a signed-in caller) persists it server-authoritatively.
  async function finalizeDiagnostic() {
    const myRun = diagRun.current;
    setDiagError("");
    setStage("scoring");
    try {
      const payload = { kind: "diagnostic", tokens: ORDER.map((s) => diagFinal.current[s]) };
      let scoresObj;
      if (user) {
        const data = await authApi("/api/score", payload);
        // Abandoned mid-finalize (signed out / Restart): bail before touching state.
        if (myRun !== diagRun.current) return;
        scoresObj = data.scores || {};
        setScores(scoresObj);
        if (data.attempt) setHistory((h) => [...h, data.attempt]);
      } else {
        // Guest: the server aggregates (no account to persist to); the baseline is
        // saved to localStorage here, including the SERVER-derived mastery updates
        // so the Learn tab colors the tested concepts for guests too.
        const data = await api("/api/score", payload);
        if (myRun !== diagRun.current) return;
        scoresObj = data.scores || {};
        const evt = { type: "baseline", t: now(), totalAfter: totalPoints(scoresObj), phdAfter: phdIndex(scoresObj) };
        const st = await saveProgress(scoresObj, evt, data.masteryUpdates);
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
      // Keep the final tokens; the waiting card's "Try again" re-runs finalize.
      setDiagError(e.message || "Grading failed.");
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

    const key = `${subject}::${concept}`;
    const cached = learnCacheRef.current[key];
    // Serve the memo UNLESS its "try this" token was consumed (tokens are one-shot —
    // the jti dedupe would 409 a second graded attempt) or rejected (expired). A
    // token-less entry refetches below: a SERVER cache hit, freshly signed, no Groq.
    // Guests never need the token (they grade via /api/grade), so the memo always holds.
    if (cached && (!user || !cached.tryThisQuestion || cached.tryThisQuestion.token)) {
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

  // AI CONCEPT-PRACTICE DRILL (increment 3, RANKS_PLAN §12.3): from a Learn-tab concept
  // page, generate a question TARGETING that curriculum concept and enter the practice
  // flow with it. /api/generate validates the conceptKey against the curriculum, frames
  // the question at the concept's MASTERY-CALIBRATED band (rank band, ±1 by the
  // learner's standing on the concept — RANKS_PLAN §6), tags it with `conceptKey` +
  // that band, and signs both into the token — so the graded attempt (signed-in via
  // /api/score, guest via /api/grade) updates THIS concept's mastery coloring.
  // authApi (not api): a signed-in caller's JWT lets the server read their OWN
  // concept_mastery row for the calibration; `masteryState` is the guest fallback the
  // server only honors on unauthenticated calls (guest mastery is localStorage-derived
  // anyway). `concept` is { subject, key, label, rank, strand, masteryState } from the
  // concept page.
  async function startConceptDrill(concept) {
    if (!concept || !concept.subject || !concept.key) return;
    const { subject, key, masteryState } = concept;
    // Run-token guard (mirrors startPractice): bumping practiceRun supersedes any
    // in-flight practice/drill generation, and the post-fetch check drops THIS drill
    // if a newer one (or a sign-out/Restart) started while it was generating — so a
    // slow drill can't yank the learner into a stale concept's question.
    const myRun = ++practiceRun.current;
    setDrillBusy(key);
    setError("");
    try {
      const data = await authApi("/api/generate", {
        kind: "practice",
        subject,
        conceptKey: key,
        ...(typeof masteryState === "string" && masteryState !== "grey" ? { masteryState } : {}),
      });
      // Superseded by a newer drill/practice (or sign-out/Restart): bail WITHOUT
      // touching drillBusy — the newer run now owns that spinner state.
      if (myRun !== practiceRun.current) return;
      if (!data || typeof data.question !== "string" || !data.question.trim()) {
        throw new Error("Could not generate a practice question. Please try again.");
      }
      // Clear the spinner BEFORE entering practice — startPracticeWithQuestion bumps
      // practiceRun (to navigate away), so a run-gated clear afterward would never fire.
      setDrillBusy(null);
      // The server set difficulty (the mastery-calibrated band) + conceptKey; enter the
      // practice flow with the server-issued question verbatim (it carries the token
      // the grader path needs).
      startPracticeWithQuestion(subject, data);
    } catch (e) {
      if (myRun !== practiceRun.current) return; // superseded — don't clear/surface a stale error
      setDrillBusy(null);
      setError(e.message || "Could not generate a practice question.");
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
    let data, mime;
    try {
      ({ data, mime } = await prepareImage(file));
    } catch (e) {
      setError((e && e.message) || "Couldn't read that image. Please try a different file.");
      return;
    }
    // URL created outside the updater; previous preview revoked inside it from the
    // latest state, so rapid double-attaches can't leak the first blob (see attachCur).
    const preview = URL.createObjectURL(file);
    setPImg((prev) => {
      if (prev && prev.preview !== preview) revokePreview(prev);
      return { data, mime, name: file.name, preview };
    });
  }

  // One-shot learn tokens: after ANY signed-in submit of a Learn-sourced question
  // (success, duplicate 409, or an expired-token 400), drop the token from the session
  // guide cache so the next open of that concept refetches a freshly-signed one.
  // No-op for /api/generate questions (they aren't in the guide cache).
  function consumeLearnToken(token) {
    if (!token) return;
    for (const k of Object.keys(learnCacheRef.current)) {
      const g = learnCacheRef.current[k];
      if (g && g.tryThisQuestion && g.tryThisQuestion.token === token) {
        learnCacheRef.current[k] = { ...g, tryThisQuestion: { ...g.tryThisQuestion, token: null } };
      }
    }
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
        let data;
        try {
          data = await authApi("/api/score", {
            kind: "practice",
            // The server-issued question token (audit P1-1): subject/question/band/
            // topic/surface — AND the curriculum conceptKey for mastery coloring — all
            // come from the VERIFIED token server-side, so the client no longer asserts
            // any rating-relevant field. A missing/expired token gets a clear
            // "generate a new question" error.
            token: pQuestion.token,
            reasoning,
            image: imagePayload,
          });
        } finally {
          consumeLearnToken(pQuestion.token); // one-shot: never resubmit a used/rejected token
        }
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
        },
        // Mastery counters for a concept-tagged attempt (a drill from a concept page);
        // generic practice has no conceptKey → no update. The store allow-lists the key.
        pQuestion.conceptKey
          ? [{ subject: pSubject, conceptKey: pQuestion.conceptKey, quality: reasoningScore }]
          : undefined);
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
  // App chrome: the sidebar (nav + account + theme) renders whenever the tabs
  // used to — once there's progress or a session, outside the sign-in screen.
  // Chrome-less stages (intro / sign-in) keep a minimal centered header instead.
  const chrome = (user || scores) && stage !== "signin";

  // The public marketing landing page IS the intro stage now. It renders for anyone
  // on "intro" (guest OR a signed-in user who hasn't been ranked yet) — gating on the
  // stage rather than on `chrome` keeps the tree stable across the async sign-in load
  // (otherwise setUser would swap Landing→shell mid-interaction and detach the CTA).
  // Its CTAs call straight into the live handlers, so "Prove it"/"Sign in" move the
  // state machine off "intro" and this branch stops matching. A ranked user is sent
  // to "dashboard" by hydrate(), so they never land here.
  if (stage === "intro" && view !== "dashboard" && view !== "learn" && view !== "admin") {
    return (
      <Landing
        user={user}
        busy={busy}
        onProveIt={beginDiagnostic}
        onSignIn={() => (isSupabaseConfigured ? openSignIn() : setShowAuthNote(true))}
        error={error}
        onDismissError={() => setError("")}
        showAuthNote={showAuthNote}
        onDismissAuthNote={() => setShowAuthNote(false)}
      />
    );
  }

  return (
    <div className="np-root">
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
              Nice work. You've got your starting scores. Sign in to keep them across devices; your guest
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

      <div className="np-app" inert={bgInert}>
        {/* ONE shared sticky TopNav. With app chrome it carries the view tabs +
            identity + sign-out; on the chrome-less sign-in screen it falls back
            to just the brand + theme (+ a sign-in for a returning guest). The
            brand is the Restart control everywhere. */}
        <TopNav
          scrolled={navScrolled}
          onBrand={reset}
          brandTitle="Restart"
          tabs={chrome ? [
            { id: "practice", label: "Practice", icon: "target", active: view === "practice", onClick: () => setView("practice") },
            ...(scores ? [{ id: "learn", label: "Learn", icon: "book", active: view === "learn", onClick: () => setView("learn") }] : []),
            // One merged Dashboard tab (was Progress + Profile); a guest who clicks it gets the sign-in gate.
            { id: "dashboard", label: "Dashboard", icon: "grid", active: view === "dashboard", onClick: () => setView("dashboard") },
            ...(user && isAdmin ? [{ id: "admin", label: "Admin", icon: "shield", active: view === "admin", onClick: () => setView("admin") }] : []),
          ] : undefined}
          user={chrome ? user : undefined}
          scores={chrome ? scores : undefined}
          signIn={
            // Sign-in button: in app chrome for a guest; on chrome-less non-intro
            // stages for a returning guest. (The intro/sign-in screens surface their
            // own entry points, so we don't double up there.)
            (chrome && !user) || (!chrome && !user && stage !== "intro" && stage !== "signin")
              ? { onClick: () => (isSupabaseConfigured ? openSignIn() : setShowAuthNote(true)), label: "Sign in" }
              : undefined
          }
          signOut={chrome && user ? { onClick: handleSignOut, label: "Sign out", title: user.email || "" } : undefined}
        />

        <div className="np-frame">
          <div className="np-shell">
          <main className="np-main">
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
            loadLeaderboard={loadLeaderboard}
            loadReviews={loadReviews}
            loadMastery={loadMastery}
            onStartDiagnostic={() => { setView("practice"); beginDiagnostic(); }}
            onPractice={(s) => { setView("practice"); startPractice(s); }}
            onLearn={openLearn}
            onReset={resetProgress}
            onSignIn={() => (isSupabaseConfigured ? openSignIn() : setShowAuthNote(true))}
            onClose={() => setView("practice")}
            onOverlayActiveChange={setOverlayActive}
          />
        ) : view === "learn" && scores ? (
          // FIX 1: a deep-linked "Learn this" concept (learnConcept set) renders the
          // fetched /api/learn guide; otherwise the generic curriculum browser.
          learnConcept ? (
            <LearnConceptGuide
              concept={learnConcept}
              content={learnContent}
              busy={learnBusy}
              error={learnError}
              onPractice={startPracticeWithQuestion}
              onBrowse={() => { setLearnConcept(null); setLearnError(""); }}
              onRetry={() => openLearn(learnConcept.subject, learnConcept.concept)}
            />
          ) : (
            <LearnTab onPractice={startConceptDrill} busyConcept={drillBusy} />
          )
        ) : (
          <>
            {/* INTRO (signed-in but not yet ranked — guests see the Landing instead) */}
            {stage === "intro" && (
              <div className="fade-up">
                <div className="np-pagehead">
                  <span className="np-eyebrow--mono">Reasoning-first STEM assessment</span>
                  <h1 className="np-h1">Stop memorizing. Start thinking. Climb.</h1>
                  <p className="np-lede">
                    School makes you memorize. Most apps make you chase streaks. noobtopro does neither: it hands you real
                    problems, reads <em>how you reason</em>, and scores each subject 0 to 350, Elementary to Doctorate. Stuck? It won't hand over the
                    answer; it asks the right question and teaches the one concept you're missing. For students and
                    self-learners who'd rather understand than cram.
                  </p>
                </div>
                <div className="np-steps">
                  {[
                    ["01", "Prove it", "Nine open problems: beginner, intermediate, and hard in each of math, physics, and chemistry. Explain every step, or tap “I don’t know” to skip."],
                    ["02", "Get ranked", "Your reasoning is graded on a 9-axis rubric and mapped to a 0 to 350 rank per subject, Elementary up to Doctorate."],
                    ["03", "Climb", "Pick a subject. Get calibrated problems. Sound reasoning moves your score, even when the answer's wrong."],
                  ].map(([n, t, d]) => (
                    <div key={n} className="np-card np-lift np-step">
                      <div className="np-stepnum">{n}</div>
                      <div className="np-steptitle">{t}</div>
                      <div className="np-stepdesc">{d}</div>
                    </div>
                  ))}
                </div>
                <div className="np-subjectrow">
                  {ORDER.map((k) => (
                    <span key={k} className="np-chip">
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
                <div className="np-pagehead">
                  <span className="np-eyebrow--mono">Adaptive placement</span>
                  <h2 className="np-h2">Prove what you know</h2>
                </div>
                {/* Progress: 3 subject groups × stepsTotal pips, filled by the steps
                    ANSWERED per subject (the §8 adaptive walk, band varies per step,
                    so pips count steps, not tiers). */}
                <div className="np-diag-progress">
                  {ORDER.map((s) => (
                    <div key={s} className="np-diag-proggroup">
                      {Array.from({ length: curQ.stepsTotal || 3 }, (_, di) => (
                        <div key={di} className="np-progdot" style={{ background: di < (diagAnswered[s] || 0) ? SUBJECTS[s].color : "var(--tint-2)" }} />
                      ))}
                    </div>
                  ))}
                </div>
                <div className="np-qmeta">
                  <SubjectGlyph subject={curSubject} />
                  <span className="np-metaline">
                    {SUBJECTS[curSubject].label.toUpperCase()} · {(DIFFICULTY_LABELS[curQ.difficulty] || "").toUpperCase()} · STEP {curQ.stepNo}/{curQ.stepsTotal || 3}
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
                  submitLabel={
                    Object.values(diagAnswered).reduce((a, n) => a + n, 0) >= ORDER.length * (curQ.stepsTotal || 3) - 1
                      ? "Get ranked"
                      : "Next question"
                  }
                  loading={false}
                />
                <p className="np-hint">noobtopro grades your <em>thinking</em>, so explain your full approach, or attach a photo of your worked notes. Each answer is scored while you work on the next subject, and the difficulty adapts to you.</p>
              </div>
            )}

            {/* Adaptive-walk WAITING / RETRY state: every served question is answered
                and the next item (or the finalize) is still in flight — or a step
                failed and its signed token awaits a retry. */}
            {stage === "diagnostic" && !curQ && (
              <div className="fade-up">
                {diagError ? (
                  <div className="np-card" style={{ textAlign: "center", padding: "32px 24px" }}>
                    <p className="np-lessontext" style={{ marginBottom: 16 }}>{diagError}</p>
                    <button className="np-btn np-primary" onClick={retryDiagnostic}>Try again</button>
                  </div>
                ) : (
                  <Loader subject="scoring your last answer" />
                )}
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
                <div className="np-pagehead">
                  <span className="np-eyebrow--mono">Your results</span>
                  <h2 className="np-h2">Where you stand</h2>
                  <p className="np-lede">{SCALE_NOTE}</p>
                </div>
                <div className="np-grid3">
                  {ORDER.map((k) => {
                    const s = scores[k] || { score: 0, weakConcepts: [], comment: "" };
                    return (
                      <div key={k} className="np-card np-lift np-scorecard">
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
                <div className="np-pagehead">
                  <span className="np-eyebrow--mono">Practice</span>
                  <h2 className="np-h2">Climb {pSubject ? SUBJECTS[pSubject].label : "your subjects"}</h2>
                </div>

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
                        {scores[pSubject]?.score ?? 0}<span style={{ color: "var(--muted)" }}>/350</span>
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
                          <div className="np-feedsub">Your <em>reasoning</em> is scored, not the final answer. The breakdown below shows exactly how.</div>
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

          <footer className="np-foot">
            © {new Date().getFullYear()} noobtopro · your reasoning is graded by AI against a nine-axis rubric
          </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
