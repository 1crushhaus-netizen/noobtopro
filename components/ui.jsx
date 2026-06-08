"use client";

import React from "react";
import { SUBJECTS } from "@/lib/scoring";

/* ------------------------------- shared UI atoms -------------------------------
   Small presentational helpers shared across the tabs so the same concept renders
   identically everywhere (a subject's identity glyph; the gain/loss delta color). */

/* The subject identity mark (∑ math · ∂ physics · ⌬ chemistry). Always monospace
   (so the three align) and tinted with the subject's color; `size` overrides the
   font-size in px. Replaces the ~16 ad-hoc inline glyph spans that variously omitted
   the mono font or forced different sizes. */
export function SubjectGlyph({ subject, size, width }) {
  const s = SUBJECTS[subject];
  const style = { color: s ? s.color : "var(--muted)" };
  if (size) style.fontSize = size;
  // A fixed width aligns the glyph column when it's a flex item (e.g. dashboard rows).
  if (width) style.width = width;
  return <span className="np-subjectglyph" style={style}>{s ? s.glyph : "·"}</span>;
}

/* One source of truth for delta valence: a gain is teal (--phys), a loss is the
   semantic danger coral (--danger), no change is muted. Returns a CSS color string
   for use in an inline style on an HTML element. */
export function deltaColor(delta) {
  if (typeof delta !== "number" || delta === 0) return "var(--muted)";
  return delta > 0 ? "var(--phys)" : "var(--danger)";
}
