#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf 'Usage: %s OUTPUT_DIRECTORY\n' "$0"
  printf 'Creates a PostgreSQL custom-format backup and SHA-256 checksum.\n'
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then usage; exit 0; fi
if [[ $# -ne 1 || -z ${1:-} ]]; then usage >&2; exit 2; fi
: "${DATABASE_URL:?DATABASE_URL must be set (it is never printed)}"

out_dir=$1
mkdir -p -- "$out_dir"
chmod 700 -- "$out_dir"
if [[ ! -d "$out_dir" || ! -w "$out_dir" ]]; then
  printf 'Output directory is not writable.\n' >&2; exit 1
fi

archive="$out_dir/model-monitor-backup-$(date -u +%Y%m%dT%H%M%SZ).dump"
tmp="$archive.tmp.$$"
cleanup() { rm -f -- "$tmp"; }
trap cleanup EXIT

args=(--format=custom --file="$tmp" --no-password)
if pg_dump --help 2>/dev/null | grep -q -- '--compress'; then args+=(--compress=9); fi
printf 'Creating PostgreSQL backup in %s\n' "$out_dir"
pg_dump "${args[@]}" "$DATABASE_URL"
chmod 600 -- "$tmp"
mv -- "$tmp" "$archive"
sha256sum -- "$archive" > "$archive.sha256"
chmod 600 -- "$archive.sha256"
printf 'Backup created: %s\nChecksum created: %s\n' "$archive" "$archive.sha256"
