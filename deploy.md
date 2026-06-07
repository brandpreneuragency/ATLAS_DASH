# TABS VPS Deployment Plan

This is the top-level deployment checklist for the VPS rollout of the current
TABS app. Use `docs/deploy.md` for the detailed walkthrough and
`docs/restore.md` for the required restore test.

## Goal

Deploy the existing TABS web app to a VPS with:

- Docker Compose
- Caddy reverse proxy and HTTPS
- Node API
- Postgres
- VPS filesystem storage for uploads
- Google Drive backups through `rclone crypt`

Do not deploy the Tauri desktop bundle to the VPS.

## Hard Stops

Do not start the production cutover if any of these are true:

- `server/prisma/migrations/` is missing or has no `migration.sql` files.
- `docker compose config` fails.
- `.env` still contains placeholder secrets.
- `secrets/rclone.conf` is missing or cannot list the crypt remote.
- Ports 80 or 443 are still owned by another production stack.
- You cannot run a restore test on a clean stack with separate volumes.

Use Prisma migrations for production. Do not use `prisma db push` against the
production database.

## Preconditions

Before cutover:

- Docker and Docker Compose are installed on the VPS.
- DNS for `APP_DOMAIN` points to the VPS.
- The old CRM stack has been backed up or snapshotted.
- The old CRM stack is stopped before TABS takes ports 80 and 443.
- The operator has `rclone.conf` plus the crypt password and salt.
- The operator has a generated `.env` based on `.env.example`.

## Deployment Order

1. Snapshot or back up the current CRM before touching it.
2. Stop the old CRM stack. Do not delete its volumes until TABS is verified.
3. Clone the TABS repo to `/root/tabs`.
4. Create `.env` with real production values.
5. Place `secrets/rclone.conf` on the host and lock down its permissions.
6. Run `docker compose config`.
7. Build the images.
8. Start only Postgres.
9. Apply Prisma migrations from the API image.
10. Start the full stack.
11. Verify health, readiness, auth, tasks, comments, and file upload/download.
12. Run a one-shot backup.
13. Run `docs/restore.md` on a clean temporary stack.
14. Only after TABS and restore are verified, remove old CRM volumes if desired.

## Verification Checklist

The deployment is not complete until these are true:

- `GET /api/health` returns `{"status":"ok"}`.
- `GET /api/ready` returns `{"status":"ready"}`.
- The auth gate appears before the app shell.
- First-user bootstrap works.
- Invite signup works for a second user.
- Project, task, comment, and file flows work end to end.
- Uploaded files still open after an API container restart.
- A second user cannot see the first user's data.
- The browser build does not expose local folder connection controls.
- A one-shot backup prints `BACKUP OK`.
- The restore procedure succeeds against a fresh temporary stack.

## Operational Notes

- `docker-compose.yml` is the production stack definition.
- `Caddyfile` owns public routing and HTTPS termination.
- `Dockerfile.web` builds the browser UI with `npm run build`.
- `server/Dockerfile` builds the API container.
- `backup/` contains the backup sidecar.
- Google Drive is backup-only. It is not live app storage.

If the VPS environment differs from these assumptions, fix the environment or
create a new approved plan before changing the deployment shape.
