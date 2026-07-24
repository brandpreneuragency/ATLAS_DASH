#!/usr/bin/env bash
set -euo pipefail

usage() { printf 'Usage: %s BACKUP.dump TARGET_DATABASE_URL --confirm-empty\n' "$0"; }
if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then usage; exit 0; fi
if [[ $# -ne 3 || ${3:-} != --confirm-empty ]]; then
  usage >&2; printf 'Restore requires an explicit --confirm-empty confirmation.\n' >&2; exit 2
fi
: "${DATABASE_URL:?DATABASE_URL must be set (it is never printed)}"
archive=$1
target_url=$2
[[ -n "$target_url" ]] || { printf 'Target database URL is required.\n' >&2; exit 2; }
[[ -f "$archive" ]] || { printf 'Backup archive not found.\n' >&2; exit 1; }
[[ "$target_url" != "$DATABASE_URL" ]] || { printf 'Refusing to restore into the configured application database.\n' >&2; exit 1; }
command -v psql >/dev/null 2>&1 || { printf 'psql is required.\n' >&2; exit 1; }
command -v pg_restore >/dev/null 2>&1 || { printf 'pg_restore is required.\n' >&2; exit 1; }

app_db=$(psql "$DATABASE_URL" --no-password -Atqc 'select current_database()')
target_db=$(psql "$target_url" --no-password -Atqc 'select current_database()')
[[ -n "$target_db" && "$target_db" != "$app_db" ]] || {
  printf 'Refusing restore: target resolves to the configured application database.\n' >&2; exit 1;
}
# Only restore into a database with no user tables/schemas. System schemas are excluded.
nonempty=$(psql "$target_url" --no-password -Atqc "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p','v','m','f') and n.nspname not like 'pg_%' and n.nspname <> 'information_schema'")
[[ "$nonempty" == 0 ]] || { printf 'Refusing restore: target database is not empty.\n' >&2; exit 1; }

printf 'Restoring verified archive into caller-supplied empty target database.\n'
pg_restore --no-password --exit-on-error --dbname="$target_url" "$archive"
if [[ -n ${BACKUP_RESTORE_HEALTHCHECK:-} ]]; then
  printf 'Running configured restore health check.\n'
  "$BACKUP_RESTORE_HEALTHCHECK" "$target_url"
else
  printf 'Restore complete; no BACKUP_RESTORE_HEALTHCHECK hook configured.\n'
fi
