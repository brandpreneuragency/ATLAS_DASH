# Restoring TABS from a Backup

This is the required restore test for the VPS deployment.

Backup is not complete until restore is tested. Run this after the first
production backup and repeat it quarterly.

## What This Test Proves

The restore test must prove:

- The encrypted Google Drive backup can be decrypted.
- The Postgres dump can be restored cleanly.
- The uploads archive lands in the path the API expects.
- Users can log in after restore.
- Task attachments still open.
- Cross-user isolation still works.

## Hard Rules

- Do not restore into production volumes.
- Do not reuse the production database.
- Do not reuse the production uploads volume.
- Do not ignore `pg_restore` errors.
- Do not use the production hostname for a temporary restore stack.

Use a separate VPS or local Docker host when possible. A same-host restore test
is only safe if the temporary stack uses separate volume names, a separate
network name, and a separate hostname or port plan.

## 1. Pick Matching Snapshots

List database backups:

```bash
rclone --config /path/to/rclone.conf ls gdrypt-tabs:/db/daily
```

List upload backups:

```bash
rclone --config /path/to/rclone.conf ls gdrypt-tabs:/uploads/daily
```

Pick a matching pair with the same timestamp:

```text
db-20260607T023000Z.dump
uploads-20260607T023000Z.tar.gz
```

Set variables for the rest of the run:

```bash
export DB_BACKUP='gdrypt-tabs:/db/daily/db-20260607T023000Z.dump'
export UPLOADS_BACKUP='gdrypt-tabs:/uploads/daily/uploads-20260607T023000Z.tar.gz'
export RCLONE_CONFIG_PATH='/path/to/rclone.conf'
```

## 2. Create a Clean Restore Checkout

```bash
git clone <your-tabs-repo> /tmp/tabs-restore
cd /tmp/tabs-restore
cp .env.example .env
```

Edit `.env`:

```bash
$EDITOR .env
```

Use fresh temporary values:

- `APP_DOMAIN=restore-tabs.brandpreneur.net`
- `APP_URL=https://restore-tabs.brandpreneur.net`
- `POSTGRES_DB=tabs_restore`
- `POSTGRES_USER=tabs_restore`
- `POSTGRES_PASSWORD=<fresh random password>`
- `ENCRYPTION_KEY=<same production key if provider config decrypt must be tested>`
- `RCLONE_REMOTE=gdrypt-tabs:`
- `COOKIE_DOMAIN=`

Important:

- If you restore production provider configs, use the same production
  `ENCRYPTION_KEY` or encrypted provider keys will not decrypt.
- For a full browser login test, use HTTPS. Production cookies are `Secure`.
- If you cannot provide HTTPS for the restore host, you can still do a DB/API
  restore test, but it is not a full production-equivalent login test.

## 3. Create a Restore Compose Override

The production compose file uses explicit volume and network names. The
compose project name alone is not enough to avoid collisions.

Create a temporary override file:

```bash
cat > compose.restore.yml <<'EOF'
volumes:
  postgres_data:
    name: tabs_restore_postgres_data
  uploads_data:
    name: tabs_restore_uploads_data
  caddy_data:
    name: tabs_restore_caddy_data
  caddy_config:
    name: tabs_restore_caddy_config
  backups_cache:
    name: tabs_restore_backups_cache

networks:
  tabs_internal:
    name: tabs_restore_internal
    driver: bridge
EOF
```

Use this compose command for every restore step:

```bash
export RESTORE_COMPOSE='docker compose -p tabs-restore -f docker-compose.yml -f compose.restore.yml'
```

## 4. Start the Temporary Database

```bash
$RESTORE_COMPOSE up -d postgres
$RESTORE_COMPOSE exec postgres sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

## 5. Restore the Database

Stream the encrypted backup through the crypt remote and into the temporary
Postgres container:

```bash
rclone --config "$RCLONE_CONFIG_PATH" cat "$DB_BACKUP" \
  | $RESTORE_COMPOSE exec -T postgres sh -lc \
      'pg_restore --format=custom --clean --if-exists --no-owner --no-privileges --exit-on-error --dbname="$POSTGRES_DB" --username="$POSTGRES_USER"'
