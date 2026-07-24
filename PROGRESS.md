# Model Monitor Progress

## Current phase

`MVP implementation plan complete` — Phases 1–7 are implemented, verified, deployed, and browser-smoke-tested in production.

## Current objective

Phases 1–7 are complete. Production HTTPS/reverse proxy, backup/restore proof, runtime health and exposure checks, single-account credentials login, Settings authentication, browser smoke testing, firewall verification, and restore-test cleanup are complete.

Repository: `/home/admin/model-monitor/`

## Phase 2 repair H — changes

1. Lint + a11y evidence (focus containment every Tab; real background control inertness)
2. Alias lossless ordinary edits (omit aliases when unchanged; preserve type/provider IDs)
3. Middleware matcher exact exclusions; exported matcher unit tests; lookalike auth-boundary HTTP
4. OpenAPI YAML structural parse + object assertions; UUID/nullability/statuses/alias response schema
5. Mobile nav native modal dialog + keyboard E2E across list/detail/create/edit/merge
6. Production merge keys `mm:merge:*` retained across retries; cleanup never deletes them
7. Audit redaction allowlist; deterministic sorted relationship snapshots; exact merge audit tests
8. Merge concurrency observes ungranted locks; writer CONFLICT required; no orphan aliases
9. Reserved namespaces `mmtest:` / `mme2e:` only; safety regression preserves generic test-/e2e- rows
10. Seed near-twin from baseline identity; full-row rollback; baseline tombstone clear conflict
11. Drizzle partial seed_key unique indexes match migration 0006
12. Idempotency concurrency advisory-lock handshake
13. Controlled pagination metadata + exact score sort order fixtures
14. Documentation does not claim green until verification completes

## Gate results

Current Repair I.2 tree, independently rerun by the parent orchestrator:

- lint: PASS
- typecheck: PASS
- unit: 89 passed
- integration: 36 passed, 2 superseded shared-database seed tests skipped
- build: PASS
- E2E auth project: 7 passed
- E2E workflow/a11y project: 13 passed, 2 failed
- `git diff --check`: PASS

Both former E2E failures in `apps/web/e2e/models.spec.ts` are fixed (2026-07-22): the create test now adds a structured alias row before filling `field-aliases`, and the rename test targets the stable `field-aliases` testid instead of the ambiguous `Alias 1` label.

E2E is now fully green: `models.spec.ts` 9/9, `a11y.spec.ts` 6/6. The complete merge-audit regression, idempotency, migration-advisory-lock, seed-rollback, and baseline-tombstone tests are all present and green.

Independent-review accept verdict still outstanding (the review workers returned HTTP 429 on 2026-07-22); the gate itself is green without it. Provider-blocked handoff for reference: `/home/admin/.hermes/orchestrator/runs/model-monitor-grok45-completion/REMEDY_PHASE2_I3_PROVIDER_BLOCKED.md`.

## Not self-accepted

No commit/push performed.

---

## Phase 3 — Subscriptions & Access — Complete (2026-07-23)

Implemented service layer, API routes, management UI, dashboard KPIs, and tests for subscriptions, access, usage, and plans. Orchestrated via `commandcode_worker` (model `xiaomi/mimo-v2.5-pro`, `--yolo`); the orchestrator itself runs on Hermes (no deepseek-v4-flash in either role).

### Delivered

- **Schemas** (`packages/schemas/src/phase3.ts` + `primitives.ts` leaf to break a `index <-> phase3` circular-import that caused `TypeError: Cannot read properties of undefined (reading 'nullable')`): subscription/access/usage/plan Zod schemas; `usageTrackingMode` enum aligned with Phase-2 `subscriptionWriteSchema`; `notes`/`usageCheckInstructions` normalized `""` → `null` (AGENTS data rule: blank = unknown).
- **Services** (`packages/database/src/services/`): `subscriptions.ts`, `access.ts`, `usage.ts`, `plans.ts`, `audit.ts`. Every mutation writes an audit event. `createModelAccess` throws `ModelServiceError("CONFLICT", …, 409)` on duplicate (`UNIQUE NULLS NOT DISTINCT (model_id, plan_id, provider_model_id)`).
- **API routes** (`apps/web/src/app/api/v1/`): `subscriptions`, `model-access`, `access-matrix`, `plans`, `access-providers`, `dashboard`.
- **UI**: Dashboard (KPIs, renewal panel with "Unknown" handling, mock-usage badge), Subscriptions CRUD, Access Matrix, Model-Access link/archive, Subscription form. All use Tailwind CSS variables for light/dark; status is never color-only.

