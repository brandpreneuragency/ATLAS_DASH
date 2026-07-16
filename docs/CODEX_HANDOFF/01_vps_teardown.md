# Phase 01 — VPS teardown of old TABS stack (DESTRUCTIVE — pre-approved by user 2026-07-16)

## Context (read before acting)

Repo: the TABS repository (you are running inside it). Read `docs/MASTER_PLAN.md` and `docs/PROGRESS.md` first. The canonical spec is `docs/superpowers/plans/2026-07-16-tabs-vps-hermes-client.md` — read ONLY the Task section named below and implement it exactly (it contains complete code, commands, and expected outputs). Obey MASTER_PLAN's "Non-negotiable constraints", especially: non-interactive SSH only (`ssh -o BatchMode=yes admin@142.132.230.137 "cmd"`), never print secrets/tokens/.env values, never expose ports 9119/8642/4010 publicly, never edit the read-only Hermes reference sources.

When done: run the QA gate below, fix all failures autonomously, update `docs/PROGRESS.md` (status, date, notes, discovered facts), and commit.

## Task

Execute **Plan Task 2** exactly. The user has already approved deleting the old TABS stack INCLUDING all data volumes. Preserve `/home/admin/tabs/Caddyfile` (copy to `Caddyfile.old`) and `/var/www/wagneratelier`. Touch NOTHING except tabs* containers/images/volumes/networks. STOP and ask the user if `/var/www/wagneratelier` is missing, or if any non-tabs container would be affected.

## QA gate
- `docker ps -a | grep -i tabs` returns nothing
- `hermes`, `atlas_control`, `searxng` still running
