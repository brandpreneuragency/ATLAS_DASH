# ATLAS_DASH deploy topology

Single source of truth for naming and the local → git → VPS loop.

## Source of truth

| Layer | Canonical value |
|-------|-----------------|
| Local workspace | `C:\02_APPS\ATLAS_DASH` only |
| Legacy local | `C:\02_APPS\TABS` — do not deploy from; leave unless user says otherwise |
| Git remote | `https://github.com/brandpreneuragency/ATLAS_DASH.git` |
| Deploy branch | `main` |
| Public host | `https://atlasdash.brandpreneur.net` (Caddy basic-auth) |
| Temporary alias | `https://tabs.brandpreneur.net` (same site until DNS + client switch; then remove from Caddyfile) |
| VPS clone | `/home/admin/atlas_dash/app` |
| Compose project | `atlas_dash` (`-p atlas_dash`) |
| Compose file | `deploy/docker-compose.yml` |
| Env file | `deploy/.env` on VPS only (gitignored; never print values) |
| Web container | `atlas_dash_caddy` |
| API container | `atlas_dash_api` |
| Static root in image | `/srv/atlas-dash-web` |
| API bind | `127.0.0.1:4010` |
| Hermes | loopback `9119` / `8642` (unchanged protocol) |

Also served by the same Caddy container:

- `atlas.brandpreneur.net` → `127.0.0.1:8700` (Atlas Control)
- `wagneratelier.co` static under `/var/www/wagneratelier`

## Env key map (full rebrand)

| Purpose | Key |
|---------|-----|
| Site basic-auth user | `ATLAS_DASH_BASIC_AUTH_USER` |
| Site basic-auth bcrypt hash | `ATLAS_DASH_BASIC_AUTH_HASH` (escape `$` as `$$` for Compose) |
| API port | `ATLAS_DASH_API_PORT` (compose sets `4010`) |
| Doc Mode roots JSON | `ATLAS_DASH_FS_ROOTS` |
| Optional sensitive FS override | `ATLAS_DASH_FS_ALLOW_SENSITIVE` |
| Hermes Bearer (loopback-only mode) | `HERMES_DASHBOARD_SESSION_TOKEN` |
| Hermes cookie-bridge user | `HERMES_BASIC_AUTH_USER` |
| Hermes cookie-bridge secret/password | `HERMES_BASIC_AUTH_SECRET` / `HERMES_BASIC_AUTH_PASSWORD` |

See `deploy/.env.example`. Never commit `deploy/.env`.

## One-command agent path

User phrase: **“deploy ATLAS_DASH”** / `/atlas-dash-vps-deploy`

Skill: `.grok/skills/atlas-dash-vps-deploy/SKILL.md`

Pipeline:

1. Inventory uncommitted / unpushed work in `C:\02_APPS\ATLAS_DASH`
2. Quality gate (`npm run check`; `cd server; npm test` if `server/` changed)
3. Commit (if needed) + `git push origin main`
4. VPS: `git fetch` + `git reset --hard origin/main` in `/home/admin/atlas_dash/app`
5. Selective `docker compose -p atlas_dash -f deploy/docker-compose.yml --env-file deploy/.env up -d --build [caddy|api]`
6. Smoke checks + report

## Manual VPS commands

```bash
cd /home/admin/atlas_dash/app
git fetch origin main
git reset --hard origin/main
docker compose -p atlas_dash -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

## Smoke checklist (record codes)

| Check | Expected |
|-------|----------|
| `https://atlasdash.brandpreneur.net/` unauth | `401` |
| `https://atlas.brandpreneur.net/` | `200` |
| `https://wagneratelier.co/` | `200` |
| `http://127.0.0.1:4010/healthz` | `{"ok":true}` |
| `http://127.0.0.1:4010/hermes/api/sessions` | `200` |
| `http://127.0.0.1:4010/fs/roots` | `200` |
| `ss` for `4010` / `9119` / `8642` | `127.0.0.1` only |
| Containers | `atlas_dash_caddy`, `atlas_dash_api` Up (api healthy) |

SSH (non-interactive only):

```text
ssh -o BatchMode=yes admin@142.132.230.137 "…"
```

## Non-negotiables

- Never print `.env` / secrets
- Never expose `4010` / `9119` / `8642` publicly
- Do not recreate `hermes` / `atlas_control` / `searxng` without explicit in-session **Approve**
- Do not force-push
- Do not deploy from `C:\02_APPS\TABS` by default

## Cutover notes (TABS → ATLAS_DASH)

Host network means **one** Caddy may own `:80`/`:443` and one API may own `:4010`. Cutover is stop old `tabs_*` then immediately start `atlas_dash_*` after images build. Leave `/home/admin/tabs` as backup until the user approves removal.
