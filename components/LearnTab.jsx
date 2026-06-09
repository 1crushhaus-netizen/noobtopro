"use client";

import React, { useState } from "react";
import { SUBJECTS, ORDER } from "@/lib/scoring";
import { RANKS, RANK_LABELS, conceptsFor, isRankWip, WIP_RANKS_NOTE, rootsFor } from "@/lib/curriculum";
import { SubjectGlyph } from "@/components/ui";
import Icon from "@/components/Icon";

// The Learn tab is the fixed concept CURRICULUM (lib/curriculum.js), organized by
// SUBJECT → RANK. Concepts are clickable: opening one shows a dedicated CONCEPT PAGE
// whose "root concepts" (lower-rank prerequisites, from the curriculum graph) are
// themselves clickable, so the learning path is explicit and branched. The per-concept
// guide content + AI practice are added in later increments (see RANKS_PLAN §12).
export default function LearnTab() {
  // selected = the full concept object { subject, key, label, strand, rank } | null
  const [selected, setSelected] = useState(null);

  if (selected) {
    return <ConceptPage concept={selected} onOpen={setSelected} onBack={() => setSelected(null)} />;
  }
  return <CurriculumList onOpen={setSelected} />;
}

// ---- the curriculum listing (subject → rank → concept chips) ----
function CurriculumList({ onOpen }) {
  return (
    <div className="fade-up">
      <h2 className="np-h2">Learn</h2>
      <p className="np-lede" style={{ marginBottom: 20 }}>
        The full concept curriculum, organized by subject and rank — from Elementary up to Doctorate.
        Open any concept to see its foundations and (soon) a guide and practice.
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
                      <button
                        key={c.key}
                        type="button"
                        className="np-concepttag"
                        title={c.strand}
                        onClick={() => onOpen({ subject, rank, ...c })}
                      >
                        {c.label}
                      </button>
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

// ---- a single concept's page: title + root-concept navigation (+ guide placeholder) ----
function ConceptPage({ concept, onOpen, onBack }) {
  const { subject, key, label, rank } = concept;
  const color = SUBJECTS[subject] ? SUBJECTS[subject].color : "var(--text)";
  const roots = rootsFor(subject, key); // [{ key, label, strand, rank }]

  return (
    <div className="fade-up">
      <button className="np-ghost" style={{ marginBottom: 14 }} onClick={onBack}>
        <Icon name="back" size={15} /> Back to concepts
      </button>

      <div className="np-qmeta" style={{ marginBottom: 12 }}>
        <SubjectGlyph subject={subject} />
        <span className="np-metaline">
          {SUBJECTS[subject] && SUBJECTS[subject].label.toUpperCase()} · {(RANK_LABELS[rank] || "").toUpperCase()}
        </span>
      </div>

      <h2 className="np-h1" style={{ fontSize: "clamp(26px, 4vw, 38px)", color }}>{label}</h2>

      {/* Root concepts — the lower-rank foundations, each a link to its own page. */}
      {roots.length > 0 ? (
        <div className="np-card" style={{ marginBottom: 16 }}>
          <div className="np-cardicon" style={{ color }}>Root concepts — understand these first</div>
          <div className="np-weaktags" style={{ marginTop: 8 }}>
            {roots.map((r) => (
              <button
                key={r.key}
                type="button"
                className="np-concepttag"
                title={`${RANK_LABELS[r.rank] || ""} · ${r.strand || ""}`}
                onClick={() => onOpen({ subject, ...r })}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="np-hint" style={{ marginBottom: 16 }}>
          This is a foundational concept — it has no lower-rank prerequisites.
        </p>
      )}

      {/* Guide + practice land in later increments (RANKS_PLAN §12.3). */}
      <div className="np-card np-lesson">
        <div className="np-cardicon" style={{ color }}>Guide</div>
        <p className="np-lessontext" style={{ color: "var(--muted)" }}>
          A full explanation with a worked example, questions to think through, and a practice
          problem tailored to your level are coming to this page soon.
        </p>
      </div>
    </div>
  );
}
