"use client";

import React, { useState, useEffect } from "react";
import { SUBJECTS, ORDER, RANKS } from "@/lib/scoring";

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
// Self-contained (its own fetch + cancellation guard) so the Dashboard can drop it
// straight into the grid.
export default function Leaderboard({ loadLeaderboard, scrollRegion }) {
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
      <div className="np-dash-cardhead">
        <div className="np-charttitle" style={{ marginBottom: 6 }}>Leaderboard</div>
        <div className="np-chartsub" style={{ marginBottom: 0 }}>
          Where you stand against every ranked learner — anonymous by design: just how many sit at each rank, and your own place.
        </div>
      </div>
      <div className="np-dash-cardbody" tabIndex={scrollRegion ? 0 : undefined} role="region" aria-label="Leaderboard rankings">
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
    </div>
  );
}
