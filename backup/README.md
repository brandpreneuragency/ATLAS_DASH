# TABS backup sidecar

A daily cron-driven sidecar that:

1. Dumps the Postgres database (`pg_dump --format=custom`).
2. Archives the uploads volume (`tar -czf`).
3. Encrypts both via `rclone crypt` and uploads to Google Drive.
4. Promotes the most recent daily to `weekly/` on Sundays.
5. Prunes daily and weekly backups per the configured retention.
6. Logs everything to stdout for `docker compose logs backup`.

## File layout

```
backup/
  Dockerfile          Alpine + bash + dcron + postgresql-client + rclone
  entrypoint.sh       Installs the crontab, starts dcron in the foreground
  backup.sh           The actual backup script (steps 1-6 above)
  crontab             Schedule template (entrypoint.sh substitutes env vars)
  rclone.conf.template  Operator-facing template for /secrets/rclone.conf
  README.md           This file
```

## One-time setup on the VPS

```bash
# 1. Create the secrets dir.
mkdir -p /root/tabs/secrets

# 2. Set up the Google Drive remote interactively (opens a browser flow).
#    The resulting config file is written to ~/.config/rclone/rclone.conf.
#    Copy it to the secrets dir the backup sidecar will mount.
cp ~/.config/rclone/rclone.conf /root/tabs/secrets/rclone.conf

# 3. Sanity-check that the encrypted remote is reachable.
docker compose run --rm backup rclone lsd gdrypt-tabs:

# 4. Trigger a one-shot backup so the first snapshot lands before the cron
#    schedule fires.
docker compose exec backup /backup/backup.sh

# 5. Inspect the result.
docker compose logs backup
```

The first backup is large (uploads can be hundreds of MB). Subsequent
backups upload the new snapshots only.

## Manual run

```bash
# Trigger a backup now (returns the same output as `docker logs backup`).
docker compose exec backup /backup/backup.sh

# List the daily / weekly snapshots currently on the remote.
docker compose exec backup rclone lsd gdrypt-tabs:db
docker compose exec backup rclone ls gdrypt-tabs:db/daily
docker compose exec backup rclone ls gdrypt-tabs:db/weekly
```

## Schedule

Configured by the `BACKUP_SCHEDULE_HOUR` and `BACKUP_SCHEDULE_MINUTE` env
vars in the root `.env` file. Default: `02:30` in the container's
timezone (set via the `TZ` env var, default `UTC`).

The container's local time is whatever `TZ` resolves to. If you set
`TZ=Europe/Istanbul` the `02:30` job runs at 02:30 Istanbul time.

## Retention

- **Daily**: `BACKUP_RETAIN_DAILY` most recent daily snapshots (default 14).
- **Weekly**: `BACKUP_RETAIN_WEEKLY` most recent weekly snapshots (default 8).

Pruning uses `rclone delete --min-age Nd` which is approximate (it deletes
every file older than N days in the prefix). On a typical run this keeps
between N and N+1 snapshots because of clock drift. The cap is conservative:
**at least** N days of backups survive.

## Restore

See `docs/restore.md` for the full walkthrough. The high-level flow is:

1. Pull the latest daily DB dump and uploads archive from the remote.
2. Decrypt via `rclone cat` into a clean local Postgres + uploads dir.
3. `pg_restore` the database, untar the uploads, restart the stack.
4. Verify with `docker compose exec api node -e "..."` and a manual browser
   login.

## What's NOT in this slice

- **Restore was not run during development** (no Docker on the dev box). The
  script and the docs/restore.md walkthrough are reviewed; the actual
  round-trip has to be run on the VPS or any Docker host.
- **The rclone config is operator-supplied.** There is no `rclone config`
  wizard baked into the sidecar; the operator does the OAuth flow once and
  bind-mounts the resulting `rclone.conf` into the container.
- **No off-host restore target.** The script uploads to one Google Drive
  remote. A second remote (e.g. S3) is a v1.1 enhancement.
