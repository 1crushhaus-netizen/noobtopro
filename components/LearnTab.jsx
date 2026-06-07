"use client";

import React, { useState, useEffect, useRef } from "react";
import { SUBJECTS, ORDER } from "@/lib/scoring";
import { TOPICS, topicLabel } from "@/lib/taxonomy";
import { browsePublicConcepts, reportConcept } from "@/lib/catalog";

function Bullets({ items, color, label }) {
  return (
    <ul className="np-learnlist" aria-label={label}>
      {items.map((t, i) => (
        <li key={i} style={{ "--dot": color }}>{t}</li>
      ))}
    </ul>
  );
}

// The selected-concept area: loading state + the Socratic guide + "try this" +
// (optionally) a Report control. Shared by both the weak-concept picker and the
// browse hub so the guide rendering lives in exactly one place.
function GuideView({ active, content, busy, question, regenerating, onPracticeQuestion, onRegenerate, onPractice, canReport, onReport }) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reportMsg, setReportMsg] = useState("");
  const [reporting, setReporting] = useState(false);

  // Reset the report affordance whenever the active concept changes.
  useEffect(() => {
    setReportOpen(false);
    setReason("");
    setReportMsg("");
    setReporting(false);
  }, [active && active.subject, active && active.concept]);

  if (!active) return null;
  const activeColor = SUBJECTS[active.subject] ? SUBJECTS[active.subject].color : "var(--text)";

  if (busy) {
    return (
      <div className="np-card np-pulse" role="status" aria-live="polite" style={{ textAlign: "center", padding: "40px 24px", fontFamily: "var(--display)", fontSize: 20 }}>
        Building your guide to {active.concept}…
      </div>
    );
  }
  if (!content) return null;

  async function submitReport() {
    setReporting(true);
    setReportMsg("");
    const res = await onReport(active.subject, content.concept, reason);
    setReporting(false);
    if (res && res.ok) {
      setReportOpen(false);
      setReason("");
      setReportMsg("Thanks — reported for review.");
    } else {
      setReportMsg((res && res.error) || "Could not submit the report.");
    }
  }

  return (
    <div className="fade-up">
      <div className="np-qmeta" style={{ marginBottom: 12 }}>
        <span style={{ color: activeColor }}>{SUBJECTS[active.subject] && SUBJECTS[active.subject].glyph}</span>
        <span style={{ fontFamily: "var(--mono)", letterSpacing: 1 }}>
          {SUBJECTS[active.subject] && SUBJECTS[active.subject].label.toUpperCase()} · CONCEPT
        </span>
        <span className="np-topic">{content.concept}</span>
        {canReport && (
          <button className="np-ghost" style={{ marginLeft: "auto" }} onClick={() => setReportOpen((v) => !v)}>
            ⚑ Report
          </button>
        )}
      </div>

      {reportOpen && canReport && (
        <div className="np-card" style={{ marginBottom: 12 }}>
          <div className="np-cardicon">Report this concept</div>
          <textarea
            className="np-input"
            aria-label="Reason for reporting"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What's wrong with this concept or guide? (optional)"
            rows={3}
            maxLength={1000}
          />
          <div className="np-feedactions" style={{ marginTop: 10 }}>
            <button className="np-btn np-primary" onClick={submitReport} disabled={reporting}>{reporting ? "Sending…" : "Submit report"}</button>
            <button className="np-ghost" onClick={() => setReportOpen(false)} disabled={reporting}>Cancel</button>
          </div>
        </div>
      )}
      {reportMsg && <div className="np-note" role="status" style={{ marginBottom: 12 }}>{reportMsg}</div>}

      {content.overview && <div className="np-card np-question" style={{ fontSize: 17 }}>{content.overview}</div>}

      {content.keyIdeas && content.keyIdeas.length > 0 && (
        <div className="np-card np-lesson">
          <div className="np-cardicon" style={{ color: activeColor }}>Key ideas</div>
          <Bullets items={content.keyIdeas} color={activeColor} label="Key ideas" />
        </div>
      )}

      {content.whyItWorks && (
        <div className="np-card np-lesson">
          <div className="np-cardicon" style={{ color: activeColor }}>Why it works</div>
          {/* The proof / derivation / mechanism. pre-wrap preserves the argument's line
              structure; React escapes the text (no raw HTML). */}
          <div className="np-lessontext" style={{ whiteSpace: "pre-wrap" }}>{content.whyItWorks}</div>
        </div>
      )}

      {content.socraticQuestions && content.socraticQuestions.length > 0 && (
        <div className="np-card np-socratic">
          <div className="np-cardicon">Questions to think through</div>
          <Bullets items={content.socraticQuestions} color="var(--muted)" label="Questions to think through" />
        </div>
      )}

      {content.pitfalls && content.pitfalls.length > 0 && (
        <div className="np-card np-note" style={{ borderColor: "rgba(255,126,116,.35)" }}>
          <div className="np-cardicon" style={{ color: "var(--chem)" }}>Common pitfalls</div>
          <Bullets items={content.pitfalls} color="var(--chem)" label="Common pitfalls" />
        </div>
      )}

      {content.tryThis && (
        <div className="np-card np-lesson">
          <div className="np-cardicon" style={{ color: activeColor }}>How to approach it</div>
          <div className="np-lessontext">{content.tryThis}</div>
        </div>
      )}

      {question && question.question ? (
        <div className="np-card np-question" style={{ borderColor: activeColor }}>
          <div className="np-cardicon" style={{ color: activeColor, marginBottom: 8 }}>
            Try this problem{question.difficulty ? ` · ${String(question.difficulty).toUpperCase()}` : ""}
          </div>
          <div style={{ fontSize: 16, lineHeight: 1.5 }}>{question.question}</div>
          <div className="np-feedactions" style={{ marginTop: 16 }}>
            <button className="np-btn np-primary" style={{ borderColor: activeColor }} onClick={() => onPracticeQuestion && onPracticeQuestion(active.subject, question)}>
              Practice this problem
            </button>
            <button className="np-ghost" onClick={() => onRegenerate && onRegenerate()} disabled={regenerating}>
              {regenerating ? "Generating a new one…" : "Regenerate question"}
            </button>
          </div>
        </div>
      ) : (
        <div className="np-feedactions">
          <button className="np-btn np-primary" style={{ borderColor: activeColor }} onClick={() => onPractice && onPractice(active.subject)}>
            Practice {SUBJECTS[active.subject] && SUBJECTS[active.subject].label}
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Mode 1: the original weak-concept picker (flag OFF — behavior unchanged) ----
function WeakConceptPicker({ scores, active, content, busy, error, question, regenerating, onSelect, onPractice, onPracticeQuestion, onRegenerate }) {
  const groups = ORDER.map((k) => ({
    subject: k,
    concepts: Array.from(new Set((scores && scores[k] && scores[k].weakConcepts ? scores[k].weakConcepts : []).filter(Boolean))),
  })).filter((g) => g.concepts.length > 0);

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
            Prove what you know or practice a subject — the concepts you're weak on will show up here.
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

      {error && <div className="np-error" role="alert" style={{ marginBottom: 16 }}><span>{error}</span></div>}

      <GuideView active={active} content={content} busy={busy} question={question} regenerating={regenerating} onPracticeQuestion={onPracticeQuestion} onRegenerate={onRegenerate} onPractice={onPractice} canReport={false} />

      {!busy && !content && !error && groups.length > 0 && (
        <p className="np-hint">Pick a concept above to get a guided explanation.</p>
      )}
    </div>
  );
}

// ---- Mode 2: the browsable Concept Hub (flag ON) ----
function ConceptHub({ scores, user, isAdmin, adminApi, active, content, busy, error, question, regenerating, onSelect, onPractice, onPracticeQuestion, onRegenerate }) {
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [concepts, setConcepts] = useState([]);
  const [adminConcepts, setAdminConcepts] = useState([]); // unapproved (admin-only), shown with *
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const runRef = useRef(0);

  // Load the public catalog whenever the subject filter or search term changes
  // (debounced so typing doesn't fire a request per keystroke).
  useEffect(() => {
    const myRun = ++runRef.current;
    setLoading(true);
    setLoadError("");
    const t = setTimeout(async () => {
      const res = await browsePublicConcepts({ subject: subjectFilter === "all" ? undefined : subjectFilter, query });
      if (myRun !== runRef.current) return; // superseded by a newer filter/query
      if (res.error) setLoadError("Couldn't load the concept catalog. Please try again.");
      else setConcepts(res.concepts || []);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [subjectFilter, query]);

  // Admin overlay: fetch not-yet-approved guides once, so the admin sees them in
  // the directory marked with a *. Regular users/guests never load this.
  useEffect(() => {
    let cancelled = false;
    if (!isAdmin || !adminApi) {
      setAdminConcepts([]);
      return;
    }
    adminApi("/api/admin/data")
      .then((d) => {
        if (cancelled) return;
        const pend = (d && d.pendingGuides) || [];
        // Only the ones that actually have a guide (status='ready' but hidden) are
        // worth listing; content-less 'pending' stubs are skipped (nothing to open).
        setAdminConcepts(pend.filter((g) => g.status === "ready"));
      })
      .catch(() => {
        if (!cancelled) setAdminConcepts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, adminApi]);

  // Weak-concept shortcuts (personalized) shown above the directory.
  const weakGroups = ORDER.map((k) => ({
    subject: k,
    concepts: Array.from(new Set((scores && scores[k] && scores[k].weakConcepts ? scores[k].weakConcepts : []).filter(Boolean))),
  })).filter((g) => g.concepts.length > 0);

  // Merge approved (public) + admin-only unapproved, tagging each. Apply the
  // subject/query filter to the admin set client-side (the public set is already filtered).
  const q = query.trim().toLowerCase();
  const merged = [
    ...concepts.map((c) => ({ ...c, approved: true })),
    ...adminConcepts
      .filter((c) => subjectFilter === "all" || c.subject === subjectFilter)
      .filter((c) => !q || (c.concept || "").toLowerCase().includes(q))
      .map((c) => ({ ...c, approved: false })),
  ];

  const subjects = subjectFilter === "all" ? ORDER : [subjectFilter];

  return (
    <div className="fade-up">
      <h2 className="np-h2">Concept Hub</h2>
      <p className="np-lede" style={{ marginBottom: 16 }}>
        Browse the library of concepts. Open any one for a Socratic guide that teaches the <em>idea</em> — never the answer —
        and a practice problem to try.
      </p>

      {/* Weak-concept shortcuts */}
      {weakGroups.length > 0 && (
        <div className="np-card" style={{ marginBottom: 16 }}>
          <div className="np-cardicon">Your weak concepts</div>
          <div className="np-weaktags">
            {weakGroups.flatMap((g) =>
              g.concepts.map((c) => (
                <button key={g.subject + "::" + c} type="button" className="np-concepttag" onClick={() => onSelect(g.subject, c)}>
                  <span style={{ color: SUBJECTS[g.subject].color, fontFamily: "var(--mono)" }}>{SUBJECTS[g.subject].glyph}</span> {c}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Subject filter + search */}
      <div className="np-hub-controls">
        <div className="np-hub-filters">
          <button className={"np-chip" + (subjectFilter === "all" ? " active" : "")} onClick={() => setSubjectFilter("all")}>All</button>
          {ORDER.map((k) => (
            <button
              key={k}
              className={"np-chip" + (subjectFilter === k ? " active" : "")}
              style={subjectFilter === k ? { borderColor: SUBJECTS[k].color, color: SUBJECTS[k].color } : { borderColor: SUBJECTS[k].color }}
              onClick={() => setSubjectFilter(k)}
            >
              <span style={{ fontFamily: "var(--mono)" }}>{SUBJECTS[k].glyph}</span> {SUBJECTS[k].label}
            </button>
          ))}
        </div>
        <input
          className="np-input np-hub-search"
          type="search"
          aria-label="Search concepts"
          placeholder="Search concepts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {isAdmin && adminConcepts.length > 0 && (
        <p className="np-hint" style={{ marginTop: 4 }}>Concepts marked <strong>*</strong> are not yet approved (admin-only — approve them in the Admin tab).</p>
      )}

      {/* Directory grouped by subject → topic */}
      {loadError ? (
        <div className="np-error" role="alert" style={{ marginTop: 14 }}><span>{loadError}</span></div>
      ) : loading && merged.length === 0 ? (
        <div className="np-card np-pulse" role="status" aria-live="polite" style={{ textAlign: "center", padding: "32px 24px" }}>Loading concepts…</div>
      ) : merged.length === 0 ? (
        <div className="np-card" style={{ textAlign: "center", padding: "32px 24px" }}>
          <div className="np-h2" style={{ fontSize: 20 }}>No concepts found</div>
          <p className="np-lede" style={{ margin: "8px auto 0" }}>{query ? "Try a different search." : "The catalog is still being curated — check back soon."}</p>
        </div>
      ) : (
        <div className="np-card" style={{ marginTop: 14, marginBottom: 18 }}>
          {subjects.map((subj) => {
            const subjConcepts = merged.filter((c) => c.subject === subj);
            if (subjConcepts.length === 0) return null;
            const topicsForSubject = TOPICS[subj] || [];
            return (
              <div key={subj} className="np-learngroup">
                <div className="np-learngrouphead">
                  <span style={{ color: SUBJECTS[subj].color, fontFamily: "var(--mono)" }}>{SUBJECTS[subj].glyph}</span>
                  <span>{SUBJECTS[subj].label}</span>
                </div>
                {topicsForSubject.map((t) => {
                  const inTopic = subjConcepts.filter((c) => c.topic === t.slug);
                  if (inTopic.length === 0) return null;
                  return (
                    <div key={t.slug} className="np-hub-topic">
                      <div className="np-hub-topiclabel">{topicLabel(subj, t.slug)}</div>
                      <div className="np-weaktags">
                        {inTopic.map((c) => {
                          const isActive = active && active.subject === c.subject && active.concept === c.concept;
                          return (
                            <button
                              key={c.subject + "::" + c.concept_key}
                              type="button"
                              className={"np-concepttag" + (isActive ? " active" : "") + (c.approved ? "" : " np-hub-unapproved")}
                              style={isActive ? { borderColor: SUBJECTS[subj].color, color: SUBJECTS[subj].color } : undefined}
                              title={c.approved ? c.concept : `${c.concept} — not yet approved`}
                              onClick={() => onSelect(c.subject, c.concept)}
                            >
                              {c.concept}{c.approved ? "" : " *"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {error && <div className="np-error" role="alert" style={{ marginBottom: 16 }}><span>{error}</span></div>}

      <GuideView
        active={active}
        content={content}
        busy={busy}
        question={question}
        regenerating={regenerating}
        onPracticeQuestion={onPracticeQuestion}
        onRegenerate={onRegenerate}
        onPractice={onPractice}
        canReport={!!user}
        onReport={(subject, concept, reason) => reportConcept({ subject, conceptKey: concept, reason })}
      />
    </div>
  );
}

/**
 * The Learn tab. With NEXT_PUBLIC_ENABLE_CONCEPT_HUB OFF it is the original
 * weak-concept picker (unchanged); ON it is the browsable Concept Hub.
 */
export default function LearnTab(props) {
  return props.hubEnabled ? <ConceptHub {...props} /> : <WeakConceptPicker {...props} />;
}
