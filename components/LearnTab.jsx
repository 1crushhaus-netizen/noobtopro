"use client";

import React from "react";
import { SUBJECTS, ORDER } from "@/lib/scoring";
import { RANKS, RANK_LABELS, conceptsFor, isRankWip, WIP_RANKS_NOTE } from "@/lib/curriculum";
import { SubjectGlyph } from "@/components/ui";

// The Learn tab is the fixed concept CURRICULUM (lib/curriculum.js), organized by
// SUBJECT → RANK. Concepts are listed as NON-interactive chips: the curated curriculum
// replaced the old per-user generated concepts, so nothing here is generated on demand —
// it's a display-only reference for now. Empty ranks (Doctorate) are greyed with a note.
export default function LearnTab() {
  return (
    <div className="fade-up">
      <h2 className="np-h2">Learn</h2>
      <p className="np-lede" style={{ marginBottom: 20 }}>
        The full concept curriculum, organized by subject and rank — from Elementary up to Doctorate.
      </p>

      {ORDER.map((subject) => {
        const color = SUBJECTS[subject].color;
        return (
          <div key={subject} className="np-card" style={{ marginBottom: 16 }}>
            <div className="np-learngrouphead">
              <SubjectGlyph subject={subject} />
              <span>{SUBJECTS[subject].label}</span>
            </div>

            {RANKS.map((rank) => (
              <div key={rank} className="np-learngroup">
                <div className="np-hub-topiclabel" style={{ color }}>{RANK_LABELS[rank]}</div>
                {isRankWip(subject, rank) ? (
                  <p className="np-hint" style={{ margin: "2px 0 0", fontStyle: "italic" }}>{WIP_RANKS_NOTE}</p>
                ) : (
                  <div className="np-weaktags">
                    {conceptsFor(subject, rank).map((c) => (
                      <span key={c.key} className="np-concepttag np-concepttag--static" title={c.strand}>
                        {c.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