```

Expected:

- `pg_restore` exits 0.
- There are no `ERROR` lines.

If `pg_restore` reports an error, treat the restore as failed. Drop the
temporary volumes and retry from a clean stack.

## 6. Restore Uploads

The backup archive contains the contents of `/data/uploads`, not the parent
directory. Extract it into the root of the temporary `uploads_data` volume.

```bash
rclone --config "$RCLONE_CONFIG_PATH" cat "$UPLOADS_BACKUP" \
  | docker run --rm -i -v tabs_restore_uploads_data:/restore alpine:3.20 \
      sh -lc 'rm -rf /restore/* /restore/.[!.]* /restore/..?*; tar -xz -C /restore'
```

Verify the layout:

```bash
docker run --rm -v tabs_restore_uploads_data:/restore alpine:3.20 \
  sh -lc 'find /restore -maxdepth 4 -type d | head -40'
```

Expected layout:

```text
/restore/users/<ownerId>/<fileId>/<storedName>
```

If you see `/restore/data/uploads/...`, the archive was extracted at the wrong
level.

## 7. Boot the Restored App

```bash
$RESTORE_COMPOSE up -d api web caddy
$RESTORE_COMPOSE ps
$RESTORE_COMPOSE logs -f --tail=200 api caddy
```

Wait for:

- `api`: `[tabs-server] listening on port 4000 (env=production)`
- `caddy`: HTTPS certificate issued for the restore hostname

Check health:

```bash
curl -fsS https://restore-tabs.brandpreneur.net/api/health
# Expected: {"status":"ok"}

curl -fsS https://restore-tabs.brandpreneur.net/api/ready
# Expected: {"status":"ready"}
```

## 8. Verify in the Browser

Open:

```text
https://restore-tabs.brandpreneur.net/
```

Verify:

1. The login screen appears.
2. The original first admin can log in.
3. Projects, tasks, documents, and chat threads are visible.
4. A known task with an attachment opens.
5. The file URL is `/api/files/<fileId>/content`.
6. A second user can log in and sees only that user's data.

If login works but provider-backed AI calls fail, check whether the restore
used the same `ENCRYPTION_KEY` as production.

## 9. Optional API-Level File Check

If you know a restored file ID, check it from the browser after login. The
response should stream bytes and should not expose a filesystem path:

```text
https://restore-tabs.brandpreneur.net/api/files/<fileId>/content
```

Expected:

- HTTP 200 while logged in as the owner.
- HTTP 404 or 401 when logged out or using another user.
- No `/data/uploads/...` path in the response body.

## 10. Tear Down the Temporary Stack

```bash
$RESTORE_COMPOSE down -v
rm -rf /tmp/tabs-restore
```

Confirm temporary volumes are gone:

```bash
docker volume ls | grep tabs_restore || true
```

Production volumes must be untouched.

## Same-Host Restore Caveat

Running the restore stack on the same VPS as production is harder because:

- Production Caddy already owns ports 80 and 443.
- Production cookies require HTTPS.
- ACME certificate issuance needs the public hostname and port 80/443.

For a full restore test, prefer a separate temporary VPS or a local Docker host
with a restore hostname. If you only run `postgres` and `api` on the same VPS,
that is useful for DB and uploads validation, but it is not a complete browser
login restore test.

## If Something Fails

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `pg_restore` errors | Dirty temporary database or incompatible dump | Run `$RESTORE_COMPOSE down -v` and retry from a clean stack |
| `/api/ready` returns 503 | Database URL or restored DB is wrong | Check `.env` and `postgres` logs |
| File viewer returns 404 | Uploads restored at the wrong path or backup overlapped deletion | Verify `/restore/users/...`; try a newer matching backup |
| Login fails after restore | Wrong domain, HTTP instead of HTTPS, or wrong password | Use restore HTTPS hostname and original credentials |
| Provider keys fail to decrypt | `ENCRYPTION_KEY` differs from production | Use the production key for the restore test |
| Second user sees first user's data | Ownership bug | Stop using the restored stack and investigate before production use |
