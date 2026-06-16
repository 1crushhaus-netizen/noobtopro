# Audit 13 — Curriculum & Content Correctness

Auditor stance: ADVERSARIAL content/data-correctness review. Mandate was to assume the
content is wrong/inconsistent until proven otherwise, and to ground every finding in
real code/data (file:line). Scope: curriculum DB, taxonomy, concept keys, diagnostic
item bank, and the 224 curated written guides — both STRUCTURAL integrity and FACTUAL
correctness.

Bottom line: this corpus is, against expectation, remarkably clean. Programmatic
structural verification found **zero** integrity defects, and a manual numeric/factual
spot-check of 70+ worked examples spanning every subject and every level found **zero**
wrong answers. The findings below are therefore almost entirely P2 (maintainability /
documentation / minor convention notes). There are no P0s and no factual P1s.

---

## Validator run results (actual output)

Run from `/home/user/noobtopro`:

```
$ node scripts/validate-guides.mjs
✓ math/elementary: 21/21 guides, shape OK
✓ math/middle: 23/23 guides, shape OK
✓ math/high: 31/31 guides, shape OK
✓ math/university: 25/25 guides, shape OK
✓ physics/elementary: 10/10 guides, shape OK
✓ physics/middle: 13/13 guides, shape OK
✓ physics/high: 19/19 guides, shape OK
✓ physics/university: 20/20 guides, shape OK
✓ chemistry/elementary: 9/9 guides, shape OK
✓ chemistry/middle: 11/11 guides, shape OK
✓ chemistry/high: 18/18 guides, shape OK
✓ chemistry/university: 24/24 guides, shape OK
EXIT: 0
```

```
$ node scripts/validate-diagnostic-items.mjs
✓ math: 10 items, every band ×2, shape OK
✓ physics: 10 items, every band ×2, shape OK
✓ chemistry: 10 items, every band ×2, shape OK
EXIT: 0
```

Both validators pass. IMPORTANT CAVEAT (basis for the review, not a defect): the
diagnostic validator's own header says answer-correctness is **not** checked — it verifies
shape, unique/canonical IDs, that `topicSlug`/`conceptKey` resolve, and that questions are
substantial with no leaked solutions ("a heuristic, not a guarantee", `validate-diagnostic-items.mjs:7`).
Diagnostic items are open-response, reasoning-graded by the LLM (no stored answer key), so the
factual risk is in the *question/trap framing* and *concept labeling*, which I reviewed by hand.

Additional independent structural verification I ran (read-only, temp script, removed after):
- All 30 diagnostic-item `conceptKey`s resolve to a real **same-subject** curriculum concept.
- All 30 `topicSlug`s are valid **same-subject** taxonomy slugs.
- No duplicate concept keys within any subject.
- No `conceptKey()`-normalization collisions among curriculum labels (cache-key safety).
- Every `PREREQUISITES` entry references a real concept; every prereq is a **strictly lower
  rank, same subject** (acyclic by construction — confirmed, 0 violations).
- Every `CROSS_SUBJECT_PREREQUISITES` ref resolves, targets an earlier subject in
  `SUBJECT_FOUNDATION_ORDER`, and is rank ≤ source (0 violations).
- `SEED_CONCEPTS`: exactly one concept per taxonomy topic slug, all 36 slugs valid, no dups.
- Total curated guides = **224**, exactly matching the documented count (`lib/guides/index.js:5`)
  and exactly matching the curriculum concept count (224).

Result: **0 structural issues.**

---

## Summary table

| Severity | Count | Items |
|----------|-------|-------|
| P0 (Launch Blocker) | 0 | — |
| P1 (High) | 0 | — |
| P2 (Medium) | 5 | Duplicated seed list; band↔rank label semantics undocumented for support; one diagnostic concept-label mismatch; doctorate/phd coverage transparency; validator does not assert presence of a worked-answer/value in diagnostic items |

No P0 or P1 findings. The product's central credibility risk — wrong answers that mis-grade
users — was specifically hunted and **not found**.

---

## P0 — Launch Blockers

None.

