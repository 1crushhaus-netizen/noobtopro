"use client";

import React from "react";
import { RUBRIC_KEYS, RUBRIC_LABELS, RUBRIC_SHORT, RUBRIC_MAX } from "@/lib/scoring";

/* ----------------------------------------------------------------------------
   Dependency-free inline-SVG charting shared by the Dashboard grid (radar +
   mini-bars, always visible) and the "See trends" drawer (line + bar). Extracted
   verbatim from the former ProgressDashboard so both surfaces reuse one set of
   primitives. Each chart carries a data-encoding aria-label (the SVG is otherwise
   decorative for screen-reader users).
---------------------------------------------------------------------------- */

export function LineChart({ values, yMax = 300, color = "#F2B441" }) {
  const W = 620, H = 200, padL = 36, padR = 14, padT = 16, padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = values.length;
  const x = (i) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v) => padT + innerH * (1 - Math.max(0, Math.min(yMax, v)) / yMax);
  const pts = values.map((v, i) => ({ x: x(i), y: y(v) }));
  const line = pts.map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");
  const area = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;
  const grid = [0, yMax / 3, (2 * yMax) / 3, yMax];

  return (
    <svg
      className="np-chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Total points over time across ${values.length} graded points, ending at ${values[values.length - 1]} of ${yMax}.`}
    >
      {grid.map((g, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,.07)" strokeWidth="1" />
          <text x={padL - 8} y={y(g)} dominantBaseline="central" textAnchor="end" fill="var(--muted)" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
            {Math.round(g)}
          </text>
        </g>
      ))}
      <path d={area} fill={color} opacity="0.12" />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="var(--bg)" stroke={color} strokeWidth="2" />
      ))}
    </svg>
  );
}

export function BarChart({ items }) {
  const W = 620, H = 200, padL = 36, padR = 14, padT = 16, padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const vals = items.map((d) => d.value);
  const maxV = Math.max(1, ...vals, 0);
  const minV = Math.min(-1, ...vals, 0);
  const span = maxV - minV;
  const y = (v) => padT + innerH * (1 - (v - minV) / span);
  const zeroY = y(0);
  const n = items.length;
  const slot = innerW / n;
  const bw = Math.min(46, slot * 0.6);

  return (
    <svg
      className="np-chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Points gained or lost across ${items.length} graded attempts.`}
    >
      <line x1={padL} x2={W - padR} y1={zeroY} y2={zeroY} stroke="rgba(255,255,255,.18)" strokeWidth="1" />
      {items.map((d, i) => {
        const cx = padL + slot * (i + 0.5);
        const top = d.value >= 0 ? y(d.value) : zeroY;
        const h = Math.max(2, Math.abs(zeroY - y(d.value)));
        const fill = d.value >= 0 ? "#5BD6C4" : "#FF7E74";
        return (
          <g key={i}>
            <rect x={cx - bw / 2} y={top} width={bw} height={h} rx="3" fill={fill} opacity="0.9" />
            <text x={cx} y={d.value >= 0 ? top - 6 : top + h + 13} textAnchor="middle" fill={fill} style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700 }}>
              {d.value > 0 ? "+" : ""}{d.value}
            </text>
            <text x={cx} y={H - 8} textAnchor="middle" fill="var(--muted)" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
              {d.glyph}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function MiniBar({ value, color }) {
  return (
    <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,.08)", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: "100%", background: color, transition: "width .6s ease" }} />
    </div>
  );
}

// Hand-rolled inline-SVG radar/spider chart (no dependency, matching the other
// charts above). Axes = the 9 rubric dimensions (0–RUBRIC_MAX); ONE polygon per
// subject so the learner compares their reasoning profile across subjects.
export function RadarChart({ subjects }) {
  // Sized for the 9 reasoning axes — a touch more room so the diagonal spoke labels
  // (abbreviated via RUBRIC_SHORT) don't collide.
  const W = 640, H = 400;
  const cx = W / 2, cy = H / 2 + 4, R = 108;
  const axes = RUBRIC_KEYS;
  const N = axes.length;
  const angleFor = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / N; // first axis at the top
  const coord = (i, frac) => {
    const r = R * Math.max(0, Math.min(1, frac));
    return [cx + r * Math.cos(angleFor(i)), cy + r * Math.sin(angleFor(i))];
  };
  const ringPolygon = (frac) => axes.map((_, i) => coord(i, frac).map((n) => n.toFixed(1)).join(",")).join(" ");
  const dimVal = (rubric, k) => {
    const v = Number(rubric ? rubric[k] : 0);
    return Number.isFinite(v) ? Math.max(0, Math.min(RUBRIC_MAX, v)) : 0;
  };
  const round1 = (n) => Math.round(n * 10) / 10;

  // Accessible summary: each subject's per-dimension values (the chart is decorative
  // without this text equivalent).
  const summary = subjects
    .map((s) => `${s.label} — ${axes.map((k) => `${RUBRIC_LABELS[k]} ${round1(dimVal(s.rubric, k))}`).join(", ")}`)
    .join("; ");

  return (
    <svg
      className="np-chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Reasoning profile across the ${axes.length} rubric dimensions, scored 0 to ${RUBRIC_MAX}, for ${subjects
        .map((s) => s.label)
        .join(", ")}. ${summary}.`}
    >
      {[1, 2, 3, 4].map((lvl) => (
        <polygon key={lvl} points={ringPolygon(lvl / RUBRIC_MAX)} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="1" />
      ))}
      {axes.map((k, i) => {
        const [ex, ey] = coord(i, 1);
        const [lx, ly] = coord(i, 1.26);
        const anchor = Math.abs(lx - cx) < 6 ? "middle" : lx > cx ? "start" : "end";
        return (
          <g key={k}>
            <line x1={cx} y1={cy} x2={ex} y2={ey} stroke="rgba(255,255,255,.10)" strokeWidth="1" />
            {/* Abbreviated spoke label (full names live in the breakdown panel + the
                accessible text summary below), so 9 axes stay legible. */}
            <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="central" fill="#7a8494" style={{ fontFamily: "var(--ui)", fontSize: 10 }}>
              {RUBRIC_SHORT[k] || RUBRIC_LABELS[k]}
            </text>
          </g>
        );
      })}
      {subjects.map((s) => {
        const pts = axes.map((k, i) => coord(i, dimVal(s.rubric, k) / RUBRIC_MAX).map((n) => n.toFixed(1)).join(",")).join(" ");
        return (
          <g key={s.key}>
            <polygon points={pts} fill={s.color} fillOpacity="0.12" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
            {axes.map((k, i) => {
              const [px, py] = coord(i, dimVal(s.rubric, k) / RUBRIC_MAX);
              return <circle key={k} cx={px} cy={py} r="2.5" fill={s.color} />;
            })}
          </g>
        );
      })}
    </svg>
  );
}
