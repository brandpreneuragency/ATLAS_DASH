# Deploying TABS to the VPS

This walkthrough deploys the browser version of TABS to
`tabs.brandpreneur.net` on the Hetzner VPS.

It assumes:

- You can SSH to the VPS as `root@<vps-host>`.
- Docker and Docker Compose are installed on the VPS.
- The TABS repo is the source of truth.
- Google Drive backup credentials are operator-supplied.
- The old CRM currently owns ports 80 and 443.

## 0. Read This First

This is a production cutover. The risky parts are:

- Removing or stopping the old CRM.
- Running the first Prisma migration.
- Issuing the first TLS certificate.
- Proving that backups can restore.

Do not delete old CRM volumes during the first cutover. Stop the CRM first,
verify TABS, verify restore, then delete old CRM data only if it is no longer
needed.

Do not use `prisma db push` in production. Production uses committed
migrations only.

## 1. Preflight the Repo

From the repo root on the VPS:

```bash
test -f docker-compose.yml
test -f Caddyfile
test -f server/Dockerfile
test -f Dockerfile.web
test -d server/prisma/migrations
find server/prisma/migrations -name migration.sql -print -quit | grep -q migration.sql
```

If the migration check fails, stop. Create and commit a Prisma migration in
development before deploying.

Render the compose file:

```bash
docker compose config >/tmp/tabs-compose.rendered.yml
```

If this fails, fix `.env` or the compose file before continuing.

## 2. Back Up and Stop the Existing CRM

First, identify what is running:

```bash
ssh root@<vps-host>
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
ss -ltnp '( sport = :80 or sport = :443 )'
```

Take a Hetzner snapshot or other CRM backup before stopping it.

Then stop the CRM stack:

```bash
cd /root/crm   # adjust if the CRM stack lives elsewhere
docker compose down --remove-orphans
```

Confirm ports are free:

```bash
ss -ltnp '( sport = :80 or sport = :443 )'
# Expected: no listeners on 80 or 443.
```

Do not run `docker volume rm` for CRM volumes yet. Keep them until TABS and
restore are verified.

## 3. Clone TABS

```bash
git clone <your-tabs-repo> /root/tabs
cd /root/tabs
```

If the repo is already present:

```bash
cd /root/tabs
git pull --ff-only
```

## 4. Create the Production Environment

```bash
cp .env.example .env
$EDITOR .env
```

Set these values:

- `APP_DOMAIN`: `tabs.brandpreneur.net`
- `APP_URL`: `https://tabs.brandpreneur.net`
- `POSTGRES_PASSWORD`: 32+ random characters
- `ENCRYPTION_KEY`: 64 hex characters
- `RCLONE_REMOTE`: the rclone crypt remote, for example `gdrypt-tabs:`
- `TZ`: the backup schedule timezone

Generate `ENCRYPTION_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Keep `COOKIE_DOMAIN` blank for the same-origin v1 deployment.

## 5. Configure rclone and Google Drive

Preferred path: configure rclone on a workstation with a browser, then copy the
resulting `rclone.conf` to the VPS.

On the workstation:

```bash
rclone config
rclone lsd gdrypt-tabs:
```

On the VPS:

```bash
mkdir -p /root/tabs/secrets
scp /path/to/rclone.conf root@<vps-host>:/root/tabs/secrets/rclone.conf
chmod 600 /root/tabs/secrets/rclone.conf
```

If you configure rclone directly on a headless VPS, use rclone's remote
authorization flow from a machine with a browser. Do not assume the VPS can
open the OAuth browser flow by itself.

Verify from the VPS:

```bash
rclone --config /root/tabs/secrets/rclone.conf lsd gdrypt-tabs:
```

The crypt password and salt are required for restore. Store them in a password
manager, not only on the VPS.

## 6. Point DNS at the VPS

In the DNS provider for `brandpreneur.net`, set:

- `tabs.brandpreneur.net` A record -> VPS public IP

Verify:

```bash
dig +short tabs.brandpreneur.net
```

The result must be the VPS public IP before Caddy can get a certificate.

## 7. Build Images

```bash
cd /root/tabs
docker compose build
```

This builds:

- `api` from `server/Dockerfile`
- `web` from `Dockerfile.web`
- `backup` from `backup/Dockerfile`

The web image must use `npm run build`, not `npm run tauri:build`.

## 8. Start Postgres and Run Migrations

Start only Postgres:

```bash
docker compose up -d postgres
docker compose exec postgres sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Run migrations from the API image:

