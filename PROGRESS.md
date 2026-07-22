# Model Monitor Progress

## Current phase

`Phase 2 — Model registry` — Repair I.2 rejected/incomplete; implementation provider blocked

## Current objective

Finish repair I.2, restore a green E2E gate, and obtain fresh independent acceptance. Grok is blocked by xAI credits; Luna and the independent-review workers are blocked by the OpenAI usage limit.

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

The two current E2E failures are in `apps/web/e2e/models.spec.ts`: the legacy create test still targets the removed alias textarea, and the new structured-alias test uses an ambiguous `Alias 1` locator. Failure diagnostics remain in `apps/web/test-results/`.

The complete merge-audit regression also remains fragment-based rather than a complete deep equality. No fresh Repair I.2 reviewer verdict exists because all three review workers failed immediately with HTTP 429.

Provider-blocked handoff: `/home/admin/.hermes/orchestrator/runs/model-monitor-grok45-completion/REMEDY_PHASE2_I3_PROVIDER_BLOCKED.md`.

## Not self-accepted

No commit/push performed.
