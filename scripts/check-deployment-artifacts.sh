#!/usr/bin/env bash
set -euo pipefail

usage() { printf 'Usage: %s [--help]\n' "$0"; }
if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then usage; exit 0; fi
[[ $# -eq 0 ]] || { usage >&2; exit 2; }

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
compose="$root/docker/compose.yaml"
env_example="$root/.env.example"
for path in "$compose" "$env_example" "$root/scripts/backup-create.sh" "$root/scripts/backup-restore.sh" "$root/scripts/backup-verify.sh" "$root/docs/backup-restore.md" "$root/RELEASE_CHECKLIST.md" "$root/SECURITY_REVIEW.md"; do
  [[ -f "$path" ]] || { printf 'Missing deployment artifact: %s\n' "$path" >&2; exit 1; }
done

grep -Eq '127\.0\.0\.1:[^" ]*:5432' "$compose" || { printf 'PostgreSQL must bind to loopback only.\n' >&2; exit 1; }
if grep -Eq '(^|[[:space:]])-[[:space:]]*"?([0-9.]+:)?5432:5432' "$compose"; then
  printf 'PostgreSQL appears publicly exposed.\n' >&2; exit 1
fi
grep -q 'POSTGRES_PASSWORD: \${POSTGRES_PASSWORD' "$compose" || { printf 'PostgreSQL password must come from environment.\n' >&2; exit 1; }
grep -q -- '--confirm-empty' "$root/scripts/backup-restore.sh" || { printf 'Restore confirmation gate missing.\n' >&2; exit 1; }
grep -q 'pg_restore --list' "$root/scripts/backup-verify.sh" || { printf 'Archive validation missing.\n' >&2; exit 1; }
bash -n "$root/scripts/backup-create.sh" "$root/scripts/backup-restore.sh" "$root/scripts/backup-verify.sh" "$0"
printf 'Deployment artifact checks passed (static only; no services or database contacted).\n'