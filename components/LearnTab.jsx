"use client";

import React, { useEffect, useState } from "react";
import { SUBJECTS, ORDER } from "@/lib/scoring";
import { RANKS, RANK_LABELS, conceptsFor, isRankWip, WIP_RANKS_NOTE, rootsFor } from "@/lib/curriculum";
import { conceptState, MASTERY_LABELS } from "@/lib/mastery";
import { loadGuide } from "@/lib/guides";
import { loadMastery } from "@/lib/store";
import { SubjectGlyph } from "@/components/ui";
import Icon from "@/components/Icon";

// The Learn tab is the fixed concept CURRICULUM (lib/curriculum.js), organized by
// SUBJECT → RANK. Concepts are clickable: opening one shows a dedicated CONCEPT PAGE
// whose "root concepts" (lower-rank prerequisites, from the curriculum graph) are
// themselves clickable, so the learning path is explicit and branched. Each chip is
// COLORED by the learner's per-concept mastery (lib/mastery.js — green mastered /
// yellow in progress / red struggling / grey untouched; direct-only, no propagation).
// Each concept page carries its curated WRITTEN GUIDE (Phase D, RANKS_PLAN §12.3):
// explanation + worked example + self-questions, loaded lazily from lib/guides.
// onPractice(concept) — start an AI concept-practice drill for the given curriculum
// concept (increment 3); busyConcept is the key currently generating (button spinner).
export default function LearnTab({ onPractice, busyConcept = null } = {}) {
  // selected = the full concept object { subject, key, label, strand, rank } | null
  const [selected, setSelected] = useState(null);
  // mastery = { [subject]: { [conceptKey]: counters } } — guest localStorage or the
  // signed-in learner's own concept_mastery rows. A load failure (e.g. the table
  // predates migration 0010) just renders uncolored chips; states stay derivable.
  const [mastery, setMastery] = useState({});

  useEffect(() => {
    let alive = true;
    loadMastery()
      .then((res) => {
        if (alive && res && res.mastery) setMastery(res.mastery);
      })
      .catch(() => {}); // chips just stay uncolored
    return () => {
      alive = false;
    };
  }, []);

  const stateFor = (subject, key) => conceptState(mastery, subject, key);

  if (selected) {
    return (
      <ConceptPage
        concept={selected}
        state={stateFor(selected.subject, selected.key)}
        stateFor={stateFor}
        onOpen={setSelected}
        onBack={() => setSelected(null)}
        onPractice={onPractice}
        busyConcept={busyConcept}
      />
    );
  }
  return <CurriculumList stateFor={stateFor} onOpen={setSelected} />;
}

// One concept chip, colored by mastery state. A non-grey state is also conveyed in
// text (title + aria-label), never color alone (WCAG 1.4.1); an untouched (grey)
// chip keeps its plain label as the accessible name.
function ConceptChip({ subject, concept, state, onOpen, titleExtra }) {
  const colored = state && state !== "grey";
  return (
    <button
      type="button"
      className={`np-concepttag${colored ? ` np-concepttag--${state}` : ""}`}
      title={colored ? `${titleExtra || concept.strand || ""} — ${MASTERY_LABELS[state]}` : titleExtra || concept.strand}
      aria-label={colored ? `${concept.label} — ${MASTERY_LABELS[state]}` : undefined}
      onClick={onOpen}
    >
      {concept.label}
    </button>
  );
}

// The mastery color key, shown once above the curriculum listing.
function MasteryLegend() {
  const items = [
    ["green", "Mastered"],
    ["yellow", "In progress"],
    ["red", "Struggling"],
    ["grey", "Not attempted"],
  ];
  return (
    // role="group" so the aria-label is actually exposed (a bare div's label is ignored by AT).
    <div className="np-masterylegend" role="group" aria-label="Concept color key">
      {items.map(([state, label]) => (
        <span key={state} className={`np-masterylegend-item np-masterylegend--${state}`}>
          {label}
        </span>
      ))}
    </div>
  );
}

