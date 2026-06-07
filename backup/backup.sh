#!/usr/bin/env bash
# TABS backup script. Invoked by dcron (or manually) inside the backup
# sidecar. Writes to stdout; failure exits non-zero.
#
# Steps (per plan.md § "Backup Plan"):
#   1. pg_dump -> /backup/cache/db-<stamp>.dump
#   2. tar uploads volume -> /backup/cache/uploads-<stamp>.tar.gz
#   3. rclone copyto both into ${RCLONE_REMOTE}/db/daily/... and .../uploads/daily/...
#   4. On Sundays, promote the most recent daily to weekly/
#   5. Prune daily older than ${BACKUP_RETAIN_DAILY} days and weekly older than
#      ${BACKUP_RETAIN_WEEKLY} weeks.
#   6. Log success or failure
#
# Required environment:
#   PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE  -- postgres connection
#   RCLONE_CONFIG                                    -- path to rclone.conf
#   RCLONE_REMOTE                                    -- e.g. gdrypt-tabs:
#   BACKUP_RETAIN_DAILY                              -- int, default 14
#   BACKUP_RETAIN_WEEKLY                             -- int, default 8
#   UPLOADS_SOURCE                                   -- path to uploads dir, default /data/uploads
#
# Exit codes:
#   0  -- success
#   1  -- pg_dump failed
#   2  -- tar failed
#   3  -- rclone upload failed
#   4  -- prune failed (the backup is still considered successful)

set -Eeuo pipefail

CACHE_DIR="${BACKUP_CACHE_DIR:-/backup/cache}"
UPLOADS_SOURCE="${UPLOADS_SOURCE:-/data/uploads}"
RETAIN_DAILY="${BACKUP_RETAIN_DAILY:-14}"
RETAIN_WEEKLY="${BACKUP_RETAIN_WEEKLY:-8}"
RCLONE_BIN="${RCLONE_BIN:-rclone}"

mkdir -p "${CACHE_DIR}/db" "${CACHE_DIR}/uploads"

# Timestamped names. `date -u +%Y%m%dT%H%M%SZ` is the ISO-8601 compact form.
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DOW="$(date -u +%u)"  # 1..7, Monday..Sunday. We use UTC consistently.

DB_DUMP_NAME="db-${STAMP}.dump"
DB_DUMP_PATH="${CACHE_DIR}/db/${DB_DUMP_NAME}"

UPLOADS_TAR_NAME="uploads-${STAMP}.tar.gz"
UPLOADS_TAR_PATH="${CACHE_DIR}/uploads/${UPLOADS_TAR_NAME}"

