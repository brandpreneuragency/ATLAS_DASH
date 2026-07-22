# Model Monitor Progress

## Current phase

`Phase 2 — Model registry` ✅

## Current objective

Phase 3 — Subscriptions and access paths.

Repository: `/home/admin/model-monitor/`

## Phase 2 — Model registry (2026-07-22)

### Delivered

- Server-paginated model library with URL-addressable filters/search/sort
  - search: name, canonical ID, alias, developer, access provider
  - filters: developer, family, lifecycle, accessProvider, accessible, archived, capability flags
- Model detail tabs: Overview, Capabilities, Scores, Benchmarks, Access, Sources, History
- Create/edit forms with shared Zod validation (`@model-monitor/schemas`)
- Archive/restore (DELETE archives; POST restore)
- Aliases with normalized uniqueness
- Tri-state capabilities (null = unknown, never coerced to false)
- Scores/ranks with methodology version; blank scores render as "—", never "0"
- Benchmark evidence grouped by comparable group + source/verification metadata
- Immutable audit events on create/update/archive/restore/merge/alias
- Transactional merge transferring aliases, access, benchmarks, scores, sources, provenance; rollback on failure; source archived with `mergedIntoModelId`

### Key paths

- `packages/schemas/src/index.ts` — write/list/merge schemas + pure helpers
- `packages/database/src/services/models.ts` — repository/service boundary
- `apps/web/src/app/api/v1/models/**` — API routes
- `apps/web/src/app/models/**` — UI pages
- `apps/web/e2e/models.spec.ts` — Playwright flows
- `packages/database/src/models.integration.test.ts` — Postgres integration

### Commands and results

| Command | Result |
|---|---|
| `pnpm lint` | ✓ pass (4 packages; ESLint 9 flat) |
| `pnpm typecheck` | ✓ pass (4 packages) |
| `pnpm test:unit` | ✓ pass (schemas 17, web 8, database 3, ui 3) |
| `pnpm test:integration` | ✓ pass (seed integrity 51/4/19/276/$61 + 6 model registry tests) |
| `pnpm test:e2e` | ✓ pass (3 Playwright tests: browse/filter, create/edit/archive/restore, merge) |
| `pnpm build` | ✓ pass (`next build` model routes + API) |
| `python3 "$PLAN_DIR/check_phase.py" 2` | run after PROGRESS update |

Evidence logs under `/home/admin/.hermes/orchestrator/runs/model-monitor-grok45-completion/`:
`lint-p2.txt`, `typecheck-p2.txt`, `unit-p2.txt`, `integration-p2.txt`, `e2e-p2-final.txt`, `build-p2.txt`

### Seed integrity (post Phase 2)

| Assertion | Expected | Actual | Status |
|---|---:|---:|---:|
| Canonical models | 51 | 51 | ✓ |
| Subscriptions | 4 | 4 | ✓ |
| Model access records | 19 | 19 | ✓ |
| Benchmark evidence rows | 276 | 276 | ✓ |
| Regular monthly cost USD | 61 | 61 | ✓ |

### Acceptance criteria covered (Models + related)

Reference `docs/implementation-package/docs/13_ACCEPTANCE_CRITERIA.md`.

- [x] Search finds a model by canonical name, alias, and ID
- [x] Model can be created and edited
- [x] Archive removes model from default views
- [x] Restore returns it
- [x] Unknown capability displays as unknown
- [x] Blank score does not display as zero
- [x] Every write creates an audit event
- [x] Merge transfers all required relationships transactionally
- [x] Comparable group is retained (detail benchmarks tab)
- [x] Source URL and verification date are visible
- [x] Score methodology version is visible
- [x] Lint / typecheck / unit / integration / E2E pass

### Notes

- Playwright Chromium requires user-local shared libs under `~/.local/pw-libs` when system packages cannot be installed with sudo; `playwright.config.ts` sets `LD_LIBRARY_PATH`.
- Temporary `test:` / `e2e:` models are cleaned via `packages/database/src/cleanup-test-models.ts` so seed counts stay authoritative.

## Preflight repair (2026-07-22)

Baseline execution repair only. No Phase 2 product features implemented at that time.

### Changes

