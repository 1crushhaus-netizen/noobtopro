"use client";

import React, { useState, useEffect } from "react";
import { SUBJECTS, ORDER, RANKS } from "@/lib/scoring";

// Low→high NEUTRAL ramp for the 5 rank tiers (Elementary → Doctorate). Rank is not
// a subject and not a valence, so under the greyscale system the tiers carry no
// chromatic accent — subject colors appear only on the subject glyphs. The hexes
// are deliberately theme-stable mid-tone greys (a fill ramp that reads low→high on
// BOTH the true-black and the pure-white page); because the fills never change
// with the theme, each segment pairs a fixed count-text color below rather than
// var(--text-inverse) (which flips with the theme and would go illegible on one).
const TIER_COLORS = ["#5c5c5c", "#6e6e6e", "#828282", "#969696", "#ababab"];
// Per-segment count text: white on the two darkest fills, near-black on the three
// lightest — every pairing stays ≥4.5:1 in both themes (the fills are theme-stable).
const TIER_TEXT = ["#ffffff", "#ffffff", "#111111", "#111111", "#111111"];

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
      <div style={{ display: "flex", gap: 3, height: 26, borderRadius: "var(--radius-inset)", overflow: "hidden" }} role="img"
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
                // Full-opacity fills keep the fixed TIER_TEXT pairing legible in both
                // themes (opacity would blend the fill toward the page color); empty
                // tiers fade to a faint sliver (no text inside, so blending is fine).
                opacity: c > 0 ? 1 : 0.18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--mono)",
                fontSize: 11,
                fontWeight: 700,
                color: TIER_TEXT[i],
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
            {/* Plain ink emphasis — the mid-grey tier fills are bar colors, not text
                colors (the lowest greys fail contrast as text on the page). */}
            You're <strong style={{ color: "var(--text)" }}>{RANKS[youBand]}</strong>
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
            {/* Overall is cross-subject → no glyph and no subject color. */}
            <TierRow label="Overall" track={tiers.overall} />
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
