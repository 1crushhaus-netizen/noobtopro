"use client";

import React from "react";
import {
  SUBJECTS,
  ORDER,
  totalPoints,
  phdIndex,
  band,
  RUBRIC_KEYS,
  RUBRIC_LABELS,
  RUBRIC_MAX,
  lowestRubricDimensions,
} from "@/lib/scoring";

/* ---- tiny SVG charting (no dependencies) ---- */

function LineChart({ values, yMax = 300, color = "#F2B441" }) {
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
          <text x={padL - 8} y={y(g)} dominantBaseline="central" textAnchor="end" fill="#5a6472" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
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

function BarChart({ items }) {
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
            <text x={cx} y={H - 8} textAnchor="middle" fill="#5a6472" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
              {d.glyph}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function MiniBar({ value, color }) {
  return (
    <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,.08)", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: "100%", background: color, transition: "width .6s ease" }} />
    </div>
  );
}

// Hand-rolled inline-SVG radar/spider chart (no dependency, matching the other
// charts above). Axes = the 5 rubric dimensions (0–RUBRIC_MAX); ONE polygon per
// subject so the learner compares their reasoning profile across subjects.
function RadarChart({ subjects }) {
  const W = 600, H = 360;
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
      aria-label={`Reasoning profile across the five rubric dimensions, scored 0 to ${RUBRIC_MAX}, for ${subjects
        .map((s) => s.label)
        .join(", ")}. ${summary}.`}
    >
      {[1, 2, 3, 4].map((lvl) => (
        <polygon key={lvl} points={ringPolygon(lvl / RUBRIC_MAX)} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="1" />
      ))}
      {axes.map((k, i) => {
        const [ex, ey] = coord(i, 1);
        const [lx, ly] = coord(i, 1.2);
        const anchor = Math.abs(lx - cx) < 6 ? "middle" : lx > cx ? "start" : "end";
        return (
          <g key={k}>
            <line x1={cx} y1={cy} x2={ex} y2={ey} stroke="rgba(255,255,255,.10)" strokeWidth="1" />
            <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="central" fill="#7a8494" style={{ fontFamily: "var(--ui)", fontSize: 11 }}>
              {RUBRIC_LABELS[k]}
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

/* ---- dashboard ---- */
export default function ProgressDashboard({ scores, history = [], onPractice, onLearn }) {
  const total = totalPoints(scores);
  const phd = phdIndex(scores);
  const attempts = history.filter((h) => h.type === "attempt");
  const linePoints = history.filter((h) => typeof h.totalAfter === "number").map((h) => h.totalAfter);

  const barItems = attempts.map((a) => ({
    value: Math.round(a.delta || 0),
    glyph: SUBJECTS[a.subject]?.glyph || "·",
  }));

  // Subjects that have a rubric profile (set once the diagnostic/first attempt is
  // graded) — drives the radar chart and the "what to work on" guidance.
  const rubricSubjects = ORDER
    .filter((k) => scores && scores[k] && scores[k].rubric && typeof scores[k].rubric === "object")
    .map((k) => ({ key: k, label: SUBJECTS[k].label, color: SUBJECTS[k].color, rubric: scores[k].rubric }));

  return (
    <div className="fade-up">
      <h2 className="np-h2">Your progress</h2>
      <p className="np-lede" style={{ marginBottom: 22 }}>
        Points come from the quality of your reasoning over time. "PhD-level intelligence" is your overall progress toward
        mastery across all three subjects.
      </p>

      <div className="np-stats">
        <div className="np-card np-statcard">
          <span className="np-statlabel">Total points</span>
          <span className="np-statnum">{total}<span style={{ color: "var(--muted)", fontSize: 18 }}> / 300</span></span>
          <span className="np-statsub">summed across all three subjects</span>
        </div>
        <div className="np-card np-statcard">
          <span className="np-statlabel">PhD-level intelligence</span>
          <span className="np-statnum" style={{ color: "#F2B441" }}>{phd}<span style={{ color: "var(--muted)", fontSize: 18 }}> / 100</span></span>
          <span className="np-statsub">{band(phd)} overall</span>
        </div>
        <div className="np-card np-statcard">
          <span className="np-statlabel">Problems graded</span>
          <span className="np-statnum">{attempts.length}</span>
          <span className="np-statsub">reasoning attempts coached</span>
        </div>
      </div>

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

      <div className="np-card np-chartcard">
        <div className="np-charttitle">Reasoning profile</div>
        <div className="np-chartsub">
          How your reasoning scores across the five dimensions we grade (0–{RUBRIC_MAX}), per subject. The shape shows where
          you reason well — and where to focus next.
        </div>
        {rubricSubjects.length >= 1 ? (
          <>
            <RadarChart subjects={rubricSubjects} />
            <div style={{ marginTop: 14 }}>
              <div className="np-charttitle" style={{ fontSize: 14, marginBottom: 10 }}>What to work on</div>
              {rubricSubjects.map((s) => {
                const lowKeys = lowestRubricDimensions(s.rubric, 1);
                const lowLabel = lowKeys.length ? RUBRIC_LABELS[lowKeys[0]] : null;
                const concept = (scores[s.key]?.weakConcepts || []).find((c) => typeof c === "string" && c.trim()) || null;
                return (
                  <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                    <span style={{ color: s.color, fontFamily: "var(--mono)", width: 18 }}>{SUBJECTS[s.key].glyph}</span>
                    <span style={{ fontSize: 14, minWidth: 92 }}>{s.label}</span>
                    <span className="np-statsub" style={{ flex: 1, minWidth: 170 }}>
                      {lowLabel ? (
                        <>
                          Weakest dimension: <strong style={{ color: "var(--text)" }}>{lowLabel}</strong>
                          {concept ? <> — work on <em>{concept}</em></> : null}
                        </>
                      ) : (
                        "Keep practicing to refine your profile."
                      )}
                    </span>
                    {concept ? (
                      <button className="np-ghost" onClick={() => onLearn && onLearn(s.key, concept)} style={{ whiteSpace: "nowrap" }}>
                        Learn this
                      </button>
                    ) : (
                      <button className="np-ghost" onClick={() => onPractice && onPractice(s.key)} style={{ whiteSpace: "nowrap" }}>
                        practice
                      </button>
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

      <div className="np-card">
        <div className="np-charttitle" style={{ marginBottom: 14 }}>By subject</div>
        {ORDER.map((k) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span style={{ color: SUBJECTS[k].color, fontFamily: "var(--mono)", width: 18 }}>{SUBJECTS[k].glyph}</span>
            <span style={{ width: 92, fontSize: 14 }}>{SUBJECTS[k].label}</span>
            <MiniBar value={scores[k]?.score || 0} color={SUBJECTS[k].color} />
            <span style={{ fontFamily: "var(--mono)", fontWeight: 700, width: 64, textAlign: "right" }}>
              {scores[k]?.score || 0}<span style={{ color: "var(--muted)" }}>/100</span>
            </span>
            <button className="np-ghost" onClick={() => onPractice && onPractice(k)} style={{ whiteSpace: "nowrap" }}>practice</button>
          </div>
        ))}
      </div>
    </div>
  );
}
