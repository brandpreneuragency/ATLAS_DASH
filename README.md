# Model Monitor

Private single-user LLM registry and subscription manager with a read-only Hermes catalog.

## Stack

- Next.js 15 + TypeScript
- PostgreSQL 16
- Drizzle ORM (query layer) + hand-written SQL migrations
- Zod
- Tailwind CSS
- Auth.js (Google OAuth + email allow-list)

## Quick start

```bash
# Install
pnpm install

# Start Postgres
docker compose -f docker/compose.yaml up -d

# Migrate + seed
export DATABASE_URL=postgresql://modelmonitor:modelmonitor@localhost:5433/modelmonitor
pnpm --filter @model-monitor/database exec tsx src/migrate.ts
pnpm --filter @model-monitor/database exec tsx src/seed.ts
pnpm --filter @model-monitor/database exec tsx src/seed-integrity.test.ts

# Dev server
pnpm --filter @model-monitor/web dev
```

## Seed integrity expectations

- 51 canonical models
- 4 subscriptions
- 19 model-access records
- 276 benchmark evidence rows
- USD 61 regular monthly fixed cost

## Docs

Implementation package: `docs/implementation-package/`
ADRs: `docs/adrs/`
Issues: `docs/implementation-issues.md`
