# Model Monitor Implementation Plan

## Status legend

- `[ ]` not started
- `[~]` active
- `[x]` complete
- `[!]` blocked

## Phase 0 — Architecture lock

- [x] Review all package documents.
- [x] Confirm repository/workspace structure.
- [x] Convert SQL contract to Drizzle schema.
- [x] Generate initial migrations.
- [x] Validate OpenAPI and Hermes schemas.
- [x] Write ADRs for deviations.
- [x] Produce implementation issue list.

## Phase 1 — Foundation

- [x] Create workspace.
- [x] Add Next.js app.
- [x] Add PostgreSQL and Docker Compose.
- [x] Add Drizzle.
- [x] Add Auth.js Google OAuth.
- [x] Add email allow-list.
- [x] Add design system and shell.
- [x] Add logging and request IDs.
- [x] Add CI.
- [x] Add seed runner.
- [x] Verify 51 models, 4 subscriptions, 19 access records.

## Phase 2 — Models

- [x] Model table.
- [x] Filters and search.
- [x] Model detail.
- [x] Create/edit.
- [x] Archive/restore.
- [x] Aliases.
- [x] Capabilities.
- [x] Scores and ranks.
- [x] Benchmarks (model detail evidence; not a separate admin module).
- [x] Sources (model detail evidence).
- [x] History.
- [x] Merge.
- [x] Auth-boundary E2E (no bypass) + workflow E2E (bypass).
- [x] Accessibility automated checks + UI safeguards.
- [x] Durable migration ledger + CI enforcement + fixture/artifact cleanup.

Phase 2 features are implemented and the full serial gate is green (lint, typecheck, unit, integration, e2e [models.spec 9/9, a11y.spec 6/6], build, cleanup, inventory, git diff --check; seed 51/4/19/276/$61). The independent-review accept verdict is still outstanding (review workers returned HTTP 429 on 2026-07-22); per plan rule it is noted as pending rather than assumed.

## Phase 3 — Subscriptions and access

- [ ] Access providers.
- [ ] Plans.
- [ ] Subscriptions.
- [ ] Limit rules.
- [ ] Model access.
- [ ] Access matrix.
- [ ] Manual usage.
- [ ] Mock usage labels.
- [ ] Dashboard cost calculations.

## Phase 4 — Import and export

- [ ] Upload.
- [ ] XLSX/XLSM parser.
- [ ] Sheet extraction.
- [ ] Normalization.
- [ ] Matching.
- [ ] Preview.
- [ ] Conflict resolution.
- [ ] Transactional commit.
- [ ] Import log.
- [ ] JSON export.
- [ ] CSV export.
- [ ] XLSX export.

## Phase 5 — Dashboard and administration

- [ ] KPI dashboard.
- [ ] Data-quality warnings.
- [ ] Renewal panel.
- [ ] Audit log.
- [ ] Saved table views.
- [ ] Verification settings.
- [ ] API token settings.
- [ ] Backup scripts.

## Phase 6 — Hermes

- [ ] Catalog serializer.
- [ ] Token auth.
- [ ] Scope checks.
- [ ] ETag.
- [ ] JSON Schema validation.
- [ ] OpenAPI docs.
- [ ] Example client.
- [ ] Contract tests.

## Phase 7 — Release

- [ ] Security review.
- [ ] Accessibility review.
- [ ] Responsive review.
- [ ] Performance checks.
- [ ] Production Compose.
- [ ] HTTPS instructions.
- [ ] Backup creation.
- [ ] Empty-database restore.
- [ ] Acceptance checklist.
- [ ] Release tag.
