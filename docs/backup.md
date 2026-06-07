# Backup operator's runbook

TABS uses `rclone crypt` to push daily + weekly encrypted snapshots of
the Postgres database and the uploads volume to Google Drive. The
backup sidecar runs inside the `tabs` compose stack and is started by
`docker compose up -d`. The cron schedule is configured in `.env` and
the retention is also controlled by `.env` (see `BACKUP_RETAIN_DAILY`
and `BACKUP_RETAIN_WEEKLY`).

## What's backed up

- **Database**: a custom-format `pg_dump` of the entire `tabs` database.
  Compressed and uploaded to `gdrypt-tabs:db/daily/<stamp>.dump`.
- **Uploads**: a `tar.gz` of `/data/uploads/` (the user-owned file
  service root). Uploaded to `gdrypt-tabs:uploads/daily/<stamp>.tar.gz`.
- **Weekly promotion**: every Sunday, the most recent daily entries
  are copied to `gdrypt-tabs:db/weekly/` and `gdrypt-tabs:uploads/weekly/`
  so the retention policy covers the long tail.

## When backups run

`BACKUP_SCHEDULE_HOUR` and `BACKUP_SCHEDULE_MINUTE` in the root
`.env` set the daily schedule. The container's local time is `TZ`
(default `UTC`). A typical config:

```
BACKUP_SCHEDULE_HOUR=2
BACKUP_SCHEDULE_MINUTE=30
TZ=Europe/Istanbul
```

That runs the backup at 02:30 Istanbul time, every day.

## What the operator checks daily

```bash
# Did last night's backup succeed?
docker compose logs --since 24h backup | tail -50
# Expected last line: "[backup ...] BACKUP OK  (...)"
```

A one-line `BACKUP OK` is the success indicator. Anything else
(`ERROR`, `WARN`, `pg_dump failed`, `rclone upload ... failed`) needs
investigation.

## Triggering a one-shot backup

```bash
docker compose exec backup /backup/backup.sh
```

This runs the same script dcron runs. Output is on stdout; the script
also logs to `docker logs backup`. The run is independent of the
cron schedule and does not affect the next scheduled run.

## Listing what's on the remote

```bash
# Decrypted listing (the `gdrypt-tabs:` remote is the crypt wrapper).
docker compose exec backup rclone ls gdrypt-tabs:db/daily
docker compose exec backup rclone ls gdrypt-tabs:db/weekly
docker compose exec backup rclone ls gdrypt-tabs:uploads/daily
docker compose exec backup rclone ls gdrypt-tabs:uploads/weekly

# Raw listing (sees the encrypted blob names, useful for capacity).
docker compose exec backup rclone ls gdrive-tabs:tabs-backups/db/daily
```

## Pruning behaviour

Pruning runs at the end of every backup. It is approximate:
`rclone delete --min-age Nd` removes every file in the daily / weekly
prefix older than N days. The cap is conservative: at least N days of
backups survive.

If you want a hard "keep the last N" cap, replace the prune with a
`rclone lsjson ... | sort -k Name | tail -n +N+1 | xargs rclone
deletefile` pipeline. This is left as a v1.1 enhancement; the
`--min-age` approach has been good enough for every other project.

## Rotating the crypt password

The crypt password and salt are stored in `secrets/rclone.conf`. To
rotate:

1. `rclone obscure` the new password and salt.
2. Replace the two `password =` / `password2 =` lines in
   `secrets/rclone.conf`.
3. Re-upload every snapshot through the new crypt remote (rclone does
   not decrypt-and-re-encrypt; you must download, re-encrypt, and
   re-upload each file). The simplest path: trigger a fresh backup
   and let the prune catch up over the next 14 days.

If you lose the crypt password, **the backups are unrecoverable**. The
Google Drive admin can still see the encrypted blobs but cannot read
them. Store the password in a password manager, not just on the VPS.

## Restoring

See `docs/restore.md` for the end-to-end walkthrough. The high-level
flow is:

1. List daily / weekly on the remote.
2. `rclone cat` the latest dump and pipe to `pg_restore` on a clean
   Postgres.
3. `rclone cat` the matching uploads archive and untar to a clean
   uploads dir.
4. Boot a temporary TABS stack against the restored data.
5. Verify login, file viewer, and cross-user safety.

## What's NOT in this slice

- **Off-host backup target.** v1 ships one remote. Adding a second
  remote (S3, Backblaze B2, etc.) is a v1.1 enhancement.
- **Restore was not executed during development** (no Docker on the
  dev box). The script and the walkthrough are reviewed; the operator
  runs the first round-trip on the VPS.
- **No monitoring / alerting.** The plan does not require it for v1.
  A v1.1 enhancement is a `docker compose logs --since 24h backup |
  grep BACKUP` cron on the host that alerts the operator when
  `BACKUP OK` is missing.