### Bug fixes applied during closeout (orchestrator)

1. Circular-import leaf-refactor (`primitives.ts` + pure-barrel `index.ts`).
2. `usage.ts` / `subscriptions.ts` `no-unsafe-*` — typed `UsageSnapshotRow`/`PlanRow` + `as` cast at the drizzle join-select boundary (isolated `any` per AGENTS external-boundary rule).
3. Removed unused imports; `subscriptionResponseSchema` → type import; removed dead `toIso`.
4. Integration test `freeModelId` resolution now excludes `seedModelId` so the duplicate-access test is stable regardless of execution order.

### Gate results (2026-07-23, final)

- database lint (`eslint .`): **PASS** (exit 0)
- web lint: **PASS** (0 errors; 2 harmless warnings in `e2e/subscriptions.spec.ts`)
- database typecheck: pre-existing dependency noise only (`postgres` CJS default-import needs `esModuleInterop`; `models.ts` Set iteration under `target < es2015`) — not Phase 3 regressions; `tsx` runs tests/runtime fine.
- web typecheck (`next typegen && tsc --noEmit`): **PASS**
- web build: **PASS** (all routes compile)
- unit: **23 passed**
- integration: **45 passed, 2 skipped** (incl. duplicate-access 409 conflict)
- seed-integrity: **ALL PASS** — 51 models, 4 subs, 19 access, 276 benchmarks, **$61/mo** USD, 0 duplicate canonical IDs, 0 orphan access
- **Acceptance KPI verified**: dashboard `monthlyRegularTotal = 61` USD, 4 subscriptions; "Unknown" renewals render `data-testid="renewal-unknown"`; mock usage shows `data-testid="mock-usage-badge"`.

### Outstanding (non-blocking)

- The earlier database TypeScript warning is superseded by the final full repository typecheck passing on 2026-07-24.
- Final independent read-only checkpoint review returned **ACCEPT** on 2026-07-24 with no commit blockers; the complete staged tree then passed lint, typecheck, full tests, production build, secret scanning, and diff validation.
- No remaining implementation or release blockers.

---

## Phase 4 Wave A — Schemas & Persistence Contract — Complete (2026-07-23)

Implemented the typed Zod schema foundation for import/export. No database migration was needed — the existing `import_jobs`, `import_conflicts`, `import_provenance`, and `audit_events` tables already satisfy the Phase 4 persistence contract.

### Delivered

- **`packages/schemas/src/phase4.ts`**: All Phase 4 Zod schemas:
  - Formula-like text detection (`isFormulaLike`) and neutralization (`neutralizeFormulaText`, `neutralizeExportRow`)
  - Upload metadata (`importUploadSchema`)
  - Per-sheet summary (`sheetSummarySchema`)
  - Import preview/commit/error summaries (`importPreviewSummarySchema`, `importCommitSummarySchema`, `importErrorSummarySchema`)
  - Conflict types enum and DTO (`importConflictTypeSchema`, `importConflictDtoSchema`)
  - Resolution actions and batch resolution (`importResolutionActionSchema`, `importConflictResolutionSchema`, `importBatchResolutionSchema`)
  - Provenance DTO (`importProvenanceDtoSchema`)
  - Import job response (`importJobResponseSchema`)
  - Preview response with rows and conflicts (`importPreviewResponseSchema`, `importPreviewRowSchema`)
  - Export request/response schemas (`exportRequestSchema`, `exportResponseSchema`, `exportPayloadSchema`)
  - Structured export row types for models, subscriptions, access, benchmarks
- **`packages/schemas/src/phase4.test.ts`**: 49 unit tests covering formula neutralization, every schema boundary, empty-to-null semantics, and conflict type enumeration.
- **`packages/schemas/src/index.ts`**: Added `export * from "./phase4"` re-export.

