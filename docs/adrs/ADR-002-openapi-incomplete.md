# ADR-002: OpenAPI contract is incomplete — extend during implementation

Date: 2026-07-22

## Status

Accepted

## Context

The OpenAPI contract (`contracts/openapi.yaml`) defines 14 paths and 9 schemas.
However, the PRD (FR-11) and API spec (`docs/05_API_SPEC.md`) reference additional
endpoints not present in the OpenAPI file:

**Missing endpoints:**
- `/exports/models.json`, `/exports/models.csv`, `/exports/hermes.json` (FR-11)
- `/imports/{importId}/resolve`, `/imports/{importId}/cancel` (API spec)
- `/models/{modelId}/history`, `/models/{modelId}/scores` (API spec)
- `/benchmarks`, `/benchmark-results`, `/benchmark-results/{resultId}` (API spec)
- `/providers`, `/providers/{providerId}`, `/plans`, `/plans/{planId}` (route map)
- `/subscriptions/{subscriptionId}/restore` (API spec)
- `/model-access/{accessId}` PATCH and DELETE (API spec)

**Missing schemas:**
- `Developer`, `DeveloperWrite`
- `AccessProvider`, `AccessProviderWrite`
- `Plan`, `PlanWrite`
- `Benchmark`, `BenchmarkResult`
- `ModelScore`
- `AuditEvent`
- `ApiToken`
- `ImportConflict`

## Decision

The OpenAPI contract is treated as a starting point, not a complete specification.
During Phase 1–6 implementation, extend `openapi.yaml` with the missing endpoints
and schemas listed above. Each addition must follow the existing conventions:
- JSON only
- Zod validation at the boundary
- Structured error shape
- Cursor pagination for collections

## Consequences

- The OpenAPI file will grow during implementation.
- Contract tests must be updated alongside new endpoints.
- The Hermes catalog endpoint and schema are complete and locked — no changes needed.
