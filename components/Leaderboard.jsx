"use client";

import React, { useState, useEffect } from "react";
import { SUBJECTS, ORDER, RANKS } from "@/lib/scoring";
import { RankDistribution } from "@/components/charts";

// The anonymous-tiers leaderboard, drawn as ONE overlaid rank-distribution chart:
// a smoothed curve per track (Overall in neutral ink + the three subjects in their
// accent colors) across the five ranks, with a dot marking the caller's own rank
// on each curve. NO identities — only counts + the caller's own position.
// Lazy-loads its data via the JWT-attaching loadLeaderboard() (→ /api/leaderboard).
// Self-contained (its own fetch + cancellation guard) so the Dashboard can drop it
// straight into the grid.

// Track styling: Overall is cross-subject → neutral ink; subjects keep their
// identity accents. Colors flow through `style` in the chart, so vars are fine.
const TRACK_DEFS = [
  { key: "overall", label: "Overall", color: "var(--text)", glyph: null },
  ...ORDER.map((k) => ({ key: k, label: SUBJECTS[k].label, color: SUBJECTS[k].color, glyph: SUBJECTS[k].glyph })),
];

export default function Leaderboard({ loadLeaderboard }) {
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

  const tracks = tiers
    ? TRACK_DEFS.filter((d) => tiers[d.key] && Array.isArray(tiers[d.key].counts)).map((d) => ({
        ...d,
        counts: tiers[d.key].counts,
        you: tiers[d.key].you || null,
      }))
    : [];

  // One placement caption (the per-curve dots carry the rest): the caller's
  // overall rank + percentile among everyone ranked.
  const overall = tiers && tiers.overall;
  const you = overall && overall.you;
  const total = overall ? Number(overall.total) || 0 : 0;
  const youBand = you && Number.isInteger(you.band) ? you.band : null;
  // FIX 8: an UNVERIFIED caller (a freshly-migrated guest score) gets a PROVISIONAL
  // placement — no real rank/percentile until N=5 server-graded attempts are earned.
  const provisional = !!(you && you.provisional);
  const gradedNeeded = provisional ? Math.max(0, Number(you.needed) || 0) : 0;
  // A real percentile only exists for a VERIFIED caller (the server omits `above` when provisional).
  const topPct = you && !provisional && total >= 2 && Number.isFinite(Number(you.above))
    ? Math.max(1, Math.round(((you.above + 1) / total) * 100))
    : null;

  return (
    <div className="np-card">
      <div className="np-dash-cardhead">
        <div className="np-charttitle" style={{ marginBottom: 6 }}>Leaderboard</div>
        <div className="np-chartsub" style={{ marginBottom: 0 }}>
          How everyone ranked is distributed across the five ranks, anonymous by design. The dot on each curve is you.
        </div>
      </div>
      <div className="np-dash-cardbody" role="region" aria-label="Leaderboard rankings">
        {loading ? (
          <p className="np-statsub" role="status" aria-live="polite">Loading the leaderboard…</p>
        ) : error ? (
          <p className="np-statsub">{error}</p>
        ) : tracks.length > 0 ? (
          <>
            {/* A11y P2-11: the legend is the on-screen color→track key (the curves are
                otherwise distinguished only by color), so it is NOT aria-hidden — its
                labels are useful to AT and color-blind users alike. The color swatch is
                decorative (the track label text carries the meaning). */}
            <div className="np-legend" aria-label="Chart color key">
              {tracks.map((t) => (
                <span key={t.key} className="np-legend-item">
                  <span className="np-legend-swatch" style={{ background: t.color }} aria-hidden="true" />
                  {t.glyph ? <span style={{ color: t.color, fontFamily: "var(--mono)" }} aria-hidden="true">{t.glyph}</span> : null}
                  {t.label}
                </span>
              ))}
            </div>
            <RankDistribution tracks={tracks} rankLabels={RANKS} />
            <div className="np-statsub" style={{ marginTop: 8 }}>
              {provisional ? (
                // FIX 8: a migrated guest score is shown but UNRANKED until verified.
                <>
                  Your placement is <strong style={{ color: "var(--text)" }}>provisional</strong>. Complete{" "}
                  {gradedNeeded > 0 ? <>{gradedNeeded} more graded {gradedNeeded === 1 ? "attempt" : "attempts"}</> : "a few graded attempts"}{" "}
                  to join the leaderboard.
                </>
              ) : youBand != null ? (
                <>
                  You're <strong style={{ color: "var(--text)" }}>{RANKS[youBand]}</strong> overall
                  {topPct != null ? <>, top {topPct}%</> : null} of {total} ranked
                </>
              ) : (
                "Complete the diagnostic to take your place."
              )}
            </div>
          </>
        ) : (
          <p className="np-statsub">No ranked learners yet. Be the first.</p>
        )}
      </div>
    </div>
  );
}
