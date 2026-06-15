"use client";

import React, { useState, useEffect } from "react";
import { SUBJECTS } from "@/lib/scoring";
import ScoreBreakdown, { ErrorList } from "@/components/ScoreBreakdown";
import { SubjectGlyph, deltaColor } from "@/components/ui";

// "Review your answers" — lazily loads the learner's past graded answers (signed-in:
// their own attempt_reviews via RLS; guest: from local history) and renders each as an
// expandable card: the question, what they wrote, the rubric, the strengths/improvements
// feedback, and the full worked solution. Lives in the Dashboard's "Review your answers"
// drawer, so the fetch only fires when the learner opens it (lazy).
export default function ReviewList({ loadReviews, onPractice, onLearn }) {
  const [reviews, setReviews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (typeof loadReviews !== "function") {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    loadReviews()
      .then((res) => {
        if (cancelled) return;
        if (res && res.reviews) setReviews(res.reviews);
        else setError("Couldn't load your past answers.");
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your past answers.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadReviews]);

  return (
    <div className="np-card">
      <div className="np-charttitle" style={{ marginBottom: 6 }}>Review your answers</div>
      <div className="np-chartsub" style={{ marginBottom: 14 }}>
        Re-open any past attempt to see the question, what you wrote, your rubric, exactly what to improve, and the full worked solution.
      </div>
      {loading ? (
        <p className="np-statsub" role="status" aria-live="polite">Loading your answers…</p>
      ) : error ? (
        <p className="np-statsub">{error}</p>
      ) : !reviews || reviews.length === 0 ? (
        <p className="np-statsub">No graded answers to review yet. Solve a practice problem and it'll show up here.</p>
      ) : (
        reviews.map((rv, i) => {
          const color = SUBJECTS[rv.subject]?.color || "var(--muted)";
          const fb = rv.feedback || {};
          return (
            <details key={i} className="np-card" style={{ marginBottom: 10 }}>
              <summary style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <SubjectGlyph subject={rv.subject} />
                <span style={{ fontFamily: "var(--mono)", fontWeight: 700 }}>{rv.reasoningScore ?? 0}<span style={{ color: "var(--muted)" }}>/100</span></span>
                {typeof rv.delta === "number" && rv.delta !== 0 && (
                  <span style={{ color: deltaColor(rv.delta), fontFamily: "var(--mono)", fontWeight: 700 }}>
                    {rv.delta > 0 ? "+" : ""}{rv.delta}
                  </span>
                )}
                <span className="np-statsub" style={{ flex: 1, minWidth: 120 }}>{rv.targetConcept || (rv.question ? rv.question.slice(0, 60) : "")}</span>
              </summary>

              <div style={{ marginTop: 12 }}>
                {rv.question && <div className="np-card np-question" style={{ fontSize: 15 }}>{rv.question}</div>}
                {rv.answer && (
                  <div className="np-card np-lesson" style={{ marginTop: 10 }}>
                    <div className="np-cardicon">Your answer</div>
                    <div className="np-lessontext" style={{ whiteSpace: "pre-wrap" }}>{rv.answer}</div>
                  </div>
                )}
                {rv.rubric && (
                  <div style={{ marginTop: 10 }}>
                    <ScoreBreakdown rubric={rv.rubric} total={rv.reasoningScore} color={color} />
                  </div>
                )}
                {Array.isArray(fb.errors) && fb.errors.length > 0 && (
                  <div className="np-card np-errors" style={{ marginTop: 10 }}>
                    <div className="np-cardicon" style={{ color: "var(--math)" }}>Where your reasoning broke</div>
                    <ErrorList errors={fb.errors} />
                  </div>
                )}
                {Array.isArray(fb.strengths) && fb.strengths.length > 0 && (
                  <div className="np-card np-lesson" style={{ marginTop: 10 }}>
                    <div className="np-cardicon" style={{ color: "var(--phys)" }}>What you did well</div>
                    <ul className="np-learnlist" aria-label="What you did well">{fb.strengths.map((s, j) => <li key={j} style={{ "--dot": "var(--phys)" }}>{s}</li>)}</ul>
                  </div>
                )}
                {Array.isArray(fb.improvements) && fb.improvements.length > 0 && (
                  <div className="np-card np-lesson" style={{ marginTop: 10 }}>
                    <div className="np-cardicon" style={{ color: "var(--math)" }}>To reach 100</div>
                    <ul className="np-learnlist" aria-label="How to reach the maximum score">{fb.improvements.map((s, j) => <li key={j} style={{ "--dot": "var(--math)" }}>{s}</li>)}</ul>
                  </div>
                )}
                {fb.workedSolution && (
                  <div className="np-card np-lesson" style={{ marginTop: 10 }}>
                    <div className="np-cardicon" style={{ color }}>Worked solution</div>
                    <div className="np-lessontext" style={{ whiteSpace: "pre-wrap" }}>{fb.workedSolution}</div>
                  </div>
                )}
                <div className="np-feedactions" style={{ marginTop: 12 }}>
                  {rv.targetConcept && onLearn && (
                    <button className="np-ghost" onClick={() => onLearn(rv.subject, rv.targetConcept)}>Learn this concept</button>
                  )}
                  {onPractice && <button className="np-ghost" onClick={() => onPractice(rv.subject)}>Practice again</button>}
                </div>
              </div>
            </details>
          );
        })
      )}
    </div>
  );
}
