"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SUBJECTS, ORDER } from "@/lib/scoring";
import { RANKS, RANK_LABELS, conceptsFor, isRankWip, WIP_RANKS_NOTE, rootsFor, crossRootsFor } from "@/lib/curriculum";
import { conceptState, assumedMasteredKeys, MASTERY_LABELS } from "@/lib/mastery";
import { rankCoverage } from "@/lib/promotion";
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
// openConcept — a full curriculum concept object to DEEP-LINK open (a weak-concept
// "Learn this" chip routes here instead of generating a guide); onConceptConsumed is
// called once it's opened so the parent can clear the signal and re-tapping re-opens.
export default function LearnTab({ onPractice, busyConcept = null, openConcept = null, onConceptConsumed, mastery: masteryProp = null } = {}) {
  // selected = the full concept object { subject, key, label, strand, rank } | null
  const [selected, setSelected] = useState(null);
  // mastery = { [subject]: { [conceptKey]: counters } } — guest localStorage or the
  // signed-in learner's own concept_mastery rows. A load failure (e.g. the table
  // predates migration 0010) just renders uncolored chips; states stay derivable.
  // FRONTEND P1-2: prefer the LIFTED prop (fetched ONCE in the shell, shared with the
  // Dashboard); only self-fetch via the store when no prop is supplied (standalone
  // use, e.g. the unit tests). This removes the second per-session mastery round-trip.
  const [fetchedMastery, setFetchedMastery] = useState({});
  const mastery = masteryProp ?? fetchedMastery;

  useEffect(() => {
    if (masteryProp != null) return undefined; // mastery supplied by the parent — don't double-fetch
    let alive = true;
    loadMastery()
      .then((res) => {
        if (alive && res && res.mastery) setFetchedMastery(res.mastery);
      })
      .catch(() => {}); // chips just stay uncolored
    return () => {
      alive = false;
    };
  }, [masteryProp]);

  // Deep-link: when the parent asks to open a concept (a weak-concept chip), jump
  // straight onto its prepared guide, then signal consumption so re-tapping the same
  // chip (which re-sets openConcept) opens it again rather than no-op'ing.
  useEffect(() => {
    if (openConcept && openConcept.subject && openConcept.key) {
      setSelected(openConcept);
      if (onConceptConsumed) onConceptConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openConcept]);

  // Per-subject set of elementary concepts INFERRED as mastered from the learner's
  // demonstrated work (assumedMasteredKeys) — recomputed only when mastery changes.
  const assumed = useMemo(() => {
    const m = {};
    for (const subject of ORDER) m[subject] = assumedMasteredKeys(mastery, subject);
    return m;
  }, [mastery]);

  // Effective display state: a direct attempt always wins; an untouched (grey)
  // elementary concept that's a prerequisite of demonstrated work shows as "assumed".
  // PERF (P2-3): stabilized on [mastery, assumed] so child memos that depend on it
  // (CurriculumList's searchResults) don't invalidate on every keystroke render.
  const stateFor = useCallback(
    (subject, key) => {
      const s = conceptState(mastery, subject, key);
      if (s === "grey" && assumed[subject] && assumed[subject].has(key)) return "assumed";
      return s;
    },
    [mastery, assumed]
  );

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
  return <CurriculumList stateFor={stateFor} mastery={mastery} onOpen={setSelected} />;
}

// One concept chip, colored by mastery state. A non-grey state is also conveyed in
// text (title + aria-label), never color alone (WCAG 1.4.1); an untouched (grey)
// chip keeps its plain label as the accessible name. The label is wrapped so it can
// truncate inside the aligned concept grid (full text stays in title/aria-label).
function ConceptChip({ subject, concept, state, onOpen, titleExtra, namePrefix }) {
  const colored = state && state !== "grey";
  const detail = titleExtra || concept.strand || "";
  // namePrefix distinguishes contexts that repeat a concept (the "Up next" strip vs
  // the curriculum grid) so accessible names stay unique and carry their context.
  const baseName = `${namePrefix ? `${namePrefix}: ` : ""}${concept.label}`;
  return (
    <button
      type="button"
      className={`np-concepttag${colored ? ` np-concepttag--${state}` : ""}`}
      title={`${concept.label}${detail ? ` · ${detail}` : ""}${colored ? `: ${MASTERY_LABELS[state]}` : ""}`}
      aria-label={colored || namePrefix ? `${baseName}${colored ? `: ${MASTERY_LABELS[state]}` : ""}` : undefined}
      onClick={onOpen}
    >
      <span className="np-ctlabel">{concept.label}</span>
    </button>
  );
}

// The mastery color key, doubling as the STATUS FILTER: each state chip filters the
// listing to concepts in that state ("all" restores everything). Keyed glyphs mirror
// the concept chips, so the legend teaches the encoding while it filters.
const FILTER_STATES = [
  ["green", "Mastered"],
  ["assumed", "Assumed"],
  ["yellow", "In progress"],
  ["red", "Struggling"],
  ["grey", "Not attempted"],
];
function MasteryFilter({ filter, onFilter }) {
  return (
    <div className="np-masterylegend" role="group" aria-label="Concept color key & status filter">
      <button
        type="button"
        className={`np-masterylegend-item np-filterchip${filter === "all" ? " active" : ""}`}
        aria-pressed={filter === "all"}
        onClick={() => onFilter("all")}
      >
        All
      </button>
      {FILTER_STATES.map(([state, label]) => (
        <button
          key={state}
          type="button"
          className={`np-masterylegend-item np-masterylegend--${state} np-filterchip${filter === state ? " active" : ""}`}
          aria-pressed={filter === state}
          onClick={() => onFilter(filter === state ? "all" : state)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// The rank a learner is currently climbing in a subject: the lowest populated rank
// whose breadth-gate counter isn't complete (everything complete → the highest one).
function currentRankFor(mastery, subject) {
  let last = RANKS[0];
  for (const rank of RANKS) {
    if (isRankWip(subject, rank)) continue;
    last = rank;
    const total = conceptsFor(subject, rank).length;
    if (rankCoverage(mastery, subject, rank).mastered < total) return rank;
  }
  return last;
}

// "Up next" strip: per subject, the current rank + the first few concepts that still
// need work there (struggling first, then in-progress, then untouched) — the direct
// answer to "what should I learn now?" without opening anything.
function UpNext({ mastery, stateFor, onOpen }) {
  const PRIORITY = { red: 0, yellow: 1, grey: 2 };
  return (
    <div className="np-upnext">
      {ORDER.map((subject) => {
        const rank = currentRankFor(mastery, subject);
        const next = conceptsFor(subject, rank)
          .map((c) => ({ ...c, state: stateFor(subject, c.key) }))
          .filter((c) => c.state !== "green" && c.state !== "assumed") // mastered (earned or assumed) isn't "up next"
          .sort((a, b) => (PRIORITY[a.state] ?? 3) - (PRIORITY[b.state] ?? 3))
          .slice(0, 3);
        return (
          <div key={subject} className="np-card np-lift np-upnext-card">
            <div className="np-upnext-head">
              <SubjectGlyph subject={subject} />
              <span className="np-upnext-subject">{SUBJECTS[subject].label}</span>
              <span className="np-upnext-rank">{RANK_LABELS[rank]}</span>
            </div>
            {next.length > 0 ? (
              <div className="np-upnext-chips">
                {next.map((c) => (
                  <ConceptChip
                    key={c.key}
                    subject={subject}
                    concept={c}
                    state={c.state}
                    namePrefix="Up next"
                    titleExtra={`${RANK_LABELS[rank]} · ${c.strand || ""}`}
                    onOpen={() => onOpen({ subject, rank, key: c.key, label: c.label, strand: c.strand })}
                  />
                ))}
              </div>
            ) : (
              <p className="np-statsub" style={{ margin: 0 }}>Rank complete. Keep climbing.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- the curriculum listing: subject tabs → collapsible rank sections → an
// aligned concept grid. Search spans ALL subjects; the status filter narrows to
// one mastery state (and expands every rank that has matches). ----
function CurriculumList({ stateFor, mastery, onOpen }) {
  const [subject, setSubject] = useState(ORDER[0]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all"); // "all" | green | yellow | red | grey
  // Explicit user expand/collapse choices; anything unset falls back to the default
  // (only the subject's CURRENT rank starts open).
  const [openOverrides, setOpenOverrides] = useState({});

  const q = query.trim().toLowerCase();
  const matchesFilter = (s, key) => filter === "all" || stateFor(s, key) === filter;
  const isOpen = (s, rank) =>
    filter !== "all" ? true : (openOverrides[`${s}:${rank}`] ?? rank === currentRankFor(mastery, s));
  const toggle = (s, rank) =>
    setOpenOverrides((o) => ({ ...o, [`${s}:${rank}`]: !isOpen(s, rank) }));

  // Search mode: a flat, cross-subject result list (grouped by subject) replaces the
  // tabbed listing while a query is present.
  // PERF (P2-3): this flat-maps the ENTIRE curriculum (224 concepts × 3 subjects × 5
  // ranks) and ran on EVERY keystroke (the search input is controlled). Memoize it on
  // [q, filter, stateFor] — stateFor is now stable across renders that don't change
  // mastery, so typing only rebuilds when the query/filter actually change.
  const searchResults = useMemo(() => {
    if (!q) return null;
    return ORDER.map((s) => ({
      subject: s,
      items: RANKS.filter((r) => !isRankWip(s, r)).flatMap((r) =>
        conceptsFor(s, r)
          .filter((c) => c.label.toLowerCase().includes(q) && (filter === "all" || stateFor(s, c.key) === filter))
          .map((c) => ({ ...c, rank: r }))
      ),
    })).filter((g) => g.items.length > 0);
  }, [q, filter, stateFor]);

  return (
    <div className="fade-up">
      <div className="np-pagehead" style={{ marginBottom: 18 }}>
        <span className="np-eyebrow--mono">Learn</span>
        {/* A11y P1-5: one real <h1> for the Learn view (visual style kept via np-h2). */}
        <h1 className="np-h2">The concept library</h1>
        <p className="np-lede">
          The full concept curriculum, organized by subject and rank, from Elementary up to Doctorate.
          Open any concept for its foundations, a written guide with a worked example, and practice.
        </p>
      </div>

      <UpNext mastery={mastery} stateFor={stateFor} onOpen={onOpen} />

      <div className="np-learn-controls">
        <div className="np-seg" role="tablist" aria-label="Subject">
          {ORDER.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={subject === s}
              className={"np-seg-btn" + (subject === s ? " active" : "")}
              onClick={() => setSubject(s)}
            >
              <SubjectGlyph subject={s} /> {SUBJECTS[s].label}
            </button>
          ))}
        </div>
        <input
          type="search"
          className="np-input np-hub-search np-learn-search"
          placeholder="Search concepts…"
          aria-label="Search concepts"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <MasteryFilter filter={filter} onFilter={setFilter} />

      {searchResults ? (
        searchResults.length > 0 ? (
          searchResults.map((g) => (
            <div key={g.subject} className="np-card" style={{ marginBottom: 14 }}>
              <div className="np-learngrouphead">
                <SubjectGlyph subject={g.subject} />
                <span>{SUBJECTS[g.subject].label}</span>
                <span className="np-learncount">{g.items.length} match{g.items.length === 1 ? "" : "es"}</span>
              </div>
              <div className="np-conceptgrid">
                {g.items.map((c) => (
                  <ConceptChip
                    key={c.key}
                    subject={g.subject}
                    concept={c}
                    state={stateFor(g.subject, c.key)}
                    titleExtra={`${RANK_LABELS[c.rank] || ""} · ${c.strand || ""}`}
                    onOpen={() => onOpen({ subject: g.subject, rank: c.rank, key: c.key, label: c.label, strand: c.strand })}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="np-hint">No concepts match “{query.trim()}”.</p>
        )
      ) : (
        <div className="np-card">
          <div className="np-learngrouphead">
            <SubjectGlyph subject={subject} />
            <span>{SUBJECTS[subject].label}</span>
          </div>

          {RANKS.map((rank) => {
            const wip = isRankWip(subject, rank);
            const concepts = wip ? [] : conceptsFor(subject, rank);
            const visible = wip ? [] : concepts.filter((c) => matchesFilter(subject, c.key));
            const cov = wip ? null : rankCoverage(mastery, subject, rank);
            const open = isOpen(subject, rank);
            // Under a status filter, ranks with no matching concepts collapse away
            // entirely (headers stay when unfiltered so counters always inform).
            if (filter !== "all" && !wip && visible.length === 0) return null;
            return (
              <div key={rank} className="np-learngroup">
                <button
                  type="button"
                  className="np-rankhead"
                  aria-expanded={open}
                  aria-label={
                    wip
                      ? RANK_LABELS[rank]
                      : `${RANK_LABELS[rank]} · ${cov.mastered} of ${concepts.length} mastered`
                  }
                  onClick={() => toggle(subject, rank)}
                >
                  <span className={"np-rankchevron" + (open ? " open" : "")} aria-hidden="true">
                    <Icon name="chevron" size={14} />
                  </span>
                  <span className="np-hub-topiclabel" style={{ margin: 0 }}>{RANK_LABELS[rank]}</span>
                  {!wip && (
                    <>
                      <span className="np-learncount">{cov.mastered}/{concepts.length} mastered</span>
                      <span className="np-rankbar" aria-hidden="true">
                        <span
                          className="np-rankbar-fill"
                          style={{ width: `${concepts.length ? Math.round((cov.mastered / concepts.length) * 100) : 0}%` }}
                        />
                      </span>
                    </>
                  )}
                </button>
                {open &&
                  (wip ? (
                    <p className="np-hint" style={{ margin: "2px 0 8px 24px", fontStyle: "italic" }}>{WIP_RANKS_NOTE}</p>
                  ) : (
                    <div className="np-conceptgrid">
                      {visible.map((c) => (
                        <ConceptChip
                          key={c.key}
                          subject={subject}
                          concept={c}
                          state={stateFor(subject, c.key)}
                          onOpen={() => onOpen({ subject, rank, ...c })}
                        />
                      ))}
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- a single concept's page: title + root navigation + written guide + drill ----
function ConceptPage({ concept, state, stateFor, onOpen, onBack, onPractice, busyConcept }) {
  const { subject, key, label, rank } = concept;
  const color = SUBJECTS[subject] ? SUBJECTS[subject].color : "var(--text)";
  const roots = rootsFor(subject, key); // [{ key, label, strand, rank }] — same subject
  const crossRoots = crossRootsFor(subject, key); // [{ subject, key, … }] — other subjects
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

      {/* A11y P1-5: this concept title was an <h2> styled as np-h1 — make it a real
          <h1> so the visual level matches the semantic level (one h1 per view). */}
      <h1 className="np-h1" style={{ color }}>{label}</h1>

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
              ? "Before practicing this again, work through the root concepts below; they are what this concept is built on."
              : "There's nothing lower to fall back on here. Try a gentler practice round on this concept before moving up."}
          </p>
        </div>
      )}

      {/* Root concepts — the foundations, each a link to its own page: the same-subject
          lower-rank roots, then any CROSS-SUBJECT roots (§12.2 enhancement — e.g.
          calculus-based physics → math derivatives), whose chips carry their subject
          name and navigate into that subject's concept page. */}
      {roots.length > 0 || crossRoots.length > 0 ? (
        <div className="np-card" style={{ marginBottom: 16 }}>
          <div className="np-cardicon" style={{ color }}>Root concepts: understand these first</div>
          {roots.length > 0 && (
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
          )}
          {crossRoots.length > 0 && (
            <>
              <div className="np-eyebrow np-eyebrow--sm" style={{ margin: "12px 2px 2px" }}>
                From other subjects
              </div>
              <div className="np-weaktags" style={{ marginTop: 6 }}>
                {crossRoots.map((r) => (
                  <ConceptChip
                    key={`${r.subject}:${r.key}`}
                    subject={r.subject}
                    concept={{ ...r, label: `${SUBJECTS[r.subject] ? SUBJECTS[r.subject].label : r.subject}: ${r.label}` }}
                    state={stateFor(r.subject, r.key)}
                    titleExtra={`${SUBJECTS[r.subject] ? SUBJECTS[r.subject].label : ""} · ${RANK_LABELS[r.rank] || ""} · ${r.strand || ""}`}
                    onOpen={() => onOpen({ ...r })}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <p className="np-hint" style={{ marginBottom: 16 }}>
          This is a foundational concept; it has no lower-rank prerequisites.
        </p>
      )}

      {/* The curated written guide (Phase D, §12.3): explanation, one fully worked
          example, and self-questions — read first, then practice below. */}
      {guide && <ConceptGuide guide={guide} color={color} />}

      {/* AI concept-practice drill (increment 3 + mastery calibration, RANKS_PLAN §6):
          an on-request question targeting THIS concept, framed at its rank band shifted
          by the learner's standing (green stretches up, red comes gentler — the server
          resolves the state authoritatively for signed-in users; masteryState is the
          guest fallback). Graded process-first; updates the mastery coloring above. */}
      <div className="np-card np-lesson">
        <div className="np-cardicon" style={{ color }}>Practice this concept</div>
        <p className="np-lessontext" style={{ color: "var(--muted)", marginBottom: 12 }}>
          Get a reasoning question aimed right at <strong style={{ color: "var(--text)" }}>{label}</strong>,
          framed at the {RANK_LABELS[rank] || rank} level.{" "}
          {state === "red"
            ? "Since you've been struggling here, the next question comes one notch gentler, to rebuild from the core idea."
            : state === "green"
              ? "You've shown mastery here, so expect a stretch question one notch up."
              : ""}{state === "red" || state === "green" ? " " : ""}Explain your thinking and it's graded on
          reasoning; your attempts update this concept's standing above.
        </p>
        {onPractice ? (
          <button
            type="button"
            className="np-btn np-primary np-btn--subject"
            style={{ "--subject": color }}
            disabled={generating}
            onClick={() => onPractice({ ...concept, masteryState: state })}
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
          Think these through before practicing; explaining your reasoning out loud counts.
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
