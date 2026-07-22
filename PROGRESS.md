# Model Monitor Progress

## Current phase

`Phase 1 — Foundation` ✅

## Current objective

Phase 2 — Model registry: model list, detail, CRUD, archive/restore, scores, benchmarks, merge.

Repository: `/home/admin/model-monitor/`

## Preflight repair (2026-07-22)

Baseline execution repair only. No Phase 2 product features implemented.

### Changes

- `pnpm-workspace.yaml` `allowBuilds`: `esbuild: true`, `sharp: true` (required by tsx/vitest/drizzle-kit and Next.js)
- `docker/compose.yaml` Postgres published as `127.0.0.1:5433:5432` (loopback-only); container recreated; volume `docker_pgdata` preserved
- Shared real linter: `scripts/lint.mjs` (TypeScript parse + forbid explicit `any` + secret-material patterns)
- Real unit/integration tests added for Phase 1 behavior (schemas, ui `cn`, auth policy, logger, health route, database schema/migrations, seed integrity)
- Package scripts wired so root turbo tasks run genuine checks (no `echo pass` / `--passWithNoTests`)
- Web typecheck uses `next typegen && tsc --noEmit`; turbo `build` depends on `typecheck` to avoid `.next/types` races
- `.gitignore` tightened for `.env.*` while keeping `.env.example`
- Removed explicit `any` in database schema self-FK and seed loader types

### Commands and results

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | ✓ pass (pnpm 11.11.0) |
| `docker compose -f docker/compose.yaml up -d --force-recreate` | ✓ pass; `127.0.0.1:5433->5432`; volume `docker_pgdata` kept |
| `ss -ltn \| grep 5433` | ✓ `127.0.0.1:5433` only |
| `pnpm lint` | ✓ pass (4 packages) |
| `pnpm typecheck` | ✓ pass (4 packages) |
| `pnpm test:unit` | ✓ pass (web 8, schemas 6, ui 3, database 3) |
| `pnpm test:integration` | ✓ pass (database seed integrity + web health) |
| `pnpm build` | ✓ pass (`next build` 14 routes) |
| seed integrity after recreate | ✓ 51 models / 4 subs / 19 access / 276 benchmarks / $61 |

### Seed integrity (post-recreate)

| Assertion | Expected | Actual | Status |
|---|---:|---:|---|
| Canonical models | 51 | 51 | ✓ |
| Subscriptions | 4 | 4 | ✓ |
| Model access records | 19 | 19 | ✓ |
| Benchmark evidence rows | 276 | 276 | ✓ |
| Regular monthly cost USD | 61 | 61 | ✓ |

## Decisions made during implementation

| Date | Decision | Reason | ADR |
|---|---|---|---|
| 2026-07-22 | Hand-written SQL migrations instead of Drizzle generate | SQL contract uses `UNIQUE NULLS NOT DISTINCT`, pgcrypto, deferred FKs | ADR-001 |
| 2026-07-22 | OpenAPI contract is incomplete — extend during implementation | 14 paths exist but PRD references ~30+ endpoints | ADR-002 |
| 2026-07-22 | Hermes serializer must map snake_case to camelCase explicitly | Schema uses camelCase, SQL uses snake_case | ADR-003 |
| 2026-07-22 | Local auth bypass via `AUTH_DEV_BYPASS=true` | Google OAuth credentials may be absent during local shell work | — |
| 2026-07-22 | Benchmark seed matches models by display name | Seed file uses model names, not canonical IDs | — |

## Completed work

| Date | Item | Evidence |
|---|---|---|
| 2026-07-22 | Phase 0 architecture lock | docs/adrs/*, docs/implementation-issues.md |
| 2026-07-22 | Monorepo workspace (pnpm + turbo) | package.json, pnpm-workspace.yaml, turbo.json |
| 2026-07-22 | Next.js app shell + routes | apps/web build success |
| 2026-07-22 | PostgreSQL 16 via Docker Compose | docker/compose.yaml, healthy container |
| 2026-07-22 | SQL migrations applied | 5 migration files, live DB |
| 2026-07-22 | Seed runner | 51/4/19/276/$61 |
| 2026-07-22 | Seed integrity tests | all assertions pass |
| 2026-07-22 | Auth.js Google OAuth + allow-list | apps/web/src/lib/auth.ts |
| 2026-07-22 | Request ID middleware | x-request-id on /api/* |
| 2026-07-22 | CI workflow | .github/workflows/ci.yml |
| 2026-07-22 | Production build | `next build` success |
| 2026-07-22 | Health endpoint | HTTP 200 + JSON |
| 2026-07-22 | Preflight execution baseline | lint/typecheck/unit/integration/build green; loopback Postgres |

## Verification evidence

| Date | Command or test | Result | Notes |
|---|---|---|---|
| 2026-07-22 | `tsx src/migrate.ts` | ✓ pass | 5 migrations applied |
| 2026-07-22 | `tsx src/seed.ts` | ✓ pass | ALL SEED ASSERTIONS PASS |
| 2026-07-22 | `tsx src/seed-integrity.test.ts` | ✓ pass | 51/4/19/276/61 + no dupes/orphans |
| 2026-07-22 | `tsc --noEmit` (database) | ✓ pass | |
| 2026-07-22 | `tsc --noEmit` (schemas) | ✓ pass | |
| 2026-07-22 | `tsc --noEmit` (web) | ✓ pass | |
| 2026-07-22 | `next build` | ✓ pass | 14 routes |
| 2026-07-22 | `GET /api/v1/health` | ✓ 200 | includes x-request-id |
| 2026-07-22 | `GET /dashboard` `/login` `/models` | ✓ 200 | shell pages render |
| 2026-07-22 | `pnpm lint` | ✓ pass | scripts/lint.mjs via turbo |
| 2026-07-22 | `pnpm typecheck` | ✓ pass | turbo 4 packages |
| 2026-07-22 | `pnpm test:unit` | ✓ pass | 20 tests across 4 packages |
| 2026-07-22 | `pnpm test:integration` | ✓ pass | seed integrity + health |
| 2026-07-22 | `pnpm build` | ✓ pass | next build 14 routes |

## Seed integrity

| Assertion | Expected | Actual | Status |
|---|---:|---:|---|
| Canonical models | 51 | 51 | ✓ |
| Subscriptions | 4 | 4 | ✓ |
| Model access records | 19 | 19 | ✓ |
| Benchmark evidence rows | 276 | 276 | ✓ |
| Regular monthly cost USD | 61 | 61 | ✓ |

## Open issues

| Priority | Issue | Owner | Blocked phase | Next action |
|---|---|---|---|---|
| Low | Alias seed inserts 25 rows but unique normalized aliases yield 21 | — | none | Acceptable; document in import matching |
| Medium | Google OAuth needs real client credentials for non-bypass login | owner | auth UX | Provide GOOGLE_CLIENT_ID/SECRET + ALLOWED_EMAILS |
| Medium | Health endpoint reports database:ok without live DB probe yet | — | P5 | Wire real DB ping |

## Acceptance criteria completed

Reference `docs/implementation-package/docs/13_ACCEPTANCE_CRITERIA.md`.

- [ ] Authentication (scaffold done; live Google OAuth not verified without credentials)
- [x] Seed and dashboard (seed counts only; live KPI cards still placeholders)
- [ ] Models
- [ ] Subscriptions and access
- [ ] Benchmarks and sources
- [ ] Import
- [ ] Export
- [ ] Hermes
- [ ] Security and operations
- [ ] Quality