### Gate results (2026-07-23)

- schemas lint (`eslint .`): **PASS**
- schemas typecheck (`tsc --noEmit`): **PASS**
- schemas unit tests (`vitest run`): **81 passed** (49 Phase 4 + 32 Phase 2/3 pre-existing)
- No database schema changes — existing tables fully satisfy the contract.
- No commit/push performed (awaiting user direction).

---

## Phase 4 — Import and Export — Complete (2026-07-23)

Implemented safe workbook intake, fixture-backed normalization and matching, transactional preview/commit/conflict resolution, idempotent import commit, and authenticated JSON/CSV/XLSX exports.

### Delivered

- Safe XLSX/XLSM intake with private storage, checksum/parser metadata, and no macro/formula execution.
- Fixture-backed preview planning with 31 populated `Master Models` rows, a 51-model canonical roster, and 276 benchmark plan rows.
- Typed blank/unknown-ID conflicts, duplicate-access handling without canonical model duplication, preserved benchmark settings/comparable groups/source metadata, null cost semantics, formula/error preservation, and import provenance.
- Read-only preview, useful persisted/reconstructed preview rows, transactional rollback on failed commit, conflict resolution, audit events, and idempotent commit/replay handling.
- Authenticated import routes and documented OpenAPI contracts for preview, inspection, conflict resolution, commit, and export downloads.
- JSON, CSV, and XLSX export serializers with formula neutralization, null preservation, typed score/source/provenance sections, and safe download headers.

### Gate results (2026-07-23, independently rerun)

- full lint: **PASS** (5 packages; 0 errors; 2 pre-existing warnings in `apps/web/e2e/subscriptions.spec.ts`)
- full typecheck: **PASS** (9 tasks)
- full unit: **PASS** (232 tests)
- full integration: **PASS** (web 1; database 63 passed, 2 skipped)
- seed integrity: **PASS** — 51 models, 4 subscriptions, 19 access, 276 benchmarks, USD 61 monthly cost
- web production build: **PASS**
- E2E: **PASS** — 7 auth-boundary tests and 19 workflow/accessibility tests
- `git diff --check`: **PASS**
- No commit/push performed.

---

## Phase 5 — Dashboard and administration — Complete (2026-07-23)

Implemented the dashboard quality/KPI surface and administration controls for audit events, verification settings, saved table views, and scoped API tokens. Added authenticated route-level tests and documented the implemented Phase 5 API paths in OpenAPI.

### Gate results

- full lint: **PASS** (0 errors; 2 pre-existing warnings in `apps/web/e2e/subscriptions.spec.ts`)
- full typecheck: **PASS**
- full unit: **PASS**
- full integration: **PASS** (seed integrity and health checks included)
- isolated web production build: **PASS**
- E2E: **PASS** — 7 auth-boundary tests and 19 workflow/accessibility tests
- Phase 5 route tests: **10 passed**
- OpenAPI contract tests: **10 passed**

---

## Phase 6 — Hermes contract — Complete (2026-07-23)

Added `@model-monitor/hermes-contract` with strict Zod serialization aligned to the authoritative Hermes JSON Schema, plus the versioned read-only `GET /api/v1/hermes/catalog` endpoint.

### Delivered

- Bearer token authentication with `catalog:read`, expiry, revocation, and invalid-token rejection.
- Direct schema-valid catalog response with canonical models emitted once, active access paths, null-preserving capabilities/technical values/scores, methodology versions, and latest usage provenance.
- Mock/manual usage source and `isMock` labels preserved; no token plaintext/hash or provider secrets returned.
- Stable `ETag`, `Last-Modified`, private 60-second caching, and `304 Not Modified` support.
- OpenAPI catalog documentation and route-level tests with mocked database access; catalog requests perform no token last-used write.

### Gate results

- focused Hermes route/contract tests: **9 passed**
- full lint: **PASS** (0 errors; 2 pre-existing warnings)
- full typecheck: **PASS**
- full unit: **PASS** — 263 tests across the workspace
- full integration: **PASS** — 63 database tests passed, 2 skipped; web health integration passed
- production build: **PASS**; `/api/v1/hermes/catalog` present in the route manifest
- E2E: **PASS** — 7 auth-boundary tests and 19 workflow/accessibility tests

