# ADR-003: Hermes serializer must map snake_case to camelCase

Date: 2026-07-22

## Status

Accepted

## Context

The Hermes catalog JSON Schema (`contracts/hermes-catalog.schema.json`) uses
camelCase for field names while the PostgreSQL schema uses snake_case:

| SQL column | Hermes schema field |
|---|---|
| `model_capabilities.tool_use` | `capabilities.tools` |
| `model_capabilities.parallel_agents` | `capabilities.parallelAgents` |
| `model_capabilities.computer_use` | `capabilities.computerUse` |
| `usage_snapshots.captured_at` | `access[].usage.capturedAt` |
| `usage_snapshots.used_percent` | `access[].usage.usedPercent` |
| `usage_snapshots.is_mock` | `access[].usage.isMock` |

The Hermes schema uses `additionalProperties: false`, so extra SQL columns
(`audio_input`, `video_input`, `image_input`, `structured_output`,
`function_calling`) must be omitted from the catalog output.

## Decision

Implement a dedicated catalog serializer in `packages/hermes-contract` that:
1. Explicitly maps each SQL column to its Hermes schema field name.
2. Omits capabilities not defined in the Hermes schema.
3. Validates output against the JSON Schema before returning.

Do not rely on a generic snake_case-to-camelCase converter — use an explicit
mapping function to prevent accidental field leakage.

## Consequences

- Serializer must be updated if either schema changes.
- Contract tests must validate serializer output against the JSON Schema.
- The `additionalProperties: false` constraint is a safety boundary.
