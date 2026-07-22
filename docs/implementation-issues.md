# Model Monitor — Implementation Issue List

Phase 0 architecture review output. Issues are sized for coding agent sessions.

## Phase 1 — Foundation

| ID | Title | Size | Details |
|---|---|---|---|
| P1-01 | Workspace + package.json + turbo | S | Create monorepo root with turbo, TypeScript strict config, shared tsconfig |
| P1-02 | Next.js app scaffold | S | `apps/web` with App Router, Tailwind, shadcn/ui setup |
| P1-03 | Docker Compose for PostgreSQL | S | `docker/compose.yaml` with postgres:16, persistent volume, health check |
| P1-04 | Drizzle config + migration runner | S | `packages/database` with drizzle-kit, migration scripts, db:generate/migrate |
| P1-05 | Zod shared schemas | M | `packages/schemas` — Zod schemas for all API write models |
| P1-06 | Auth.js Google OAuth + allow-list | M | NextAuth Google provider, ALLOWED_EMAILS env check, session cookie config |
| P1-07 | App shell + design tokens | M | Sidebar nav, top bar, theme switcher, light/dark CSS variables |
| P1-08 | Logging + request IDs | S | Structured logger middleware, request ID generation per request |
| P1-09 | CI pipeline | S | GitHub Actions: lint, typecheck, test:unit, test:integration |
| P1-10 | Seed runner | M | Script to load `data/*.seed.json` into database via Drizzle |
| P1-11 | Seed integrity tests | S | Tests asserting 51 models, 4 subscriptions, 19 access, USD 61 total |

## Phase 2 — Model registry

| ID | Title | Size | Details |
|---|---|---|---|
| P2-01 | Model list with server-side pagination | M | `/models` route, TanStack Table, cursor pagination, search, filters |
| P2-02 | Model detail with tabs | M | `/models/[id]` with Overview, Capabilities, Scores, Benchmarks, Access, Sources, History tabs |
| P2-03 | Model create/edit form | M | React Hook Form + Zod, all model fields, capability tri-state controls |
| P2-04 | Archive/restore | S | DELETE → archive, POST /restore, audit event on each |
| P2-05 | Aliases CRUD | S | Add/remove aliases on model detail, normalized_alias uniqueness |
| P2-06 | Scores + methodology display | M | Score cards, factor bars, methodology version, null ≠ zero display |
| P2-07 | Benchmark evidence list | S | Filter by model and category, preserve comparable group |
| P2-08 | Sources + verification | S | Attach sources to any entity, needs_recheck flag, verification warnings |
| P2-09 | Audit history per model | S | Query audit_events by entity, display before/after diffs |
| P2-10 | Transactional model merge | L | Lock both rows, transfer all relationships, archive source, audit, single tx |
| P2-11 | Model E2E tests | M | Playwright: create, edit, archive, restore, merge flows |

## Phase 3 — Subscriptions and access

| ID | Title | Size | Details |
|---|---|---|---|
| P3-01 | Access providers CRUD | S | `/providers` list and detail |
| P3-02 | Plans CRUD | S | `/plans` list and detail, link to provider |
| P3-03 | Subscriptions CRUD | M | `/subscriptions` list, detail, create/edit, billing fields |
| P3-04 | Subscription limit rules | S | Structured rules + raw notes, per subscription |
| P3-05 | Model access CRUD | M | Create from model or subscription detail, availability states |
| P3-06 | Access matrix view | L | Models × subscriptions grid, frozen model column, cell click → edit |
| P3-07 | Manual/mock usage | S | Usage snapshots with mock labeling, visual distinction |
| P3-08 | Dashboard cost calc | S | Regular monthly fixed cost = USD 61, current paid cost |
| P3-09 | Subscription E2E tests | M | Playwright: create subscription, add access, edit billing |

## Phase 4 — Import and export

