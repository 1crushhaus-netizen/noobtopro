"use client";

import React from "react";
import { contributionBreakdown, RUBRIC_MAX } from "@/lib/scoring";

// Typed-error taxonomy → badge label + color. Keys match the grader's error `type`
// (lib/gradeInput.js normalizeErrors allow-list); unknown → reasoning.
// Muted valence mapping: conceptual (serious) → danger; strategic/reasoning →
// "improve" gold; slips/communication (minor) → neutral grey. Inline style
// resolves the var() tokens, so both themes stay in lockstep.
export const ERROR_TYPES = {
  conceptual: { label: "Conceptual", color: "var(--danger)" },
  strategic: { label: "Strategic", color: "var(--math)" },
  reasoning: { label: "Reasoning", color: "var(--math)" },
  "execution-slip": { label: "Slip", color: "var(--muted)" },
  communication: { label: "Communication", color: "var(--muted)" },
};

export const hasReasoningError = (errors) =>
  Array.isArray(errors) && errors.some((e) => e && e.type === "reasoning");

/**
 * "Where your reasoning breaks" — the typed errors, ordered most-costly first. A reasoning
 * error LEADS with its Socratic question (the learner catches it themselves); slips and
 * conceptual errors state the fix directly. All text is React-escaped.
 */
export function ErrorList({ errors }) {
  if (!Array.isArray(errors) || errors.length === 0) return null;
  return (
    <ul className="np-errlist" aria-label="Issues found in your reasoning">
      {errors.map((e, i) => {
        const t = ERROR_TYPES[e.type] || ERROR_TYPES.reasoning;
        const socratic = e.type === "reasoning" && e.socraticPrompt;
        // P2-1: type + index is a more stable key than the bare index (the type
        // disambiguates rows that reorder when the error list is re-derived).
        return (
          <li key={`${e.type || "reasoning"}-${i}`} className="np-erritem">
            <span className="np-errbadge" style={{ borderColor: t.color, color: t.color }}>{t.label}</span>
            <div className="np-errbody">
              {socratic ? (
                <>
                  {e.message && <div className="np-errwhat">{e.message}</div>}
                  <div className="np-socratictext" style={{ marginTop: e.message ? 6 : 0 }}>{e.socraticPrompt}</div>
                </>
              ) : (
                <div className="np-errwhat">{e.message || e.what}</div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// A 0–RUBRIC_MAX segmented bar (mirrors Noobtopro's SegBar; small so the breakdown table
// stays compact).
function Seg({ value, color }) {
  return (
    <div style={{ display: "flex", gap: 3 }} aria-hidden="true">
      {Array.from({ length: RUBRIC_MAX }, (_, i) => (
        <div
          key={i}
          style={{ height: 6, flex: 1, minWidth: 8, borderRadius: 2, background: i < value ? color : "var(--tint-2)" }}
        />
      ))}
    </div>
  );
}

/**
 * "How this score is computed" — the legible per-axis breakdown. Each reasoning axis shows
 * its 0–RUBRIC_MAX value, its weight, and the POINTS it contributes; the contributions add
 * up (modulo ≤1 rounding) to the headline reasoning score. There is no hidden factor — the
 * number is a transparent weighted mean of the bars (lib/scoring.js scoreFromRubric).
 */
export default function ScoreBreakdown({ rubric, total, color = "var(--math)", open = false }) {
  const { items, total: computed } = contributionBreakdown(rubric);
  const headline = typeof total === "number" ? total : computed;
  return (
    <details className="np-card np-scorebreak" open={open}>
      <summary className="np-cardicon" style={{ cursor: "pointer" }}>How this score is computed</summary>
      <div role="table" aria-label={`Per-axis score breakdown, total ${headline} of 100`} style={{ marginTop: 10 }}>
        <div role="row" className="np-brkrow np-brkhead">
          <span role="columnheader" className="np-brklabel">Reasoning axis</span>
          <span role="columnheader" className="np-brkbar">Score</span>
          <span role="columnheader" className="np-brkw">weight</span>
          <span role="columnheader" className="np-brkpts">points</span>
        </div>
        {items.map((it) => (
          <div role="row" key={it.key} className="np-brkrow">
            <span role="cell" className="np-brklabel">{it.label}</span>
            <span role="cell" className="np-brkbar">
              <Seg value={it.value} color={color} />
              <span className="np-sronly">{it.value} out of {RUBRIC_MAX}</span>
            </span>
            <span role="cell" className="np-brkw">×{it.weight}</span>
            <span role="cell" className="np-brkpts">{it.points}</span>
          </div>
        ))}
        <div role="row" className="np-brkrow np-brktotal">
          <span role="cell" className="np-brklabel" style={{ fontWeight: 700 }}>Reasoning score</span>
          <span role="cell" className="np-brkbar" />
          <span role="cell" className="np-brkw" />
          <span role="cell" className="np-brkpts" style={{ color, fontWeight: 700 }}>{headline}</span>
        </div>
      </div>
    </details>
  );
}
