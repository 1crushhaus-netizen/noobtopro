// ---------------------------------------------------------------------------
// conceptKey() — the canonical concept→cache-key normalizer.
//
// Pure (no env, no I/O), so it is safe to import from BOTH server code and
// client components. It lives in its own module precisely so the browse UI
// (lib/catalog.js → client) can use it WITHOUT pulling in the server-only
// service-role client (lib/supabaseAdmin.js re-exports it for server callers).
//
// Kept byte-for-byte identical to the SQL _concept_key() in db/schema.sql
// (pinned by test/conceptKey.test.js golden vectors + a live-DB equality check):
//   1. strip control/format chars (C0, DEL+C1, zero-width, BOM) — the set where
//      JS \s / String.trim() and Postgres \s disagree — so the two can't diverge;
//   2. trim → lowercase → strip surrounding quote runs → collapse whitespace;
//   3. truncate to 200 by CODE POINT (Array.from), matching SQL left(), so an
//      astral/emoji char straddling position 200 isn't split into a lone surrogate.
// ---------------------------------------------------------------------------

export function conceptKey(concept) {
  const cleaned = String(concept ?? "").replace(/[\x00-\x1F\x7F-\x9F​-‍﻿]/g, "");
  const normalized = cleaned
    .trim()
    .toLowerCase()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ");
  return Array.from(normalized).slice(0, 200).join("");
}