| ID | Title | Size | Details |
|---|---|---|---|
| P4-01 | Secure file upload | M | XLSX/XLSM only, MIME + signature check, size limit, SHA-256 |
| P4-02 | Sheet parser | L | Parse known sheets, capture row/col provenance, no macro execution |
| P4-03 | Normalization engine | L | Trim, slugify, tri-state booleans, null normalization, dev/provider separation |
| P4-04 | Match engine | M | 5-tier matching: canonical ID → alias → name+dev → family+gen → manual |
| P4-05 | Conflict detection | M | 10 conflict types, store in import_conflicts |
| P4-06 | Preview UI | M | Summary cards: new, matched, updated, duplicates, conflicts, skipped |
| P4-07 | Conflict resolution UI | M | Per-conflict: current vs imported, resolution choices, apply-to-similar |
| P4-08 | Transactional commit | L | Single tx, idempotency key, provenance, audit events, rollback on failure |
| P4-09 | JSON export | S | Export model catalog as JSON |
| P4-10 | CSV export | S | Export selected tables, formula-injection neutralization |
| P4-11 | XLSX export | M | Normalized workbook export, formula-injection neutralization |
| P4-12 | Import fixture tests | L | 15 sheets, 31 rows, 51 roster, 276 benchmarks, idempotent reimport |

## Phase 5 — Dashboard and administration

| ID | Title | Size | Details |
|---|---|---|---|
| P5-01 | Dashboard KPIs | M | Active subs, monthly cost, accessible models, canonical count, needs recheck, renewals |
| P5-02 | Data quality warnings | S | Unknown renewal, unconfirmed access, missing canonical ID, stale verification |
| P5-03 | Audit log with filters | S | `/audit` page, filter by entity, action, date range |
| P5-04 | Saved table views | M | URL-addressable view state, save/restore column config |
| P5-05 | Verification settings | S | Configurable recheck interval in app_settings |
| P5-06 | API token management | M | Create (show once), list, revoke, audit token_create/token_revoke |
| P5-07 | Backup scripts | S | pg_dump, encrypt, checksum, prune, restore script |

## Phase 6 — Hermes API

| ID | Title | Size | Details |
|---|---|---|---|
| P6-01 | Bearer token auth middleware | M | Hashed token lookup, scope check (catalog:read), expiry, revocation |
| P6-02 | Catalog serializer | M | Explicit snake→camel mapping, omit non-schema fields, null preservation |
| P6-03 | /hermes/catalog endpoint | S | ETag, Last-Modified, Cache-Control, 304 support |
| P6-04 | /hermes/models/{id} endpoint | S | Single model by canonical_id |
| P6-05 | /hermes/subscriptions endpoint | S | Active subscriptions only |
| P6-06 | /hermes/access endpoint | S | Active access paths only |
| P6-07 | Contract tests | M | Validate all endpoints against hermes-catalog.schema.json |
| P6-08 | Example client | S | Typed TypeScript client in `packages/api-client` |

## Phase 7 — Hardening

| ID | Title | Size | Details |
|---|---|---|---|
| P7-01 | Security review | M | Auth, token scope, upload, injection, secrets, CSP |
| P7-02 | Accessibility review | M | axe checks, keyboard nav, focus traps, color-independent status |
| P7-03 | Performance checks | M | 5000 models, 50k benchmarks, p95 < 500ms |
| P7-04 | Production Docker Compose | M | web + postgres + backup services, non-root, health checks |
| P7-05 | Backup + restore proof | S | Create backup, restore into empty DB, verify seed integrity |
| P7-06 | Acceptance checklist | S | Walk through all 13_ACCEPTANCE_CRITERIA items with evidence |

## Size legend

- **S** = 1–2 hours, single file or small surface
- **M** = 2–4 hours, multiple files or moderate logic
- **L** = 4–8 hours, complex feature or large surface

## Summary

| Phase | Issues | S | M | L |
|---|---|---|---|---|
| 1 | 11 | 6 | 4 | 1 |
| 2 | 11 | 4 | 5 | 2 |
| 3 | 9 | 4 | 3 | 2 |
| 4 | 12 | 3 | 4 | 5 |
| 5 | 7 | 3 | 3 | 1 |
| 6 | 8 | 4 | 3 | 1 |
| 7 | 6 | 2 | 4 | 0 |
| **Total** | **64** | **26** | **26** | **12** |
