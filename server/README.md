# TABS Server

Node/TypeScript backend for the TABS multi-user web app. Express + Prisma + Postgres. Cookie-based sessions, Argon2id passwords, encrypted API keys at rest.

This is the foundation (Agent 1 of the migration plan). The next slices will add: project/task/comment CRUD, file service, AI streaming, document/chat/settings stores, import flow, and Docker deployment.

## Requirements

- **Node.js 22+**
- **Postgres 14+** (16 recommended; matches the production image)
- A running Postgres you can connect to from your dev machine.

The simplest local setup is the bundled test-stack:

```bash
# from the repo root
docker compose -f server/docker-compose.test.yml up -d
```

This starts Postgres on `localhost:5433` with database `tabs_test`, user `tabs`, password `tabs`. The defaults in `server/.env.test` already point at it (after fixing the port — see below).

If you prefer a regular dev DB (e.g. on `localhost:5432`), copy `.env.example` to `.env`, edit it, and run `npm --prefix server run prisma:migrate`.

## Scripts

Run from the repo root (or `cd server` first):

| Command | What it does |
| --- | --- |
| `npm run server:dev` | Run the API in watch mode (`tsx watch src/index.ts`) |
| `npm run server:build` | Compile to `server/dist/` |
| `npm run server:start` | Run the compiled API |
| `npm run server:test` | Run the test suite (Vitest) |
| `npm run server:typecheck` | Type-check without emitting |
| `npm run prisma:generate` | Regenerate the Prisma client |
| `npm run prisma:migrate` | Create / apply a dev migration |
| `npm run prisma:deploy` | Apply pending migrations (CI / production) |

## Environment variables

See `.env.example` for the full list. Required:

- `DATABASE_URL` — Postgres connection string.
- `APP_URL` — public origin of the web app (used for cookie scoping).
- `ENCRYPTION_KEY` — 32 bytes hex (64 chars). Used to encrypt provider API keys at rest. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- `FILE_STORAGE_ROOT` — directory for uploaded files. Defaults to `/data/uploads` in production.
- `MAX_UPLOAD_MB` — upload size limit. Defaults to 50.
- `COOKIE_DOMAIN` — optional. Set this (e.g. `.example.com`) when the API runs on a different subdomain from the web app. Leave empty for same-origin.

## Setting up Postgres locally

The simplest path on a dev machine is the bundled test stack:

```bash
docker compose -f server/docker-compose.test.yml up -d
```

That exposes Postgres on `localhost:5433` (note: 5433, not 5432, to avoid clashing with any local Postgres install).

For your **dev** database (not tests) you have two options:

1. Add a second service to the same compose file (port 5432, database `tabs`).
2. Or create a `tabs` database on your existing local Postgres and point `.env` at it.

If you use a hosted Postgres (Neon, Supabase, etc.), just paste the connection string into `.env`.

## First-time setup

```bash
# 1. install deps
npm --prefix server install

# 2. copy env templates and edit
cp server/.env.example   server/.env
cp server/.env.test      server/.env.test   # already exists, edit if you change ports

# 3. generate the Prisma client
npm run prisma:generate

# 4. create the dev database schema
npm run prisma:migrate -- --name init
```

For the test database, the test setup itself runs `prisma db push --force-reset`, so no manual migration is needed.

## Running the tests

With the test Postgres up:

```bash
npm run server:test
```

The first test run will be slow because `prisma db push --force-reset` rebuilds the schema. Subsequent runs are fast.

## API

All endpoints are mounted under `/api`. See `src/routes/auth.ts` and `src/routes/health.ts`.

Public:

- `GET  /api/health`
- `GET  /api/ready`
- `GET  /api/auth/status` → `{ hasUsers: boolean }`
- `POST /api/auth/bootstrap` — only when no users exist; first user becomes `admin`.
- `POST /api/auth/login` — body `{ email, password }`. Sets a `tabs_session` cookie.
- `POST /api/auth/register-with-invite` — body `{ inviteCode, email, displayName, password }`. Sets a `tabs_session` cookie.

Authenticated (`tabs_session` cookie):

- `GET  /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/invites` — body `{ expiresInDays?: number }` (default 14). Returns the raw code **once**.

## Cookie / session

- Cookie name: `tabs_session`
- `HttpOnly`, `SameSite=Lax`, `Secure` in production.
- TTL: 30 days. Sessions are stored server-side; the cookie holds the raw token and the DB row holds `SHA-256(token)`.

## Ownership

Every private table has `ownerId`. Every server query filters by it. Adding a new private endpoint means wrapping it with `requireAuth` and adding `where: { ownerId: req.user.id }` to every read / write.

## Encryption

`src/encryption.ts` provides `encrypt(plaintext)` / `decrypt(ciphertext)` using AES-256-GCM with `ENCRYPTION_KEY`. Used for `provider_configs.apiKey` (wired up in the AI server migration slice).
