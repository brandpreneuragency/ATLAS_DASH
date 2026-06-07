# Backup sidecar. Alpine + bash + dcron + postgresql-client + rclone.
#
# Build:  docker build -t tabs-backup backup/.
# Run:    started by docker-compose; schedules a daily backup inside the
#         container via dcron. The operator can also trigger a one-shot run
#         with `docker compose exec backup /backup/backup.sh`.

FROM alpine:3.20

# Tools: bash for the script, dcron for the schedule, postgresql-client for
# pg_dump / psql, rclone for the encrypted upload. `tzdata` so the container
# can honour the `TZ` env var. `coreutils` for `date -d` portability.
RUN apk add --no-cache \
        bash \
        dcron \
        postgresql16-client \
        rclone \
        tzdata \
        coreutils \
        tini

# Working directory for the sidecar's state.
WORKDIR /backup

# Layout inside the container:
#   /backup/backup.sh        main script
#   /backup/entrypoint.sh    starts dcron in the foreground
#   /backup/crontab          the daily schedule (substituted at build)
#   /backup/cache            local state (bind-mounted as a named volume)
COPY backup.sh /backup/backup.sh
COPY entrypoint.sh /backup/entrypoint.sh
COPY crontab /backup/crontab.template
RUN chmod +x /backup/backup.sh /backup/entrypoint.sh

# tini = PID 1, reaps zombies from the cron daemon.
ENTRYPOINT ["/sbin/tini", "--", "/backup/entrypoint.sh"]

# The script writes to stdout; docker-compose surfaces this via
# `docker compose logs backup`.
CMD ["dcron", "-f", "-l", "2"]
