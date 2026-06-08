"use client";

import React, { useState, useEffect, useRef } from "react";
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
import Icon from "@/components/Icon";
import { LineChart, BarChart, RadarChart, MiniBar } from "@/components/charts";
import Leaderboard from "@/components/Leaderboard";
import ReviewList from "@/components/ReviewList";

/* ---------------------------------------------------------------------------
   Dashboard — the user's home base. Merges the former Profile (identity, KPIs,
   by-subject, anonymous leaderboard, reset) and Progress (reasoning radar, trend
   charts, why-your-rank-moved, answer review) tabs into ONE space-efficient bento
   grid that fits a 1920×1080 screen with no page scroll: the always-visible stats
   live in the grid; the heavier trend charts and the answer-review list each open
   in a slide-over Drawer. Guests (no signed-in `user`) get a gated, blurred preview
   prompting sign-in (no real data, no auth fetches).
--------------------------------------------------------------------------- */

// True at the desktop breakpoint where the dashboard becomes a viewport-tall frame
// and its panels actually scroll internally. The scrollable-region tabIndex is gated
// on this so the panels aren't empty keyboard tab-stops below 1024px (where they're
// plain blocks on a normally-scrolling page).
function useIsWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return wide;
}

// Reusable right-side slide-over drawer. Portaled to <body> so it mounts OUTSIDE
// the inert background subtree (the page is made inert via onOverlayActiveChange,
// so a drawer rendered inside it would disable its own controls). ARIA dialog
// pattern: Escape to close, focus the panel on open, restore focus on close, lock
// background scroll, and a real Tab focus-trap (WCAG 2.4.3).
function Drawer({ open, title, titleId, onClose, children }) {
  const panelRef = useRef(null);
  const prevFocus = useRef(null);

  useEffect(() => {
    if (!open) return;
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
        onClose();
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
  }, [open, onClose]);

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
          <h2 id={titleId} className="np-charttitle" style={{ fontSize: 22, margin: 0 }}>{title}</h2>
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
      <div className="np-card np-statcard">
        <span className="np-statlabel">PhD-level intelligence</span>
        <span className="np-statnum" style={{ color: "var(--math)" }}>
          {phdIndex(scores)}<span style={{ color: "var(--muted)", fontSize: 15 }}> / 100</span>
        </span>
      </div>
      <div className="np-card np-statcard">
        <span className="np-statlabel">Total points</span>
        <span className="np-statnum">
          {totalPoints(scores)}<span style={{ color: "var(--muted)", fontSize: 15 }}> / 300</span>
        </span>
      </div>
      <div className="np-card np-statcard">
        <span className="np-statlabel">Problems graded</span>
        <span className="np-statnum">{attempts}</span>
      </div>
    </div>
  );
}

// Per-subject score + band + a mini-bar and a practice shortcut.
function BySubject({ scores, onPractice }) {
  // Always exactly three rows → never overflows, so it stays a plain (non-scroll)
  // card (no cardbody/scrollbar-gutter).
  return (
    <div className="np-card np-dash-panel">
      <div className="np-charttitle" style={{ marginBottom: 12 }}>By subject</div>
      {ORDER.map((k) => (
        <div key={k} className="np-dash-subrow">
          <span style={{ color: SUBJECTS[k].color, fontFamily: "var(--mono)", width: 16 }}>{SUBJECTS[k].glyph}</span>
          <span className="np-dash-sublabel">{SUBJECTS[k].label}</span>
          <MiniBar value={scores[k]?.score || 0} color={SUBJECTS[k].color} />
          <span style={{ fontFamily: "var(--mono)", fontWeight: 700, width: 58, textAlign: "right" }}>
            {scores[k]?.score || 0}<span style={{ color: "var(--muted)" }}>/100</span>
          </span>
          <button className="np-ghost" onClick={() => onPractice && onPractice(k)} style={{ whiteSpace: "nowrap" }}>practice</button>
        </div>
      ))}
    </div>
  );
}

