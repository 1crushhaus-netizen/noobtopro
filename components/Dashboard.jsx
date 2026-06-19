"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  SUBJECTS,
  ORDER,
  rankFor,
  totalPoints,
  phdIndex,
  RUBRIC_LABELS,
  lowestRubricDimensions,
} from "@/lib/scoring";
import { effectiveScores, subjectRankView } from "@/lib/promotion";
import { conceptLabel, resolveConceptKey } from "@/lib/curriculum";
import Icon from "@/components/Icon";
import { LineChart, BarChart, RadarChart, MiniBar } from "@/components/charts";
import ReviewList from "@/components/ReviewList";
import { useScrollReveal } from "@/components/useReveal";
import { SubjectGlyph, deltaColor } from "@/components/ui";

// A11y P1-2: map each subject to its accessible TEXT color token (darker in the
// light theme so small tinted labels reach WCAG AA). The bright SUBJECTS[k].color
// accents stay for charts / large / graphical use.
const SUBJECT_TEXT = { math: "var(--math-text)", physics: "var(--phys-text)", chemistry: "var(--chem-text)" };

/* ---------------------------------------------------------------------------
   Dashboard — the user's home base. Merges the former Profile (identity, KPIs,
   by-subject, anonymous leaderboard, reset) and Progress (reasoning radar, trend
   charts, why-your-rank-moved, answer review) tabs into ONE space-efficient bento
   grid that fits a 1920×1080 screen with no page scroll: the always-visible stats
   live in the grid; the heavier trend charts and the answer-review list each open
   in a slide-over Drawer. Guests (no signed-in `user`) get a gated, blurred preview
   prompting sign-in (no real data, no auth fetches).
--------------------------------------------------------------------------- */

