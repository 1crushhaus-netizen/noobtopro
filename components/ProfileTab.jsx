"use client";

import React, { useState, useEffect } from "react";
import { SUBJECTS, ORDER, band, rankFor, RANKS, totalPoints, phdIndex } from "@/lib/scoring";

// Cohesive low→high colour ramp for the 5 rank tiers (Absolute beginner → PhD-level).
const TIER_COLORS = ["#5a6472", "#7a8494", "#5BD6C4", "#F2B441", "#FF7E74"];

// One track's anonymous tier distribution: a 5-segment bar (segment width ∝ how many
// ranked learners sit in that rank) with the caller's own tier outlined, plus a caption
// placing the caller. NO identities — only counts + the caller's own position.
function TierRow({ label, glyph, color, track }) {
  if (!track) return null;
  const counts = Array.isArray(track.counts) ? track.counts : [0, 0, 0, 0, 0];
  const total = Number(track.total) || 0;
  const you = track.you || null;
  const youBand = you && Number.isInteger(you.band) ? you.band : null;
  // "Top X%": the caller is at position (above + 1) from the top of `total` ranked.
  const topPct = you && total >= 2 ? Math.max(1, Math.round(((you.above + 1) / total) * 100)) : null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        {glyph && <span style={{ color, fontFamily: "var(--mono)", width: 16 }}>{glyph}</span>}
        <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
        <span className="np-statsub" style={{ marginLeft: "auto" }}>
          {total} ranked
        </span>
      </div>
      <div style={{ display: "flex", gap: 3, height: 26, borderRadius: 6, overflow: "hidden" }} role="img"
        aria-label={`${label} rank distribution: ${RANKS.map((n, i) => `${counts[i] || 0} ${n}`).join(", ")}.${you ? ` You are ${RANKS[youBand]}.` : ""}`}>
        {RANKS.map((name, i) => {
          const c = counts[i] || 0;
          const isYou = youBand === i;
          // Min flex so empty tiers still show a sliver; non-empty scale with count.
          const flex = c > 0 ? c * 6 + 4 : 1;
          return (
            <div
              key={name}
              title={`${name}: ${c}`}
              style={{
                flex,
                background: TIER_COLORS[i],
                opacity: c > 0 ? 0.9 : 0.18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--mono)",
                fontSize: 11,
                fontWeight: 700,
                color: "#0a0d13",
                outline: isYou ? "2px solid var(--text)" : "none",
                outlineOffset: -2,
              }}
            >
              {c > 0 ? c : ""}
            </div>
          );
        })}
      </div>
      <div className="np-statsub" style={{ marginTop: 5 }}>
        {you ? (
          <>
            You're <strong style={{ color: TIER_COLORS[youBand] }}>{RANKS[youBand]}</strong>
            {topPct != null ? <> — top {topPct}%</> : null}
          </>
        ) : (
          "Complete the diagnostic to take your place."
        )}
      </div>
    </div>
  );
}

