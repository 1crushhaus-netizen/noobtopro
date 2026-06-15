// Shared social-card artwork (1200x630), rendered from code with next/og (Satori).
// Used by app/opengraph-image.js and app/twitter-image.js so the link-preview image
// that shows up in Discord / Slack / iMessage / X is generated to always match the
// brand — the dark surface, the wordmark, and the three subject accents from
// lib/scoring.js (#97804d math, #56897e physics, #9d685e chemistry).
//
// Satori (what next/og uses) only supports a flexbox subset of CSS: every element
// with more than one child must set display:flex, and gradients/positioning are
// limited — keep edits within that subset or the build will fail.
import React from "react";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT =
  "noobtopro — prove what you know. Reasoning-graded problems in math, physics, and chemistry, ranked Elementary to Doctorate.";

const MATH = "#97804d";
const PHYS = "#56897e";
const CHEM = "#9d685e";
const STRIPE = `linear-gradient(90deg, ${MATH} 0%, ${PHYS} 50%, ${CHEM} 100%)`;

const PILLS = [
  { label: "Mathematics", color: MATH, soft: "rgba(151,128,77,0.16)" },
  { label: "Physics", color: PHYS, soft: "rgba(86,137,126,0.16)" },
  { label: "Chemistry", color: CHEM, soft: "rgba(157,104,94,0.16)" },
];

export function OgImage() {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#000000",
        padding: "76px 80px",
        position: "relative",
        fontFamily: "sans-serif",
      }}
    >
      {/* Top accent stripe — the three subject colors. */}
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 8, display: "flex", backgroundImage: STRIPE }} />

      {/* Brand row: the noob→pro arrow mark + wordmark. */}
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 72,
            height: 72,
            borderRadius: 18,
            backgroundColor: "#0e0e12",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
        >
          <svg width="44" height="44" viewBox="0 0 64 64">
            <path d="M15 32h31M34 19l13 13-13 13" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: "#ededed", letterSpacing: "-0.02em" }}>noobtopro</div>
      </div>

      {/* Hero copy. */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 94, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.035em", lineHeight: 1.02 }}>
          prove what you know
        </div>
        <div style={{ display: "flex", fontSize: 33, color: "#9b9b9b", lineHeight: 1.35, marginTop: 26, maxWidth: 950 }}>
          {"Real problems in math, physics & chemistry. Your reasoning is graded — not just the answer."}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 34 }}>
          {PILLS.map((p) => (
            <div
              key={p.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 22px",
                borderRadius: 999,
                border: `1px solid ${p.color}`,
                backgroundColor: p.soft,
              }}
            >
              <div style={{ display: "flex", width: 14, height: 14, borderRadius: 999, backgroundColor: p.color }} />
              <div style={{ display: "flex", fontSize: 26, color: "#ededed" }}>{p.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer: the 0–350 rank ladder + domain. */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", width: 560, height: 12, borderRadius: 999, backgroundImage: STRIPE }} />
          <div style={{ display: "flex", fontSize: 24, color: "#9b9b9b", letterSpacing: "0.01em" }}>Ranked 0–350 · Elementary → Doctorate</div>
        </div>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 600, color: "#ededed" }}>noobto.pro</div>
      </div>
    </div>
  );
}