// Reusable right-side slide-over drawer. Portaled to <body> so it mounts OUTSIDE
// the inert background subtree (the page is made inert via onOverlayActiveChange,
// so a drawer rendered inside it would disable its own controls). ARIA dialog
// pattern: Escape to close, focus the panel on open, restore focus on close, lock
// background scroll, and a real Tab focus-trap (WCAG 2.4.3).
function Drawer({ open, title, titleId, onClose, children }) {
  const panelRef = useRef(null);
  const prevFocus = useRef(null);
  // Keep the live onClose in a ref so the effect below depends ONLY on `open`
  // (audit P2-13): both drawers receive an inline onClose arrow whose identity
  // changes every parent render, so with onClose in the deps the effect re-ran
  // after the drawer opened — re-capturing prevFocus as the drawer's own close
  // button — and close restored focus to <body> instead of the trigger.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    // Captured exactly once per closed→open transition (the effect's only dep is
    // `open`), so this is always the TRIGGER, never a drawer-internal element.
    prevFocus.current = typeof document !== "undefined" ? document.activeElement : null;
    const panel = panelRef.current;
    const focusables = () =>
      panel
        ? Array.from(
            panel.querySelectorAll(
              'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
            )
          )
        : [];
    // Move focus into the dialog on open (the close button is first).
    focusables()[0]?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab") {
        const f = focusables();
        if (f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      const prev = prevFocus.current;
      // Restore focus to the trigger AFTER the next frame: closing the drawer also
      // un-inerts the page background (via onOverlayActiveChange → bgInert), and that
      // happens in a follow-up render. Focusing the trigger (which lives inside the
      // briefly-still-inert <main>) synchronously here would be a no-op, so defer it.
      if (prev && typeof prev.focus === "function") {
        if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => prev.focus());
        else prev.focus();
      }
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="np-drawer-backdrop" onClick={onClose}>
      <div
        className="np-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="np-drawer-head">
          <h2 id={titleId} className="np-sectiontitle" style={{ margin: 0 }}>{title}</h2>
          <button className="np-iconbtn np-drawer-close" aria-label="Close" onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="np-drawer-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

// The three headline KPI cards (deduped from the two former tabs into one cluster).
// Compact: label + number only — the descriptive sub-lines were dropped so the whole
// top band stays slim, freeing vertical space for the panels below. (The rank that the
// PhD sub used to repeat is already shown as the identity rank chip.)
function KpiStats({ scores, attempts }) {
  return (
    <div className="np-dash-kpis">
      <div className="np-card np-lift np-statcard">
        <span className="np-eyebrow np-eyebrow--xs">Doctorate index</span>
        {/* Neutral ink like its siblings — the KPI is not a subject or a valence,
            so it gets no chromatic accent under the greyscale system. */}
        <span className="np-statnum">
          {phdIndex(scores)}<span style={{ color: "var(--muted)", fontSize: 15 }}> / 350</span>
        </span>
      </div>
      <div className="np-card np-lift np-statcard">
        <span className="np-eyebrow np-eyebrow--xs">Total points</span>
        <span className="np-statnum">
          {totalPoints(scores)}<span style={{ color: "var(--muted)", fontSize: 15 }}> / 1050</span>
        </span>
      </div>
      <div className="np-card np-lift np-statcard">
        <span className="np-eyebrow np-eyebrow--xs">Problems graded</span>
        <span className="np-statnum">{attempts}</span>
      </div>
    </div>
  );
}

// Per-subject rank + a mini-bar + practice shortcut. The headline number is the
// MASTERY-BLENDED score (lib/promotion.js — depth × the fraction of the curriculum
// mastered, owner decision 2026-06-17): mastering concepts is what raises it. The line
// underneath surfaces the underlying reasoning DEPTH (so a strong reasoner sees their
// work is recognized — it converts to rank through mastery) and how much is left to
// master. `masteryReady` guards the brief window before the map has loaded: until then
// we show the raw depth rather than flashing a coverage-zeroed rank.
function BySubject({ scores, mastery, masteryReady = true, onPractice }) {
  // Always exactly three rows (each with one gate line) → never overflows, so it
  // stays a plain (non-scroll) card (no cardbody/scrollbar-gutter).
  return (
    <div className="np-card np-dash-panel">
      <div className="np-charttitle" style={{ marginBottom: 12 }}>By subject</div>
      {ORDER.map((k) => {
        const view = subjectRankView(scores[k]?.score || 0, mastery, k);
        const num = masteryReady ? view.effective : view.depth;
        const rankName = masteryReady ? view.rank.name : rankFor(view.depth).name;
        return (
          <div key={k} className="np-dash-subwrap">
            <div className="np-dash-subrow">
              <SubjectGlyph subject={k} width={16} />
              <span className="np-dash-sublabel">{SUBJECTS[k].label}</span>
              <MiniBar value={num} color={SUBJECTS[k].color} />
              <span style={{ fontFamily: "var(--mono)", fontWeight: 700, width: 58, textAlign: "right" }}>
                {num}<span style={{ color: "var(--muted)" }}>/350</span>
              </span>
              <button className="np-ghost" onClick={() => onPractice && onPractice(k)} style={{ whiteSpace: "nowrap" }}>Practice</button>
            </div>
            <div className="np-dash-subgate">
              {/* A11y P1-2: the small rank pill is meaningful text, so it uses the
                  accessible per-subject TEXT variant (darker in light theme), not the
                  bright graphical accent. */}
              <span className="np-dash-subband" style={{ "--subject": SUBJECT_TEXT[k] }}>{rankName}</span>
              {masteryReady && view.total > 0 && (
                view.fullyMastered ? (
                  <span className="np-dash-subgatetext">
                    All {view.total} {SUBJECTS[k].label} concepts mastered — your full reasoning depth counts
                  </span>
                ) : (
                  // The score qualifies for more, but it only counts as you MASTER the
                  // curriculum (state in text, not color alone). Depth shown so the
                  // learner sees their reasoning is recognized, awaiting mastery.
                  <span className="np-dash-subgatetext">
                    <Icon name="lock" size={11} /> Reasoning depth {view.depth} · {view.green}/{view.total} mastered — master{" "}
                    {view.remaining} more concept{view.remaining === 1 ? "" : "s"} in Learn to raise your score
                  </span>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Reasoning radar + a compact "what to work on" (weakest axis + weak concept) per
// profiled subject. No internal scroll: the chart SHRINKS to whatever height is
// left so the focus rows below it are always visible — "what to work on" is the
// actionable part and must never require scrolling to find.
function RadarPanel({ scores, onPractice, onLearn }) {
  // PERF (P2-3): the subject filter/map only changes when `scores` does — memoize it
  // so unrelated dashboard interactions (drawer toggle, confirm modal) don't rebuild it.
  const rubricSubjects = useMemo(
    () =>
      ORDER
        .filter((k) => scores && scores[k] && scores[k].rubric && typeof scores[k].rubric === "object")
        .map((k) => ({ key: k, label: SUBJECTS[k].label, color: SUBJECTS[k].color, rubric: scores[k].rubric })),
    [scores]
  );

  return (
    <div className="np-card np-dash-radar" data-reveal style={{ "--ri": 0 }}>
      <div className="np-dash-cardhead">
        <div className="np-charttitle">Reasoning profile</div>
        <div className="np-chartsub" style={{ marginBottom: 0 }}>
          Where you reason well across the dimensions we grade, and where to focus next.
        </div>
      </div>
      {rubricSubjects.length >= 1 ? (
        <>
          <div className="np-dash-radarchart">
            <RadarChart subjects={rubricSubjects} />
          </div>
          <div className="np-dash-focus">
            {rubricSubjects.map((s) => {
              const lowKeys = lowestRubricDimensions(s.rubric, 1);
              const lowLabel = lowKeys.length ? RUBRIC_LABELS[lowKeys[0]] : null;
              // Resolve the first weak concept that maps onto a REAL curriculum concept
              // (curriculum key OR legacy free-text). Only then offer "Learn this",
              // which deep-links to that concept's guide; otherwise fall back to a plain
              // "Practice" so the row never points at a non-existent topic.
              const conceptKey =
                (scores[s.key]?.weakConcepts || [])
                  .map((c) => (typeof c === "string" ? resolveConceptKey(s.key, c) : null))
                  .find(Boolean) || null;
              const conceptText = conceptKey ? conceptLabel(s.key, conceptKey) : null;
              return (
                <div key={s.key} className="np-dash-focusrow">
                  <SubjectGlyph subject={s.key} width={16} />
                  <span className="np-statsub" style={{ flex: 1, minWidth: 0 }}>
                    {lowLabel ? (
                      <>Weakest: <strong style={{ color: "var(--text)" }}>{lowLabel}</strong>{conceptText ? <>: <em>{conceptText}</em></> : null}</>
                    ) : (
                      "Keep practicing to refine your profile."
                    )}
                  </span>
                  {conceptKey ? (
                    <button className="np-ghost" onClick={() => onLearn && onLearn(s.key, conceptKey)} style={{ whiteSpace: "nowrap" }}>Learn this</button>
                  ) : (
                    <button className="np-ghost" onClick={() => onPractice && onPractice(s.key)} style={{ whiteSpace: "nowrap" }}>Practice</button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="np-statsub">Finish the diagnostic to see your reasoning profile.</p>
      )}
    </div>
  );
}

// "Why your rank moved" — the most recent graded attempts with their persisted
// one-line rationale (trimmed for the always-visible grid).
function RecentMoves({ history }) {
  // Newest first. In normal page flow we keep a generous slice (the page scrolls);
  // the learner can scroll back through their recent history.
  const moves = history
    .filter((a) => a.type === "attempt" && typeof a.rationale === "string" && a.rationale.trim())
    .slice(-25)
    .reverse()
    // P2-1: carry the attempt timestamp so the list can key by a STABLE field
    // (timestamp + subject) instead of the array index — index keys mis-associate
    // rows as new attempts land at the head of the reversed slice.
    .map((a) => ({ t: a.t, subject: a.subject, delta: Math.round(a.delta || 0), rationale: a.rationale }));

  return (
    <div className="np-card np-dash-panel np-dash-moves">
      <div className="np-dash-cardhead">
        {/* These deltas are the REASONING-DEPTH movement per attempt (the quality engine).
            The headline rank is depth × mastery coverage, so it moves as you master
            concepts — kept distinct here so a depth gain that hasn't yet mastered a
            concept still reads honestly. */}
        <div className="np-charttitle" style={{ marginBottom: 4 }}>Why your reasoning moved</div>
        <div className="np-chartsub" style={{ marginBottom: 0 }}>Your latest graded attempts, and the reasoning depth each gained or cost. Master concepts in Learn to turn depth into rank.</div>
      </div>
      <div className="np-dash-cardbody" role="region" aria-label="Recent reasoning changes">
        {moves.length >= 1 ? (
          moves.map((m, i) => (
            <div key={m.t ? `${m.subject}:${m.t}` : i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
              <SubjectGlyph subject={m.subject} width={16} />
              <span style={{
                fontFamily: "var(--mono)", fontWeight: 700, width: 40, textAlign: "right",
                color: deltaColor(m.delta),
              }}>
                {m.delta > 0 ? "+" : ""}{m.delta}
              </span>
              <span className="np-statsub" style={{ flex: 1 }}>{m.rationale}</span>
            </div>
          ))
        ) : (
          <p className="np-statsub">Answer a practice problem to see why your rank moves.</p>
        )}
      </div>
    </div>
  );
}

// "Progress trends" charts (Pro). The trend series lives in `attempts`, whose direct client
// SELECT is revoked (db/migrations/0024), so this fetches it through the Pro-gated /api/trends
// (loadTrends) on open — not from the free in-memory history. Mirrors how ReviewList loads
// answer history. A non-Pro user never reaches here (the "See trends" button shows the lock +
// upgrade); the route itself returns 402 as the server backstop.
function TrendCharts({ loadTrends }) {
  const [state, setState] = useState({ status: "loading", trends: [] });
  useEffect(() => {
    if (typeof loadTrends !== "function") {
      setState({ status: "ready", trends: [] });
      return;
    }
    let alive = true;
    loadTrends()
      .then((res) => {
        if (!alive) return;
        if (res && res.error) setState({ status: "error", trends: [] });
        else setState({ status: "ready", trends: (res && res.trends) || [] });
      })
      .catch(() => {
        if (alive) setState({ status: "error", trends: [] });
      });
    return () => {
      alive = false;
    };
  }, [loadTrends]);

  const linePoints = useMemo(
    () => state.trends.filter((h) => typeof h.totalAfter === "number").map((h) => h.totalAfter),
    [state.trends]
  );
  const barItems = useMemo(
    () =>
      state.trends
        .filter((h) => h.type === "attempt")
        .map((a) => ({ value: Math.round(a.delta || 0), glyph: SUBJECTS[a.subject]?.glyph || "·" })),
    [state.trends]
  );

  if (state.status === "loading") return <p className="np-statsub">Loading your trends…</p>;
  if (state.status === "error")
    return <p className="np-statsub">Couldn&rsquo;t load your trends. Please try again.</p>;
  return (
    <>
      <div className="np-card np-chartcard">
        <div className="np-charttitle">Total points over time</div>
        <div className="np-chartsub">From your starting scores through every graded attempt.</div>
        {linePoints.length >= 2 ? (
          <LineChart values={linePoints} yMax={1050} />
        ) : (
          <p className="np-statsub">Answer a practice problem to start the trend line.</p>
        )}
      </div>
      <div className="np-card np-chartcard">
        <div className="np-charttitle">Points gained and lost</div>
        <div className="np-chartsub">Each bar is one graded attempt: above the line when your reasoning earned points, below it when it cost them.</div>
        {barItems.length >= 1 ? (
          <BarChart items={barItems} />
        ) : (
          <p className="np-statsub">No graded attempts yet.</p>
        )}
      </div>
    </>
  );
}

export default function Dashboard({
  user,
  scores,
  history = [],
  isPro = false,
  proEnabled = false,
  upgradeBusy = false,
  loadReviews,
  loadTrends,
  loadMastery,
  // FRONTEND P1-2: mastery is now LIFTED into the shell and passed in (fetched once
  // for both Dashboard + LearnTab). When provided, we use it directly and skip the
  // self-fetch; the loadMastery prop remains a fallback for standalone/legacy callers.
  mastery: masteryProp,
  // True once the mastery map has actually loaded — gates the mastery-blended score so
  // a fresh mount doesn't briefly flash a coverage-zeroed rank before mastery arrives.
  // Defaults true for standalone/test callers that pass a ready map directly.
  masteryReady = true,
  onStartDiagnostic,
  onPractice,
  onLearn,
  onReset,
  onDeleteAccount,
  onExport,
  onSignIn,
  onUpgrade,
  onManageSubscription,
  // EU "Withdraw from contract here" (CRD Art. 11a): onWithdraw() terminates immediately +
  // refunds pro-rata and resolves to the on-screen confirmation; withdrawalUntil is the ISO
  // end of the 14-day window (the control shows only while a Pro user is inside it).
  onWithdraw,
  withdrawalUntil,
  onClose,
  onOverlayActiveChange,
}) {
  const [imgFailed, setImgFailed] = useState(false);
  // Pro features (trends over time + answer history) are locked only when the paid tier
  // is live AND this user isn't subscribed. A Pro subscriber is never locked; a
  // deployment that doesn't sell Pro (proEnabled=false) keeps everything open as before.
  const proLocked = proEnabled && !isPro;
  // Which slide-over drawer is open: null | "charts" | "reviews".
  const [drawer, setDrawer] = useState(null);
  // Destructive-action confirmation modal (replaces window.confirm): a dimmed dialog with
  // No (safe default) / Yes. One modal serves both "Reset my progress" and "Delete account"
  // — confirmAction is null | "reset" | "delete". `resetting` drives the in-flight spinner
  // so a slow operation can't be double-fired.
  const [confirmAction, setConfirmAction] = useState(null);
  const [resetting, setResetting] = useState(false);
  const resetNoRef = useRef(null); // default focus = the safe "No" button
  const resetPrevFocus = useRef(null); // focus to restore when the dialog closes
  const resettingRef = useRef(false);
  useEffect(() => { resettingRef.current = resetting; }, [resetting]);
  // EU withdrawal flow (CRD Art. 11a). withdrawPhase: idle | confirm | busy | done | error.
  // The control is offered only to a Pro user still inside the 14-day window.
  const [withdrawPhase, setWithdrawPhase] = useState("idle");
  const [withdrawResult, setWithdrawResult] = useState(null);
  const [withdrawError, setWithdrawError] = useState("");
  const withdrawCancelRef = useRef(null); // default focus = the safe "Keep my subscription"
  const withdrawalOpen =
    isPro && typeof onWithdraw === "function" && withdrawalUntil != null && new Date() <= new Date(withdrawalUntil);
  // Minor units (cents) + ISO currency code -> a human "9.71 EUR".
  const fmtMoney = (minor, currency) => {
    const amt = (Math.max(0, Math.round(Number(minor) || 0)) / 100).toFixed(2);
    const cur = (currency || "").toUpperCase();
    return cur ? `${amt} ${cur}` : amt;
  };
  // "Download my data" (GDPR access/portability) in-flight flag.
  const [exporting, setExporting] = useState(false);
  // Tasteful staggered scroll-reveal for the bento's main panels (shared hook).
  const { ref: revealRef, armed } = useScrollReveal();
  // Per-concept mastery map for the §7 breadth gate. Prefer the LIFTED prop (fetched
  // once in the shell — FRONTEND P1-2); only self-fetch via the injected loader when
  // no prop is supplied (standalone/legacy use). Signed-in only (the guest gate
  // fetches nothing); a load failure just renders ungated bands — nothing is lost.
  const [fetchedMastery, setFetchedMastery] = useState({});
  const mastery = masteryProp ?? fetchedMastery;
  // The mastery-blended scores (depth × coverage) drive every headline rank/number on
  // the dashboard (KPIs, identity chip, by-subject). The radar/profile stays on the raw
  // scores (it's about reasoning quality, not coverage). Until mastery has loaded, fall
  // back to the raw depth so the rank doesn't flash to zero on a fresh mount.
  const effScores = useMemo(
    () => (masteryReady ? effectiveScores(scores, mastery) : scores),
    [scores, mastery, masteryReady]
  );
  useEffect(() => {
    if (masteryProp != null) return; // mastery supplied by the parent — don't double-fetch
    if (!user || !loadMastery) return;
    let alive = true;
    loadMastery()
      .then((res) => {
        if (alive && res && res.mastery) setFetchedMastery(res.mastery);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user, loadMastery, masteryProp]);

  // Make the page background inert while a drawer is open (proper modal focus
  // containment). The guest gate does NOT inert the page — it's scoped to the
  // dashboard body so the nav stays usable for a guest who'd rather keep exploring.
  useEffect(() => {
    onOverlayActiveChange?.(drawer !== null || confirmAction !== null || withdrawPhase !== "idle");
  }, [drawer, confirmAction, withdrawPhase, onOverlayActiveChange]);
  useEffect(() => () => onOverlayActiveChange?.(false), [onOverlayActiveChange]);

  // Withdrawal dialog: focus the safe "Keep my subscription" on open; let Escape close it
  // unless a withdrawal is mid-flight (busy). On the "done"/"error" panels the close
  // button is the safe action.
  useEffect(() => {
    if (withdrawPhase === "idle") return;
    if (withdrawPhase === "confirm") withdrawCancelRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape" && withdrawPhase !== "busy") setWithdrawPhase("idle"); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [withdrawPhase]);

  // Reset dialog: focus the safe "No" button on open; restore focus on close; let
  // Escape cancel (unless a reset is already in flight). The dimmed backdrop +
  // inert background (via onOverlayActiveChange) contain focus like the other modals.
  useEffect(() => {
    if (!confirmAction) return;
    resetNoRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape" && !resettingRef.current) setConfirmAction(null); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      resetPrevFocus.current?.focus?.();
    };
  }, [confirmAction]);

  const meta = (user && user.user_metadata) || {};
  const name = meta.full_name || meta.name || (user && user.email) || "You";
  const avatar = meta.avatar_url || meta.picture || null;
  const email = user && user.email;
  const showAvatar = avatar && !imgFailed;

  // The "Progress trends" chart arrays are no longer derived from the free in-memory
  // history — the trend series is Pro-gated and fetched on demand by <TrendCharts> via
  // loadTrends() -> /api/trends (db/migrations/0024). The free history still drives the
  // KPI "problems graded" count + the "why your reasoning moved" list.

  // ---- Guest gate: blurred preview + sign-in prompt (no data, no auth fetches) ----
  if (!user) {
    return (
      <div className="fade-up np-dash-gatewrap">
        <div className="np-dash-gateblur" aria-hidden="true" inert={true}>
          <div className="np-card" style={{ height: 90 }} />
          <div className="np-card" style={{ height: 90 }} />
          <div className="np-card" style={{ height: 240 }} />
          <div className="np-card" style={{ height: 240 }} />
          <div className="np-card" style={{ height: 140 }} />
          <div className="np-card" style={{ height: 140 }} />
        </div>
        <div className="np-surface-elevated np-dash-gatecard" role="dialog" aria-modal="false" aria-labelledby="np-gate-title">
          <div className="np-modal-spark" aria-hidden="true"><Icon name="lock" size={22} /></div>
          {/* A11y P1-5: the gate is this view's primary content → a real <h1>. */}
          <h1 id="np-gate-title" className="np-h2 np-modal-title">Sign in to see your Dashboard</h1>
          <p className="np-lede np-modal-subtitle">
            Your scores, reasoning profile, and answer history live here. Sign in to unlock your dashboard
            {scores ? "; your guest results carry over automatically." : "."}
          </p>
          <button className="np-btn np-primary np-big np-btn--block" onClick={onSignIn}>
            <Icon name="login" size={16} /> Sign in
          </button>
          {onClose && <button className="np-ghost np-modal-later" onClick={onClose}>Maybe later</button>}
        </div>
      </div>
    );
  }

  // ---- Signed-in, not ranked yet: identity + "Prove it" empty state ----
  const attempts = (history || []).filter((h) => h.type === "attempt").length;

  const identity = (
    <div className="np-card np-dash-identity">
      {showAvatar ? (
        <img className="np-avatar" src={avatar} alt="" referrerPolicy="no-referrer" onError={() => setImgFailed(true)} />
      ) : (
        <div className="np-avatar np-avatarfallback">{String(name).charAt(0).toUpperCase()}</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="np-profilename">{name}</div>
        {email && <div className="np-profileemail">{email}</div>}
      </div>
      {scores && (
        // A11y P2-4: aria-label so the chip's purpose isn't title-only.
        <span
          className="np-dash-rankchip"
          title="Your overall rank"
          aria-label={`Your overall rank: ${rankFor(phdIndex(effScores)).name}`}
        >
          {rankFor(phdIndex(effScores)).name}
        </span>
      )}
      {/* Sign out lives once, in the global header (np-top) — no duplicate here. */}
    </div>
  );

  if (!scores) {
    return (
      <div className="fade-up">
        {identity}
        <div className="np-card" style={{ textAlign: "center", padding: "36px 24px", marginTop: 16 }}>
          {/* A11y P1-5: primary heading of the not-ranked view → a real <h1>. */}
          <h1 className="np-h2">Not ranked yet</h1>
          <p className="np-lede" style={{ margin: "0 auto 20px" }}>
            Prove what you know across nine problems (beginner, intermediate, and hard in each subject) to get your starting scores in math, physics, and chemistry.
          </p>
          <button className="np-btn np-primary np-big" onClick={onStartDiagnostic}>Prove it</button>
        </div>
      </div>
    );
  }

  // ---- Signed-in dashboard: the bento grid ----

  return (
    <div className={"fade-up np-dash-frame" + (armed ? " is-armed" : "")} ref={revealRef}>
      <div className="np-pagehead np-dash-pagehead">
        <span className="np-eyebrow--mono">Where you stand</span>
        {/* A11y P1-5: primary heading of the signed-in dashboard → a real <h1>. */}
        <h1 className="np-h2">
          Your dashboard
          {isPro && (
            <span className="np-dash-rankchip" style={{ marginLeft: 10, verticalAlign: "middle" }} title="You're a Pro subscriber" aria-label="You're a Pro subscriber">
              Pro
            </span>
          )}
        </h1>
        <p className="np-lede">Your scores, reasoning profile, rank, and recent progress, all in one place.</p>
      </div>
      <div className="np-dash">
        {/* Identity (avatar + name + rank) lives in the app top nav — the bento's
            top row is purely the KPI cluster. */}
        <KpiStats scores={effScores} attempts={attempts} />
        <RadarPanel scores={scores} onPractice={onPractice} onLearn={onLearn} />
        <div className="np-dash-mid" data-reveal style={{ "--ri": 1 }}>
          <BySubject scores={scores} mastery={mastery} masteryReady={masteryReady} onPractice={onPractice} />
        </div>
        <div className="np-dash-lead" data-reveal style={{ "--ri": 2 }}>
          <RecentMoves history={history} />
        </div>
        <div className="np-dash-actions">
          {/* Trends-over-time + answer history are PRO features — but ONLY when the paid
              tier is live (proEnabled). When locked, the buttons show a lock and open the
              upgrade flow instead of the drawer (the drawer's data is never fetched for
              them). When Pro isn't sold (proEnabled=false) they behave exactly as before. */}
          {proLocked ? (
            <button className="np-btn np-secondary np-dash-actbtn" onClick={onUpgrade} title="Pro feature — upgrade to unlock">
              <Icon name="lock" size={14} /> See trends
            </button>
          ) : (
            <button className="np-btn np-secondary np-dash-actbtn" onClick={() => setDrawer("charts")}>
              See trends <Icon name="arrow" size={16} />
            </button>
          )}
          {proLocked ? (
            <button className="np-btn np-secondary np-dash-actbtn" onClick={onUpgrade} title="Pro feature — upgrade to unlock">
              <Icon name="lock" size={14} /> Review your answers
            </button>
          ) : (
            <button className="np-btn np-secondary np-dash-actbtn" onClick={() => setDrawer("reviews")}>
              Review your answers <Icon name="arrow" size={16} />
            </button>
          )}
          {/* Re-take the diagnostic to re-baseline. The replace-your-scores confirmation
              lives in beginDiagnostic (FIX 6) so it fires from every entry point. */}
          {onStartDiagnostic && (
            <button className="np-btn np-secondary np-dash-actbtn" onClick={onStartDiagnostic}>
              Re-take diagnostic <Icon name="arrow" size={16} />
            </button>
          )}
          {/* Pro status / upgrade. Only shown once the paid tier is live; Pro subscribers
              get "Manage subscription" (+ the withdrawal control below while in-window),
              free users get the upgrade CTA. */}
          {isPro && (
            <button className="np-btn np-secondary np-dash-actbtn" style={{ marginLeft: "auto" }} onClick={onManageSubscription} disabled={upgradeBusy}>
              <Icon name="spark" size={14} /> {upgradeBusy ? "Opening…" : "Manage subscription"}
            </button>
          )}
          {/* EU 14-day withdrawal (CRD Art. 11a) — distinct from "Manage subscription"
              (which cancels at period end). Shown only to a Pro user still inside the
              window; terminates immediately + refunds the pro-rata remainder. */}
          {withdrawalOpen && (
            <button
              className="np-btn np-secondary np-dash-actbtn"
              onClick={() => { withdrawCancelRef.current = null; setWithdrawError(""); setWithdrawResult(null); setWithdrawPhase("confirm"); }}
              title="EU 14-day right of withdrawal — cancel immediately with a pro-rata refund"
            >
              <Icon name="refresh" size={14} /> Withdraw from contract here
            </button>
          )}
          {!isPro && proEnabled ? (
            <button className="np-btn np-primary np-dash-actbtn" style={{ marginLeft: "auto" }} onClick={onUpgrade} disabled={upgradeBusy}>
              <Icon name="spark" size={14} /> {upgradeBusy ? "Starting…" : "Upgrade to Pro"}
            </button>
          ) : null}
          {/* GDPR access/portability — a non-destructive "save a copy of my data". Sits at
              the head of the account-actions group (takes the right-push when no Pro/upgrade
              button precedes it). */}
          {onExport && (
            <button
              className="np-btn np-secondary np-dash-actbtn"
              style={!isPro && !proEnabled ? { marginLeft: "auto" } : undefined}
              disabled={exporting}
              onClick={async () => { setExporting(true); try { await onExport(); } finally { setExporting(false); } }}
            >
              {exporting ? "Preparing…" : "Download my data"}
            </button>
          )}
          <button
            className="np-btn np-danger np-dash-actbtn"
            style={!isPro && !proEnabled && !onExport ? { marginLeft: "auto" } : undefined}
            onClick={() => { resetPrevFocus.current = document.activeElement; setConfirmAction("reset"); }}
          >
            Reset my progress
          </button>
          {onDeleteAccount && (
            <button
              className="np-btn np-danger np-dash-actbtn"
              onClick={() => { resetPrevFocus.current = document.activeElement; setConfirmAction("delete"); }}
            >
              Delete account
            </button>
          )}
        </div>
      </div>

      <Drawer open={drawer === "charts"} title="Your trends over time" titleId="np-drawer-charts" onClose={() => setDrawer(null)}>
        {/* Mount (and fetch) only when the drawer is open — the trend series is Pro-gated. */}
        {drawer === "charts" && <TrendCharts loadTrends={loadTrends} />}
      </Drawer>

      <Drawer open={drawer === "reviews"} title="Review your answers" titleId="np-drawer-reviews" onClose={() => setDrawer(null)}>
        <ReviewList loadReviews={loadReviews} onPractice={onPractice} onLearn={onLearn} />
      </Drawer>

      {confirmAction &&
        createPortal(
          <div
            className="np-modal-backdrop"
            onClick={() => { if (!resetting) setConfirmAction(null); }}
          >
            <div
              className="np-surface-elevated np-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="np-resetconfirm-title"
              aria-describedby="np-resetconfirm-desc"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="np-modal-spark" aria-hidden="true"><Icon name={confirmAction === "delete" ? "x" : "refresh"} size={22} /></div>
              <h2 id="np-resetconfirm-title" className="np-h2 np-modal-title">
                {confirmAction === "delete" ? "Delete your account?" : "Are you sure?"}
              </h2>
              <p id="np-resetconfirm-desc" className="np-lede np-modal-subtitle">
                {confirmAction === "delete"
                  ? "This permanently deletes your account and all your data, and cancels any Pro subscription. This can't be undone."
                  : "This permanently deletes all your scores and history."}
              </p>
              <div className="np-modal-actions">
                <button
                  ref={resetNoRef}
                  className="np-btn np-secondary"
                  onClick={() => setConfirmAction(null)}
                  disabled={resetting}
                >
                  No
                </button>
                <button
                  className="np-btn np-danger"
                  onClick={async () => {
                    setResetting(true);
                    const ok = confirmAction === "delete" ? await onDeleteAccount?.() : await onReset?.();
                    // Success → the app switches to the intro view (reset) or signs out
                    // (delete) and unmounts this dashboard. Failure → the handler surfaces
                    // the error banner; close the dialog and clear the spinner.
                    if (ok === false) { setResetting(false); setConfirmAction(null); }
                  }}
                  disabled={resetting}
                >
                  {resetting ? (confirmAction === "delete" ? "Deleting…" : "Resetting…") : "Yes"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* EU withdrawal (CRD Art. 11a): confirm → terminate immediately + pro-rata refund →
          on-screen durable confirmation. Distinct from "cancel" (period-end). */}
      {withdrawPhase !== "idle" &&
        createPortal(
          <div
            className="np-modal-backdrop"
            onClick={() => { if (withdrawPhase !== "busy") setWithdrawPhase("idle"); }}
          >
            <div
              className="np-surface-elevated np-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="np-withdraw-title"
              aria-describedby="np-withdraw-desc"
              onClick={(e) => e.stopPropagation()}
            >
              {withdrawPhase === "confirm" && (
                <>
                  <div className="np-modal-spark" aria-hidden="true"><Icon name="refresh" size={22} /></div>
                  <h2 id="np-withdraw-title" className="np-h2 np-modal-title">
                    Withdraw from your subscription?
                  </h2>
                  <p id="np-withdraw-desc" className="np-lede np-modal-subtitle">
                    This exercises your EU 14-day right of withdrawal: your Pro subscription ends{" "}
                    <strong>immediately</strong> and we refund the part of this month you haven&rsquo;t used (a
                    proportionate amount is kept for the time already provided). This is different from
                    cancelling, which keeps Pro until the period ends.
                  </p>
                  <div className="np-modal-actions">
                    <button
                      ref={withdrawCancelRef}
                      className="np-btn np-secondary"
                      onClick={() => setWithdrawPhase("idle")}
                    >
                      Keep my subscription
                    </button>
                    <button
                      className="np-btn np-danger"
                      onClick={async () => {
                        setWithdrawPhase("busy");
                        try {
                          const res = await onWithdraw?.();
                          setWithdrawResult(res || {});
                          setWithdrawPhase("done");
                        } catch (e) {
                          setWithdrawError((e && e.message) || "Could not complete your withdrawal. Please try again.");
                          setWithdrawPhase("error");
                        }
                      }}
                    >
                      Confirm withdrawal
                    </button>
                  </div>
                </>
              )}

              {withdrawPhase === "busy" && (
                <>
                  <h2 id="np-withdraw-title" className="np-h2 np-modal-title">
                    Processing your withdrawal…
                  </h2>
                  <p id="np-withdraw-desc" className="np-statsub" style={{ textAlign: "center", margin: 0 }}>
                    Cancelling your subscription and issuing your refund.
                  </p>
                </>
              )}

              {withdrawPhase === "done" && (
                <>
                  <div className="np-modal-spark" aria-hidden="true"><Icon name="shield" size={22} /></div>
                  <h2 id="np-withdraw-title" className="np-h2 np-modal-title">
                    Withdrawal confirmed
                  </h2>
                  <div id="np-withdraw-desc" className="np-fineprint" style={{ textAlign: "left", margin: "0 0 18px", lineHeight: 1.6 }}>
                    <p style={{ margin: "0 0 8px" }}>
                      You withdrew from your noobtopro Pro subscription on{" "}
                      <strong>
                        {withdrawResult?.withdrawnAt ? new Date(withdrawResult.withdrawnAt).toLocaleString() : new Date().toLocaleString()}
                      </strong>
                      . Your Pro access has ended and you won&rsquo;t be charged again.
                    </p>
                    <p style={{ margin: 0 }}>
                      {withdrawResult?.refund?.status === "issued"
                        ? `A pro-rata refund of ${fmtMoney(withdrawResult.refund.amountMinor, withdrawResult.refund.currency)} is being returned to your original payment method via Polar.`
                        : withdrawResult?.refund?.status === "pending_manual"
                        ? "Your pro-rata refund is being processed and will be returned to your original payment method shortly."
                        : "No refund is due (the current period was already fully used)."}
                    </p>
                  </div>
                  <div className="np-modal-actions">
                    {/* CRD Art. 11a durable-medium acknowledgement of receipt — saved as a file the
                        consumer keeps (also emailed where the mailer is configured). */}
                    {withdrawResult?.acknowledgement && (
                      <button
                        className="np-btn np-secondary"
                        onClick={() => {
                          try {
                            const blob = new Blob([withdrawResult.acknowledgement], { type: "text/plain" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = "noobtopro-withdrawal-confirmation.txt";
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            URL.revokeObjectURL(url);
                          } catch {
                            /* download blocked — the on-screen text + email remain */
                          }
                        }}
                      >
                        Download confirmation
                      </button>
                    )}
                    {typeof window !== "undefined" && typeof window.print === "function" && (
                      <button className="np-btn np-secondary" onClick={() => window.print()}>
                        Print / save
                      </button>
                    )}
                    <button className="np-btn np-primary" onClick={() => setWithdrawPhase("idle")}>
                      Done
                    </button>
                  </div>
                </>
              )}

              {withdrawPhase === "error" && (
                <>
                  <div className="np-modal-spark" aria-hidden="true"><Icon name="x" size={22} /></div>
                  <h2 id="np-withdraw-title" className="np-h2 np-modal-title">
                    Withdrawal didn&rsquo;t go through
                  </h2>
                  <p id="np-withdraw-desc" className="np-lede np-modal-subtitle">
                    {withdrawError || "Could not complete your withdrawal. Please try again."}
                  </p>
                  <div className="np-modal-actions">
                    <button className="np-btn np-secondary" onClick={() => setWithdrawPhase("idle")}>
                      Close
                    </button>
                    <button className="np-btn np-primary" onClick={() => setWithdrawPhase("confirm")}>
                      Try again
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
