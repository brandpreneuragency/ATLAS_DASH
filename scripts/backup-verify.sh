#!/usr/bin/env bash
set -euo pipefail

usage() { printf 'Usage: %s BACKUP.dump [BACKUP.dump.sha256]\n' "$0"; }
if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then usage; exit 0; fi
if [[ $# -lt 1 || $# -gt 2 ]]; then usage >&2; exit 2; fi
archive=$1
checksum=${2:-$archive.sha256}
[[ -f "$archive" && -r "$archive" ]] || { printf 'Backup archive is missing or unreadable.\n' >&2; exit 1; }
[[ -f "$checksum" && -r "$checksum" ]] || { printf 'Checksum file is missing or unreadable.\n' >&2; exit 1; }
sha256sum --check --status -- "$checksum" || { printf 'Checksum verification failed.\n' >&2; exit 1; }
command -v pg_restore >/dev/null 2>&1 || { printf 'pg_restore is required for archive validation.\n' >&2; exit 1; }
pg_restore --list --file=/dev/null "$archive" >/dev/null
printf 'Backup verified: %s\n' "$archive"
printf 'Size bytes: %s\n' "$(stat -c '%s' -- "$archive")"
printf 'Mode: %s\n' "$(stat -c '%a' -- "$archive")"
printf 'Checksum: valid\n'
