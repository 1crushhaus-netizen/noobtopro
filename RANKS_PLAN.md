# noobtopro — Ranking System Redesign (Proposed Design)

> **Status: PROPOSED — not yet implemented.** This documents the *target* Elo/ranking
> system only. It supersedes the current 0–100 Glicko display + 5 fixed bands. The
> open items in §11 must be resolved before this is a buildable spec.

---

## 1. Goals & guiding principles

1. **Objective, rank-defined understanding.** A subject score is an objective measure of
   how well the learner understands that subject's concepts *at their rank's real-world level*.
2. **Progression reflects understanding only.** A learner's rank is driven solely by their
   demonstrated reasoning — **never** by how they compare to other people.
3. **Breadth before depth-skipping.** A learner must master a rank's full concept set before
   advancing (e.g. complete understanding of *elementary* math before *middle-school* math).
4. **Anti-gaming.** The system rewards genuine reasoning, not reasoning-shaped text, and
   cannot be climbed by grinding a single concept.
5. **Competition is motivation, not measurement.** Percentile vs. peers exists to motivate,
   and never influences the rank/score.

---

## 2. The rating scale

- **Engine:** Glicko-2 (internally unchanged — ratings centered at ~1500, with rating
  deviation `rd` and volatility `vol` per Glickman 2013).
- **Display:** each subject is scored **0–350**. This is a pure *display* remap of the
  existing engine (×3.5): internal Glicko ratings are scale-free, so **no rating data
  migrates** — only the displayed number, the cached `scores.score` column, and the labels.
  - `scoreFromRating(r) = round(350 · sigmoid((r − 1500) / D))` → rating 1500 maps to 175
    (the center, top of "High").
  - `ratingFromScore` is the exact inverse.
- The five new ranks land **exactly** on the old band cutoffs at ×3.5 (0/20/40/60/80/100 →
  0/70/140/210/280/350), so existing users keep their true skill and simply re-label.

---

## 3. The five ranks (absolute, fixed bands)

| Rank | Score (0–350) | Real-world level |
|---|---|---|
| **Elementary** | 0 – 69 | elementary-schooler knowledge |
| **Middle** | 70 – 139 | middle-schooler |
| **High** | 140 – 209 | high-schooler |
| **University** | 210 – 279 | undergraduate |
| **Doctorate** | 280 – 350 | PhD-level |

- Ranks are **absolute fixed bands**, NOT percentile cutoffs. The cutoffs encode an
  intrinsic real-world level, not a position relative to other users.
- Cross-subject totals: 3 subjects → **0–1050**; the "Doctorate index" (overall progress)
  is the mean of the three subject scores.

---

## 4. Metrics & weighted aggregation

Each answer is graded on **9 reasoning-chain axes, 0–4 each**. Aggregation is **weighted**
(not a flat average) so a conceptual error costs more than an arithmetic slip:

| Axis | Weight | Captures |
|---|---:|---|
| Principle | 5 | the right governing principle (conceptual) |
| Justification | 4 | *why* this method applies |
| Logic | 4 | valid inferences; no inverted ratios (reasoning) |
| Strategy | 3 | the solution route (strategic) |
| Verification | 3 | units carried + sanity check |
| Comprehension | 2 | states givens + goal |
| Method | 2 | right operations, right order |
| Computation | 1 | arithmetic only (the "slip" axis) |
| Communication | 1 | clarity |

- **Weights sum to 25**, so the weighted sum maxes at 100 — the per-attempt **"quality %"**
  is `Σ(weightᵢ × valueᵢ)`, displayed as *answer quality* (e.g. "Reasoning quality: 74%"),
  **distinct from the learner's /350 rank**.
- **Under the hood:** each axis carries its **own** Glicko rating; the subject rating is the
  weighted aggregate of the 9 axis ratings (same weights), squashed to 0–350. This drives
  the radar profile while behaving, at the subject level, exactly as your model describes
  ("average the metrics → one outcome → gain/lose points").

---

## 5. The per-attempt loop