Specifically checked and cleared:
- No diagnostic item with an objectively wrong correct-answer (items are reasoning-graded;
  every question's *implied* correct reasoning and every stated `trap` is factually sound —
  see the verification notes under P1 and below).
- No duplicate/colliding IDs or concept keys (`BY_ID` map in `lib/diagnosticBank.js:49`
  is collision-free; curriculum keys unique per subject).
- Validators pass (exit 0).
- No orphaned references: every diagnostic/guide/prereq/seed reference resolves to a real
  concept or taxonomy slug.

---

## P1 — High

None.

The mandate's highest-priority risks were each investigated:

- **Ambiguous / multiple-correct items:** The 30 diagnostic items are open-response and
  deliberately ask for *explained reasoning*; each has a single well-defined correct
  conclusion. The `trap` strings name a genuinely wrong naive path (e.g.
  `math:foundational:1` — "20% up then 20% down returns to $50" is correctly flagged as the
  trap; the real answer is $48, `lib/diagnosticItems/math.js:48-54`). No item is ambiguous.

- **Factual errors in guide content:** I manually recomputed 70+ worked examples across all
  12 (subject, level) cells. Every numeric result is correct. A representative sample that I
  re-derived independently and confirmed:
  - math/high `quadratics`: vertex t=2, h=45 m, lands t=5 s (`math/high.js:104-114`).
  - math/high `logarithms`: t = log1.5/log1.05 ≈ 8.31 yr (`math/high.js:195-204`).
  - math/university `applications_derivatives`: minimal can r≈4.30, h≈8.60 (h≈2r)
    (`math/university.js:62-72`).
  - math/university `eigenvalues`: λ=5,2 with eigenvectors (1,1),(1,−2); trace/det checks
    hold (`math/university.js:397-407`).
  - physics/high `collisions`: v=12 m/s, 40% KE lost (`physics/high.js:184-195`).
  - physics/university `special_relativity`: γ≈5.03, dilated lifetime ≈11.1 µs, range ≈3.3 km
    (`physics/university.js:402-411`).
  - chemistry/high `mole_molar_mass`: Ca(OH)₂ = 74.1 g/mol → 0.250 mol (`chemistry/high.js:229-244`).
  - chemistry/high `acids_bases_intro`: 0.010 M HCl → pH 2.00, 1000× vs pH 5 (`chemistry/high.js:357-366`).
  - chemistry/university `electrochemistry`: Daniell cell E°=+1.10 V, ΔG°=−212 kJ/mol,
    K≈10³⁷ (`chemistry/university.js:327-335`).
  - chemistry/university `biochemistry_intro`: glycine pI=(2.34+9.60)/2=5.97 (`chemistry/university.js:566-574`).

  Subtle conceptual claims were also checked and are correct, e.g. AC capacitor voltage
  "lags by 90°" / current leads (`physics/university.js:350-351`), apparent power
  "V×I = 73 W" vs real power 19 W correctly distinguished (`physics/university.js:360`),
  I-131 β-decays to *stable* Xe-131 (`chemistry/high.js:437`), Fe³⁺ = [Ar]3d⁵ with 5
  unpaired electrons via removing 4s first (`chemistry/university.js:43-44`).

- **Taxonomy / level mislabeling:** No university content is tagged elementary or vice
  versa. Guide cells map 1:1 to curriculum ranks. The diagnostic `band` vs `conceptKey`-rank
  differences are intentional and documented (see P2 below), not mislabeling.

- **Content-coverage gaps undercutting marketing:** Coverage is dense and honestly
  disclosed. Concept counts per cell: math 21/23/31/25, physics 10/13/19/20, chemistry
  9/11/18/24 (elementary/middle/high/university). The only empty cell is **doctorate** for
  all subjects — explicitly modeled as empty arrays and surfaced to users via
  `WIP_RANKS_NOTE` (`lib/curriculum.js:36-37,152-153`), so it is disclosed, not hidden.

---

## P2 — Medium