```bash
docker compose run --rm --no-deps api ./node_modules/.bin/prisma migrate deploy
```

Expected result:

- Prisma finds `server/prisma/migrations/`.
- Every migration is applied.
- The command exits 0.

If the command says there are no migrations, stop. Do not bootstrap users
against an unmigrated or `db push` database.

## 9. Start the Full Stack

```bash
docker compose up -d
docker compose ps
```

Expected:

- `postgres` is healthy.
- `api` is healthy.
- `web` is running.
- `caddy` is running.
- `backup` is running.

Watch logs:

```bash
docker compose logs -f --tail=200
```

Look for:

- `api`: `[tabs-server] listening on port 4000 (env=production)`
- `postgres`: `database system is ready to accept connections`
- `caddy`: certificate issued and HTTPS serving
- `backup`: `[backup] cron installed: ...`

If `web` exits, treat that as a failure. The nginx container should keep
running.

## 10. Verify the Running App

Use the public HTTPS origin:

```bash
curl -fsS https://tabs.brandpreneur.net/api/health
# Expected: {"status":"ok"}

curl -fsS https://tabs.brandpreneur.net/api/ready
# Expected: {"status":"ready"}

curl -fsS https://tabs.brandpreneur.net/api/auth/status
# Expected before bootstrap: {"hasUsers":false}
```

Then verify in a browser:

1. Open `https://tabs.brandpreneur.net/`.
2. Confirm the auth gate appears before the app shell.
3. Bootstrap the first admin user.
4. Create an invite.
5. Register a second user in a private browser window.
6. Confirm the second user cannot see the first user's data.
7. Create a project, task, and comment.
8. Upload a file to a task comment.
9. Open the uploaded file through the file viewer.
10. Restart the API container and refresh the browser.

Restart check:

```bash
docker compose restart api
```

The task and file should still be available after refresh.

## 11. Trigger the First Backup

```bash
docker compose exec backup /backup/backup.sh
```

Expected final line:

```text
BACKUP OK
```

Verify the remote:

```bash
docker compose exec backup rclone ls gdrypt-tabs:/db/daily
docker compose exec backup rclone ls gdrypt-tabs:/uploads/daily
```

Run backups off-peak. The backup script dumps the database and then archives
uploads. If users delete files during that window, a restore may have a DB row
for a file that was removed before the upload archive was created.

## 12. Run the Restore Test

Follow `docs/restore.md` on a clean temporary stack.

The restore test must prove:

1. `pg_restore` exits 0.
2. The uploads archive extracts into the expected `users/<ownerId>/...` layout.
3. Login works.
4. At least one task with a file attachment opens end to end.
5. A second user cannot see the first user's data.

Do not declare the deployment complete until restore succeeds.

## 13. Final Cleanup

After TABS is verified and restore succeeds:

- Save `.env` secrets in a password manager.
- Save `rclone.conf`, crypt password, and salt in a password manager.
- Add a quarterly calendar reminder to run `docs/restore.md`.
- Only then consider deleting old CRM volumes.

## Common Issues

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `prisma migrate deploy` finds no migrations | `server/prisma/migrations/` was not committed | Stop and create a migration in development |
| Caddy cannot issue a certificate | DNS does not point to the VPS or ports 80/443 are blocked | Fix DNS and confirm ports are free |
| `api` exits with `ENCRYPTION_KEY must be 32 bytes hex` | `.env` has a bad key | Generate a 64-character hex key and rebuild/restart |
| `/api/ready` returns 503 | Database is unreachable | Check `docker compose logs postgres api` |
| Login redirects or does not stick | HTTPS/cookie mismatch | Use `https://tabs.brandpreneur.net`, keep `COOKIE_DOMAIN` blank |
| Backup cannot find rclone config | `secrets/rclone.conf` is missing or permissions are wrong | Copy the file and run `chmod 600` |
| File viewer returns 404 after restore | Upload archive did not restore to `/data/uploads/users/...` | Re-run the upload restore step from `docs/restore.md` |
