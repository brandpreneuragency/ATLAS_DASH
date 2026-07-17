---
name: atlas-dash-vps-deploy
description: >
  Deploy local ATLAS_DASH repo changes to the production VPS
  (atlasdash.brandpreneur.net). Runs the full pipeline: inventory uncommitted
  work, quality gate, commit, push origin/main, VPS git pull, selective Docker
  rebuild of atlas_dash_caddy and/or atlas_dash_api, smoke checks, and a
  factual deploy report. Use when the user says "deploy ATLAS_DASH", "deploy
  to VPS", "update atlas dash on the server", "ship local changes",
  "redeploy atlas dash", "push and deploy", or runs /atlas-dash-vps-deploy.
  Prefer this over the deprecated tabs-vps-deploy skill.
---

# ATLAS_DASH → VPS Deploy

End-to-end deploy of the ATLAS_DASH web stack from the local git repo to the
VPS. Designed for **occasional deploys after many local changes** — the agent
inventories, verifies, ships, and rebuilds without the user tracking files.

Also see: `docs/ATLAS_DASH_DEPLOY.md`.

## When to run

User wants local work live at `https://atlasdash.brandpreneur.net`. Triggers
include deploy / ship / update VPS / redeploy / push and build / deploy ATLAS_DASH.

## Non-negotiables (stop if violated)

- Repo root is **ATLAS_DASH** only (normally `C:\02_APPS\ATLAS_DASH`). Confirm
  with `git rev-parse --show-toplevel` and presence of `deploy/docker-compose.yml`.
  **Do not** deploy from `C:\02_APPS\TABS` unless the user explicitly overrides.
- VPS access is **non-interactive only**:
  `ssh -o BatchMode=yes admin@142.132.230.137 "…"`
- **Never print** secrets: tokens, password hashes, `deploy/.env` values,
  Hermes basic-auth secret, API keys. Report only key *names* and set/unset.
- **Never** `git push --force`, `git reset --hard` **locally**, `git clean -fd`,
  or rewrite published history.
- On the VPS, `git reset --hard origin/main` is **allowed** only inside
  `/home/admin/atlas_dash/app` (deploy clone). That is intentional and makes the
  server match GitHub.
- Do **not** recreate or restart `hermes`, `atlas_control`, or `searxng`
  unless the user explicitly approves in-session.
- Preserve `atlas.brandpreneur.net` and `wagneratelier.co` (same Caddy).
- Do **not** expose ports `4010`, `9119`, or `8642` publicly.
- Prefer **not** committing unrelated user WIP. If the tree mixes deployable
  work with unrelated experiments, stage only deployable paths or ask.

Also honor repo `AGENTS.md` security and verification rules.

## Architecture facts (do not re-derive)

| Item | Value |
|------|--------|
| Local repo | `C:\02_APPS\ATLAS_DASH` |
| Remote | `origin/main` → `brandpreneuragency/ATLAS_DASH` |
| VPS clone | `/home/admin/atlas_dash/app` |
| Compose project | `atlas_dash` |
| Compose file | `deploy/docker-compose.yml` |
| Env file (VPS only) | `deploy/.env` (gitignored; never cat full file) |
| Web + edge | container `atlas_dash_caddy` (Dockerfile.web) |
| API + Hermes proxy | container `atlas_dash_api` (Dockerfile.api) |
| Network mode | both `host`, bind API to `127.0.0.1:4010` |
| Public host | `atlasdash.brandpreneur.net` |

**What rebuilds what**

| Path changed | Rebuild service |
|--------------|-----------------|
| `src/`, `index.html`, `public/`, `vite.config.*`, `package.json`, `package-lock.json`, `tsconfig*`, `src/i18n/`, feature CSS | `caddy` |
| `server/` | `api` |
| `deploy/Dockerfile.web`, `deploy/Caddyfile` | `caddy` |
| `deploy/Dockerfile.api` | `api` |
| `deploy/docker-compose.yml` | both (full) |
| Docs only (`docs/`, `*.md` at root, plans) | **no rebuild** — push is enough |
| `src-tauri/` only | **no VPS rebuild** (desktop; still may commit/push) |