- `pnpm-workspace.yaml` `allowBuilds`: `esbuild: true`, `sharp: true`, `unrs-resolver: true`
- `docker/compose.yaml` Postgres published as `127.0.0.1:5433:5432` (loopback-only)
- Genuine ESLint 9 flat-config quality gate restored
- Real unit/integration tests for Phase 1 behavior
- Package scripts wired so root turbo tasks run genuine checks
- Web typecheck uses `next typegen && tsc --noEmit`

### Commands and results

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | ✓ pass (pnpm 11.11.0) |
| `docker compose -f docker/compose.yaml up -d --force-recreate` | ✓ pass; `127.0.0.1:5433->5432` |
| `pnpm lint --force` | ✓ pass |
| `pnpm typecheck --force` | ✓ pass |
| `pnpm test:unit --force` | ✓ pass |
| `pnpm test:integration --force` | ✓ pass |
| `pnpm build --force` | ✓ pass |

## Decisions made during implementation

| Date | Decision | Reason | ADR |
|---|---|---|---|
| 2026-07-22 | Hand-written SQL migrations instead of Drizzle generate | SQL contract uses `UNIQUE NULLS NOT DISTINCT`, pgcrypto, deferred FKs | ADR-001 |
| 2026-07-22 | OpenAPI contract is incomplete — extend during implementation | 14 paths exist but PRD references ~30+ endpoints | ADR-002 |
| 2026-07-22 | Hermes serializer must map snake_case to camelCase explicitly | Schema uses camelCase, SQL uses snake_case | ADR-003 |
| 2026-07-22 | Local auth bypass via `AUTH_DEV_BYPASS=true` | Google OAuth credentials may be absent during local shell work | — |
| 2026-07-22 | Benchmark seed matches models by display name | Seed file uses model names, not canonical IDs | — |
| 2026-07-22 | Model service lives in `@model-monitor/database` | Keeps DB work out of React; enables package integration tests | — |

## Completed work

| Date | Item | Evidence |
|---|---|---|
| 2026-07-22 | Phase 0 architecture lock | docs/adrs/*, docs/implementation-issues.md |
| 2026-07-22 | Phase 1 foundation | seed 51/4/19/276/$61; lint/typecheck/unit/integration/build |
| 2026-07-22 | Phase 2 model registry | PLAN.md Phase 2 [x]; e2e + integration + unit gates |

## Verification evidence

| Date | Command or test | Result | Notes |
|---|---|---|---|
| 2026-07-22 | `pnpm lint` | ✓ pass | Phase 2 |
| 2026-07-22 | `pnpm typecheck` | ✓ pass | Phase 2 |
| 2026-07-22 | `pnpm test:unit` | ✓ pass | includes filter/null/merge helper tests |
| 2026-07-22 | `pnpm test:integration` | ✓ pass | CRUD, archive/restore, aliases, audit, merge/rollback, seed |
| 2026-07-22 | `pnpm test:e2e` | ✓ pass | 3 Playwright model flows |
| 2026-07-22 | `pnpm build` | ✓ pass | model pages + API routes |
| 2026-07-22 | seed integrity | ✓ 51/4/19/276/61 | preserved |

## Open issues

| Priority | Issue | Owner | Blocked phase | Next action |
|---|---|---|---|---|
| Low | Alias seed inserts 25 rows but unique normalized aliases yield 21 | — | none | Acceptable; document in import matching |
| Medium | Google OAuth needs real client credentials for non-bypass login | owner | auth UX | Provide GOOGLE_CLIENT_ID/SECRET + ALLOWED_EMAILS |
| Medium | Health endpoint reports database:ok without live DB probe yet | — | P5 | Wire real DB ping |
| Low | Playwright system libs installed user-local (`~/.local/pw-libs`) | — | e2e env | Optional: document in README |

## Acceptance criteria completed

Reference `docs/implementation-package/docs/13_ACCEPTANCE_CRITERIA.md`.

- [ ] Authentication (scaffold done; live Google OAuth not verified without credentials)
- [x] Seed and dashboard (seed counts only; live KPI cards still placeholders)
- [x] Models
- [ ] Subscriptions and access
- [x] Benchmarks and sources (display on model detail; dedicated bench UX later)
- [ ] Import
- [ ] Export
- [ ] Hermes
- [ ] Security and operations
- [x] Quality (lint/typecheck/unit/integration/e2e for Phase 2 scope)
