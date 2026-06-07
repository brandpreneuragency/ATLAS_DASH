# Deploying TABS to the VPS

This walkthrough covers the production migration to
`tabs.brandpreneur.net` on the existing Hetzner VPS. It assumes:

- The VPS is reachable as `root@<vps-host>`.
- The CRM (`crm-app` + `crm-nginx` + the CRM Postgres container) is still
  running on the VPS and shares the 80/443 ports.
- DNS for `tabs.brandpreneur.net` is currently pointed **elsewhere** (or
  not yet configured). The Caddy ACME challenge will not succeed until
  the A record is in place.
- The operator has shell access to a workstation with `docker`,
  `rclone`, and a browser.

## 0. Pre-flight

Confirm Docker is installed and the daemon is running:

```bash
docker --version
docker compose version
```

Confirm the host has the right time zone and NTP sync:

```bash
timedatectl status
```

## 1. Remove the existing CRM

The plan and the user's locked-in decisions say the CRM must be fully
removed before TABS takes over port 80/443.

```bash
# SSH into the VPS
ssh root@<vps-host>

# Stop the CRM containers and remove them.
cd /root/crm   # or wherever the CRM compose stack lives
docker compose down --remove-orphans
docker network prune -f

# Remove the CRM's Postgres data volume if it is not shared with TABS.
docker volume ls | grep -i crm
docker volume rm <crm-postgres-volume-name>
```

Confirm nothing is listening on 80/443:

```bash
ss -ltn '( sport = :80 or sport = :443 )'
# Expected: empty.
```

## 2. Clone TABS to the VPS

```bash
ssh root@<vps-host>
git clone <your-tabs-repo> /root/tabs
cd /root/tabs
```

## 3. Create the production environment

```bash
cp .env.example .env
$EDITOR .env
```

Set, at minimum:

- `APP_DOMAIN` — the hostname Caddy will issue the certificate for.
- `APP_URL` — `https://${APP_DOMAIN}`.
- `POSTGRES_PASSWORD` — a 32+ char random string.
- `ENCRYPTION_KEY` — 64 hex chars. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- `RCLONE_REMOTE` — the name of the rclone crypt remote (e.g. `gdrypt-tabs:`).
- `TZ` — the timezone the cron schedule runs in. `Europe/Istanbul` is the
  default for this user.

## 4. Configure rclone + Google Drive

```bash
# Install rclone on the VPS (one-time).
curl https://rclone.org/install.sh | sudo bash

# Interactive config wizard. This opens a browser flow to authenticate
# against the target Google account and creates the `gdrive-tabs:` remote.
rclone config

# Add a `crypt` wrapper above `gdrive-tabs:`. Note the crypt password and
# salt that rclone asks for; store them somewhere safe (e.g. a password
# manager). These are the only thing that can decrypt the backups.

# Verify the remote is reachable.
rclone lsd gdrive-tabs:
rclone lsd gdrypt-tabs:
```

Mount the resulting `rclone.conf` into the backup sidecar:

```bash
mkdir -p /root/tabs/secrets
cp ~/.config/rclone/rclone.conf /root/tabs/secrets/rclone.conf
chmod 600 /root/tabs/secrets/rclone.conf
```

## 5. Point DNS at the VPS

In the DNS provider for `brandpreneur.net`, set:

- `tabs.brandpreneur.net` → A record → the VPS's public IP.

Wait for propagation. Caddy will retry the ACME challenge until DNS is
live.

## 6. Boot the stack

```bash
cd /root/tabs
docker compose pull   # optional; pulls the public base images
docker compose up -d --build

# Tail the logs.
docker compose logs -f --tail=200
```

Watch for:

- `caddy-1` printing `obtained certificate` and `serving HTTPS on :443`.
- `api-1` printing `[tabs-server] listening on port 4000 (env=production)`.
- `postgres-1` printing `database system is ready to accept connections`.
- `web-1` exiting 0 (the `nginx:alpine` image starts fast).
- `backup-1` printing `[backup] cron installed: ...`.

## 7. Run Prisma migrations

```bash
docker compose exec api npx prisma migrate deploy
```

The output should list every migration in `server/prisma/migrations/` and
end with `All migrations have been successfully applied.`

## 8. Bootstrap the first admin

Open `https://tabs.brandpreneur.net/` in a browser. The login screen
should be the auth gate. The `/api/auth/status` endpoint will return
`{"hasUsers":false}`, which the gate renders as the Bootstrap form.

Create the first user. This user is automatically promoted to `admin`
role and can create invites for the rest of the team.

## 9. Trigger the first backup

```bash
# One-shot backup so a snapshot exists before the cron schedule fires.
docker compose exec backup /backup/backup.sh

# Verify it landed.
docker compose exec backup rclone ls gdrypt-tabs:db/daily
docker compose exec backup rclone ls gdrypt-tabs:uploads/daily
```

## 10. Run a restore test

The plan explicitly requires a restore test before declaring the
deployment complete. Follow `docs/restore.md` end-to-end on a temporary
Docker stack (e.g. on a separate VPS, or in a different directory on
the same VPS with a different compose project name). The test must show:

1. The database restores cleanly (`pg_restore` finishes without error).
2. The uploads archive extracts and the file-service can serve the
   restored bytes.
3. Login as the first admin still works.
4. At least one task with an attachment is viewable end-to-end.

## 11. Hand off

- Save `rclone.conf` and the crypt password + salt in a password
  manager. The deploy is unrecoverable without them.
- Add a calendar reminder to run `docs/restore.md` end-to-end every
  quarter.
- Subscribe to the TABS server logs: `docker compose logs -f api`.

## Common issues

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Caddy logs `dial tcp: lookup api on ...: no such host` | The `tabs_internal` network is missing or `api` hasn't started | `docker compose up -d api` first, then `caddy` |
| Caddy logs `obtained certificate: ... challenge failed` | DNS A record not pointing at the VPS | Check DNS with `dig +short tabs.brandpreneur.net` |
| `api-1` exits with `ENCRYPTION_KEY must be 32 bytes hex` | `.env` not loaded, or `ENCRYPTION_KEY` is wrong | Verify with `docker compose exec api env \| grep ENCRYPTION` |
| `pg_isready` fails inside the postgres container | `POSTGRES_PASSWORD` mismatch between `postgres` service and `api` service | They read the same `.env`; check for quoting issues |
| `backup-1` exits with `rclone: config file not found` | `secrets/rclone.conf` missing on the host | `mkdir -p secrets && cp /path/to/rclone.conf secrets/` |
| Login redirect loop | Cookie `Secure` flag mismatched (Caddy serving HTTP, not HTTPS) | Confirm `https://` in the browser; Caddy should have the cert by now |
