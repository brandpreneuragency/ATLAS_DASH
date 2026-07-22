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

- [ ] Model table.
- [ ] Filters and search.
- [ ] Model detail.
- [ ] Create/edit.
- [ ] Archive/restore.
- [ ] Aliases.
- [ ] Capabilities.
- [ ] Scores and ranks.
- [ ] Benchmarks.
- [ ] Sources.
- [ ] History.
- [ ] Merge.

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
