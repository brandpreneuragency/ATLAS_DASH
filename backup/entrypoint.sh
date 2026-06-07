#!/usr/bin/env bash
# Entrypoint for the backup sidecar. Substitutes the cron schedule from env
# vars, installs the crontab, and starts dcron in the foreground (so the
# container stays alive and stdout is collected by the Docker log driver).

set -euo pipefail

HOUR="${BACKUP_SCHEDULE_HOUR:-2}"
MIN="${BACKUP_SCHEDULE_MINUTE:-30}"

# dcron's crontab format: "MIN HOUR DOM MON DOW CMD". One job, one script.
# A leading `0` is allowed; `dcron` accepts both `2 30` and `02 30`.
cat > /etc/crontabs/root <<EOF
${MIN} ${HOUR} * * * /usr/local/bin/run-backup.sh >/proc/1/fd/1 2>/proc/1/fd/2
EOF

# dcron logs through syslog by default; redirect to stdout for visibility.
# Many Alpine images do not run syslogd, so we use `-f` to keep dcron in the
# foreground and `-l 2` to enable logging to stderr. The default CMD in the
# Dockerfile already sets these.

# A small wrapper around the main script so dcron sees a clean exit code and
# the script's stdout shows up in `docker logs`.
cat > /usr/local/bin/run-backup.sh <<'WRAP'
#!/usr/bin/env bash
exec /backup/backup.sh
WRAP
chmod +x /usr/local/bin/run-backup.sh

echo "[backup] cron installed: ${MIN} ${HOUR} * * * -> /backup/backup.sh"

# Hand off to dcron. The Dockerfile's CMD is `["dcron", "-f", "-l", "2"]`
# so this is what actually runs.
exec dcron -f -l 2
