# ADR-001: Hand-written SQL migrations instead of Drizzle generate

Date: 2026-07-22

## Status

Accepted

## Context

The SQL contract in `contracts/postgresql-schema.sql` is the authoritative database
definition. It uses PostgreSQL-specific features that Drizzle's migration generator
may not fully support:

- `UNIQUE NULLS NOT DISTINCT` on `model_access(model_id, plan_id, provider_model_id)`
- `CREATE EXTENSION pgcrypto` for `gen_random_uuid()`
- Deferred foreign keys (added via `ALTER TABLE` after dependent tables exist)
- `CHECK (importance BETWEEN 1 AND 5)` constraint

Drizzle schema files (`packages/database/src/schema/*.ts`) are maintained as the
TypeScript type-level representation for application code. Migrations are hand-written
SQL files that exactly mirror the contract.

## Decision

Use hand-written SQL migration files under `packages/database/migrations/` as the
source of truth for database structure. Run them via `drizzle-kit` or direct `psql`.

The Drizzle TypeScript schema is used for type-safe queries in application code but
is not used to generate migrations.

## Consequences

- Migrations must be reviewed against the SQL contract manually.
- Drizzle schema and SQL migrations may diverge if not kept in sync.
- Future schema changes require both a new SQL migration and a Drizzle schema update.
- `UNIQUE NULLS NOT DISTINCT` is preserved exactly as written in the contract.