// ---- the curriculum listing (subject → rank → concept chips) ----
function CurriculumList({ stateFor, onOpen }) {
  return (
    <div className="fade-up">
      <h2 className="np-h2">Learn</h2>
      <p className="np-lede" style={{ marginBottom: 12 }}>
        The full concept curriculum, organized by subject and rank — from Elementary up to Doctorate.
        Open any concept for its foundations, a written guide with a worked example, and practice.
      </p>
      <MasteryLegend />

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
                      <ConceptChip
                        key={c.key}
                        subject={subject}
                        concept={c}
                        state={stateFor(subject, c.key)}
                        onOpen={() => onOpen({ subject, rank, ...c })}
                      />
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

// ---- a single concept's page: title + root navigation + written guide + drill ----
function ConceptPage({ concept, state, stateFor, onOpen, onBack, onPractice, busyConcept }) {
  const { subject, key, label, rank } = concept;
  const color = SUBJECTS[subject] ? SUBJECTS[subject].color : "var(--text)";
  const roots = rootsFor(subject, key); // [{ key, label, strand, rank }]
  const generating = busyConcept === key;

  // The curated written guide (Phase D, §12.3) — undefined while its subject·rank
  // chunk loads, null when none exists (fallback hint), else the guide object.
  const [guide, setGuide] = useState(undefined);
  useEffect(() => {
    let alive = true;
    setGuide(undefined);
    loadGuide(subject, rank, key)
      .then((g) => {
        if (alive) setGuide(g);
      })
      .catch(() => {
        if (alive) setGuide(null); // a failed chunk load degrades to the hint
      });
    return () => {
      alive = false;
    };
  }, [subject, rank, key]);

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

      {/* The learner's standing on THIS concept (state also shown in text, not color alone). */}
      {state && state !== "grey" && (
        <p className={`np-masterystatus np-masterystatus--${state}`}>{MASTERY_LABELS[state]}</p>
      )}

      {/* Red = struggling: a warning, not a gate (§12.1) — point at the roots first. */}
      {state === "red" && (
        <div className="np-card np-masterywarn" role="note">
          <div className="np-cardicon" style={{ color: "var(--danger)" }}>Build the foundations first</div>
          <p className="np-lessontext">
            Your recent attempts here struggled.{" "}
            {roots.length > 0
              ? "Before practicing this again, work through the root concepts below — they are what this concept is built on."
              : "There's nothing lower to fall back on here — try a gentler practice round on this concept before moving up."}
          </p>
        </div>
      )}

      {/* Root concepts — the lower-rank foundations, each a link to its own page. */}
      {roots.length > 0 ? (
        <div className="np-card" style={{ marginBottom: 16 }}>
          <div className="np-cardicon" style={{ color }}>Root concepts — understand these first</div>
          <div className="np-weaktags" style={{ marginTop: 8 }}>
            {roots.map((r) => (
              <ConceptChip
                key={r.key}
                subject={subject}
                concept={r}
                state={stateFor(subject, r.key)}
                titleExtra={`${RANK_LABELS[r.rank] || ""} · ${r.strand || ""}`}
                onOpen={() => onOpen({ subject, ...r })}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="np-hint" style={{ marginBottom: 16 }}>
          This is a foundational concept — it has no lower-rank prerequisites.
        </p>
      )}

      {/* The curated written guide (Phase D, §12.3): explanation, one fully worked
          example, and self-questions — read first, then practice below. */}
      {guide && <ConceptGuide guide={guide} color={color} />}

      {/* AI concept-practice drill (increment 3): an on-request question targeting THIS
          concept, graded process-first, that updates the concept's mastery coloring. */}
      <div className="np-card np-lesson">
        <div className="np-cardicon" style={{ color }}>Practice this concept</div>
        <p className="np-lessontext" style={{ color: "var(--muted)", marginBottom: 12 }}>
          Get a reasoning question aimed right at <strong style={{ color: "var(--text)" }}>{label}</strong>,
          framed at the {RANK_LABELS[rank] || rank} level. Explain your thinking and it's graded on
          reasoning — your attempts update this concept's standing above.
        </p>
        {onPractice ? (
          <button
            type="button"
            className="np-btn np-primary np-btn--subject"
            style={{ "--subject": color }}
            disabled={generating}
            onClick={() => onPractice(concept)}
          >
            {generating ? "Generating a question…" : "Practice this concept"}
          </button>
        ) : (
          <p className="np-hint" style={{ margin: 0 }}>Sign in or complete the diagnostic to practice.</p>
        )}
      </div>

      {/* Safety net only: every populated cell ships a guide (test/guides.test.js),
          so this shows just when a guide is genuinely absent or its chunk failed. */}
      {guide === null && (
        <p className="np-hint" style={{ marginTop: 14 }}>
          A full written guide for this concept is coming soon.
        </p>
      )}
    </div>
  );
}

// ---- the written guide body (Phase D, §12.3): idea → worked example → self-questions ----
function ConceptGuide({ guide, color }) {
  return (
    <>
      <div className="np-card np-lesson">
        <div className="np-cardicon" style={{ color }}>The idea</div>
        {guide.explanation.map((p, i) => (
          <p key={i} className="np-lessontext" style={{ margin: i ? "10px 0 0" : 0 }}>
            {p}
          </p>
        ))}
      </div>

      <div className="np-card np-lesson">
        <div className="np-cardicon" style={{ color }}>Worked example</div>
        <p className="np-guideproblem">{guide.example.problem}</p>
        <ol className="np-guidesteps">
          {guide.example.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        <p className="np-guideanswer">
          <strong>Answer:</strong> {guide.example.answer}
        </p>
      </div>

      <div className="np-card np-lesson">
        <div className="np-cardicon" style={{ color }}>Ask yourself</div>
        <p className="np-lessontext" style={{ color: "var(--muted)", marginBottom: 10 }}>
          Think these through before practicing — explaining your reasoning out loud counts.
        </p>
        <ul className="np-selfqs">
          {guide.selfQuestions.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
