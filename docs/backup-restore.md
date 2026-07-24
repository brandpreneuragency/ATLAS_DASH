# PostgreSQL backup and restore controls

These controls are deliberately conservative. They never print `DATABASE_URL`, credentials, hostnames, or connection strings. Set `DATABASE_URL` through the deployment secret manager; do not put it in a command, filename, or log.

## Create a backup

The output directory is explicit and is created with mode `0700`. The archive is PostgreSQL custom format, optionally compressed when the installed `pg_dump` supports compression, and accompanied by a SHA-256 checksum. Files are mode `0600`.

```sh
export DATABASE_URL='<APPLICATION_DATABASE_URL_FROM_SECRET_MANAGER>'
./scripts/backup-create.sh /var/backups/model-monitor
```

The filename contains only a UTC timestamp, never a database name or secret.

## Verify a backup

Verification checks the checksum and asks `pg_restore` to parse the archive table of contents. Only safe metadata (path, byte size, mode, checksum status) is reported.

```sh
./scripts/backup-verify.sh /var/backups/model-monitor/model-monitor-backup-<UTC_TIMESTAMP>.dump
```

## Daily scheduling

Run from the deployed release directory with the secret injected by the service manager. Example cron shape (replace placeholders; do not add credentials):

```cron
# <MINUTE> <HOUR> * * * cd <RELEASE_DIRECTORY> && /usr/bin/env DATABASE_URL='<INJECTED_AT_RUNTIME>' ./scripts/backup-create.sh <BACKUP_DIRECTORY> >> <BACKUP_LOG> 2>&1
```

Prefer a systemd timer or secret-aware scheduler that supplies `DATABASE_URL` without placing it in a world-readable crontab. Retain backups according to the operator's policy and copy them to separate protected storage.

## Restore into an empty database

Restore is intentionally not a reset or reseed operation. It refuses the configured application database, requires the explicit `--confirm-empty` argument, and refuses a target containing user tables. It does not drop objects. **Do not run this against the live application database.**

1. Provision an empty PostgreSQL database using your approved infrastructure process.
2. Set `DATABASE_URL` to the application database (the script uses it only to identify and protect the live database).
3. Verify the archive first.
4. Supply the target connection string from the secret manager and explicitly confirm emptiness:

```sh
export DATABASE_URL='<APPLICATION_DATABASE_URL_FROM_SECRET_MANAGER>'
./scripts/backup-verify.sh <BACKUP_DIRECTORY>/model-monitor-backup-<UTC_TIMESTAMP>.dump
./scripts/backup-restore.sh <BACKUP_DIRECTORY>/model-monitor-backup-<UTC_TIMESTAMP>.dump '<EMPTY_TARGET_DATABASE_URL>' --confirm-empty
```

Connection strings are shown as placeholders only and must never be committed or pasted into logs. If `BACKUP_RESTORE_HEALTHCHECK` is set to an executable hook, it is called with the target URL after restore; otherwise the script reports that no hook was configured. A suitable hook should run the application's database health/integrity checks without mutating data.

## Safe checks

All scripts support `--help` without contacting PostgreSQL or changing files. Shell syntax can be checked with:

```sh
bash -n scripts/backup-create.sh scripts/backup-verify.sh scripts/backup-restore.sh
```

No restore should be used as a dry run: archive validation is performed by `backup-verify.sh`; `backup-restore.sh` always performs a real restore after its safety gates pass.