1. **Select** — the adaptive engine picks a concept at the learner's current rank whose
   **absolute difficulty ≈ the learner's current rating** (see §6).
2. **Generate** — a question is produced for that concept, framed at the rank's real-world
   level (Elementary vocabulary … Doctorate rigor).
3. **Grade** — the LLM grader solves it first (compute-first), then scores the 9 axes with
   anti-gaming rules (jargon/length/"reasoning-shaped text" → 0) at temperature 0 for
   repeatability. Final-answer correctness is a *diagnostic*, never a direct score input.
4. **Update** — weighted quality becomes the Glicko **outcome** (0–1); each axis updates
   against the concept's **absolute difficulty** (the Glicko opponent). The subject rating
   re-aggregates.
5. **Record** — quality % shown to the learner; the concept's mastery state updates (§7).
6. **Repeat** — the learner ranks up when **both** depth (rating) **and** curriculum
   coverage (§7) are satisfied.

---

## 6. Difficulty: absolute & curriculum-anchored

- Every concept has a **fixed difficulty anchored to its rank's real-world level**. An
  Elementary question is *intrinsically* elementary — its difficulty is **never tuned by
  the crowd**.
- **"At-rating" is achieved by selection, not by tuning the opponent.** The engine serves
  concepts whose absolute difficulty sits near the learner's current rating, so matches stay
  informative (~50% expected) and stiffen as the learner climbs — while the difficulty value
  itself stays absolute.
- Population outcomes per item **are** recorded, but used **only** for analytics (e.g.
  surfacing miscalibrated items for human review) — **never** as the rating's opponent.
  This is the change that removes *all* peer influence from the rank.

---

## 7. Curriculum & mastery (the breadth gate)

This is the layer that turns "an Elo number" into "objective, rank-defined understanding."

- **Curriculum:** a defined **concept set per `(subject, rank)`** — the concepts that
  *define* that rank's level (e.g. "Elementary math = {place value, basic fractions,
  proportional reasoning, …}"). Each concept carries its absolute difficulty (§6).
- **Mastery:** per-concept competence is tracked for each learner.
- **Coverage-gated promotion:** a learner **cannot cross into the next rank until they have
  mastered the current rank's full concept set** — depth (rating) alone is insufficient. Even
  a prodigy must demonstrate each concept; the adaptive engine routes them to the ones they
  haven't yet covered.
- **Anti-gaming corollary:** because promotion requires breadth, a learner cannot rank up by
  repeatedly acing one concept.

---

## 8. Adaptive diagnostic placement

- **Branching:** start each subject near the middle (~High), grade, nudge a provisional
  rating up/down, and pick the next question's rank from that — ~4–6 steps per subject,
  interleaving the three subjects round-robin to hide grading latency.
- **Final placement** = the **reasoning-anchored, difficulty-weighted aggregate** of the
  answers given (full 0–350 range: a blank/idk test lands at the dock floor, a flawless one
  near 350). This seeds the Glicko state at **full RD** so subsequent practice refines it.
- This replaces today's fixed 9-question batch-graded diagnostic; the diagnostic becomes an
  iterative, stateful sequence (like practice).

---

## 9. Percentile / peer comparison (analytics only)

