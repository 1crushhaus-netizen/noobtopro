"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
import { loadState, saveProgress, resetAll, migrateGuestToAccount, deleteAllUserData, deleteAccount as requestAccountDeletion, submitAgeVerification, hasGuestAgeAck, recordGuestAgeAck, clearGuestAgeAck, exportMyData, loadReviews, loadTrends, loadMastery, loadSubscription, withdrawFromContract } from "@/lib/store";
import { IMMEDIATE_ACCESS_CONSENT_TEXT, IMMEDIATE_ACCESS_CONSENT_VERSION } from "@/lib/consent";
import { getSupabase, ensureSupabase, isSupabaseConfigured, signInWithProvider, signOutUser, PROVIDERS } from "@/lib/supabase";
import { track } from "@/lib/analytics";
import { isActiveSubscription } from "@/lib/proStatus";
import { resolveConceptKey, conceptByKey, conceptLabel } from "@/lib/curriculum";
import { effectiveScores, effectiveSubjectScore, pickPracticeConcept } from "@/lib/promotion";
import { applyMasteryUpdates } from "@/lib/mastery";
import dynamic from "next/dynamic";
import Icon from "@/components/Icon";
import SignIn from "@/components/SignIn";
import AgeGate from "@/components/AgeGate";
import ScoreBreakdown, { ErrorList, hasReasoningError } from "@/components/ScoreBreakdown";

// PERF (INP / First Load JS): the Dashboard, Learn, and Admin views are only ever
// mounted AFTER the user navigates to them — the landing, the adaptive diagnostic,
// and the practice flow never render them. Statically importing them forced every
// first-time visitor to download, parse, and hydrate all of that code (plus their
// own deps: charts, the leaderboard, the curriculum browser) on the critical path,
// inflating main-thread time and Interaction-to-Next-Paint. Code-splitting them
// into on-demand chunks keeps the initial `/` bundle to just the landing + flow.
const Dashboard = dynamic(() => import("@/components/Dashboard"), { loading: () => <Loader subject="dashboard" reserve /> });
const LearnTab = dynamic(() => import("@/components/LearnTab"), { loading: () => <Loader subject="learn" reserve /> });
const AdminDashboard = dynamic(() => import("@/components/AdminDashboard"), { loading: () => <Loader subject="admin" reserve /> });
import Landing from "@/components/Landing";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import { useScrolled } from "@/components/useReveal";
import { SubjectGlyph, deltaColor } from "@/components/ui";