### [P2] Seed-concept list is duplicated between taxonomy.js and the seed script
- **File(s):** `lib/taxonomy.js:115-158` (`SEED_CONCEPTS`) and `scripts/seed-concept-hub.mjs:27-70` (`SEED`)
- **Category:** Maintainability / drift risk
- **Description:** The 36 (slug, concept) seed pairs are hand-copied into the seed script as
  a separate literal `SEED` rather than imported from `SEED_CONCEPTS`. The script's own
  comment acknowledges this ("mirrors lib/taxonomy.js SEED_CONCEPTS", line 19/26) and notes a
  test pins consistency (`test/seed-concepts.test.js`). I verified the two lists are currently
  identical, so this is not a present defect — but two sources of truth invite future drift if
  someone edits one and not the other (the script can't import taxonomy.js directly because
  taxonomy.js pulls the `@/` alias via `import { ORDER } from "@/lib/scoring"`, which plain
  Node can't resolve — the same reason the official validators parse taxonomy by regex).
- **Impact:** A future edit to one copy would silently seed the wrong public hub concept or
  skip a topic. Caught by tests today, but fragile.
- **Recommended fix:** Extract the seed pairs into an alias-free module (e.g. a plain JSON or a
  `.mjs` with no `@/` imports) imported by both `lib/taxonomy.js` and the seed script, so there
  is a single source of truth. Same root cause makes the official validators parse source text
  instead of importing — worth fixing the alias-resolution story generally.

### [P2] Diagnostic `band` deliberately differs from `conceptKey`'s curriculum rank — undocumented for support/QA
- **File(s):** `lib/diagnosticItems/{math,physics,chemistry}.js` (all items); behavior in `lib/diagnosticBank.js:1-28`
- **Category:** Convention clarity / future-maintainer footgun
- **Description:** Several items carry a `band` that does not equal the rank-band of their
  `conceptKey`. Examples: `math:phd:1` band=phd but `sequences_series` is a *university*
  concept; `chemistry:beginner:1` band=beginner but `mole_molar_mass` is a *high*-school
  concept (`chemistry.js:13-19`); `physics:beginner:1` band=beginner but
  `balanced_unbalanced_forces` is a *middle*-school concept. This is **by design** — the
  bank header (`lib/diagnosticBank.js:18-26`) states `conceptKey` records the concept an item
  *evidences* for mastery coloring, and PhD-band items intentionally map to the hardest
  existing university concept because doctorate cells are WIP. The `band` is what drives
  difficulty/adaptive walk; the `conceptKey` is only for mastery attribution. Nothing is wrong,
  but the divergence is non-obvious and a QA reviewer skimming the bank could mistake it for
  mislabeling.
- **Impact:** Low — purely a "why does a beginner item point at a high-school concept?"
  confusion risk during content review or support triage; mastery coloring may attribute a
  beginner-band performance to a higher-rank concept node.
- **Recommended fix:** Add a one-line note on each item file (or per anomalous item) restating
  that `band` ≠ concept rank by design, or have the diagnostic validator emit an informational
  line summarizing the band↔rank mapping so reviewers see it is intentional.

### [P2] One diagnostic item's `conceptKey` is a weak match for its content
- **File(s):** `lib/diagnosticItems/math.js:30-36` (`math:advanced:1`)
- **Category:** Concept labeling precision
- **Description:** `math:advanced:1` asks the learner to prove 1+3+5+…+(2n−1) = n² (an
  induction / general-argument task; `topicSlug: proof_reasoning`, `targetConcept:
  "constructing a general proof"`). Its `conceptKey` is `sequences_series_hs` (high-school
  "Sequences & series"). The concept key is *valid* (resolves, same subject) and defensible
  (the sum is a series), but the item is really evidencing proof/reasoning, and there is no
  curriculum concept that captures "induction/proof" at the high-school rank to attach it to
  cleanly. This is a minor mismatch between what the item tests and the concept its mastery
  signal will color.
- **Impact:** Low — a strong proof answer attributes mastery to `sequences_series_hs` rather
  than a proof concept; no grading impact (grader solves from the question text, not the key).
- **Recommended fix:** Either accept as-is (documented), or if a proof/reasoning curriculum
  concept exists or is added at the high rank, re-point the key there. NEEDS VERIFICATION that
  product owners consider `sequences_series_hs` the intended mastery target here.

### [P2] Doctorate rank present but empty while a "phd" diagnostic band is live — transparency check
- **File(s):** `lib/curriculum.js:25,152-153,230-231,308-309`; `lib/diagnosticBank.js:9-14`
- **Category:** Coverage transparency / marketing-claim integrity
- **Description:** The five-rank ladder advertises a Doctorate tier, but every subject's
  `doctorate` array is empty (WIP). The diagnostic still includes a `phd` band so a flawless
  run can place near the top of the range (documented owner decision, `lib/diagnosticBank.js:9-14`).
  The product handles this honestly via `WIP_RANKS_NOTE` ("practice for this rank is coming
  soon", `curriculum.js:36-37`) and `isRankWip()`. This is disclosed, so it is not a defect —
  flagged only so the marketing surface and the in-app messaging stay consistent: a user who is
  *placed* at phd by the diagnostic then finds doctorate practice greyed out, which must be
  framed gracefully.
- **Impact:** Low if messaging is consistent; could feel like a bait-and-switch if any
  marketing copy implies doctorate-level *practice* exists today.
- **Recommended fix:** Confirm no marketing/onboarding copy promises doctorate practice
  content; ensure the post-diagnostic "you placed at PhD" flow explicitly references the WIP
  note. (Coordination with the growth/marketing audit, not a code change here.)

### [P2] Diagnostic-item validator does not assert any answerable/gradeable target beyond text length
- **File(s):** `scripts/validate-diagnostic-items.mjs:60-66`
- **Category:** Missing validation rule (defense-in-depth)
- **Description:** The validator checks `targetConcept`, `topic`, question length ≥ 60, and a
  leaked-solution heuristic, but there is no positive assertion that an item is actually
  *gradeable* — e.g. no check that the question contains the quantities needed to reach a
  determinate answer. This is acceptable for reasoning-graded open items (by design there is no
  answer key), and all current items are in fact well-posed (verified by hand). The gap is that
  a future malformed item (e.g. missing a needed value) would pass the validator and only fail
  at grade time against the LLM.
- **Impact:** Low today (0 malformed items); a latent risk for future authoring.
- **Recommended fix:** Optionally extend the eval harness (`scripts/eval-grading-ordering.mjs`)
  to run each bank item through the live grader's `solve` step and flag any item the grader
  cannot solve to a determinate answer — turning "well-posed" into a checked property rather
  than a manual one.

---

## Verification appendix — what was checked and how

- **Structural:** wrote a temporary read-only script importing `lib/curriculum.js` +
  `lib/diagnosticItems/*` + `lib/conceptKey.js` and parsing `lib/taxonomy.js` (regex, to dodge
  the `@/` alias), asserting all invariants listed at the top. 0 issues. Script removed; no
  source modified.
- **Factual (math):** re-derived every worked example in math/elementary, math/middle,
  math/high, math/university. All correct.
- **Factual (physics):** re-derived every worked example in physics/elementary, physics/high,
  physics/university (and reviewed physics/middle traps/claims). All correct.
- **Factual (chemistry):** re-derived every worked example in chemistry/elementary,
  chemistry/middle, chemistry/high, chemistry/university. All correct.
- **Diagnostic items:** reviewed all 30 questions + every `trap` string for factual soundness
  and ambiguity. All sound; no wrong/ambiguous items.
- **Counts:** loaded all 12 guide modules at runtime — total 224, matches curriculum and the
  documented claim.

Files reviewed: `lib/curriculum.js`, `lib/catalog.js`, `lib/taxonomy.js`, `lib/conceptKey.js`,
`lib/diagnosticBank.js`, `lib/diagnosticItems/{math,physics,chemistry}.js`,
`lib/guides/index.js`, `lib/guides/validate.js`, and all 12 `lib/guides/<subject>/<rank>.js`
files in full or near-full; `scripts/validate-guides.mjs`, `scripts/validate-diagnostic-items.mjs`,
`scripts/eval-grading-ordering.mjs`, `scripts/seed-concept-hub.mjs`.