If unsure, rebuild **both**.

---

## Procedure

Execute steps in order. Do not skip inventory or smoke checks.

### Step 0 — Confirm workspace

```powershell
cd C:\02_APPS\ATLAS_DASH
git rev-parse --show-toplevel
git branch --show-current
git status --short
git remote -v
```

- Must resolve to ATLAS_DASH (not TABS).
- Must be on `main` (or user-named branch that tracks the VPS deploy branch).
  Default deploy target is **`origin/main`**. If not on `main`, ask before
  pushing/deploying.
- Abort if SSH will be needed and `BatchMode` cannot authenticate (report).

### Step 1 — Inventory local changes

```powershell
git status --short
git log origin/main..HEAD --oneline
git diff --stat origin/main
git diff --stat
git diff --cached --stat
```

Classify:

1. **Uncommitted** working tree / index changes  
2. **Committed but unpushed** (`origin/main..HEAD`)  
3. **Already on origin** (nothing to ship)  

Map paths → rebuild targets (`caddy` / `api` / none / both).

If **nothing** to ship (clean tree and no unpushed commits vs `origin/main`):

- Optionally still run VPS rebuild if user said “redeploy anyway”.
- Otherwise report “already in sync” and stop after confirming VPS commit
  matches `origin/main`.

### Step 2 — Quality gate (before commit/push)

| Changes | Gate |
|---------|------|
| `server/` | `cd server; npm test` then from root if frontend also changed continue below |
| Frontend / shared TS | `npm run check` (typecheck + lint + test + build) |
| Docs only | `git diff --check` (or skip heavy gate) |
| `src-tauri/` | `cargo check` in `src-tauri/` if tooling available; note desktop is not VPS |

- Fix **gate failures you introduced** before deploy.  
- If failures look like pre-existing WIP outside deploy scope, do not mass-fix
  unrelated WIP; either exclude those files from the commit or stop and ask.

### Step 3 — Commit (if uncommitted changes)

1. Review `git status` and diffs. **Do not** stage:
   - `.env`, credentials, keys, local secrets  
   - Accidental `node_modules/`, `dist/`, `src-tauri/target/`  
2. Stage deployable work. Prefer explicit paths over blind `git add -A` when
   the tree is mixed.
3. Commit with a concise message summarizing the *batch* of changes.
4. Use a HEREDOC/here-string for the message; no interactive `git commit`
   editors.

If the user already committed everything, skip to push.

**Do not commit** unless there is real content. Empty commits are not allowed.

### Step 4 — Push

```powershell
git push origin HEAD
```

Default: push current branch. VPS tracks **`main`**. If pushing a feature
branch, stop and ask whether to merge to `main` first.

Confirm:

```powershell
git log origin/main -1 --oneline
git status --short
```

### Step 5 — VPS pull

```powershell
ssh -o BatchMode=yes admin@142.132.230.137 "cd /home/admin/atlas_dash/app && git fetch origin main && git reset --hard origin/main && git log -1 --oneline && git status --short"
```

- Expected: HEAD equals the commit just pushed.  
- Unexpected local VPS edits: `reset --hard` discards them (deploy clone only).

### Step 6 — Selective rebuild

From inventory, set services to `caddy`, `api`, or both.

**Both (default when mixed or unsure):**

```powershell
ssh -o BatchMode=yes admin@142.132.230.137 "cd /home/admin/atlas_dash/app && docker compose -p atlas_dash -f deploy/docker-compose.yml --env-file deploy/.env up -d --build"
```

**Web only:**

```powershell
ssh -o BatchMode=yes admin@142.132.230.137 "cd /home/admin/atlas_dash/app && docker compose -p atlas_dash -f deploy/docker-compose.yml --env-file deploy/.env up -d --build caddy"
```

**API only:**