// The anonymous-tiers leaderboard. Lazy-loads its data via the JWT-attaching
// loadLeaderboard() (→ /api/leaderboard). Shows overall + per-subject distributions.
function Leaderboard({ loadLeaderboard }) {
  const [tiers, setTiers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (typeof loadLeaderboard !== "function") {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    loadLeaderboard()
      .then((res) => {
        if (cancelled) return;
        if (res && res.tiers) setTiers(res.tiers);
        else setError("Couldn't load the leaderboard.");
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the leaderboard.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadLeaderboard]);

  return (
    <div className="np-card">
      <div className="np-charttitle" style={{ marginBottom: 6 }}>Leaderboard</div>
      <div className="np-chartsub" style={{ marginBottom: 14 }}>
        Where you stand against every ranked learner — anonymous by design: just how many sit at each rank, and your own place.
      </div>
      {loading ? (
        <p className="np-statsub" role="status" aria-live="polite">Loading the leaderboard…</p>
      ) : error ? (
        <p className="np-statsub">{error}</p>
      ) : tiers ? (
        <>
          <TierRow label="Overall" color="var(--math)" track={tiers.overall} />
          {ORDER.map((k) => (
            <TierRow key={k} label={SUBJECTS[k].label} glyph={SUBJECTS[k].glyph} color={SUBJECTS[k].color} track={tiers[k]} />
          ))}
        </>
      ) : (
        <p className="np-statsub">No ranked learners yet — be the first.</p>
      )}
    </div>
  );
}

/**
 * Profile for a signed-in user: identity, diagnostic status (with an empty
 * state if they haven't tested yet), a stats summary, the anonymous-tiers
 * leaderboard, and account actions.
 */
export default function ProfileTab({
  user,
  scores,
  history = [],
  loadLeaderboard,
  onStartDiagnostic,
  onPractice,
  onSignOut,
  onReset,
  onViewProgress,
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const meta = (user && user.user_metadata) || {};
  const name = meta.full_name || meta.name || (user && user.email) || "You";
  const avatar = meta.avatar_url || meta.picture || null;
  const email = user && user.email;
  const completed = Boolean(scores);
  const attempts = (history || []).filter((h) => h.type === "attempt").length;
  const showAvatar = avatar && !imgFailed;

  return (
    <div className="fade-up">
      <div className="np-card np-profilehead">
        {showAvatar ? (
          <img className="np-avatar" src={avatar} alt="" referrerPolicy="no-referrer" onError={() => setImgFailed(true)} />
        ) : (
          <div className="np-avatar np-avatarfallback">{String(name).charAt(0).toUpperCase()}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="np-profilename">{name}</div>
          {email && <div className="np-profileemail">{email}</div>}
        </div>
        <button className="np-ghost" onClick={onSignOut}>Sign out</button>
      </div>

      {!completed ? (
        <div className="np-card" style={{ textAlign: "center", padding: "36px 24px" }}>
          <h2 className="np-h2">Not ranked yet</h2>
          <p className="np-lede" style={{ margin: "0 auto 20px" }}>
            Prove what you know across six problems (an easy and a hard one per subject) to get your starting scores in math, physics, and chemistry.
          </p>
          <button className="np-btn np-primary np-big" onClick={onStartDiagnostic}>Prove it</button>
        </div>
      ) : (
        <>
          <div className="np-stats">
            <div className="np-card np-statcard">
              <span className="np-statlabel">PhD-level intelligence</span>
              <span className="np-statnum" style={{ color: "var(--math)" }}>
                {phdIndex(scores)}<span style={{ color: "var(--muted)", fontSize: 18 }}> / 100</span>
              </span>
              <span className="np-statsub">Rank: <strong style={{ color: "var(--text)" }}>{rankFor(phdIndex(scores)).name}</strong></span>
            </div>
            <div className="np-card np-statcard">
              <span className="np-statlabel">Total points</span>
              <span className="np-statnum">
                {totalPoints(scores)}<span style={{ color: "var(--muted)", fontSize: 18 }}> / 300</span>
              </span>
              <span className="np-statsub">across all three subjects</span>
            </div>
            <div className="np-card np-statcard">
              <span className="np-statlabel">Problems graded</span>
              <span className="np-statnum">{attempts}</span>
              <span className="np-statsub">practice attempts</span>
            </div>
          </div>

          <div className="np-card">
            <div className="np-charttitle" style={{ marginBottom: 14 }}>By subject</div>
            {ORDER.map((k) => {
              const sc = scores[k]?.score ?? 0;
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <span style={{ color: SUBJECTS[k].color, fontFamily: "var(--mono)", width: 18 }}>{SUBJECTS[k].glyph}</span>
                  <span style={{ width: 92, fontSize: 14 }}>{SUBJECTS[k].label}</span>
                  <span style={{ fontFamily: "var(--mono)", fontWeight: 700, width: 64 }}>
                    {sc}<span style={{ color: "var(--muted)" }}>/100</span>
                  </span>
                  <span className="np-bandtag" style={{ color: SUBJECTS[k].color }}>{band(sc)}</span>
                  <button className="np-ghost" style={{ marginLeft: "auto" }} onClick={() => onPractice && onPractice(k)}>
                    practice
                  </button>
                </div>
              );
            })}
          </div>

          <Leaderboard loadLeaderboard={loadLeaderboard} />

          <div className="np-feedactions">
            <button className="np-ghost" onClick={onViewProgress}>See progress over time</button>
            <button
              className="np-ghost"
              style={{ color: "var(--chem)" }}
              onClick={() => {
                if (window.confirm("This permanently deletes all your scores and history. Continue?")) onReset();
              }}
            >
              Reset my progress
            </button>
          </div>
        </>
      )}
    </div>
  );
}
