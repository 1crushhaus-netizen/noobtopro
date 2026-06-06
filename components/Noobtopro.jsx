"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  SUBJECTS,
  ORDER,
  RUBRIC_LABELS,
  SCALE_NOTE,
  band,
  blend,
  totalPoints,
  phdIndex,
} from "@/lib/scoring";
import { loadState, saveProgress, resetAll, migrateGuestToAccount, deleteAllUserData } from "@/lib/store";
import { getSupabase, isSupabaseConfigured, signInWithProvider, signOutUser, PROVIDERS } from "@/lib/supabase";
import ProgressDashboard from "@/components/ProgressDashboard";
import SignIn from "@/components/SignIn";
import ProfileTab from "@/components/ProfileTab";
import LearnTab from "@/components/LearnTab";

/* ----------------------------- icons (inline, no deps) ----------------------------- */
function Icon({ name, size = 16 }) {
  const c = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  if (name === "arrow") return <svg {...c}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
  if (name === "back") return <svg {...c}><path d="M19 12H5M11 18l-6-6 6-6" /></svg>;
  if (name === "x") return <svg {...c}><path d="M6 6l12 12M18 6 6 18" /></svg>;
  if (name === "clip") return <svg {...c}><path d="M21.4 11.05 12.25 20.2a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>;
  if (name === "bulb") return <svg {...c}><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2Z" /></svg>;
  if (name === "refresh") return <svg {...c}><path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v5h-5" /></svg>;
  if (name === "spark") return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z" /></svg>;
  if (name === "google") return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M21.8 10.04H12v3.96h5.62c-.25 1.34-1 2.48-2.13 3.24v2.69h3.45c2.02-1.86 3.18-4.6 3.18-7.85 0-.73-.07-1.43-.2-2.08z" /><path d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.45-2.69c-.96.64-2.18 1.02-3.17 1.02-2.6 0-4.8-1.76-5.59-4.12H2.84v2.78A10 10 0 0 0 12 22z" /><path d="M6.41 13.78a6 6 0 0 1 0-3.56V7.44H2.84a10 10 0 0 0 0 9.12z" /><path d="M12 5.98c1.47 0 2.79.51 3.83 1.5l2.86-2.86A9.6 9.6 0 0 0 12 2 10 10 0 0 0 2.84 7.44l3.57 2.78C7.2 7.74 9.4 5.98 12 5.98z" /></svg>;
  return null;
}

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

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

const now = () => new Date().toISOString();

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

function SegBar({ value, color }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ height: 7, flex: 1, borderRadius: 3, background: i < value ? color : "rgba(255,255,255,.09)", transition: "background .4s ease" }} />
      ))}
    </div>
  );
}