// Reasoning radar + a compact "what to work on" (weakest axis + weak concept) per
// profiled subject.
function RadarPanel({ scores, onPractice, onLearn, scrollRegion }) {
  const rubricSubjects = ORDER
    .filter((k) => scores && scores[k] && scores[k].rubric && typeof scores[k].rubric === "object")
    .map((k) => ({ key: k, label: SUBJECTS[k].label, color: SUBJECTS[k].color, rubric: scores[k].rubric }));

  return (
    <div className="np-card np-dash-radar">
      <div className="np-dash-cardhead">
        <div className="np-charttitle">Reasoning profile</div>
        <div className="np-chartsub" style={{ marginBottom: 0 }}>
          Where you reason well across the dimensions we grade — and where to focus next.
        </div>
      </div>
      {rubricSubjects.length >= 1 ? (
        <div className="np-dash-cardbody" tabIndex={scrollRegion ? 0 : undefined} role="region" aria-label="Reasoning profile detail">
          <RadarChart subjects={rubricSubjects} />
          <div className="np-dash-focus">
            {rubricSubjects.map((s) => {
              const lowKeys = lowestRubricDimensions(s.rubric, 1);
              const lowLabel = lowKeys.length ? RUBRIC_LABELS[lowKeys[0]] : null;
              const concept = (scores[s.key]?.weakConcepts || []).find((c) => typeof c === "string" && c.trim()) || null;
              return (
                <div key={s.key} className="np-dash-focusrow">
                  <span style={{ color: s.color, fontFamily: "var(--mono)", width: 16 }}>{SUBJECTS[s.key].glyph}</span>
                  <span className="np-statsub" style={{ flex: 1, minWidth: 0 }}>
                    {lowLabel ? (
                      <>Weakest: <strong style={{ color: "var(--text)" }}>{lowLabel}</strong>{concept ? <> — <em>{concept}</em></> : null}</>
                    ) : (
                      "Keep practicing to refine your profile."
                    )}
                  </span>
                  {concept ? (
                    <button className="np-ghost" onClick={() => onLearn && onLearn(s.key, concept)} style={{ whiteSpace: "nowrap" }}>Learn this</button>
                  ) : (
                    <button className="np-ghost" onClick={() => onPractice && onPractice(s.key)} style={{ whiteSpace: "nowrap" }}>practice</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="np-dash-cardbody"><p className="np-statsub">Finish the diagnostic to see your reasoning profile.</p></div>
      )}
    </div>
  );
}

// "Why your rank moved" — the most recent graded attempts with their persisted
// one-line rationale (trimmed for the always-visible grid).
function RecentMoves({ history, scrollRegion }) {
  // Newest first. The panel scrolls internally, so we keep a generous slice rather
  // than the old hard cap of 4 — the learner can scroll back through their history.
  const moves = history
    .filter((a) => a.type === "attempt" && typeof a.rationale === "string" && a.rationale.trim())
    .slice(-25)
    .reverse()
    .map((a) => ({ subject: a.subject, delta: Math.round(a.delta || 0), rationale: a.rationale }));

  return (
    <div className="np-card np-dash-panel">
      <div className="np-dash-cardhead">
        <div className="np-charttitle" style={{ marginBottom: 4 }}>Why your rank moved</div>
        <div className="np-chartsub" style={{ marginBottom: 0 }}>Your latest graded attempts, and why each gained or cost points.</div>
      </div>
      <div className="np-dash-cardbody" tabIndex={scrollRegion ? 0 : undefined} role="region" aria-label="Recent rank changes">
        {moves.length >= 1 ? (
          moves.map((m, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
              <span style={{ color: SUBJECTS[m.subject]?.color || "var(--muted)", fontFamily: "var(--mono)", width: 14 }}>
                {SUBJECTS[m.subject]?.glyph || "·"}
              </span>
              <span style={{
                fontFamily: "var(--mono)", fontWeight: 700, width: 40, textAlign: "right",
                color: m.delta > 0 ? "var(--phys)" : m.delta < 0 ? "var(--chem)" : "var(--muted)",
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

export default function Dashboard({
  user,
  scores,
  history = [],
  loadLeaderboard,
  loadReviews,
  onStartDiagnostic,
  onPractice,
  onLearn,
  onSignOut,
  onReset,
  onSignIn,
  onClose,
  onOverlayActiveChange,
}) {
  const [imgFailed, setImgFailed] = useState(false);
  // Which slide-over drawer is open: null | "charts" | "reviews".
  const [drawer, setDrawer] = useState(null);
  // ≥1024px (the panels scroll internally there) → mark the scroll regions focusable.
  const isWide = useIsWide();

  // Make the page background inert while a drawer is open (proper modal focus
  // containment). The guest gate does NOT inert the page — it's scoped to the
  // dashboard body so the nav stays usable for a guest who'd rather keep exploring.
  useEffect(() => {
    onOverlayActiveChange?.(drawer !== null);
  }, [drawer, onOverlayActiveChange]);
  useEffect(() => () => onOverlayActiveChange?.(false), [onOverlayActiveChange]);

  const meta = (user && user.user_metadata) || {};
  const name = meta.full_name || meta.name || (user && user.email) || "You";
  const avatar = meta.avatar_url || meta.picture || null;
  const email = user && user.email;
  const showAvatar = avatar && !imgFailed;

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
        <div className="np-dash-gatecard" role="dialog" aria-modal="false" aria-labelledby="np-gate-title">
          <div className="np-modal-spark" aria-hidden="true"><Icon name="lock" size={22} /></div>
          <h2 id="np-gate-title" className="np-h2" style={{ textAlign: "center", margin: "0 0 8px" }}>Sign in to see your Dashboard</h2>
          <p className="np-lede" style={{ textAlign: "center", margin: "0 auto 22px" }}>
            Your scores, reasoning profile, leaderboard rank, and answer history live here. Sign in to unlock your dashboard
            {scores ? " — your guest results carry over automatically." : "."}
          </p>
          <button className="np-btn np-primary np-big" style={{ width: "100%", justifyContent: "center" }} onClick={onSignIn}>
            <Icon name="google" size={16} /> Sign in
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
        <span className="np-dash-rankchip" title="Your overall rank">
          {rankFor(phdIndex(scores)).name}
        </span>
      )}
      <button className="np-ghost" onClick={onSignOut}>Sign out</button>
    </div>
  );

  if (!scores) {
    return (
      <div className="fade-up">
        {identity}
        <div className="np-card" style={{ textAlign: "center", padding: "36px 24px", marginTop: 16 }}>
          <h2 className="np-h2">Not ranked yet</h2>
          <p className="np-lede" style={{ margin: "0 auto 20px" }}>
            Prove what you know across nine problems (beginner, intermediate, and hard in each subject) to get your starting scores in math, physics, and chemistry.
          </p>
          <button className="np-btn np-primary np-big" onClick={onStartDiagnostic}>Prove it</button>
        </div>
      </div>
    );
  }

  // ---- Signed-in dashboard: the bento grid ----
  const linePoints = history.filter((h) => typeof h.totalAfter === "number").map((h) => h.totalAfter);
  const barItems = history
    .filter((h) => h.type === "attempt")
    .map((a) => ({ value: Math.round(a.delta || 0), glyph: SUBJECTS[a.subject]?.glyph || "·" }));

  return (
    <div className="fade-up np-dash-frame">
      <div className="np-dash">
        {identity}
        <KpiStats scores={scores} attempts={attempts} />
        <RadarPanel scores={scores} onPractice={onPractice} onLearn={onLearn} scrollRegion={isWide} />
        <div className="np-dash-mid">
          <BySubject scores={scores} onPractice={onPractice} />
          <RecentMoves history={history} scrollRegion={isWide} />
        </div>
        <div className="np-dash-lead">
          <Leaderboard loadLeaderboard={loadLeaderboard} scrollRegion={isWide} />
        </div>
        <div className="np-dash-actions">
          <button className="np-btn np-dash-actbtn" onClick={() => setDrawer("charts")}>
            See trends <Icon name="arrow" size={16} />
          </button>
          <button className="np-btn np-dash-actbtn" onClick={() => setDrawer("reviews")}>
            Review your answers <Icon name="arrow" size={16} />
          </button>
          <button
            className="np-btn np-dash-actbtn np-dash-actbtn--danger"
            style={{ marginLeft: "auto" }}
            onClick={() => {
              if (window.confirm("This permanently deletes all your scores and history. Continue?")) onReset && onReset();
            }}
          >
            Reset my progress
          </button>
        </div>
      </div>

      <Drawer open={drawer === "charts"} title="Your trends over time" titleId="np-drawer-charts" onClose={() => setDrawer(null)}>
        <div className="np-card np-chartcard">
          <div className="np-charttitle">Total points over time</div>
          <div className="np-chartsub">From your starting scores through every graded attempt.</div>
          {linePoints.length >= 2 ? (
            <LineChart values={linePoints} yMax={300} color="#F2B441" />
          ) : (
            <p className="np-statsub">Answer a practice problem to start the trend line.</p>
          )}
        </div>
        <div className="np-card np-chartcard">
          <div className="np-charttitle">Points gained and lost</div>
          <div className="np-chartsub">Each bar is one graded attempt — green when your reasoning earned points, coral when it cost them.</div>
          {barItems.length >= 1 ? (
            <BarChart items={barItems} />
          ) : (
            <p className="np-statsub">No graded attempts yet.</p>
          )}
        </div>
      </Drawer>

      <Drawer open={drawer === "reviews"} title="Review your answers" titleId="np-drawer-reviews" onClose={() => setDrawer(null)}>
        <ReviewList loadReviews={loadReviews} onPractice={onPractice} onLearn={onLearn} />
      </Drawer>
    </div>
  );
}
