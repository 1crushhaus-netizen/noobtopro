#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Validate the curated written guides (Phase D, RANKS_PLAN §12.3) against the
// curriculum: every concept in a populated (subject, rank) cell must have a guide
// in lib/guides/<subject>/<rank>.js, with no extra keys and no shape problems
// (rules shared with the CI suite via lib/guides/validate.js).
//
// Run from the repo root:
//   node scripts/validate-guides.mjs                # all populated cells
//   node scripts/validate-guides.mjs math middle    # one cell
// Exits non-zero on any missing/extra/malformed guide (also used by the content-
// authoring workflow to self-check a cell before review).
// ---------------------------------------------------------------------------

import { CURRICULUM, RANKS, conceptsFor } from "../lib/curriculum.js";
import { guideProblems } from "../lib/guides/validate.js";

const [subjArg, rankArg] = process.argv.slice(2);
let failed = false;

async function checkCell(subject, rank) {
  const concepts = conceptsFor(subject, rank);
  if (!concepts.length) return; // WIP rank (doctorate) — nothing to validate
  const wanted = concepts.map((c) => c.key);

  let guides;
  try {
    ({ GUIDES: guides } = await import(new URL(`../lib/guides/${subject}/${rank}.js`, import.meta.url)));
  } catch {
    console.error(`✗ ${subject}/${rank}: module lib/guides/${subject}/${rank}.js missing or unparseable (${wanted.length} guides needed)`);
    failed = true;
    return;
  }
  if (!guides || typeof guides !== "object") {
    console.error(`✗ ${subject}/${rank}: no GUIDES export`);
    failed = true;
    return;
  }

  const have = Object.keys(guides);
  const missing = wanted.filter((k) => !have.includes(k));
  const extra = have.filter((k) => !wanted.includes(k));
  const shape = [];
  for (const k of have) {
    for (const p of guideProblems(guides[k])) shape.push(`${k} — ${p}`);
  }

  if (missing.length || extra.length || shape.length) {
    failed = true;
    console.error(`✗ ${subject}/${rank}: ${have.length}/${wanted.length} guides`);
    if (missing.length) console.error(`  missing: ${missing.join(", ")}`);
    if (extra.length) console.error(`  extra: ${extra.join(", ")}`);
    for (const p of shape) console.error(`  shape: ${p}`);
  } else {
    console.log(`✓ ${subject}/${rank}: ${have.length}/${wanted.length} guides, shape OK`);
  }
}

if (subjArg && rankArg) {
  await checkCell(subjArg, rankArg);
} else {
  for (const subject of Object.keys(CURRICULUM)) {
    for (const rank of RANKS) await checkCell(subject, rank);
  }
}
process.exit(failed ? 1 : 0);