function AnswerComposer({ value, onText, img, onAttach, onRemoveImg, onSubmit, submitLabel, loading, placeholder }) {
  const fileRef = useRef(null);
  const canSubmit = (value && value.trim().length > 0) || img;
  return (
    <div className="np-card" style={{ padding: 0, overflow: "hidden" }}>
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderTop: "1px solid var(--line)", background: "rgba(255,255,255,.015)" }}>
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
        <button className="np-btn np-primary" disabled={!canSubmit || loading} onClick={onSubmit}>
          {loading ? "Working…" : submitLabel} {!loading && <Icon name="arrow" size={16} />}
        </button>
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
    <div className="np-card fade-up" style={{ textAlign: "center", padding: "48px 24px" }}>
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
  const [view, setView] = useState("practice"); // practice | learn | progress | profile
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAuthNote, setShowAuthNote] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [user, setUser] = useState(null);

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

  useEffect(() => {
    const sb = getSupabase();
    hydrate();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => setUser((data && data.user) || null)).catch(() => setUser(null));
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      setUser((session && session.user) || null);
      // Only reload data when the identity actually changes. TOKEN_REFRESHED /
      // USER_UPDATED / INITIAL_SESSION fire routinely and would otherwise re-run
      // hydrate mid-attempt (the mount call above already covers session restore).
      if (event === "SIGNED_IN") {
        setShowSaveModal(false);
        setStage((p) => (p === "signin" ? "dashboard" : p)); // leave the sign-in menu
        hydrate(); // migrates guest progress, then loads the account
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
        hydrate();
      }
    });
    return () => sub && sub.subscription && sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reset() {
    diagRun.current++; // supersede any in-flight diagnostic grade so it can't land a stale write
    practiceRun.current++; // and any in-flight practice grade (see submitPractice's guard)
    setBusy(false); // a superseded in-flight grade won't clear its own busy flag (its finally is run-guarded)
    await resetAll();
    // Release any outstanding image previews before clearing state.
    Object.values(answers).forEach((a) => revokePreview(a && a.img));
    revokePreview(pImg);
    setShowSaveModal(false);
    setLearnConcept(null);
    setLearnContent(null);
    setLearnError("");
    setLearnQuestion(null);
    setStage("intro");
    setView("practice");
    setQuestions([]);
    setQi(0);
    setAnswers({});
    setScores(null);
    setHistory([]);
    setPSubject(null);
    setPQuestion(null);
    setPText("");
    setPImg(null);
    setFeedback(null);
    setScoreDelta(null);
    setError("");
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
      // Keep the FIRST question per known subject, then require exactly one for
      // each of the three. Guards against the model returning duplicates or an
      // unknown subject, which would otherwise crash the dashboard (scores[k]
      // undefined). ORDER.includes avoids inherited-key matches.
      const bySubject = {};
      for (const q of data.questions || []) {
        if (q && ORDER.includes(q.subject) && !bySubject[q.subject]) bySubject[q.subject] = q;
      }
      const qs = ORDER.map((s) => bySubject[s]).filter(Boolean);
      if (qs.length < ORDER.length) {
        throw new Error("Could not generate a full diagnostic. Please try again.");
      }
      const init = {};
      qs.forEach((q) => (init[q.subject] = { text: "", img: null }));
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

  const curSubject = questions[qi] ? questions[qi].subject : null;
  const curAns = curSubject ? answers[curSubject] || { text: "", img: null } : { text: "", img: null };

  function setCurText(t) {
    setAnswers((a) => ({ ...a, [curSubject]: { ...a[curSubject], text: t } }));
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
      const prev = a[curSubject] && a[curSubject].img;
      if (prev && prev.preview !== preview) revokePreview(prev);
      return { ...a, [curSubject]: { ...a[curSubject], img: { data, mime: file.type, name: file.name, preview } } };
    });
  }
  function removeCurImg() {
    revokePreview(curAns.img);
    setAnswers((a) => ({ ...a, [curSubject]: { ...a[curSubject], img: null } }));
  }

  function nextDiagnostic() {
    if (qi < questions.length - 1) setQi(qi + 1);
    else submitDiagnostic();
  }

  async function submitDiagnostic() {
    const myRun = ++diagRun.current;
    setError("");
    setStage("scoring");
    try {
      const results = await Promise.all(
        questions.map(async (q) => {
          const a = answers[q.subject] || { text: "", img: null };
          const r = await api("/api/grade", {
            kind: "diagnostic",
            subject: q.subject,
            question: q.question,
            reasoning: a.text,
            image: a.img ? { mime: a.img.mime, data: a.img.data } : undefined,
          });
          return [q.subject, { score: r.score, weakConcepts: r.weakConcepts || [], comment: r.comment || "" }];
        })
      );
      // The user abandoned this diagnostic mid-grade (signed out / hit Restart):
      // bail BEFORE persisting so we don't re-write the abandoned baseline to the
      // store or stomp the freshly-reset intro state with a stale dashboard.
      if (myRun !== diagRun.current) return;
      const obj = {};
      results.forEach(([k, v]) => (obj[k] = v));
      // Atomic: persist the baseline scores AND the baseline attempt together.
      const st = await saveProgress(obj, { type: "baseline", t: now(), totalAfter: totalPoints(obj), phdAfter: phdIndex(obj) });
      if (myRun !== diagRun.current) return; // abandoned during the save round-trip
      if (st && st.history) setHistory(st.history); // null = couldn't refresh; keep current
      setScores(obj);
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
    setLearnError("");
    setLearnRegen(true);
    try {
      const data = await api("/api/generate", {
        kind: "practice",
        subject,
        score: scores?.[subject]?.score ?? 0,
        weakConcepts: [concept],
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
      setLearnQuestion({ question: data.question, targetConcept: data.targetConcept || concept, difficulty });
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
      const s = scores[subject];
      const data = await api("/api/generate", {
        kind: "practice",
        subject,
        score: s.score,
        weakConcepts: s.weakConcepts || [],
      });
      // A newer practice (another startPractice, or "Practice this problem" from
      // Learn) started while this generation was in flight — drop this stale
      // question so submitPractice can't grade it against the wrong subject/concept.
      if (myRun !== practiceRun.current) return;
      // Guard against malformed model output so we don't render an empty prompt.
      if (!data || typeof data.question !== "string" || !data.question.trim()) {
        throw new Error("Could not generate a question. Please try again.");
      }
      setPQuestion(data);
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

  async function submitPractice() {
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
      const prev = scores[pSubject];
      const r = await api("/api/grade", {
        kind: "practice",
        subject: pSubject,
        question: pQuestion.question,
        targetConcept: pQuestion.targetConcept,
        score: prev.score,
        reasoning: pText,
        difficulty: pQuestion.difficulty,
        image: pImg ? { mime: pImg.mime, data: pImg.data } : undefined,
      });
      if (myRun !== practiceRun.current) return; // abandoned mid-grade — don't persist a stale write
      const updatedScore = blend(prev.score, r.newScoreSuggestion, {
        difficulty: pQuestion.difficulty,
        reasoningScore: r.reasoningScore,
      });
      const updatedScores = {
        ...scores,
        [pSubject]: {
          score: updatedScore,
          weakConcepts: r.weakConcepts && r.weakConcepts.length ? r.weakConcepts : prev.weakConcepts,
          comment: prev.comment,
        },
      };
      // Atomic: persist the updated score AND its attempt in one transaction, so a
      // partial failure can't leave the score saved but the attempt lost (which a
      // retry would then re-grade and overwrite). Send ONLY the changed subject:
      // save_progress upserts every subject in the map, so passing the full map
      // would rewrite the two UNCHANGED subjects with this tab's (possibly stale)
      // hydrated copy and clobber a concurrent same-user session's progress on them.
      // (totalAfter/phdAfter still use the full map — they're the attempt snapshot.)
      const st = await saveProgress({ [pSubject]: updatedScores[pSubject] }, {
        type: "attempt",
        t: now(),
        subject: pSubject,
        reasoningScore: r.reasoningScore,
        delta: updatedScore - prev.score,
        newScore: updatedScore,
        totalAfter: totalPoints(updatedScores),
        phdAfter: phdIndex(updatedScores),
      });
      if (myRun !== practiceRun.current) return; // abandoned during the save round-trip — don't repopulate the reset UI
      if (st && st.history) setHistory(st.history); // null = couldn't refresh; keep current
      setScores(updatedScores);
      setScoreDelta(updatedScore - prev.score);
      setFeedback(r);
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

  // While the modal is open, make the rest of the page inert so keyboard/screen-
  // reader users can't reach background controls (proper modal focus containment).
  const bgInert = showSaveModal && !user ? true : undefined;

  /* ----------------------------- render ----------------------------- */
  return (
    <div className="np-shell">
      {showSaveModal && !user && (
        <div className="np-modal-backdrop" onClick={() => setShowSaveModal(false)}>
          <div
            className="np-modal"
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
              className="np-btn np-primary np-big"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => { setShowSaveModal(false); openSignIn(); }}
            >
              <Icon name="google" size={16} /> Sign in
            </button>
            <button className="np-ghost np-modal-later" onClick={() => setShowSaveModal(false)}>Not now</button>
          </div>
        </div>
      )}

      <header className="np-top" inert={bgInert}>
        <button className="np-brand" onClick={reset} title="Restart">
          noob<span className="np-arrow">→</span>topro
        </button>
        <span className="np-tag">prove what you know</span>
        <div className="np-signin">
          {user ? (
            <button className="np-signinbtn" onClick={() => signOutUser()} title={user.email || ""}>
              <Icon name="google" size={16} /> Sign out
            </button>
          ) : (
            // Guests on the intro see Sign in beside the primary CTA instead, so the
            // top-right button is hidden there to avoid two sign-in buttons.
            stage !== "intro" && (
              isSupabaseConfigured ? (
                <button className="np-signinbtn" onClick={openSignIn}>
                  <Icon name="google" size={16} /> Sign in
                </button>
              ) : (
                <button className="np-signinbtn" onClick={() => setShowAuthNote(true)}>
                  <Icon name="google" size={16} /> Sign in
                </button>
              )
            )
          )}
        </div>
      </header>

      {(user || scores) && stage !== "signin" && (
        <nav className="np-nav" inert={bgInert}>
          <button className={"np-tab" + (view === "practice" ? " active" : "")} onClick={() => setView("practice")}>Practice</button>
          {scores && (
            <button className={"np-tab" + (view === "learn" ? " active" : "")} onClick={() => setView("learn")}>Learn</button>
          )}
          {scores && (
            <button className={"np-tab" + (view === "progress" ? " active" : "")} onClick={() => setView("progress")}>Progress</button>
          )}
          {user && (
            <button className={"np-tab" + (view === "profile" ? " active" : "")} onClick={() => setView("profile")}>Profile</button>
          )}
        </nav>
      )}

      <main className="np-main" inert={bgInert}>
        {showAuthNote && (
          <div className="np-banner fade-up">
            <span>Google sign-in runs through Supabase. Add your Supabase URL + anon key and enable the Google provider by following the README ("Supabase setup"). The app works fully as a guest in the meantime.</span>
            <button className="np-ghost" onClick={() => setShowAuthNote(false)}><Icon name="x" size={14} /> dismiss</button>
          </div>
        )}
        {error && (
          <div className="np-error fade-up">
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
        ) : view === "profile" && user ? (
          <ProfileTab
            user={user}
            scores={scores}
            history={history}
            onStartDiagnostic={() => { setView("practice"); beginDiagnostic(); }}
            onPractice={(s) => { setView("practice"); startPractice(s); }}
            onSignOut={() => signOutUser()}
            onReset={resetProgress}
            onViewProgress={() => setView("progress")}
          />
        ) : view === "learn" && scores ? (
          <LearnTab
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
        ) : view === "progress" && scores ? (
          <ProgressDashboard
            scores={scores}
            history={history}
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
                    ["01", "Prove it", "Three open problems — one each in math, physics, chemistry. Solve them and explain every step."],
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
                      <span style={{ color: SUBJECTS[k].color, fontFamily: "var(--mono)" }}>{SUBJECTS[k].glyph}</span> {SUBJECTS[k].label}
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
                      <Icon name="google" size={16} /> Sign in
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* DIAGNOSTIC */}
            {stage === "diagnostic" && questions[qi] && (
              <div className="fade-up" key={qi}>
                <div className="np-progress">
                  {questions.map((q, i) => (
                    <div key={i} className="np-progdot" style={{ background: i <= qi ? SUBJECTS[q.subject].color : "rgba(255,255,255,.12)" }} />
                  ))}
                </div>
                <div className="np-qmeta">
                  <span style={{ color: SUBJECTS[curSubject].color }}>{SUBJECTS[curSubject].glyph}</span>
                  <span style={{ fontFamily: "var(--mono)", letterSpacing: 1 }}>
                    {SUBJECTS[curSubject].label.toUpperCase()} · PROVE IT {qi + 1}/{questions.length}
                  </span>
                  {questions[qi].topic && <span className="np-topic">{questions[qi].topic}</span>}
                </div>
                <div className="np-card np-question">{questions[qi].question}</div>
                <AnswerComposer
                  value={curAns.text}
                  onText={setCurText}
                  img={curAns.img}
                  onAttach={attachCur}
                  onRemoveImg={removeCurImg}
                  onSubmit={nextDiagnostic}
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
                      <Icon name="google" size={15} /> Sign in to save
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
                          <span style={{ color: SUBJECTS[k].color, fontFamily: "var(--mono)", fontSize: 20 }}>{SUBJECTS[k].glyph}</span>
                          <span className="np-scorelabel">{SUBJECTS[k].label}</span>
                        </div>
                        <Ring value={s.score} color={SUBJECTS[k].color} label={SUBJECTS[k].label} />
                        <div className="np-bandtag" style={{ color: SUBJECTS[k].color }}>{band(s.score)}</div>
                        {s.comment && <div className="np-comment">{s.comment}</div>}
                        {s.weakConcepts && s.weakConcepts.length > 0 && (
                          <div className="np-weakwrap">
                            <div className="np-weaklabel">Work on</div>
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
                        <button className="np-btn np-outline" style={{ marginTop: 14, borderColor: SUBJECTS[k].color, color: SUBJECTS[k].color }} onClick={() => startPractice(k)}>
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
                      <span style={{ color: SUBJECTS[pSubject].color }}>{SUBJECTS[pSubject].glyph}</span>
                      <span style={{ fontFamily: "var(--mono)", letterSpacing: 1 }}>
                        {SUBJECTS[pSubject].label.toUpperCase()} · {(pQuestion.difficulty || "").toUpperCase()}
                      </span>
                      {pQuestion.targetConcept && <span className="np-topic">{pQuestion.targetConcept}</span>}
                      <span className="np-livescore" style={{ borderColor: SUBJECTS[pSubject].color }}>
                        {scores[pSubject].score}<span style={{ color: "var(--muted)" }}>/100</span>
                        {scoreDelta !== null && scoreDelta !== 0 && (
                          <span style={{ color: scoreDelta > 0 ? "var(--phys)" : "var(--chem)", marginLeft: 6 }}>
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
                          onSubmit={submitPractice}
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
                            <div className="np-feedlabel">Reasoning quality this attempt</div>
                            <div className="np-feedscore">{feedback.reasoningScore}<span style={{ color: "var(--muted)", fontSize: 18 }}>/100</span></div>
                          </div>
                          <div className="np-rubric">
                            {Object.keys(RUBRIC_LABELS).map((k) => (
                              <div key={k} className="np-rubrow">
                                <span className="np-rublabel">{RUBRIC_LABELS[k]}</span>
                                <SegBar value={(feedback.rubric && feedback.rubric[k]) || 0} color={SUBJECTS[pSubject].color} />
                              </div>
                            ))}
                          </div>
                        </div>

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
                          <button className="np-ghost" onClick={() => setView("progress")}>See progress over time</button>
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

      <footer className="np-foot" inert={bgInert}>Prototype · grading is performed live by Groq against a reasoning rubric. Scores are demonstrative.</footer>
    </div>
  );
}
