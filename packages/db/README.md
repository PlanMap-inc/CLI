# @planmap/db

The PlanMap **storage adapter**. Implements the `StorageAdapter` seam from
`@planmap/core`.

## Milestone 1: `LocalStore`

A **JSON-canonical** `.planmap/` store, committed to git — durable, shareable,
no server or database. JSON files under `nodes/`, `edges/`, and `drift/` are the
source of truth; an in-memory index (rebuilt from JSON on open) makes queries
fast.

## Versioning & migrations (the `makemigrations` analog)

`.planmap/config.json` records a schema `version`. On open, if the store is
older than `SCHEMA_VERSION`, an **ordered forward-migration runner** applies each
`up()` in sequence, rewrites the store, and bumps the version — then the current
schema validates it. A schema change = add one migration entry. Contributors
never hand-fix old stores, and a store written by one version opens cleanly in a
newer one.

## Roadmap

`CloudStore` (Postgres) implements the same interface with an identical logical
schema — an edition is a deployment choice, not a fork. Postgres migrations use
Drizzle + drizzle-kit (`pnpm db:generate` / `pnpm db:migrate`).