- An anonymous rank-tier distribution + the learner's own position is shown for **motivation**.
- It is **display-only** and **never** feeds the rating (the leaderboard already works this
  way; once difficulty is absolute per §6, the population's entire influence on rank is gone).

---

## 10. Implementation surface (high level)

| Area | Change |
|---|---|
| `lib/scoring.js` | 0–350 scale, 5-rank `rankFor`, weighted aggregate, rank-midpoint difficulty anchors; delete dead `blend`/`eloUpdate`. |
| `lib/groq.js`, `lib/gradeInput.js` | rank vocabulary (5 ranks), prompt rewrites with real-world framing, pass rank into generation. |
| **Curriculum module (NEW)** | concept set + absolute difficulty per `(subject, rank)`. |
| **Mastery + promotion (NEW)** | per-concept mastery tracking + coverage-gated rank-up logic (DB + server). |
| `app/api/generate`, `app/api/score` | feed rating→rank into generation; Glicko opponent = concept's absolute difficulty; remove population self-calibration from the rating path (keep `item_difficulty` as analytics-only). |
| Adaptive diagnostic | new iterative client flow + API step. |
| DB migration | RPC score clamps 0–100 → 0–350; recompute cached `scores.score` from the (scale-free) glicko; new curriculum/mastery tables; `item_difficulty` → analytics-only. |
| `components/*` | `/100` → `/350`, rank chips + colour ramp, "quality %" relabel, copy/`SCALE_NOTE`. |
| Tests | rescale the scoring suite; add rank-mapping, coverage-gate, and absolute-difficulty tests. |

---

## 11. Open items (must resolve before build)

These four (plus three further considerations) are unresolved and materially change the
size and behavior of the build.

### 11.1 Curriculum source — *curated vs. generated*
Absolute difficulty + a defined concept set per rank strongly implies a **curated
curriculum**: a human defines "Elementary math = these concepts, at these difficulties."
- **What must be authored:** for each of 3 subjects × 5 ranks, the concept list, each
  concept's absolute difficulty, and (for the adaptive diagnostic) at least a few seed items
  per concept so branching doesn't repeat.
- **Option A — curated structure + Groq-generated drills (recommended):** humans author the
  concept set + difficulties; Groq generates the *practice questions* within each concept
  (varied drilling). Standardized structure, varied questions.
- **Option B — fully generated:** Groq proposes concepts and questions. Far less authoring,
  but placement is no longer identical for everyone and "objective, rank-defined" weakens.
- **Cost:** Option A is the largest single authoring task in the project (the curriculum is
  the product's backbone). Decision needed: who authors it, and at what concept granularity.

### 11.2 What "concept mastery" means — ✅ RESOLVED: sustained-quality flag (see §12.1)
How is a concept marked mastered for a learner?
- **Option A — per-concept mini-Glicko:** each concept gets its own rating; "mastered" =
  rating ≥ the rank's threshold. Most precise + gaming-resistant, but heavy (many concepts ×
  ratings to store/update).
- **Option B — sustained-quality flag:** "mastered" = achieved ≥ X quality on the concept at
  rank difficulty, over ≥ N distinct attempts (anti one-off). Lighter, simpler, easier to
  explain; less granular.
- Drives storage model, gaming-resistance, and how "coverage" is computed for the gate.

### 11.3 Rating vs. the rank cap
When a learner's *depth* (rating) would exceed their current rank but they haven't covered
the curriculum:
- **Option A — soft-cap the score at the rank ceiling** (e.g. hold at 139 until Middle's
  curriculum is complete, then release the accumulated rating into High). Clear "you're
  gated" signal; the number can plateau.
- **Option B — uncapped rating, gated *displayed rank*:** the number rises past 139 but the
  rank label stays "Middle (curriculum X% covered)" until coverage completes.
- Affects what number the learner sees and how the "do the rest of the curriculum" nudge reads.

### 11.4 Adaptive diagnostic length / latency
Each diagnostic step is a sequential graded round-trip (can't batch).
- Cap at ~4–6 steps/subject? Tighter (e.g. 3) = faster but less accurate first placement
  (practice converges the rest). Interleaving subjects hides some latency; the cost/rate-limit
  guards apply. Decision: the step cap and the latency budget.

### 11.5 (further) Existing-user migration & grandfathering
The rating remaps cleanly (×3.5, scale-free), **but the new coverage gate is new data**:
existing users have no per-concept mastery history. Options: grandfather everyone at their
current rank (gate only *future* promotions), or require retroactive coverage (re-locks
progress — likely too punitive). Recommendation: grandfather at current rank.

### 11.6 (further) Demotion / de-ranking
Can a learner drop a rank if their rating falls below the band (e.g. a sustained regression)?
If so, does dropping a rank re-lock the lower curriculum? Recommendation: allow rating to
fall within bands, but do not strip *covered* curriculum mastery (coverage is monotonic;
only the live rating moves). Needs an explicit call.

### 11.7 (further) Grader objectivity ceiling
"Extremely objective" is bounded by LLM-as-judge. Beyond what exists (compute-first grading,
temp 0, anti-gaming rules, final-answer-as-diagnostic), optional hardening: deterministic /
symbolic checks where the domain allows (numeric answers + units), multi-sample grader
consensus, and tight per-rank rubric anchors. Decision: how far to invest here, given the
whole anti-gaming guarantee leans on grader robustness.

---

## 12. Learn tab — concept browser, mastery coloring & concept pages

The Learn tab is the front-end of the curriculum (§7). It is built in phases:

- **Phase A — SHIPPED:** the Learn tab is a static browse of the fixed curriculum
  (`lib/curriculum.js`), organized Subject → Rank, with concepts as non-interactive chips;
  Doctorate greyed (WIP). Generated/auto-grown concepts removed. *(Done.)*
- **Phases B–D below** are specified here with the owner's decisions baked in.

### 12.1 Mastery coloring (Phase B) — ✅ resolves §11.2
Each concept chip is colored by the learner's per-concept state:

| Color | Meaning |
|---|---|
| 🟢 green | clear understanding |
| 🟡 yellow | practiced but struggling / mixed |
| 🔴 red | attempted and failed, or skipped — "study the foundations first" |
| ⚪ grey | never covered |

- **Mastery model = sustained-quality flag** (the resolution of §11.2): a concept turns green
  after ≥ X quality over ≥ N distinct attempts; yellow on mixed/struggling; red on failed or
  skipped; grey until touched. Lightweight, explainable, gaming-resistant. *(Not a per-concept
  Glicko.)*
- **Coloring is direct-only — no propagation.** The initial diagnostic colors only the concepts
  it actually tested; everything else stays grey until practiced. (Chosen over rank-based
  inference and graph propagation.)
- **Red is a warning, not a gate.** A red concept stays practiceable but shows a strong warning
  + a "start with these root concepts first" nudge (the roots come from §12.2).
- **Storage:** per-concept mastery is stored per user — `localStorage` for guests, a per-user
  table for signed-in users. **Depends on:** attempts being *tagged to a curriculum concept key*
  (today the diagnostic is 9 untagged questions and practice is per-subject — this tagging is
  the foundational prerequisite for Phase B).

### 12.2 Concept page + prerequisite graph (Phase C)
- **Prerequisite graph = hand-authored** (the owner's choice over AI-proposed). Each concept
  gains a `roots: [conceptKey, …]` field in `lib/curriculum.js`: its **direct (1–4), most-relevant,
  LOWER-RANK, same-subject** prerequisites. Elementary concepts have `roots: []`. The graph is a
  DAG by construction (edges only point down in rank → no cycles). *Defaults (adjustable):
  lower-rank only and within-subject; cross-subject links (e.g. calculus-based physics → math)
  are a noted future enhancement.*
- **Concept page:** opening a concept shows a dedicated page — title = the concept, and beneath
  it the **root concepts as clickable buttons** that navigate to their pages. This makes the
  learning path explicit and branched. The same graph powers the red-concept "start with roots"
  nudge in §12.1.

### 12.3 Concept page content (Phase D — separate later project)
The page body (explicitly deferred by the owner to its own project):
- a section explaining the concept **with a solved example problem**;
- a section of **self-questions** to promote thinking;
- an on-request **AI-generated problem targeting this concept** — this is the per-concept
  *calibrated drill* (difficulty tied to the learner's mastery of this concept, per §6).
The explanation/example/self-questions are **curated, static** content (authored once); only the
targeted problem is generated at runtime.

### 12.4 Build order
1. **Prerequisite graph** (`roots` in `lib/curriculum.js`) — self-contained authoring; unblocks
   §12.2 navigation + the §12.1 red nudge. *(In progress.)*
2. **Concept-tagged attempts + per-concept mastery storage** — the foundation for §12.1 coloring.
3. **Coloring (Phase B).**
4. **Concept-page shell + root navigation (Phase C).**
5. **Page content + AI drill (Phase D)** — later project.