---

## Phase 7 — Hardening/deployment artifacts and runtime verification (2026-07-23)

- Added environment-driven PostgreSQL credentials, loopback-only Compose binding, explicit Next hostname binding, dynamic healthcheck, and the production web image.
- Added static `scripts/check-deployment-artifacts.sh`, `RELEASE_CHECKLIST.md`, and `SECURITY_REVIEW.md`.
- Added `models.brandpreneur.net` to the existing Caddy configuration without changing the Atlas Dash, Atlas Control, or Wagner site blocks.
- Runtime verified: `model-monitor-web` healthy; web listens on `127.0.0.1:3000`; PostgreSQL remains on `127.0.0.1:5433`; public HTTPS health returns 200; unauthenticated Hermes catalog returns 401 with a request ID; existing sites remain reachable.
- Backup verified: archive and checksum are owner-readable mode `600`; SHA-256 and `pg_restore --list` pass; archive restored into an isolated empty database; restored seed-integrity assertions pass (51 models, 4 subscriptions, 19 access, 276 benchmarks, 4 mock usage snapshots, $61 monthly cost, 0 duplicate canonical IDs, 0 orphan access records).
- Fresh repository gates: `pnpm run lint` PASS (2 pre-existing warnings); `pnpm run typecheck` PASS; `pnpm run test` PASS (13 Turbo tasks, 85 web unit tests, 41 database unit tests, 63 database integration tests with 2 expected skips); `pnpm run test:e2e` PASS (7 auth-boundary tests, 19 workflow/accessibility tests); `pnpm run verify:deployment` PASS; `bash -n scripts/*.sh` PASS; Compose config PASS; Caddy validation PASS; production Docker build PASS.
- Credentials login replacement (2026-07-24): replaced Google OAuth with a single configured email/password account using a Node built-in scrypt password hash; added hidden-input hash generation, login UI, unit coverage, and updated anonymous auth-boundary E2E assertions. Runtime credentials were configured from the protected environment, and Auth.js production URL/trusted-host settings (`AUTH_URL`, `NEXTAUTH_URL`, `AUTH_TRUST_HOST`) were added to the web deployment. Middleware now derives redirects from the canonical public URL and explicitly reads the HTTPS `__Secure-authjs.session-token` cookie; exact redirect/cookie regressions pass, and a 60-second in-memory synthetic production session reached `/dashboard` with HTTP 200 and no redirect. The web container was rebuilt and restarted without recreating PostgreSQL; live health, database health, and anonymous auth-boundary checks pass. Google client variables are no longer used.
- Settings authentication repair (2026-07-24): credential emails now resolve race-safely to UUID-backed `users` rows for both new logins and existing JWT sessions, so UUID-owned API tokens no longer fail. Settings API responses are validated and loaded independently so one failed endpoint renders an inline error instead of crashing React. Production verification with the legacy textual session returned HTTP 200 and valid response shapes for `/settings`, verification settings, API tokens, and saved views; exactly one configured UUID user row exists.
- Production browser smoke test passed (2026-07-24): credentials login reached `/dashboard`, and the Settings verification, saved-view, and API-token sections loaded without a client exception.
- Restore-test cleanup (2026-07-24): after explicit approval, dropped only `modelmonitor_restore_20260723182731` after verifying it had zero active connections and differed from the production database name. Post-cleanup verification confirms only production `modelmonitor` remains; PostgreSQL and web containers are healthy, and public app/database health is `ok`.
- Firewall verification (2026-07-24): UFW is active with default deny for incoming and routed traffic. Public inbound allowances are SSH (`22`), HTTP/HTTPS (`80`/`443`), and the intentional Syncthing TCP/UDP port (`22000`); `18789` is explicitly denied. Docker NAT publishes PostgreSQL `5433` and the existing `8888` service only on `127.0.0.1`; Model Monitor and PostgreSQL are not publicly exposed. No firewall rules were changed.
- Outstanding: none for the Phase 7 deployment/runtime verification scope.
