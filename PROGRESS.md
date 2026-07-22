# Model Monitor Progress

## Current phase

`Phase 1 — Foundation` ✅

## Current objective

Phase 2 — Model registry: model list, detail, CRUD, archive/restore, scores, benchmarks, merge.

Repository: `/home/admin/model-monitor/`

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
