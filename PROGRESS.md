# Model Monitor Progress

## Current phase

`Phase 2 — Model registry` — Complete. Mechanical gate green end to end; both E2E projects pass.

## Current objective

Phase 2 is closed. Next: obtain the independent-review accept verdict (blocked earlier by the OpenAI 429 on review workers), then resume the orchestrator at Phase 3 (subscriptions/access).

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
