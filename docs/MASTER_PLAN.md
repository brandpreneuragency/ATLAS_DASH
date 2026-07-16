# MASTER PLAN — TABS Web on VPS as Hermes Client

**Canonical plan:** `docs/superpowers/plans/2026-07-16-tabs-vps-hermes-client.md` (read the referenced Task section before starting a phase; it contains complete code, commands, and acceptance criteria).

**Progress tracking:** `docs/PROGRESS.md` — update it at the end of every phase.

## Phase → Plan-Task map

| Phase | Name | Plan task | Type |
|-------|------|-----------|------|
| 0 | Commit & push working tree | Task 1 | git |
| 1 | VPS teardown of old TABS stack (DESTRUCTIVE, pre-approved) | Task 2 | ops/ssh |
| 2 | `tabs_api` server (fs API + Hermes proxy) | Task 3 | code+tests |
| 3 | Deploy assets (Dockerfiles, Caddyfile, compose) | Task 4 | code |
| 4 | VPS install & 3-domain verification | Task 5 | ops/ssh |
| 5 | Hermes session token (needs explicit user "Approve") | Task 6 | ops/ssh, risky |
| 6 | Frontend services + WS protocol extraction | Task 7 | research+code |
| 7 | RemoteFolderConnector (VPS folders in Doc Mode) | Task 8 | code |
| 8 | CHAT mode workspace | Task 9 | code/UI |
| 9 | Approvals inbox | Task 10 | code/UI |
| 10 | Memory browser (pinned memories root) | Task 11 | code/UI |
| 11 | Redeploy + final acceptance checklist | Task 12 | ops |

## Non-negotiable constraints (apply to every phase)

- VPS access: `ssh -o BatchMode=yes admin@142.132.230.137 "cmd"` — non-interactive only. Never print secrets/tokens/.env values into logs or chat.
- Hermes ports 9119/8642 and tabs_api 4010 must never be publicly exposed; `tabs_api` binds `127.0.0.1` only.
- Do not modify the `hermes`, `atlas_control`, or `searxng` containers except exactly as Task 6 specifies (and only after the user types "Approve").
- Caddy must keep serving `atlas.brandpreneur.net` and `wagneratelier.co`.
- Reference-only sources (never edit): `C:\Users\burak\AppData\Local\hermes\hermes-agent\**` (Hermes desktop + server source).
- Quality gate before ending any code phase: `npm run check` (typecheck + lint + test + build) green, plus `cd server && npm test` when `server/` changed. Fix failures autonomously.
- End every phase by updating `docs/PROGRESS.md` and committing.
