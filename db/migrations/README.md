# Database migrations — provisioning model (READ FIRST)

> **TL;DR:** `db/schema.sql` is the authoritative way to provision a fresh database.
> The numbered files in this directory are an **incremental change log** applied on top
> of the Supabase-connector-managed base — they are **NOT** guaranteed to apply cleanly,
> in order, to an empty database.

## Why the numbered migrations do not provision a fresh DB

An independent audit (2026-06) confirmed that running `0001a → 0023` against an empty
Postgres **aborts at `0002`**. The reasons:

- **Base objects are never created by a migration.** `concept_topics`, `concept_guides`,
  `security_events`, `concept_reports`, the historical `diagnostic_pool`, and helper
  functions like `_concept_key` / `promote_or_insert_guide` / `register_concepts` are
  **referenced** by `0002` (`revoke … on public.concept_guides, public.diagnostic_pool`),
  `0004`, `0005`, `0006`, `0008`, `0015`, and `0019` — but no file in this directory ever
  `create`s them. They were introduced into the live project directly via the connector /
  `schema.sql`, not via a numbered migration.
- **`0010` is intentionally absent** (the sequence skips from `0009` to `0011`; `0010`
  was reserved for a held curriculum stack).
- **Some referenced objects no longer exist in `schema.sql`** because later migrations
  drop them (`0013` drops `diagnostic_pool`, `0014` drops `register_concepts`). A faithful
  from-scratch granular history would therefore have to recreate objects that are dead in
  the current schema.

The live database (the connector's own migration history) and this directory's
consolidated files genuinely diverge in provenance. `schema.sql` is the single source of
truth that **matches production**.

## How to provision / reproduce the database

- **Fresh deploy, staging, or disaster recovery:** apply **`db/schema.sql`**. It is
  idempotent-friendly (`create … if not exists`, `create or replace`) and reflects the
  current production schema, RLS policies, grants, functions, and constraints.
- **Existing production database:** the connector applies new changes; the numbered files
  here are the human-readable audit trail of those changes (and the rationale comments).
  When adding a change, add it to **both** `schema.sql` (source of truth) and a new
  numbered file (changelog), keeping the function bodies identical between them.

## A note on `0020` vs `0023` (`upsert_subscription`)

`0023` / `schema.sql` hold the **hardened** webhook ordering guard
(`coalesce(excluded.event_modified_at, 'epoch') >= s.event_modified_at`). `0020` has been
edited to the same hardened form so that re-applying it (`create or replace`) can never
regress the guard to the old `excluded.event_modified_at is null` wildcard, which could
let a stale/partial event resurrect a canceled subscription. Always treat `schema.sql` as
authoritative if the two ever disagree.