/* ----------------------------- helpers ----------------------------- */
// A hard client-side timeout so a hung request (a stalled LLM grade, a flaky
// network) can never leave the UI spinning forever — it rejects with a clear,
// retryable message instead (audit P0-6). 60s is generous for LLM grading.
const REQUEST_TIMEOUT_MS = 60000;
async function fetchWithTimeout(path, init) {
  if (typeof AbortController === "undefined") return fetch(path, init);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(path, { ...init, signal: controller.signal });
  } catch (e) {
    if (e && (e.name === "AbortError" || controller.signal.aborted)) {
      const err = new Error("This is taking longer than expected — check your connection and try again.");
      err.timeout = true;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function api(path, body) {
  const res = await fetchWithTimeout(path, {
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
    const err = new Error(msg);
    // Carry the HTTP status + the server's `upgrade` flag so callers can distinguish a
    // Pro paywall (402) from a generic failure and surface an upgrade nudge.
    err.status = res.status;
    err.upgrade = data.upgrade === true || res.status === 402;
    throw err;
  }
  return data;
}

// Like api(), but attaches the signed-in user's Supabase access token so the server
// can verify the caller's identity from the JWT. Used by the authenticated routes:
// the Admin tab (/api/admin/*) and server-authoritative scoring (/api/score), which
// both re-verify the token on every call and never trust a client-supplied identity.
// Resolve the browser Supabase client, loading the code-split @supabase/supabase-js bundle
// on first use (ensureSupabase — see lib/supabase.js). Falls back to the synchronous
// getSupabase() when ensureSupabase isn't present (e.g. a unit-test mock that only stubs
// getSupabase), so behavior is identical in the app and in tests.
async function resolveSupabase() {
  return (await ensureSupabase?.()) ?? getSupabase();
}

async function authApi(path, body) {
  const sb = await resolveSupabase();
  let token = null;
  if (sb) {
    const { data } = await sb.auth.getSession();
    token = (data && data.session && data.session.access_token) || null;
  }
  const res = await fetchWithTimeout(path, {
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
  if (!res.ok || data.error) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.upgrade = data.upgrade === true || res.status === 402;
    throw err;
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
            // toBlob + async FileReader keeps the JPEG encode OFF the synchronous
            // main-thread path (toDataURL blocks for hundreds of ms on a multi-MB
            // phone photo — the device class that uses photo-of-work most; audit
            // P1-P4). Falls back to toDataURL where toBlob is unavailable.
            const b64 = await new Promise((resolve) => {
              if (typeof canvas.toBlob !== "function") {
                try { resolve(String(canvas.toDataURL("image/jpeg", 0.8)).split(",")[1] || ""); }
                catch { resolve(""); }
                return;
              }
              canvas.toBlob(
                (blob) => {
                  if (!blob) { resolve(""); return; }
                  const r = new FileReader();
                  r.onload = () => resolve(String(r.result).split(",")[1] || "");
                  r.onerror = () => resolve("");
                  r.readAsDataURL(blob);
                },
                "image/jpeg",
                0.8
              );
            });
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

// A11y P1-2: accessible TEXT color per subject for small meaning-bearing labels
// (the score-card rank band tag). Darker than SUBJECTS[k].color in the light theme
// so 12px tinted text reaches WCAG AA; the bright accents stay for the rings/glyphs.
const SUBJECT_TEXT = { math: "var(--math-text)", physics: "var(--phys-text)", chemistry: "var(--chem-text)" };


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
// FRONTEND P1-1 (bounded extraction): the answer textarea now owns its own LOCAL
// text state instead of being controlled by the 1900-line shell's state. A keystroke
// re-renders ONLY this memoized child, not the whole app shell + TopNav + footer +
// every sibling stage branch. The value is lifted up to the parent on blur (onText)
// and passed explicitly to onSubmit(text) so the submit handlers grade the freshest
// text without the shell ever holding it per-keystroke. `initialValue`/`lockKey`
// re-seed the field when the QUESTION changes (a fresh question = a fresh empty box).
// React.memo + the stabilized (useCallback) handler props from the parent keep a
// shell re-render (e.g. the live-score updating) from re-rendering this subtree.
const AnswerComposer = React.memo(function AnswerComposer({
  initialValue = "",
  onText,
  img,
  onAttach,
  // Photo-of-work grading is a Pro feature (the server enforces it with a 402); when
  // `canAttach` is false the control is replaced by an upgrade nudge so a non-Pro photo
  // is never sent. `onUpgrade` opens that nudge.
  canAttach = true,
  onUpgrade,
  onRemoveImg,
  onSubmit,
  onSkip,
  submitLabel,
  loading,
  placeholder,
  lockKey,
}) {
  const fileRef = useRef(null);
  const [text, setText] = useState(initialValue);
  // Guards against a double-submit / no-feedback tap on the most-repeated action
  // (audit P0-3): once submitted, the button locks until the question changes
  // (lockKey) — which for the diagnostic is the immediate advance to the next step.
  const [submitting, setSubmitting] = useState(false);
  // Re-seed the local field when the question changes (lockKey). Keyed on lockKey
  // (not initialValue) so the parent's per-keystroke blur sync can't clobber the box.
  useEffect(() => {
    setText(initialValue);
    setSubmitting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockKey]);
  const canSubmit = (text && text.trim().length > 0) || img;
  // The "I don't know" skip is TIME-LOCKED for SKIP_LOCK_SECONDS after each new question,
  // so a learner can't reflexively skip without giving it a moment's thought. The countdown
  // resets when lockKey (the question identity) changes.
  const [skipIn, setSkipIn] = useState(onSkip ? SKIP_LOCK_SECONDS : 0);
  // The timer must restart ONLY when the QUESTION changes (lockKey), never on a
  // parent re-render (audit P2-15). With local text state, typing no longer touches
  // the parent at all — but the lockKey-only dep is kept as the correct invariant.
  // hasSkip (a stable boolean) keeps the mount/unmount behavior; the click handler
  // reads the live prop.
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
        value={text}
        onChange={(e) => setText(e.target.value)}
        // Lift the value up on blur so any parent read (e.g. the diagnostic answers
        // map) stays roughly in sync; submit also passes the freshest text directly.
        onBlur={() => onText && onText(text)}
        placeholder={placeholder || "Show your full reasoning: every step, not just the answer."}
        rows={6}
        // Cap the answer so a runaway paste can't bloat the single all-answers
        // diagnostic request toward the platform body limit (audit P0-4).
        maxLength={8000}
      />
      {img && (
        <div style={{ padding: "0 16px 8px", display: "flex", alignItems: "center", gap: 10 }}>
          {/* img.preview is a blob: URL we minted from the selected File via
              URL.createObjectURL. encodeURI() is a no-op on a well-formed blob: URL but
              percent-encodes any HTML meta-characters (< > "), so even a non-blob value
              could never break out of the src attribute — defense-in-depth for the
              user-supplied image preview (CWE-079, js/xss-through-dom). */}
          <img src={encodeURI(img.preview)} alt="your work" style={{ height: 56, borderRadius: 8, border: "1px solid var(--line)" }} />
          <span style={{ fontSize: 13, color: "var(--muted)" }}>{img.name}</span>
          <button className="np-iconbtn" onClick={onRemoveImg} aria-label="remove image"><Icon name="x" size={15} /></button>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 12px", borderTop: "1px solid var(--line)", background: "var(--tint-1)", flexWrap: "wrap" }}>
        {canAttach ? (
          <>
            <button className="np-ghost" onClick={() => fileRef.current && fileRef.current.click()}><Icon name="clip" size={15} /> Attach your work</button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              aria-label="Upload a photo of your work"
              style={{ display: "none" }}
              onChange={async (e) => {
                const f = e.target.files && e.target.files[0];
                if (f) await onAttach(f);
                e.target.value = "";
              }}
            />
          </>
        ) : (
          // Gated: photo grading is Pro-only. A clear, non-dead affordance that opens
          // the upgrade nudge instead of a file picker (no file input is rendered, so a
          // non-Pro photo can't be selected or sent).
          <button
            type="button"
            className="np-ghost"
            onClick={() => onUpgrade && onUpgrade()}
            aria-label="Attach your work — a Pro feature. Upgrade to Pro to attach a photo of your work."
            title="Photo-of-work grading is a Pro feature"
          >
            <Icon name="clip" size={15} /> Attach your work
            <span className="np-badge" style={{ marginLeft: 4 }}>Pro</span>
          </button>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
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
          <button
            className="np-btn np-primary"
            disabled={!canSubmit || loading || submitting}
            title={!canSubmit ? "Add your reasoning or attach a photo to submit" : undefined}
            onClick={() => {
              if (submitting || loading) return;
              setSubmitting(true);
              onSubmit(text);
            }}
          >
            {loading ? "Working…" : submitLabel} {!loading && <Icon name="arrow" size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
});

// Signed-in identity (avatar + name + email + overall rank) now lives in the
// shared TopNav (components/TopNav.jsx) — its only home, the Dashboard bento has
// no identity bar.

function Loader({ subject, reserve = false }) {
  const lines = ["Reading your reasoning line by line", "Weighing the thinking, not just the answer", "Scoring against the rubric"];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % lines.length), 1400);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="np-card fade-up" role="status" aria-live="polite" style={{ textAlign: "center", padding: "48px 24px", minHeight: reserve ? "60vh" : undefined }}>
      <div className="np-pulse" style={{ fontFamily: "var(--mono)", fontSize: 13, letterSpacing: 1, color: "var(--muted)" }}>
        {subject ? subject.toUpperCase() : "EVALUATING"}
      </div>
      <div style={{ fontFamily: "var(--display)", fontSize: 22, marginTop: 10 }}>{lines[i]}…</div>
    </div>
  );
}

// The app-shell view tabs that map 1:1 onto a URL hash (#practice / #learn /
// #dashboard / #admin). Kept distinct from the marketing landing's section anchors
// (#top / #how / #engine / #ranks / #pricing) so the two uses of the hash never
// collide.
const VIEW_HASHES = ["practice", "learn", "dashboard", "admin"];

// useEvent-style stable callback: a function whose IDENTITY never changes but which
// always invokes the LATEST closure (via a ref refreshed in an effect). Lets us pass
// stable handler props into React.memo'd children WITHOUT dependency arrays — so there
// is no stale-closure risk in the critical flows it wraps (reset / sign-out).
function useStableCallback(fn) {
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; });
  return useCallback((...args) => ref.current(...args), []);
}

// The signed-in-app footer is fully static (its cookie-prefs button dispatches a
// window event and reads no shell state). Extracting it as a memoized, no-prop
// component — with a module-level YEAR so it never re-allocates a Date — keeps it
// out of the shell's per-render reconciliation (P1-P1: trimming the monolith's
// render cost, the zero-risk way — no handler stabilization, no state moved).
const FOOTER_YEAR = new Date().getFullYear();
const AppFooter = React.memo(function AppFooter() {
  return (
    <footer className="np-foot">
      © {FOOTER_YEAR} noobtopro · your reasoning is graded by AI against a nine-axis rubric
      {/* GDPR Art 7(3): withdrawing analytics consent must be as easy as giving it, and
          reachable from inside the signed-in app — not only the marketing footer. */}
      {" · "}
      <a href="/cookies" style={{ color: "inherit" }}>Cookies</a>
      {" · "}
      <button
        type="button"
        className="np-linkbtn"
        onClick={() => { if (typeof window !== "undefined") window.dispatchEvent(new Event("noobtopro:open-consent")); }}
      >
        Cookie preferences
      </button>
    </footer>
  );
});

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
  // True when a guest→account progress migration failed atomically (the guest copy
  // is intact). Drives an explicit, actionable "retry saving" banner (audit P0-5)
  // instead of a dead generic error the user can only dismiss.
  const [migrationFailed, setMigrationFailed] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [resetNotice, setResetNotice] = useState(false); // transient "progress was reset" toast
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false); // server-verified via /api/admin/me; gates the Admin tab
  // Pro entitlement (Polar.sh). `subscription` is the user's OWN SELECT-own row (or null);
  // `isPro` is the shared client/server predicate over it. upgradeNudge holds a paywall
  // message (set on a 402) so the upgrade modal can explain what was gated; upgradeBusy
  // covers the checkout/portal round-trip; checkoutDone shows the post-purchase banner.
  const [subscription, setSubscription] = useState(null);
  const [upgradeNudge, setUpgradeNudge] = useState(null);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [checkoutDone, setCheckoutDone] = useState(false);
  const isPro = isActiveSubscription(subscription);
  // CRD Art. 16(a) checkout-consent gate: the immediate-access dialog (shown before the
  // Polar redirect) and whether its required checkbox is ticked. `withdrawalUntil` is the
  // end of the EU 14-day withdrawal window (ISO | null) that gates the Dashboard's
  // "Withdraw from contract here" control.
  const [showConsent, setShowConsent] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [withdrawalUntil, setWithdrawalUntil] = useState(null);
  // Is the paid Pro tier live in this deployment? (mirrors NEXT_PUBLIC_ENABLE_GITHUB etc.)
  // When off, NO Pro UI shows and nothing is gated client-side — exactly today's behavior;
  // the server mirrors this via lib/polar.js#proIsAvailable. The owner flips both on
  // together when going live (see MONETIZATION_PLAN.md).
  const proEnabled = process.env.NEXT_PUBLIC_PRO_ENABLED === "true";
  // Photo-of-work grading is a Pro feature: the server 402s a non-Pro image (incl. on
  // a diagnostic step). Mirror that on the client so guests + free users never trigger
  // the attach control — a non-Pro photo otherwise dead-ended the diagnostic on a
  // perpetual, misleading loader. When Pro isn't sellable in this deployment the server
  // grades images for free, so attach stays available for everyone (and for the
  // Pro-less test env, keeping the image-attach tests valid).
  const canAttachWork = isPro || !proEnabled;
  const onAttachUpgrade = useCallback(
    () => setUpgradeNudge("Photo-of-work grading is a Pro feature — upgrade to Pro to attach a photo of your work."),
    []
  );
  const navScrolled = useScrolled(); // drives the shared TopNav condense-on-scroll

  const [questions, setQuestions] = useState([]);
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState({});

  const [scores, setScores] = useState(null);
  const [history, setHistory] = useState([]);

  // FRONTEND P1-2: per-concept mastery is lifted into the shell and fetched ONCE,
  // then passed to BOTH Dashboard and LearnTab — they no longer each fire their own
  // uncached loadMastery round-trip (two per session). A load failure leaves this {}
  // so both surfaces just render uncolored/ungated chips (nothing is lost).
  const [mastery, setMastery] = useState({});
  // True once the mastery map has loaded at least once — gates the mastery-blended
  // display score so a fresh mount shows raw depth rather than flashing a coverage-zeroed
  // rank before the map arrives. Stays true after the first load (re-fetches just update).
  const [masteryLoaded, setMasteryLoaded] = useState(false);

  const [pSubject, setPSubject] = useState(null);
  const [pQuestion, setPQuestion] = useState(null);
  const [pText, setPText] = useState("");
  const [pImg, setPImg] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [scoreDelta, setScoreDelta] = useState(null);

  // Learn tab: the curriculum concept to deep-link open on its PREPARED guide
  // (a full concept object { subject, key, label, strand, rank } | null). Set by
  // openLearn from a weak-concept chip; LearnTab opens that concept and clears it.
  const [learnConcept, setLearnConcept] = useState(null);
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
  // FRONTEND P1-4: when a step grade returns a malformed-but-2xx shape (no next /
  // finalToken), retrying re-sends the same bad payload and dead-ends. This flag
  // surfaces a hard-fail message + a "Restart diagnostic" recovery path on the
  // waiting card so the learner is never stuck on a spinner with a hopeless retry.
  const [diagFatal, setDiagFatal] = useState(false);
  // FRONTEND P1-5 / A11y P1-5: in-app confirm for re-baselining (replaces the
  // blocking, mobile-webview-suppressible window.confirm). null when closed.
  const [showRebaselineConfirm, setShowRebaselineConfirm] = useState(false);
  const rebaselineCancelRef = useRef(null); // default focus = the safe "Keep my scores"
  const rebaselinePrevFocus = useRef(null); // focus to restore on close

  // GUEST 18+ gate. Signed-in age verification is server-authoritative (app_metadata); a guest
  // has no account, so their one-time 18+ confirmation is a CLIENT-side ack (localStorage,
  // read on mount). `guestAgePrompt` proactively shows the gate when a guest tries to ENTER the
  // service (e.g. "Prove it"), so we never fire a generation request before they confirm;
  // `afterAgeRef` resumes that deferred action once they do.
  const [guestAgeAck, setGuestAgeAck] = useState(false);
  const [guestAgePrompt, setGuestAgePrompt] = useState(false);
  const afterAgeRef = useRef(null);
  useEffect(() => { setGuestAgeAck(hasGuestAgeAck()); }, []);

  // Monotonic token so a slow in-flight startPractice generation can't land its
  // question after the user has moved to a different practice question/subject —
  // e.g. via the Learn tab's "Practice this problem" (startPracticeWithQuestion) —
  // which would otherwise grade the wrong concept and update the wrong subject's
  // score. Bumped by startPractice (per call) and by startPracticeWithQuestion.
  const practiceRun = useRef(0);


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
      // Migration failed atomically (nothing written); the guest copy is kept, so
      // surface an explicit retry affordance (audit P0-5) rather than a dead banner.
      setMigrationFailed(true);
    } else if (mig) {
      setMigrationFailed(false);
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

  // Keep the URL hash in sync with the active app view, so the address bar shows
  // where you are — #dashboard on the Dashboard, not a stale landing anchor like
  // #pricing left over from the marketing nav — and so #practice / #learn /
  // #dashboard deep-link straight into that tab. The view tabs are
  // <button onClick={setView}> (TopNav) which never touched the URL, and nothing
  // read it back; these two effects close that gap. The marketing landing's own
  // section anchors (#how, #engine, #ranks, #pricing) are left untouched — they
  // only apply while the landing is mounted (stage "intro" on a practice-ish view).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = window.location.hash.replace(/^#/, "");
    if (VIEW_HASHES.includes(h)) setView(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Mirror the render gate for the marketing landing: while it's showing, the hash
    // belongs to its section anchors, so don't overwrite it.
    const landingShown = stage === "intro" && view !== "dashboard" && view !== "learn" && view !== "admin";
    if (landingShown || stage === "signin") return;
    const desired = `#${view}`;
    if (window.location.hash !== desired) window.history.replaceState(null, "", desired);
  }, [view, stage]);

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

  // Refresh the Pro entitlement from the data layer (the user's SELECT-own subscription
  // row). Deny-by-default: any failure leaves `subscription` as-is/null → treated as Free.
  // The server gate is authoritative; this only drives the UI (badge, CTAs, dashboard gate).
  async function refreshPro() {
    try {
      if (typeof loadSubscription !== "function") return; // tolerate a partial store mock
      const res = await loadSubscription();
      setSubscription((res && res.subscription) || null);
      setWithdrawalUntil((res && res.withdrawalUntil) || null);
    } catch {
      /* leave entitlement as-is — deny-by-default */
    }
  }

  // FRONTEND P1-2: refresh the per-concept mastery map (signed-in DB rows or the guest
  // localStorage copy). Fetched once on load and after a graded attempt, then handed to
  // Dashboard + LearnTab — replacing their two independent per-mount fetches. Deny-by-
  // default on failure: keep {} so chips/gates just render uncolored/ungated.
  async function refreshMastery() {
    try {
      if (typeof loadMastery !== "function") return;
      const res = await loadMastery();
      if (res && res.mastery) setMastery(res.mastery);
    } catch {
      /* leave mastery as-is — uncolored chips */
    } finally {
      // Mark the blend safe to apply even on a failed/empty load: the gate's only job
      // is to suppress the pre-load flash, not to hide a legitimately-empty map.
      setMasteryLoaded(true);
    }
  }

  // Start a Polar checkout: POST (with the verified JWT) and navigate to the returned
  // hosted checkout URL. Identity is bound server-side to the verified uid, so the client
  // sends no identity. Used after we KNOW the caller is signed in (the pending-upgrade
  // resume + startCheckout's signed-in branch).
  // POST /api/checkout with the recorded Art. 16(a) consent and redirect to Polar. Only
  // reachable AFTER the consent dialog's required checkbox is ticked (the server also
  // refuses a checkout without consent:true), so the express immediate-access request is
  // captured + audited before the sale.
  async function beginCheckout() {
    setShowConsent(false);
    setUpgradeBusy(true);
    // Funnel analytics: the checkout POST is firing (covers both the signed-in path and
    // the resume-after-sign-in path). track() is a no-op when analytics isn't enabled.
    track("checkout_started");
    try {
      const data = await authApi("/api/checkout", { consent: true, consentVersion: IMMEDIATE_ACCESS_CONSENT_VERSION });
      if (data && data.url && typeof window !== "undefined") {
        window.location.href = data.url; // full-page redirect to Polar
        return;
      }
      throw new Error("Could not start checkout. Please try again.");
    } catch (e) {
      setUpgradeBusy(false);
      setError(e.message || "Could not start checkout. Please try again.");
    }
  }

  // Open the immediate-access consent dialog (CRD Art. 16(a)) for a signed-in user; the
  // dialog's confirm calls beginCheckout. Resets the checkbox so each checkout requires a
  // fresh, deliberate tick.
  function openConsent() {
    setUpgradeNudge(null);
    setConsentChecked(false);
    setShowConsent(true);
  }

  // Upgrade entry point (landing CTA, dashboard CTA, the 402 nudge). A guest must sign in
  // first so the purchase attaches to an account — remember the intent in sessionStorage
  // and resume checkout automatically after sign-in (the SIGNED_IN handler). A signed-in
  // user goes to the consent dialog, not straight to Polar.
  function startCheckout() {
    setUpgradeNudge(null);
    if (!user) {
      try {
        if (typeof window !== "undefined") window.sessionStorage.setItem("noobtopro:pendingUpgrade", "1");
      } catch {}
      if (isSupabaseConfigured) openSignIn();
      else setShowAuthNote(true);
      return;
    }
    openConsent();
  }

  // EU "Withdraw from contract here" (CRD Art. 11a): terminate immediately + pro-rata
  // refund within the 14-day window. Returns the on-screen confirmation to the Dashboard
  // (which owns the confirm dialog + the durable confirmation display); throws on error so
  // it can surface why. Refresh the entitlement/window afterward (the webhook also lands).
  async function handleWithdraw() {
    const res = await withdrawFromContract();
    refreshPro();
    return res;
  }

  // Open the Polar customer portal (manage payment / cancel / invoices) for a subscriber.
  async function openPortal() {
    setUpgradeBusy(true);
    try {
      const data = await authApi("/api/portal", {});
      if (data && data.url && typeof window !== "undefined") {
        window.location.href = data.url;
        return;
      }
      throw new Error("Could not open subscription management. Please try again.");
    } catch (e) {
      setUpgradeBusy(false);
      setError(e.message || "Could not open subscription management. Please try again.");
    }
  }

  useEffect(() => {
    hydrate();
    refreshMastery(); // FRONTEND P1-2: fetch mastery once for both Dashboard + LearnTab
    let cancelled = false;
    let unsubscribe = null;
    // Wire the auth bootstrap (session restore + the onAuthStateChange listener) once the
    // browser Supabase client is available. Extracted so it can run synchronously in tests
    // (which mock getSupabase) and only after the dynamic import resolves in production
    // (ensureSupabase) — the behavior is otherwise identical to wiring it inline on mount.
    const wireAuth = (sb) => {
      if (cancelled || !sb) return;
      sb.auth.getUser().then(({ data }) => {
        const u = (data && data.user) || null;
        setUser(u);
        if (u) { checkAdmin(); refreshPro(); }
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
          refreshPro(); // load the account's Pro entitlement
          refreshMastery(); // FRONTEND P1-2: load the account's per-concept mastery
          // Resume a pending "Upgrade to Pro" the guest started before signing in (the
          // purchase needs an account). authApi reads the token from the fresh session, so
          // it works even before `user` state lands. Cleared so it fires exactly once.
          try {
            if (typeof window !== "undefined" && window.sessionStorage.getItem("noobtopro:pendingUpgrade")) {
              window.sessionStorage.removeItem("noobtopro:pendingUpgrade");
              openConsent(); // capture the Art. 16(a) consent before redirecting to Polar
            }
          } catch {}
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
          setMastery({}); // FRONTEND P1-2: drop the prior user's mastery coloring too
          setIsAdmin(false); // hide the Admin tab immediately on sign-out
          setSubscription(null); // drop the prior user's Pro entitlement
          setUpgradeNudge(null);
          // Clear the local guest blob on sign-out so the prior user's scores/weak
          // concepts aren't exposed to the next person on a shared device.
          resetAll();
          hydrate();
          refreshMastery(); // reload mastery for the now-guest (empty) session
        }
      });
      unsubscribe = () => sub && sub.subscription && sub.subscription.unsubscribe();
    };
    // PERF (Lighthouse "unused"/"legacy" JS): pull @supabase/supabase-js off the landing
    // page's critical bundle by loading it via dynamic import (ensureSupabase) AFTER hydration.
    // Tests stub only getSupabase (no ensureSupabase), so wire synchronously in that case.
    if (typeof ensureSupabase === "function") {
      ensureSupabase().then((sb) => wireAuth(sb));
    } else {
      wireAuth(getSupabase());
    }
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Returning from a successful Polar checkout (?checkout=success): show the welcome
  // banner and POLL the entitlement a few times, because the webhook that flips the
  // subscriptions row arrives asynchronously (usually within a second or two). Strip the
  // query param so a refresh doesn't replay this. Runs once on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;
    params.delete("checkout");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash);
    setCheckoutDone(true);
    // Funnel analytics: the learner returned from a successful Polar checkout (the
    // conversion event). Entitlement activation is confirmed asynchronously by refreshPro.
    track("checkout_success");
    let n = 0;
    let timer = null;
    const tick = () => {
      refreshPro();
      if (++n < 5) timer = setTimeout(tick, 1500);
    };
    tick();
    return () => timer && clearTimeout(timer);
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
    setDiagError("");
    setDiagFatal(false);
    setShowRebaselineConfirm(false);
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
      setMastery({}); // FRONTEND P1-2: the guest blob (incl. mastery) was wiped
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
    setSubscription(null); // drop the Pro entitlement immediately too
    setScores(null);
    setHistory([]);
    setScoreDelta(null);
    setFeedback(null);
    setLearnConcept(null);
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
      setMastery({}); // FRONTEND P1-2: progress deleted → drop mastery coloring
      setLearnConcept(null);
      setView("practice");
      setStage("intro");
      setError("");
      setResetNotice(true); // success toast (auto-dismisses); the dashboard's modal closes by unmounting
      return true;
    } catch (e) {
      setError(e.message || "Could not reset your progress.");
      return false;
    }
  }

  // Adults-only (18+) age gate. A signed-in account that hasn't been age-verified is blocked
  // from the app by AgeGate until it is. The verdict is SERVER-AUTHORITATIVE: it lives in
  // app_metadata (set only by /api/account/age after a server-side age check), which the user
  // cannot edit. Guests aren't gated here (their data is local-only). Note: the old
  // user_metadata.age_ack_year flag is intentionally NOT honored, so every existing account
  // re-attests under the 18+ regime.
  function hasAgeAck(u) {
    return !!(u && u.app_metadata && u.app_metadata.age_verified === true);
  }
  // 18+ path. Signed-in: POST the DOB to the server, which verifies the age and records the
  // verdict in app_metadata; then refresh `user` so the gate (derived from app_metadata)
  // clears (throws so AgeGate can surface a save/verification failure). Guest: record the
  // client-side ack and resume any action that was deferred behind the gate.
  async function confirmAge({ dob }) {
    if (user) {
      await submitAgeVerification(dob);
      const sb = await resolveSupabase();
      if (sb) {
        const { data } = await sb.auth.getUser();
        setUser((data && data.user) || user);
      }
      return;
    }
    recordGuestAgeAck();
    setGuestAgeAck(true);
    setGuestAgePrompt(false);
    const next = afterAgeRef.current;
    afterAgeRef.current = null;
    if (typeof next === "function") next();
  }
  // Under-18 path. Signed-in: sign out (no learning data was collected — they never reached
  // the app). Guest: clear the local ack + any guest progress and return to the public intro.
  // Either way, surface why on the landing.
  async function handleUnderage() {
    setGuestAgePrompt(false);
    afterAgeRef.current = null;
    if (user) {
      try { await signOutUser(); } catch {}
    } else {
      clearGuestAgeAck();
      setGuestAgeAck(false);
      try { await resetAll(); } catch {}
      setScores(null);
      setStage("intro");
    }
    setError("noobtopro is an adults-only service for ages 18 and over.");
  }

  // Dashboard → "Delete account": permanent erasure (cancels any Pro subscription, deletes
  // the auth user and all their data). On success the store signs out, which fires the
  // SIGNED_OUT handler and returns the app to the intro view.
  async function deleteAccount() {
    diagRun.current++; // supersede any in-flight grade
    practiceRun.current++;
    setBusy(false);
    try {
      await requestAccountDeletion();
      setError("");
      return true;
    } catch (e) {
      setError(e.message || "Could not delete your account.");
      return false;
    }
  }

  // Dashboard → "Download my data": GDPR access/portability. Fetch the JSON bundle and save
  // it as a file. Returns true on success / false on error (the Dashboard button clears its
  // own busy state on false); errors surface in the global banner.
  async function exportData() {
    try {
      const data = await exportMyData();
      if (typeof window !== "undefined") {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "noobtopro-data-export.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
      setError("");
      return true;
    } catch (e) {
      setError(e.message || "Could not export your data.");
      return false;
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
    // FRONTEND P1-5: gate the re-baseline behind a styled, accessible in-app modal
    // (the Dashboard reset/delete pattern) instead of the blocking window.confirm —
    // which janks the main thread and is silently suppressed in some mobile webviews.
    if (user && scores) {
      if (typeof document !== "undefined") rebaselinePrevFocus.current = document.activeElement;
      setShowRebaselineConfirm(true);
      return;
    }
    // Guest 18+ gate: a guest entering the adults-only service must confirm they're 18+ once
    // (client-side). Defer the diagnostic behind the gate so we never call /api/generate for
    // an unconfirmed guest; confirmAge resumes it.
    if (!user && !guestAgeAck) {
      afterAgeRef.current = startDiagnostic;
      setGuestAgePrompt(true);
      return;
    }
    return startDiagnostic();
  }

  // The actual diagnostic generation, split out of beginDiagnostic so the
  // re-baseline confirm modal can invoke it directly on "Yes".
  async function startDiagnostic() {
    setShowRebaselineConfirm(false);
    setError("");
    setDiagError("");
    setDiagFatal(false);
    setBusy(true);
    // Funnel analytics: the learner is starting the placement diagnostic (top of funnel).
    track("diagnostic_started", { signedIn: !!user, rebaseline: !!(user && scores) });
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
  function nextDiagnostic(text) {
    const q = curQ;
    // The composer owns its text now (FRONTEND P1-1); grade the value it just passed
    // (falling back to any blur-synced map text), keeping the attached image.
    const a = { text: typeof text === "string" ? text : curAns.text, img: curAns.img };
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
        // FRONTEND P1-4: a malformed-but-2xx payload (no next AND no finalToken).
        // Re-submitting the same step would just hit this again, so don't queue it
        // for the plain "Try again" — flag a FATAL state that surfaces a clear
        // message + a "Restart diagnostic" recovery on the waiting card.
        const err = new Error("We couldn't read the grader's response. Please restart the diagnostic.");
        err.fatal = true;
        throw err;
      }
    } catch (e) {
      if (myRun !== diagRun.current) return;
      if (e && e.fatal) {
        // Unexpected response shape: a retry can't fix it. Don't push to the retry
        // queue; show the hard-fail + restart instead.
        setDiagFatal(true);
        setDiagError(e.message);
        return;
      }
      if (e && (e.status === 402 || e.upgrade)) {
        // Paywall mid-diagnostic (e.g. a photo step for a non-Pro user). A retry can't
        // succeed AND the step never completes — so besides the upgrade nudge, flag a
        // FATAL state so the waiting card shows a clear "Restart diagnostic" instead of
        // a perpetual, misleading loader (the reported "infinite loading status" loop).
        setUpgradeNudge(e.message || "You've reached a free-tier limit. Upgrade to Pro to keep going.");
        setDiagFatal(true);
        setDiagError(e.message || "This step needs Pro. Restart the diagnostic to finish, or upgrade to Pro.");
        return;
      }
      diagFailed.current.push({ q, a });
      setDiagError(e.message || "We couldn't grade an answer just now. Your work is saved — retry to finish.");
    }
  }

  // Re-fire everything that failed (step grades and/or the finalize) — the signed
  // tokens are still valid, so a transient outage costs nothing but the retry.
  function retryDiagnostic() {
    setDiagError("");
    setDiagFatal(false);
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
      refreshMastery(); // FRONTEND P1-2: the baseline updated mastery — refresh the shared map
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
  // Open a weak concept in the Learn tab on its PREPARED guide (lib/guides), drawing
  // from the existing curriculum library instead of generating one from scratch.
  // `value` is a curriculum KEY (the grader now reports keys) or legacy free text —
  // resolveConceptKey maps either onto a real concept; conceptByKey adds its rank so
  // LearnTab can load the right guide. Unresolvable input just opens the curriculum
  // browser (no concept selected), so a "Learn this" click is never a dead end.
  function openLearn(subject, value) {
    const key = resolveConceptKey(subject, value);
    const concept = key ? conceptByKey(subject, key) : null;
    setView("learn");
    setLearnConcept(concept ? { subject, ...concept } : null);
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
      // CLOSE THE TAGGING GAP (owner decision 2026-06-17): route generic practice through
      // a real curriculum concept so the attempt accrues MASTERY (untagged practice never
      // colored a concept, so coverage — and the mastery-blended score — could never rise
      // from practicing). The picker targets a not-yet-mastered concept at the learner's
      // level; the server validates the conceptKey, frames the question on it, tags it, and
      // signs it into the token so the graded attempt updates that concept's mastery. A
      // forged/unknown key would just degrade to ordinary level-based practice.
      const target = pickPracticeConcept(mastery, subject, s.score);
      const data = await api("/api/generate", {
        kind: "practice",
        subject,
        score: s.score,
        weakConcepts: s.weakConcepts || [],
        recentQuestions: getRecentQuestions(recentKey),
        ...(target
          ? {
              conceptKey: target.key,
              ...(target.masteryState && target.masteryState !== "grey" ? { masteryState: target.masteryState } : {}),
            }
          : {}),
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

  // Enter the practice flow with an ALREADY-FETCHED question object (the concept
  // drill's generated question from startConceptDrill) — this function makes no
  // /api/generate call itself; it just hands the question to the normal practice +
  // grading flow. Grading is unchanged.
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


  async function submitPractice(skip = false, composerText) {
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
      // The composer owns its text (FRONTEND P1-1) and passes it on submit; fall back to
      // pText (the blur-synced copy) when called without it.
      const reasoning = skip ? "" : (typeof composerText === "string" ? composerText : pText);
      const imagePayload = skip || !pImg ? undefined : { mime: pImg.mime, data: pImg.data };
      // Default for a subject not yet in scores (e.g. practicing an un-baselined
      // subject after a partial diagnostic) — guards the guest blend path below.
      const prev = scores?.[pSubject] || { score: 0, weakConcepts: [], comment: "", rubric: null };
      if (user) {
        // Signed-in: SERVER-AUTHORITATIVE. The server grades, computes the new score
        // from the user's STORED level, and persists it for the verified uid; the
        // client renders the trusted result and cannot substitute a score.
        // The server-issued question token (audit P1-1): subject/question/band/topic/
        // surface — AND the curriculum conceptKey for mastery coloring — all come from
        // the VERIFIED token server-side, so the client no longer asserts any
        // rating-relevant field. A missing/expired token gets a clear
        // "generate a new question" error.
        const data = await authApi("/api/score", {
          kind: "practice",
          token: pQuestion.token,
          reasoning,
          image: imagePayload,
        });
        if (myRun !== practiceRun.current) return; // abandoned mid-grade
        // Defensive: a malformed response must not put an undefined subjectScore into
        // state (which would crash the dashboard/livescore reads) — surface an error.
        if (!data || !data.subjectScore) throw new Error("Grading failed. Please try again.");
        // The headline subject number is the MASTERY-BLENDED score (depth × coverage), so
        // the delta shown beside it must be the BLENDED delta — the raw depth delta
        // (data.delta) can differ (e.g. a strong attempt that doesn't newly master a
        // concept lifts depth but not the blended rank). Apply this attempt's mastery
        // updates optimistically so the new coverage is reflected at once; refreshMastery
        // below reconciles with the server's authoritative counters.
        const masteryUpdates = Array.isArray(data.masteryUpdates) ? data.masteryUpdates : [];
        const nextMastery = masteryUpdates.length ? applyMasteryUpdates(mastery, masteryUpdates) : mastery;
        const blendedDelta =
          effectiveSubjectScore(data.subjectScore.score, nextMastery, pSubject) -
          effectiveSubjectScore(prev.score, mastery, pSubject);
        if (masteryUpdates.length) setMastery(nextMastery);
        setScores((s) => ({ ...s, [pSubject]: data.subjectScore }));
        if (data.attempt) setHistory((h) => [...h, data.attempt]);
        setScoreDelta(blendedDelta);
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
        // Generic practice is now concept-tagged (the picker in startPractice), so every
        // attempt accrues mastery — building the coverage that drives the blended score.
        const guestMasteryUpdates = pQuestion.conceptKey
          ? [{ subject: pSubject, conceptKey: pQuestion.conceptKey, quality: reasoningScore }]
          : [];
        // Blended delta for the headline (depth × coverage), applying this attempt's
        // mastery optimistically so a newly-mastered concept's lift shows immediately.
        const nextMastery = guestMasteryUpdates.length ? applyMasteryUpdates(mastery, guestMasteryUpdates) : mastery;
        const blendedDelta =
          effectiveSubjectScore(updatedScore, nextMastery, pSubject) -
          effectiveSubjectScore(prev.score, mastery, pSubject);
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
        // Mastery counters for the concept-tagged attempt (the store allow-lists the key).
        guestMasteryUpdates.length ? guestMasteryUpdates : undefined);
        if (myRun !== practiceRun.current) return; // abandoned during the save round-trip
        if (guestMasteryUpdates.length) setMastery(nextMastery); // reflect new coverage at once
        if (st && st.history) setHistory(st.history); // null = couldn't refresh; keep current
        setScores(updatedScores);
        setScoreDelta(blendedDelta);
        setFeedback({ ...r, rationale });
      }
      // The composer/img unmounts once feedback is truthy (the graded view renders),
      // so the attached photo is no longer shown; release its preview blob URL (the
      // base64 was already sent to the grader) instead of leaking it until the next action.
      revokePreview(pImg);
      setPImg(null);
      // FRONTEND P1-2: a concept-tagged attempt updates mastery — refresh the shared
      // map so the Learn chips / dashboard gates re-color without a second fetch.
      if (pQuestion && pQuestion.conceptKey) refreshMastery();
    } catch (e) {
      if (myRun !== practiceRun.current) return; // abandoned — don't surface a stale error on the reset UI
      // A Pro paywall (the free daily practice cap, or photo-of-work grading) comes back
      // as 402 + `upgrade`. Show the upgrade nudge with the server's explanation instead
      // of a generic error banner.
      if (e && (e.status === 402 || e.upgrade)) setUpgradeNudge(e.message || "Upgrade to Pro to keep going.");
      else setError(e.message || "Grading failed.");
    } finally {
      if (myRun === practiceRun.current) setBusy(false);
    }
  }

  // FRONTEND P1-1 / P2-12: stable handler identities for the memoized practice
  // AnswerComposer, so a shell re-render that DOESN'T change the question (e.g. the
  // live score landing) doesn't re-render the composer subtree. submitPractice reads
  // a lot of changing state, so the stable callbacks dispatch through a ref that always
  // points at the LATEST submitPractice — never a stale closure from the first render.
  const submitPracticeRef = useRef(submitPractice);
  useEffect(() => { submitPracticeRef.current = submitPractice; });
  const onPracticeSubmit = useCallback((text) => submitPracticeRef.current(false, text), []);
  const onPracticeSkip = useCallback(() => submitPracticeRef.current(true), []);
  const onPracticeRemoveImg = useCallback(() => {
    revokePreview(pImgRef.current);
    setPImg(null);
  }, []);

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

  // Re-baseline confirm modal (FRONTEND P1-5): focus the safe default ("Keep my
  // scores") on open, Escape to cancel, restore focus to the trigger on close —
  // mirrors the Dashboard reset/delete dialog pattern.
  useEffect(() => {
    if (!showRebaselineConfirm) return undefined;
    rebaselineCancelRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") setShowRebaselineConfirm(false); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const prev = rebaselinePrevFocus.current;
      if (prev && typeof prev.focus === "function") prev.focus();
    };
  }, [showRebaselineConfirm]);

  // While the save modal or a dashboard drawer is open, make the rest of the page
  // inert so keyboard/screen-reader users can't reach background controls (proper
  // modal focus containment).
  // The "progress was reset" toast auto-dismisses; role=status announces it once.
  useEffect(() => {
    if (!resetNotice) return;
    const t = setTimeout(() => setResetNotice(false), 4000);
    return () => clearTimeout(t);
  }, [resetNotice]);

  // P0-4: warn before a tab close / refresh discards in-progress, ungraded answers
  // (the diagnostic and practice composers hold text in memory). Native browser
  // confirm only — covers the close/refresh vector; in-app navigation guarding is a
  // separate, larger change (it must intercept the brand-Restart and every tab).
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const hasWork =
      (stage === "diagnostic" && Object.values(answers).some((a) => a && typeof a.text === "string" && a.text.trim())) ||
      (stage === "practice" && typeof pText === "string" && pText.trim().length > 0);
    if (!hasWork) return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [stage, answers, pText]);

  // Every overlay must make the rest of the page inert so keyboard/SR users can't
  // Tab behind it. The modals render as SIBLINGS of `.np-app` (below), so inerting
  // `.np-app` contains focus to the open dialog. `showConsent` (the CRD checkout
  // consent gate) was previously missing here — without it, focus could escape the
  // legally-required consent dialog into the nav/footer (audit P0-8).
  const bgInert = (showSaveModal && !user) || !!upgradeNudge || showConsent || showRebaselineConfirm || overlayActive ? true : undefined;

  // PERF (P2-7): stabilize the callback props whose bodies use ONLY React's stable
  // state setters, so a keystroke-driven Noobtopro re-render doesn't churn their
  // identity and re-fire child effects keyed on them (e.g. Dashboard's
  // onOverlayActiveChange effect). The handlers that call the component's other
  // (per-render) functions — onProveIt/onSignIn/onPractice/onLearn/etc. — are left as
  // inline arrows: memoizing them safely would require also stabilizing those
  // functions (a larger refactor tied to the P1-1 monolith split, deferred here).
  // Retry a failed guest→account migration (audit P0-5). The guest blob is still in
  // localStorage, so this just re-runs the atomic fold and re-hydrates on success.
  async function retryMigration() {
    setMigrationFailed(false);
    const mig = await migrateGuestToAccount();
    if (mig && mig.error) {
      setMigrationFailed(true);
      return;
    }
    hydrate();
    refreshMastery();
  }

  const onDismissError = useCallback(() => setError(""), []);
  const onDismissAuthNote = useCallback(() => setShowAuthNote(false), []);
  const onCloseDashboard = useCallback(() => setView("practice"), []);

  // ---- memoized nav props (P1-P1) ----
  // The sticky, backdrop-blurred TopNav otherwise reconciles on EVERY shell state
  // change (live-score ticks, grading, the background mastery refresh). Compute
  // `chrome`/`appTabs` ABOVE the early returns and hand React.memo(TopNav) only stable
  // prop identities, so the nav (and its blur) stops re-rendering while the learner
  // types/submits. Handlers use the useEvent pattern (stable identity + latest
  // closure), so there is NO stale-closure risk in reset / sign-out.
  const chrome = (user || scores) && stage !== "signin";
  const stableReset = useStableCallback(reset);
  const stableSignOut = useStableCallback(handleSignOut);
  const stableGuestSignIn = useStableCallback(() => (isSupabaseConfigured ? openSignIn() : setShowAuthNote(true)));
  const appTabs = useMemo(
    () =>
      chrome
        ? [
            { id: "practice", label: "Practice", icon: "target", active: view === "practice", onClick: () => setView("practice") },
            ...(scores ? [{ id: "learn", label: "Learn", icon: "book", active: view === "learn", onClick: () => setView("learn") }] : []),
            // One merged Dashboard tab (was Progress + Profile); a guest who clicks it gets the sign-in gate.
            { id: "dashboard", label: "Dashboard", icon: "grid", active: view === "dashboard", onClick: () => setView("dashboard") },
            ...(user && isAdmin ? [{ id: "admin", label: "Admin", icon: "shield", active: view === "admin", onClick: () => setView("admin") }] : []),
          ]
        : null,
    [chrome, view, scores, user, isAdmin]
  );
  // The nav rank chip reflects MASTERY too: blended scores once the map loads, raw
  // depth before then (so it doesn't flash a coverage-zeroed rank on a fresh mount).
  const navScores = useMemo(
    () => (chrome ? (masteryLoaded && scores ? effectiveScores(scores, mastery) : scores) : undefined),
    [chrome, masteryLoaded, scores, mastery]
  );
  const navSignIn = useMemo(
    () =>
      (chrome && !user) || (!chrome && !user && stage !== "intro" && stage !== "signin")
        ? { onClick: stableGuestSignIn, label: "Sign in" }
        : undefined,
    [chrome, user, stage, stableGuestSignIn]
  );
  const navSignOut = useMemo(
    () => (chrome && user ? { onClick: stableSignOut, label: "Sign out", title: user.email || "" } : undefined),
    [chrome, user, stableSignOut]
  );

  // Transient "progress was reset" toast. Rendered in EVERY return branch — a reset
  // lands the learner on the intro/Landing branch (below), not the app shell — so it
  // always appears. Fixed-position, so where it sits in the tree doesn't matter.
  const resetToast = resetNotice ? (
    <div className="np-toast" role="status" aria-live="polite">Your progress was reset.</div>
  ) : null;

  /* ----------------------------- render ----------------------------- */
  // 18+ adults-only gate (P0-10). Signed-in: block any account that hasn't completed the
  // server-authoritative age check (app_metadata) — clears as soon as confirmAge refreshes the
  // user. Guest: block once they ENTER the service without the client-side 18+ ack — either
  // because they explicitly tried to start (guestAgePrompt) or because they returned to a
  // non-intro view (e.g. a saved-progress dashboard). A guest on the public landing is exempt,
  // so the marketing page stays open/crawlable. The sign-in screen is always exempt.
  const guestOnPublicLanding =
    !user && stage === "intro" && view !== "dashboard" && view !== "learn" && view !== "admin";
  const ageVerified = user ? hasAgeAck(user) : guestAgeAck;
  const needsAgeGate =
    stage !== "signin" && !ageVerified && (!!user || guestAgePrompt || !guestOnPublicLanding);
  if (needsAgeGate) {
    return (
      <>
        {resetToast}
        <AgeGate onConfirm={confirmAge} onUnderage={handleUnderage} guest={!user} />
      </>
    );
  }

  // (chrome / appTabs / the memoized nav props are computed ABOVE the early returns
  // — see the "memoized nav props" block — so they can feed React.memo(TopNav).)

  // The public marketing landing page IS the intro stage now. It renders for anyone
  // on "intro" (guest OR a signed-in user who hasn't been ranked yet) — gating on the
  // stage rather than on `chrome` keeps the tree stable across the async sign-in load
  // (otherwise setUser would swap Landing→shell mid-interaction and detach the CTA).
  // Its CTAs call straight into the live handlers, so "Prove it"/"Sign in" move the
  // state machine off "intro" and this branch stops matching. A ranked user is sent
  // to "dashboard" by hydrate(), so they never land here.
  if (stage === "intro" && view !== "dashboard" && view !== "learn" && view !== "admin") {
    return (
      <>
        <Landing
          user={user}
          busy={busy}
          isPro={isPro}
          proEnabled={proEnabled}
          onProveIt={beginDiagnostic}
          onSignIn={() => (isSupabaseConfigured ? openSignIn() : setShowAuthNote(true))}
          onUpgrade={startCheckout}
          error={error}
          onDismissError={onDismissError}
          showAuthNote={showAuthNote}
          onDismissAuthNote={onDismissAuthNote}
        />
        {resetToast}
      </>
    );
  }

  return (
    <div className="np-root">
      {/* A11y P1-4: skip-to-content as the first focusable element of the app shell
          (visually hidden until focused) so keyboard users bypass the whole TopNav. */}
      <a className="np-skiplink" href="#np-main-content">Skip to content</a>
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
            <h2 id="np-save-title" className="np-h2 np-modal-title">
              Save your progress
            </h2>
            <p id="np-save-desc" className="np-lede np-modal-subtitle">
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

      {resetToast}

      {/* Upgrade-to-Pro nudge — shown when a Pro-gated action (the free daily practice
          cap, or photo-of-work grading) returns 402. The CTA starts checkout (a guest is
          routed to sign in first, then checkout resumes automatically). */}
      {upgradeNudge && (
        <div className="np-modal-backdrop" onClick={() => setUpgradeNudge(null)}>
          <div
            className="np-surface-elevated np-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="np-upgrade-title"
            aria-describedby="np-upgrade-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="np-iconbtn np-modal-close" aria-label="Dismiss" onClick={() => setUpgradeNudge(null)}>
              <Icon name="x" size={16} />
            </button>
            <div className="np-modal-spark" aria-hidden="true"><Icon name="spark" size={22} /></div>
            <h2 id="np-upgrade-title" className="np-h2 np-modal-title">
              Upgrade to Pro
            </h2>
            <p id="np-upgrade-desc" className="np-lede np-modal-subtitle">
              {upgradeNudge}
            </p>
            <button
              className="np-btn np-primary np-big np-btn--block"
              onClick={startCheckout}
              disabled={upgradeBusy}
            >
              <Icon name="spark" size={16} /> {upgradeBusy ? "Starting checkout…" : "Upgrade to Pro — €9.99/mo"}
            </button>
            <button className="np-ghost np-modal-later" onClick={() => setUpgradeNudge(null)}>Not now</button>
          </div>
        </div>
      )}

      {/* Immediate-access consent (CRD Art. 16(a)): shown before redirecting to Polar. The
          consumer must EXPRESSLY request immediate access and acknowledge they lose the
          14-day withdrawal right once the service is fully performed. The checkbox starts
          unticked; the pay button is disabled until it's ticked, and the server records the
          consent (db/migrations/0025) before creating the checkout session. */}
      {showConsent && (
        <div className="np-modal-backdrop" onClick={() => setShowConsent(false)}>
          <div
            className="np-surface-elevated np-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="np-consent-title"
            aria-describedby="np-consent-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="np-iconbtn np-modal-close" aria-label="Dismiss" onClick={() => setShowConsent(false)}>
              <Icon name="x" size={16} />
            </button>
            <h2 id="np-consent-title" className="np-h2 np-modal-title">
              Start your Pro subscription
            </h2>
            <p id="np-consent-desc" className="np-lede np-modal-subtitle">
              <strong>€9.99/month</strong>, taxes included. Renews monthly until you cancel — cancel anytime.
            </p>
            <label className="np-consent-check">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
              />
              <span className="np-fineprint">{IMMEDIATE_ACCESS_CONSENT_TEXT}</span>
            </label>
            <button
              className="np-btn np-primary np-big np-btn--block"
              onClick={beginCheckout}
              disabled={!consentChecked || upgradeBusy}
            >
              <Icon name="spark" size={16} /> {upgradeBusy ? "Starting checkout…" : "Subscribe & pay €9.99/month"}
            </button>
            <p className="np-fineprint" style={{ textAlign: "center", margin: "12px 0 0" }}>
              By subscribing you agree to our <a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a> and{" "}
              <a href="/refunds" target="_blank" rel="noopener noreferrer">Refund &amp; Cancellation Policy</a>. Payments are
              processed by Polar (Merchant of Record).
            </p>
            <button className="np-ghost np-modal-later" onClick={() => setShowConsent(false)}>Not now</button>
          </div>
        </div>
      )}

      {/* Re-baseline confirm (FRONTEND P1-5): a styled, focus-managed, Escape-closable
          dialog replacing the blocking window.confirm. The safe default ("Keep my
          scores") is focused on open; "Re-take" discards the accumulated baseline. */}
      {showRebaselineConfirm && (
        <div className="np-modal-backdrop" onClick={() => setShowRebaselineConfirm(false)}>
          <div
            className="np-surface-elevated np-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="np-rebaseline-title"
            aria-describedby="np-rebaseline-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="np-modal-spark" aria-hidden="true"><Icon name="refresh" size={22} /></div>
            <h2 id="np-rebaseline-title" className="np-h2 np-modal-title">
              Re-take the diagnostic?
            </h2>
            <p id="np-rebaseline-desc" className="np-lede np-modal-subtitle">
              Re-taking the diagnostic will replace your current scores with a fresh baseline.
              Your accumulated progress will be lost. This can't be undone.
            </p>
            <div className="np-modal-actions">
              <button
                ref={rebaselineCancelRef}
                className="np-btn np-secondary"
                onClick={() => setShowRebaselineConfirm(false)}
              >
                Keep my scores
              </button>
              <button className="np-btn np-danger" onClick={startDiagnostic}>
                Re-take diagnostic
              </button>
            </div>
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
          onBrand={stableReset}
          brandTitle="Restart"
          tabs={appTabs || undefined}
          user={chrome ? user : undefined}
          scores={navScores}
          signIn={navSignIn}
          signOut={navSignOut}
        />

        {/* Mobile-only primary nav: on phones the TopNav tab strip is hidden (CSS) and
            these same tabs render in a fixed, thumb-reachable bottom bar instead. */}
        {appTabs && <BottomNav tabs={appTabs} />}

        <div className="np-frame">
          <div className="np-shell">
          <main className="np-main" id="np-main-content">
        {showAuthNote && (
          <div className="np-banner fade-up">
            <span>Google sign-in runs through Supabase. Add your Supabase URL + anon key and enable the Google provider by following the README ("Supabase setup"). The app works fully as a guest in the meantime.</span>
            <button className="np-ghost" onClick={() => setShowAuthNote(false)}><Icon name="x" size={14} /> dismiss</button>
          </div>
        )}
        {migrationFailed && (
          <div className="np-error fade-up" role="alert">
            <span>We couldn&rsquo;t save your guest progress to your account — your results are still here. Retry to keep them across devices.</span>
            <button className="np-btn np-secondary" onClick={retryMigration}>Retry saving my progress</button>
          </div>
        )}
        {error && (
          <div className="np-error fade-up" role="alert">
            <span>{error}</span>
            <button className="np-ghost" onClick={() => setError("")}><Icon name="x" size={14} /> dismiss</button>
          </div>
        )}
        {checkoutDone && (
          <div className="np-banner fade-up" role="status">
            <span>
              {isPro
                ? "You're Pro. Unlimited graded practice, photo-of-work grading, and full progress trends are unlocked."
                : "Thanks for upgrading! Your Pro access is activating and will appear in a moment."}
            </span>
            <button className="np-ghost" onClick={() => setCheckoutDone(false)}><Icon name="x" size={14} /> dismiss</button>
          </div>
        )}

        {stage === "signin" ? (
          <SignIn
            providers={PROVIDERS}
            onProvider={async (id) => {
              // Funnel analytics: sign-in initiated (activation step).
              track("sign_in_started", { provider: id });
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
            isPro={isPro}
            proEnabled={proEnabled}
            upgradeBusy={upgradeBusy}
            loadReviews={loadReviews}
            loadTrends={loadTrends}
            mastery={mastery}
            masteryReady={masteryLoaded}
            onStartDiagnostic={() => { setView("practice"); beginDiagnostic(); }}
            onPractice={(s) => { setView("practice"); startPractice(s); }}
            onLearn={openLearn}
            onReset={resetProgress}
            onDeleteAccount={deleteAccount}
            onExport={user ? exportData : undefined}
            onSignIn={() => (isSupabaseConfigured ? openSignIn() : setShowAuthNote(true))}
            onUpgrade={startCheckout}
            onManageSubscription={openPortal}
            onWithdraw={handleWithdraw}
            withdrawalUntil={withdrawalUntil}
            onClose={onCloseDashboard}
            onOverlayActiveChange={setOverlayActive}
          />
        ) : view === "learn" && scores ? (
          // The Learn tab IS the curriculum library. A deep-linked weak concept
          // (learnConcept, set by openLearn) opens straight onto that concept's
          // PREPARED guide; LearnTab clears the signal once consumed so re-tapping the
          // same chip re-opens it. No concept set → the curriculum browser.
          <LearnTab
            onPractice={startConceptDrill}
            busyConcept={drillBusy}
            openConcept={learnConcept}
            onConceptConsumed={() => setLearnConcept(null)}
            mastery={mastery}
          />
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
                  {/* A11y P1-5: one real <h1> per signed-in view (visual style kept via np-h2). */}
                  <h1 className="np-h2">Prove what you know</h1>
                </div>
                {/* Progress: 3 subject groups × stepsTotal pips, filled by the steps
                    ANSWERED per subject (the §8 adaptive walk, band varies per step,
                    so pips count steps, not tiers).
                    A11y P2-2: completion was conveyed by fill COLOR alone. Each subject
                    group now carries role=img + an aria-label ("Math: 2 of 3 answered"),
                    and a single visually-hidden summary gives the whole row's progress —
                    so the diagnostic progress is perceivable without color. */}
                <div className="np-diag-progress">
                  {ORDER.map((s) => {
                    const total = curQ.stepsTotal || 3;
                    const done = diagAnswered[s] || 0;
                    return (
                      <div
                        key={s}
                        className="np-diag-proggroup"
                        role="img"
                        aria-label={`${SUBJECTS[s].label}: ${done} of ${total} answered`}
                      >
                        {Array.from({ length: total }, (_, di) => (
                          <div key={di} className="np-progdot" style={{ background: di < done ? SUBJECTS[s].color : "var(--tint-2)" }} />
                        ))}
                      </div>
                    );
                  })}
                </div>
                <span className="np-sronly" role="status" aria-live="polite">
                  {`Diagnostic progress: ${ORDER.map((s) => `${SUBJECTS[s].label} ${diagAnswered[s] || 0} of ${curQ.stepsTotal || 3} answered`).join(", ")}.`}
                </span>
                {/* P0-1: a background step-grade failure used to be invisible until the
                    final waiting card. Surface it inline the moment it happens, with a
                    retry, so the learner isn't answering on top of silently-lost work. */}
                {diagError && (
                  <div className="np-error fade-up" role="alert" style={{ marginBottom: 16 }}>
                    <span>{diagError}</span>
                    <button className="np-btn np-secondary" onClick={retryDiagnostic}>Retry now</button>
                  </div>
                )}
                <div className="np-qmeta">
                  <SubjectGlyph subject={curSubject} />
                  <span className="np-metaline">
                    {SUBJECTS[curSubject].label.toUpperCase()} · {(DIFFICULTY_LABELS[curQ.difficulty] || "").toUpperCase()} · STEP {curQ.stepNo}/{curQ.stepsTotal || 3}
                  </span>
                  {curQ.topic && <span className="np-topic">{curQ.topic}</span>}
                </div>
                <div className="np-card np-question">{curQ.question}</div>
                <AnswerComposer
                  initialValue={curAns.text}
                  onText={setCurText}
                  img={curAns.img}
                  onAttach={attachCur}
                  canAttach={canAttachWork}
                  onUpgrade={onAttachUpgrade}
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
                  <div className="np-card" role="alert" style={{ textAlign: "center", padding: "32px 24px" }}>
                    <p className="np-lessontext" style={{ marginBottom: 16 }}>{diagError}</p>
                    {/* FRONTEND P1-4: when the failure is a recoverable hiccup, offer
                        "Try again"; when the response shape is unexpected (fatal — a
                        retry can't fix it), offer only "Restart diagnostic" so the
                        learner is never stuck on a hopeless retry loop. A restart is
                        always available as an escape hatch. */}
                    <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                      {!diagFatal && (
                        <button className="np-btn np-primary" onClick={retryDiagnostic}>Try again</button>
                      )}
                      <button className={diagFatal ? "np-btn np-primary" : "np-btn np-secondary"} onClick={startDiagnostic}>
                        Restart diagnostic
                      </button>
                    </div>
                  </div>
                ) : (
                  <Loader subject="scoring your last answer" />
                )}
              </div>
            )}

            {/* SCORING */}
            {stage === "scoring" && <Loader subject="scoring all three subjects" />}

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
                  {/* A11y P1-5: one real <h1> per signed-in view (visual style kept via np-h2). */}
                  <h1 className="np-h2">Where you stand</h1>
                  {/* The 0–350 rank ladder as a segmented scale bar (brightens
                      Elementary → Doctorate). SCALE_NOTE stays as the screen-reader
                      label so the same info reaches assistive tech. */}
                  <div className="np-scale" role="img" aria-label={`Score scale, 0 to 350. ${SCALE_NOTE}`}>
                    {[
                      ["Elementary", "0–69"],
                      ["Middle", "70–139"],
                      ["High", "140–209"],
                      ["University", "210–279"],
                      ["Doctorate", "280–350"],
                    ].map(([name, range]) => (
                      <div className="np-scale-tier" key={name}>
                        <span className="np-scale-seg" aria-hidden="true" />
                        <span className="np-scale-name">{name}</span>
                        <span className="np-scale-range">{range}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="np-grid3">
                  {ORDER.map((k) => {
                    const s = scores[k] || { score: 0, weakConcepts: [], comment: "" };
                    // Headline = the mastery-blended score (depth × coverage); raw depth
                    // until the mastery map has loaded (avoids a pre-load rank flash).
                    const shown = masteryLoaded ? effectiveSubjectScore(s.score, mastery, k) : (s.score || 0);
                    return (
                      <div key={k} className="np-card np-lift np-scorecard">
                        <div className="np-scorehead">
                          <SubjectGlyph subject={k} size={20} />
                          <span className="np-scorelabel">{SUBJECTS[k].label}</span>
                        </div>
                        <Ring value={shown} color={SUBJECTS[k].color} label={SUBJECTS[k].label} />
                        {/* A11y P1-2: the rank band is small meaningful text → accessible text variant. */}
                        <div className="np-bandtag" style={{ color: SUBJECT_TEXT[k] }}>{band(shown)}</div>
                        {/* When mastery coverage holds the rank below the reasoning depth
                            (e.g. straight after the diagnostic, before anything is mastered),
                            surface the depth so the score isn't an unexplained 0. */}
                        {masteryLoaded && shown < (s.score || 0) && (
                          <div className="np-comment" style={{ color: "var(--muted)" }}>
                            Reasoning depth {s.score} — master {SUBJECTS[k].label} concepts in Learn to raise your rank.
                          </div>
                        )}
                        {s.comment && <div className="np-comment">{s.comment}</div>}
                        {(() => {
                          // Resolve each stored weak concept onto a REAL curriculum
                          // concept and render only those (deduped, max 3). A chip
                          // therefore never shows a phantom topic, and clicking it always
                          // deep-links to that concept's prepared guide. Legacy free-text
                          // rows that map to no concept are dropped rather than rendered
                          // as a dead-end label that just bounces to the Learn tab.
                          const chips = [];
                          const seen = new Set();
                          for (const w of s.weakConcepts || []) {
                            const ck = typeof w === "string" ? resolveConceptKey(k, w) : null;
                            if (!ck || seen.has(ck)) continue;
                            seen.add(ck);
                            chips.push({ key: ck, label: conceptLabel(k, ck) });
                            if (chips.length >= 3) break;
                          }
                          if (!chips.length) return null;
                          return (
                            <div className="np-weakwrap">
                              <div className="np-eyebrow np-eyebrow--sm">Work on</div>
                              <div className="np-weaktags">
                                {chips.map((c) => (
                                  <button
                                    key={`${k}:${c.key}`}
                                    type="button"
                                    className="np-weaktag np-weaktag-btn"
                                    title={`Learn: ${c.label}`}
                                    onClick={() => openLearn(k, c.key)}
                                  >
                                    {c.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                        <button className="np-btn np-secondary np-btn--block" style={{ marginTop: 14 }} onClick={() => startPractice(k)}>
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
                  {/* A11y P1-5: one real <h1> per signed-in view (visual style kept via np-h2). */}
                  <h1 className="np-h2">Climb {pSubject ? SUBJECTS[pSubject].label : "your subjects"}</h1>
                </div>

                {busy && !pQuestion && <Loader subject={pSubject ? SUBJECTS[pSubject].label : ""} />}

                {/* FRONTEND P2-5: a generation failure clears `busy` but leaves
                    `pQuestion` null, so the body would otherwise render empty (just the
                    top error banner). Show an in-context retry card so the learner can
                    re-generate without navigating back and re-entering practice. */}
                {!busy && !pQuestion && pSubject && (
                  <div className="np-card" role="alert" style={{ textAlign: "center", padding: "32px 24px" }}>
                    <p className="np-lessontext" style={{ marginBottom: 16 }}>
                      We couldn&apos;t generate a {SUBJECTS[pSubject].label} question just now.
                    </p>
                    <button className="np-btn np-primary" onClick={() => startPractice(pSubject)}>
                      <Icon name="refresh" size={15} /> Try again
                    </button>
                  </div>
                )}

                {pQuestion && (
                  <>
                    <div className="np-qmeta">
                      <SubjectGlyph subject={pSubject} />
                      <span className="np-metaline">
                        {SUBJECTS[pSubject].label.toUpperCase()} · {(pQuestion.difficulty || "").toUpperCase()}
                      </span>
                      {pQuestion.targetConcept && <span className="np-topic">{pQuestion.targetConcept}</span>}
                      {/* A11y P1-3: announce the live score + its delta when the grade lands. */}
                      {/* FRONTEND P1-3: guard the BASE — `scores` can be null on the
                          partial-baseline path (a subject practiced before it was ranked),
                          so `scores[pSubject]` would throw before the `?.` ran. */}
                      {/* The live score is the MASTERY-BLENDED rank (depth × coverage); raw
                          depth until the mastery map has loaded. */}
                      {(() => {
                        const depthNow = scores?.[pSubject]?.score ?? 0;
                        const liveScore = masteryLoaded ? effectiveSubjectScore(depthNow, mastery, pSubject) : depthNow;
                        return (
                      <span
                        className="np-livescore"
                        style={{ borderColor: SUBJECTS[pSubject].color }}
                        role="status"
                        aria-live="polite"
                        aria-label={`Current score ${liveScore} of 350${scoreDelta ? `, ${scoreDelta > 0 ? "up" : "down"} ${Math.abs(scoreDelta)}` : ""}`}
                      >
                        {liveScore}<span style={{ color: "var(--muted)" }}>/350</span>
                        {scoreDelta !== null && scoreDelta !== 0 && (
                          <span style={{ color: deltaColor(scoreDelta), marginLeft: 6 }}>
                            {scoreDelta > 0 ? "+" : ""}{scoreDelta}
                          </span>
                        )}
                      </span>
                        );
                      })()}
                    </div>
                    <div className="np-card np-question">{pQuestion.question}</div>

                    {!feedback && (
                      <>
                        <AnswerComposer
                          initialValue={pText}
                          onText={setPText}
                          img={pImg}
                          onAttach={attachP}
                          canAttach={canAttachWork}
                          onUpgrade={onAttachUpgrade}
                          onRemoveImg={onPracticeRemoveImg}
                          onSubmit={onPracticeSubmit}
                          onSkip={onPracticeSkip}
                          lockKey={pQuestion.question}
                          submitLabel="Submit reasoning"
                          loading={busy}
                        />
                        <p className="np-hint">No answer will be handed to you. Reason it out, then submit.</p>
                      </>
                    )}

                    {feedback && (
                      // A11y: the concise score + delta is announced by the dedicated
                      // `.np-livescore` polite region below; this large result block is
                      // NOT itself a live region (wrapping the whole breakdown + lists in
                      // aria-live made SR read a verbose wall of text on every grade).
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

                        {/* Pro gate (P0-3): for a non-Pro caller the server withholds the full
                            worked solution + "how to reach 100"; nudge to upgrade in their place. */}
                        {!feedback.workedSolution && feedback.workedSolutionLocked && (
                          <div className="np-card np-lesson">
                            <div className="np-cardicon" style={{ color: SUBJECTS[pSubject].color }}>
                              <Icon name="lock" size={16} /> Worked solution &amp; how to reach 100
                            </div>
                            <div className="np-lessontext" style={{ marginTop: 8 }}>
                              The full step-by-step worked solution and the exact steps to reach a perfect score are a Pro feature.
                            </div>
                            <button className="np-btn np-primary" style={{ marginTop: 12 }} onClick={startCheckout} disabled={upgradeBusy}>
                              <Icon name="spark" size={15} /> {upgradeBusy ? "Starting…" : "Upgrade to Pro"}
                            </button>
                          </div>
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

          <AppFooter />
          </div>
        </div>
      </div>
    </div>
  );
}
