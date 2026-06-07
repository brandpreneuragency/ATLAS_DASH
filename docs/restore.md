# Restoring TABS from a backup

This walkthrough is the **required** restore test for the Agent 8
deployment. Per the plan: "Backup is not complete until restore is
tested." Run this end-to-end on a fresh stack before declaring the
production deploy successful, and re-run it every quarter as a fire
drill.

The procedure assumes:

- You have the rclone `crypt` password and salt. **Without these the
  encrypted backups are unrecoverable.** Store them in a password
  manager.
- The `rclone.conf` is intact and the Google Drive token has not been
  revoked.
- The target machine has Docker and the `tabs` repo checked out.

## 1. Pick the snapshots to restore

```bash
# From the host (or any machine with the rclone.conf).
rclone ls gdrypt-tabs:db/daily
# Example output:
#   12345678 db-20260607T023000Z.dump
#   12345678 db-20260606T023000Z.dump
#   ...

rclone ls gdrypt-tabs:uploads/daily
# Example output:
#   98765432 uploads-20260607T023000Z.tar.gz
#   98765432 uploads-20260606T023000Z.tar.gz
#   ...
```

Pick the matching `db-*` and `uploads-*` pair from the same timestamp.

## 2. Bring up a temporary stack

The temporary stack should NOT share volumes with the production
stack. Use a different compose project name so Docker creates fresh
named volumes.

```bash
git clone <your-tabs-repo> /tmp/tabs-restore
cd /tmp/tabs-restore
cp .env.example .env
$EDITOR .env
# Set POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD to fresh values
# (this is a temporary database). Keep everything else the same.
```

Edit `docker-compose.yml` to prefix the volume names so they do not
collide with the production stack. Quickest way: at the bottom of the
file, edit the `volumes:` block to append `-restore` to each name:

```yaml
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
```

Also override the project name in `.env` (or use `-p` on the command
line):

```bash
docker compose -p tabs-restore up -d postgres
```

## 3. Restore the database

```bash
# Stream-encrypt-decrypt the dump straight into pg_restore.
rclone cat gdrypt-tabs:db/daily/db-20260607T023000Z.dump \
  | pg_restore --format=custom --no-owner --no-privileges \
              --dbname=<POSTGRES_DB> --username=<POSTGRES_USER> \
              --host=127.0.0.1 --port=5432

# The pg_restore connection has to land inside the temporary postgres
# container. Easier: drop the file into the container with `rclone
# cat` piped through `docker exec`:
rclone cat gdrypt-tabs:db/daily/db-20260607T023000Z.dump \
  | docker compose -p tabs-restore exec -T postgres \
        pg_restore --format=custom --no-owner --no-privileges \
                   --dbname=$POSTGRES_DB --username=$POSTGRES_USER
```

The second form pipes directly into the container, avoiding the need
to expose Postgres on the host. `pg_restore` exits 0 on success. Any
"ERROR" lines on stderr that come from `pg_restore` itself are
non-fatal when restoring a `--format=custom` dump (it issues CREATE /
ALTER statements that may warn about already-existing objects if the
DB was not empty; that is expected).

## 4. Restore the uploads

```bash
# Stream-decrypt and untar into the temporary stack's uploads volume.
docker compose -p tabs-restore exec -T api mkdir -p /data/uploads
rclone cat gdrypt-tabs:uploads/daily/uploads-20260607T023000Z.tar.gz \
  | tar -xz -C /tmp/uploads-restore
docker compose -p tabs-restore cp /tmp/uploads-restore/. api:/data/uploads/
```

Verify the bytes are where the API expects them:

```bash
docker compose -p tabs-restore exec api ls /data/uploads
# Expected: one directory per user, e.g. users/<userId>/<fileId>/<storedName>
```

## 5. Boot the rest of the stack

```bash
docker compose -p tabs-restore up -d api web caddy
docker compose -p tabs-restore logs -f api
```

Wait for `[tabs-server] listening on port 4000 (env=production)`.

## 6. Verify

### a) API health

```bash
curl -sf https://<APP_DOMAIN>/api/health
# Expected: {"status":"ok"}

curl -sf https://<APP_DOMAIN>/api/ready
# Expected: {"ready":true}
```

### b) Login as the first admin

Open `https://<APP_DOMAIN>/` in a browser. The login screen should
appear. Sign in as the original first admin. Expected: the dashboard
loads, projects / tasks / documents / chat threads all show the data
from the dump.

### c) At least one task with a file attachment

Open a task that you know had a file attachment before the backup.
Click the attachment thumbnail. Expected: the image / file viewer
loads the bytes. The file URL is `https://<APP_DOMAIN>/api/files/<id>/content`
and the API streams them from `/data/uploads/users/<ownerId>/<fileId>/...`.

### d) Cross-user safety sanity

Sign in as a second user (created via invite before the backup).
Expected: only that user's data is visible. No leakage of user A's
projects, tasks, or files.

## 7. Tear down

When the test is done:

```bash
docker compose -p tabs-restore down -v
# -v removes the temporary volumes.
rm -rf /tmp/tabs-restore
```

The production stack on the original host is unaffected.

## If something is wrong

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `pg_restore: error: could not execute query: ... already exists` | The temporary database was not empty | Drop and recreate the database before retrying |
| File viewer shows 404 for an attachment | The uploads archive did not extract to the path the API expects | `docker compose exec api ls /data/uploads` should show `users/...`; if it shows the contents of the tarball directly, the tar extraction was wrong |
| `/api/ready` returns 503 with `pg_isready: ...` | DATABASE_URL mismatch | Check the `.env` on the temporary host; the URL must point at the temporary postgres container, not `localhost` |
| Caddy can't obtain a certificate on the temporary host | DNS for `APP_DOMAIN` is still pointed at the production VPS | Use a different `APP_DOMAIN` for the restore test (e.g. a localhost-only test with Caddy in HTTP mode) |
| Login succeeds but the dashboard is empty | Wrong dump timestamp; older dump than the current data | Pick a more recent daily; the daily cron keeps 14 |
