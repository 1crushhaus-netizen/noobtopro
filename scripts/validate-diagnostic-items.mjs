#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Validate the adaptive-diagnostic item bank (RANKS_PLAN §8): every (subject,
// band) cell must hold EXACTLY 2 items, ids unique + canonical, topicSlug a
// real taxonomy slug, conceptKey a real same-subject curriculum concept,
// surfaces allow-listed, trap only on a trap surface, questions substantial
// with no leaked solutions ("answer:" etc. is a heuristic, not a guarantee).
//
//   node scripts/validate-diagnostic-items.mjs            # all subjects
//   node scripts/validate-diagnostic-items.mjs math       # one subject
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { BAND_LADDER, conceptByKey } from "../lib/curriculum.js";

// lib/taxonomy.js imports through the "@/" alias, which plain node can't
// resolve — parse the slug vocabulary from source text instead. (Slug checks
// here are GLOBAL; the strict per-subject check lives in
// test/diagnostic-bank.test.js, which runs under the alias-aware vitest.)
const TAXONOMY_SRC = readFileSync(new URL("../lib/taxonomy.js", import.meta.url), "utf8");
const ALL_SLUGS = new Set([...TAXONOMY_SRC.matchAll(/\{ slug: "([a-z0-9_]+)"/g)].map((m) => m[1]));

const SUBJECTS = ["math", "physics", "chemistry"];
const EXPORTS = { math: "MATH_DIAGNOSTIC_ITEMS", physics: "PHYSICS_DIAGNOSTIC_ITEMS", chemistry: "CHEMISTRY_DIAGNOSTIC_ITEMS" };
const SURFACES = ["multi-step", "branch", "trap"];
const PER_CELL = 2;

const only = process.argv[2];
let failed = false;
const bad = (msg) => {
  failed = true;
  console.error(`✗ ${msg}`);
};

for (const subject of only ? [only] : SUBJECTS) {
  let items;
  try {
    ({ [EXPORTS[subject]]: items } = await import(new URL(`../lib/diagnosticItems/${subject}.js`, import.meta.url)));
  } catch (e) {
    bad(`${subject}: module missing/unparseable (${e.message})`);
    continue;
  }
  if (!Array.isArray(items)) {
    bad(`${subject}: ${EXPORTS[subject]} is not an array`);
    continue;
  }
  const ids = new Set();
  const cells = {};
  for (const q of items) {
    const where = `${subject} item ${q && q.id}`;
    if (!q || typeof q !== "object") { bad(`${subject}: non-object item`); continue; }
    if (typeof q.id !== "string" || ids.has(q.id)) bad(`${where}: missing/duplicate id`);
    ids.add(q.id);
    if (q.subject !== subject) bad(`${where}: subject mismatch`);
    if (!BAND_LADDER.includes(q.band)) bad(`${where}: band "${q.band}" not in BAND_LADDER`);
    if (!q.id.startsWith(`${subject}:${q.band}:`)) bad(`${where}: id must be "${subject}:${q.band}:<n>"`);
    cells[q.band] = (cells[q.band] || 0) + 1;
    if (!ALL_SLUGS.has(q.topicSlug)) bad(`${where}: topicSlug "${q.topicSlug}" is not a taxonomy slug`);
    if (!conceptByKey(subject, q.conceptKey)) bad(`${where}: conceptKey "${q.conceptKey}" is not a ${subject} curriculum concept`);
    if (!SURFACES.includes(q.reasoningSurface)) bad(`${where}: reasoningSurface "${q.reasoningSurface}" not allow-listed`);
    if (q.reasoningSurface === "trap" && (typeof q.trap !== "string" || q.trap.trim().length < 10)) bad(`${where}: trap surface needs a trap description`);
    if (q.reasoningSurface !== "trap" && q.trap) bad(`${where}: trap text on a non-trap surface`);
    if (typeof q.question !== "string" || q.question.trim().length < 60) bad(`${where}: question too short`);
    if (typeof q.question === "string" && /answer\s*:|solution\s*:/i.test(q.question)) bad(`${where}: question appears to leak a solution`);
    if (typeof q.targetConcept !== "string" || !q.targetConcept.trim()) bad(`${where}: missing targetConcept`);
    if (typeof q.topic !== "string" || !q.topic.trim()) bad(`${where}: missing topic`);
  }
  for (const band of BAND_LADDER) {
    if ((cells[band] || 0) !== PER_CELL) bad(`${subject}/${band}: ${cells[band] || 0}/${PER_CELL} items`);
  }
  if (!failed) console.log(`✓ ${subject}: ${items.length} items, every band ×${PER_CELL}, shape OK`);
}
process.exit(failed ? 1 : 0);