```powershell
ssh -o BatchMode=yes admin@142.132.230.137 "cd /home/admin/atlas_dash/app && docker compose -p atlas_dash -f deploy/docker-compose.yml --env-file deploy/.env up -d --build api"
```

- Web build runs `tsc -b && vite build` inside Docker. **Do not** mark deploy
  success if build failed.  
- Env-only changes on VPS (`deploy/.env`): do not commit `.env`. After editing
  on server (no secret echo), force-recreate `api` only when needed.

### Step 7 — Smoke checks

```powershell
ssh -o BatchMode=yes admin@142.132.230.137 "docker ps --filter name=atlas_dash_ --format '{{.Names}} {{.Status}}'; curl -sS -o /dev/null -w 'atlasdash_unauth:%{http_code}\n' https://atlasdash.brandpreneur.net/; curl -sS -o /dev/null -w 'atlas:%{http_code}\n' https://atlas.brandpreneur.net/; curl -sS -o /dev/null -w 'wagner:%{http_code}\n' https://wagneratelier.co/; curl -sS http://127.0.0.1:4010/healthz; echo; curl -sS -o /dev/null -w 'hermes_sessions:%{http_code}\n' http://127.0.0.1:4010/hermes/api/sessions; curl -sS -o /dev/null -w 'fs_roots:%{http_code}\n' http://127.0.0.1:4010/fs/roots; ss -lntp | grep -E ':(4010|9119|8642)\s' || true"
```

**Pass expectations**

| Check | Expected |
|-------|----------|
| `atlas_dash_caddy` / `atlas_dash_api` | Up (api healthy) |
| `atlasdash_unauth` | `401` (basic-auth) |
| `atlas` / `wagner` | `200` |
| `healthz` | `{"ok":true}` |
| `hermes_sessions` | `200` (cookie bridge) |
| `fs_roots` | `200` |
| ports 4010/9119/8642 | listen on `127.0.0.1` only |

If smoke fails, diagnose (compose logs, last build error). Fix and redeploy;
do not claim success.

### Step 8 — Report to user

Factual, concise:

1. **Shipped commit** — hash + subject  
2. **What changed** — short summary of the batch  
3. **Rebuild** — `caddy` / `api` / both / none  
4. **Smoke** — exact codes  
5. **User action** — hard-refresh browser (`Ctrl+Shift+R`)  
6. **Risks / skipped** — e.g. Tauri-only not on VPS  

---

## Decision tree (quick)

```
Uncommitted changes?
  yes → gate → commit → push
  no  → unpushed commits?
          yes → push
          no  → already on origin; rebuild only if user wants redeploy

Path classes → rebuild caddy | api | both | skip containers

VPS: fetch + reset --hard origin/main → compose up -d --build [services]

Smoke → report
```

## Failure playbook

| Symptom | Action |
|---------|--------|
| `npm run check` fails locally | Fix before push |
| Docker build `tsc` fails on VPS | Fix types, push, rebuild `caddy` |
| `atlas_dash_api` unhealthy | `docker logs atlas_dash_api --tail 80` (no secrets); fix server; rebuild `api` |
| `hermes_sessions` 401 | Cookie bridge env missing (`HERMES_BASIC_AUTH_USER` + `SECRET` or password). Presence-only check; never print values |
| Atlas/Wagner not 200 | Stop and investigate Caddy — do not remove site blocks |
| SSH password prompt | Stop; BatchMode/key broken |
| Wrong workspace (TABS path) | Stop; switch to ATLAS_DASH |

## Out of scope

- Hermes container recreate / image change  
- Changing basic-auth password without user request  
- Desktop Tauri installers (`npm run tauri:build`)  
- Editing production secrets into git  
- Deleting `C:\02_APPS\TABS` or `/home/admin/tabs` without explicit Approve  

## Example user phrases

- “Deploy ATLAS_DASH”  
- “Deploy everything I have locally to the VPS”  
- “/atlas-dash-vps-deploy”  
- “Update atlasdash.brandpreneur.net from main”  
