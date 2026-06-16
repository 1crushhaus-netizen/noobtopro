// Shared social-card artwork (1200x630), rendered from code with next/og (Satori).
// Used by app/opengraph-image.js and app/twitter-image.js so the link-preview image
// that shows up in Discord / Slack / iMessage / X is generated to always match the
// brand — the dark surface, the wordmark, and the three subject accents from
// lib/scoring.js (#97804d math, #56897e physics, #9d685e chemistry).
//
// Typography matches the marketing landing: Geist Sans (the site's --display/--ui
// font), headline at weight 600 like .np-lp-h1. The geist npm package ships TTFs
// (Satori can't read the woff2 that next/font uses), so we load those at build —
// these image routes are statically generated, so the reads happen at build time.
//
// Satori (what next/og uses) only supports a flexbox subset of CSS: every element
// with more than one child must set display:flex; keep edits within that subset.
import React from "react";
import fs from "node:fs";
import path from "node:path";

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

// Read a Geist TTF straight from the installed package (always present — geist is
// a dependency — and resolved at build time for the static image route).
function geistFont(rel) {
  return fs.readFileSync(path.join(process.cwd(), "node_modules", "geist", "dist", "fonts", rel));
}

export function ogFonts() {
  return [
    { name: "Geist", data: geistFont("geist-sans/Geist-Regular.ttf"), weight: 400, style: "normal" },
    { name: "Geist", data: geistFont("geist-sans/Geist-SemiBold.ttf"), weight: 600, style: "normal" },
  ];
}

export function OgImage() {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#000000",
        color: "#ededed",
        fontFamily: "Geist",
      }}
    >
      {/* Top accent rail — full width (a flex child, so the parent padding can't
          clip it like an absolutely-positioned element did). */}
      <div style={{ width: "100%", height: 10, display: "flex", backgroundImage: STRIPE }} />

      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: "58px 80px 64px" }}>
        {/* Brand row: the noob->pro arrow mark + wordmark. */}
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
          <div style={{ display: "flex", fontSize: 36, fontWeight: 600, color: "#ededed", letterSpacing: "-0.01em" }}>noobtopro</div>
        </div>

        {/* Hero copy — headline matches .np-lp-h1 (Geist 600, tight tracking). */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 96, fontWeight: 600, color: "#ffffff", letterSpacing: "-0.035em", lineHeight: 1.04 }}>
            prove what you know
          </div>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 400, color: "#9b9b9b", lineHeight: 1.4, marginTop: 24, maxWidth: 960 }}>
            {"Real problems in math, physics & chemistry. Your reasoning is graded — not just the answer."}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 32 }}>
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
                <div style={{ display: "flex", fontSize: 26, fontWeight: 400, color: "#ededed" }}>{p.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer: a full-content-width spectrum rail (encompasses all three
            subjects), then the rank label + domain. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ width: "100%", height: 12, borderRadius: 999, display: "flex", backgroundImage: STRIPE }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 400, color: "#9b9b9b" }}>Ranked 0–350 · Elementary → Doctorate</div>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: "#ededed" }}>noobto.pro</div>
          </div>
        </div>
      </div>
    </div>
  );
}