log() { printf '[backup %s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

# ---- 1. pg_dump ---------------------------------------------------------
log "dumping database ${PGDATABASE} on ${PGHOST}:${PGPORT}"
if ! pg_dump \
      --format=custom \
      --no-owner \
      --no-privileges \
      --file="${DB_DUMP_PATH}.tmp" \
      "${PGDATABASE}"; then
  log "ERROR: pg_dump failed"
  exit 1
fi
mv "${DB_DUMP_PATH}.tmp" "${DB_DUMP_PATH}"
DB_SIZE=$(du -h "${DB_DUMP_PATH}" | cut -f1)
log "database dump: ${DB_DUMP_PATH} (${DB_SIZE})"

# ---- 2. tar uploads -----------------------------------------------------
log "archiving uploads from ${UPLOADS_SOURCE}"
# `--warning=no-file-changed` is harmless if nothing changed; tar exits 0.
if ! tar --warning=no-file-changed \
        -czf "${UPLOADS_TAR_PATH}.tmp" \
        -C "${UPLOADS_SOURCE}" . ; then
  log "ERROR: tar of uploads failed"
  exit 2
fi
mv "${UPLOADS_TAR_PATH}.tmp" "${UPLOADS_TAR_PATH}"
UPLOADS_SIZE=$(du -h "${UPLOADS_TAR_PATH}" | cut -f1)
log "uploads archive: ${UPLOADS_TAR_PATH} (${UPLOADS_SIZE})"

# ---- 3. rclone upload ---------------------------------------------------
log "uploading to ${RCLONE_REMOTE}/db/daily/${DB_DUMP_NAME}"
if ! "${RCLONE_BIN}" copyto \
      --config "${RCLONE_CONFIG}" \
      --stats-one-line \
      --stats 30s \
      "${DB_DUMP_PATH}" \
      "${RCLONE_REMOTE}/db/daily/${DB_DUMP_NAME}"; then
  log "ERROR: rclone upload of db dump failed"
  exit 3
fi

log "uploading to ${RCLONE_REMOTE}/uploads/daily/${UPLOADS_TAR_NAME}"
if ! "${RCLONE_BIN}" copyto \
      --config "${RCLONE_CONFIG}" \
      --stats-one-line \
      --stats 30s \
      "${UPLOADS_TAR_PATH}" \
      "${RCLONE_REMOTE}/uploads/daily/${UPLOADS_TAR_NAME}"; then
  log "ERROR: rclone upload of uploads archive failed"
  exit 3
fi

# ---- 4. Weekly promotion (Sundays) --------------------------------------
# On Sundays, copy today's daily entries into the weekly/ folder so we keep
# one snapshot per week for ${RETAIN_WEEKLY} weeks.
if [[ "${DOW}" == "7" ]]; then
  log "Sunday: promoting today's daily to weekly"
  if ! "${RCLONE_BIN}" copyto \
        --config "${RCLONE_CONFIG}" \
        "${RCLONE_REMOTE}/db/daily/${DB_DUMP_NAME}" \
        "${RCLONE_REMOTE}/db/weekly/${DB_DUMP_NAME}"; then
    log "WARN: weekly promotion of db failed (continuing)"
  fi
  if ! "${RCLONE_BIN}" copyto \
        --config "${RCLONE_CONFIG}" \
        "${RCLONE_REMOTE}/uploads/daily/${UPLOADS_TAR_NAME}" \
        "${RCLONE_REMOTE}/uploads/weekly/${UPLOADS_TAR_NAME}"; then
    log "WARN: weekly promotion of uploads failed (continuing)"
  fi
fi

# ---- 5. Prune -----------------------------------------------------------
# Approximate prune via rclone's `--min-age` flag: delete every file in the
# prefix that was last modified more than `${retain}` days ago. For daily
# snapshots this is the configured daily retention. For weekly snapshots we
# convert the configured number of weeks to days below.
#
# Note: `--min-age` uses the file's modification time on the remote, which
# for our rclone copyto flow is the upload time. That is what we want.
prune_prefix() {
  local subdir="$1"   # daily | weekly
  local retain="$2"   # int
  for kind in db uploads; do
    local target="${RCLONE_REMOTE}/${kind}/${subdir}"
    log "pruning ${target} (--min-age ${retain}d)"
    if ! "${RCLONE_BIN}" delete \
          --config "${RCLONE_CONFIG}" \
          --min-age "${retain}d" \
          "${target}/"; then
      log "WARN: prune of ${target} failed (continuing)"
      continue
    fi
    "${RCLONE_BIN}" rmdirs \
      --config "${RCLONE_CONFIG}" \
      --leave-top-empty-dirs \
      "${target}/" 2>/dev/null || true
  done
}

WEEKLY_RETAIN_DAYS=$(( RETAIN_WEEKLY * 7 ))

prune_prefix daily  "${RETAIN_DAILY}"
prune_prefix weekly "${WEEKLY_RETAIN_DAYS}"

# ---- 6. Local cache cleanup ---------------------------------------------
# Keep the most recent 3 local snapshots so a failed upload can be retried
# on the next run without re-dumping the entire database.
find "${CACHE_DIR}/db"       -maxdepth 1 -type f -name 'db-*.dump'         -mtime +3 -delete || true
find "${CACHE_DIR}/uploads"  -maxdepth 1 -type f -name 'uploads-*.tar.gz'  -mtime +3 -delete || true

log "BACKUP OK  (db=${DB_SIZE} uploads=${UPLOADS_SIZE} stamp=${STAMP})"
