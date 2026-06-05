"use client";

import React from "react";
import { SUBJECTS, ORDER } from "@/lib/scoring";

function Bullets({ items, color, label }) {
  return (
    <ul className="np-learnlist" aria-label={label}>
      {items.map((t, i) => (
        <li key={i} style={{ "--dot": color }}>{t}</li>
      ))}
    </ul>
  );
}

/**
 * The Learn tab: pick a weak concept and get a Socratic, answer-free explanation.
 */
export default function LearnTab({ scores, active, content, busy, error, onSelect, onPractice }) {
  // Flatten the learner's weak concepts, grouped by subject.
  const groups = ORDER.map((k) => ({
    subject: k,
    concepts: Array.from(new Set((scores?.[k]?.weakConcepts || []).filter(Boolean))),
  })).filter((g) => g.concepts.length > 0);

  const activeColor = active ? SUBJECTS[active.subject]?.color : "var(--text)";

  return (
    <div className="fade-up">
      <h2 className="np-h2">Learn</h2>
      <p className="np-lede" style={{ marginBottom: 20 }}>
        Pick a concept you're working on. noobtopro explains the <em>idea</em> and how to think about it —
        guiding you with questions, never handing over the answer.
      </p>

      {groups.length === 0 ? (
        <div className="np-card" style={{ textAlign: "center", padding: "32px 24px" }}>
          <div className="np-h2" style={{ fontSize: 22 }}>No concepts to learn yet</div>
          <p className="np-lede" style={{ margin: "8px auto 0" }}>
            Take the diagnostic or practice a subject — the concepts you're weak on will show up here.
          </p>
        </div>
      ) : (
        <div className="np-card" style={{ marginBottom: 18 }}>
          {groups.map((g) => (
            <div key={g.subject} className="np-learngroup">
              <div className="np-learngrouphead">
                <span style={{ color: SUBJECTS[g.subject].color, fontFamily: "var(--mono)" }}>{SUBJECTS[g.subject].glyph}</span>
                <span>{SUBJECTS[g.subject].label}</span>
              </div>
              <div className="np-weaktags">
                {g.concepts.map((c) => {
                  const isActive = active && active.subject === g.subject && active.concept === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      className={"np-concepttag" + (isActive ? " active" : "")}
                      style={isActive ? { borderColor: SUBJECTS[g.subject].color, color: SUBJECTS[g.subject].color } : undefined}
                      onClick={() => onSelect(g.subject, c)}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <div className="np-error" style={{ marginBottom: 16 }}><span>{error}</span></div>}

      {busy && (
        <div className="np-card np-pulse" style={{ textAlign: "center", padding: "40px 24px", fontFamily: "var(--display)", fontSize: 20 }}>
          Building your guide to {active?.concept}…
        </div>
      )}

      {!busy && content && active && (
        <div className="fade-up">
          <div className="np-qmeta" style={{ marginBottom: 12 }}>
            <span style={{ color: activeColor }}>{SUBJECTS[active.subject]?.glyph}</span>
            <span style={{ fontFamily: "var(--mono)", letterSpacing: 1 }}>
              {SUBJECTS[active.subject]?.label.toUpperCase()} · CONCEPT
            </span>
            <span className="np-topic">{content.concept}</span>
          </div>

          {content.overview && (
            <div className="np-card np-question" style={{ fontSize: 17 }}>{content.overview}</div>
          )}

          {content.keyIdeas?.length > 0 && (
            <div className="np-card np-lesson">
              <div className="np-cardicon" style={{ color: activeColor }}>Key ideas</div>
              <Bullets items={content.keyIdeas} color={activeColor} label="Key ideas" />
            </div>
          )}

          {content.socraticQuestions?.length > 0 && (
            <div className="np-card np-socratic">
              <div className="np-cardicon">Questions to think through</div>
              <Bullets items={content.socraticQuestions} color="var(--muted)" label="Questions to think through" />
            </div>
          )}

          {content.pitfalls?.length > 0 && (
            <div className="np-card np-note" style={{ borderColor: "rgba(255,126,116,.35)" }}>
              <div className="np-cardicon" style={{ color: "var(--chem)" }}>Common pitfalls</div>
              <Bullets items={content.pitfalls} color="var(--chem)" label="Common pitfalls" />
            </div>
          )}

          {content.tryThis && (
            <div className="np-card np-lesson">
              <div className="np-cardicon" style={{ color: activeColor }}>Try this</div>
              <div className="np-lessontext">{content.tryThis}</div>
            </div>
          )}

          <div className="np-feedactions">
            <button
              className="np-btn np-primary"
              style={{ borderColor: activeColor }}
              onClick={() => onPractice && onPractice(active.subject)}
            >
              Practice {SUBJECTS[active.subject]?.label}
            </button>
          </div>
        </div>
      )}

      {!busy && !content && !error && groups.length > 0 && (
        <p className="np-hint">Pick a concept above to get a guided explanation.</p>
      )}
    </div>
  );
}
