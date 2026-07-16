# Phase 05 — Hermes session token
**Model:** gpt-5.1-codex-max · reasoning high — HARD HUMAN GATE inside

## Context (read before acting)

Repo: the TABS repository (you are running inside it). Read `docs/MASTER_PLAN.md` and `docs/PROGRESS.md` first. The canonical spec is `docs/superpowers/plans/2026-07-16-tabs-vps-hermes-client.md` — read ONLY the Task section named below and implement it exactly (it contains complete code, commands, and expected outputs). Obey MASTER_PLAN's "Non-negotiable constraints", especially: non-interactive SSH only (`ssh -o BatchMode=yes admin@142.132.230.137 "cmd"`), never print secrets/tokens/.env values, never expose ports 9119/8642/4010 publicly, never edit the read-only Hermes reference sources.

When done: run the QA gate below, fix all failures autonomously, update `docs/PROGRESS.md` (status, date, notes, discovered facts), and commit.

## Task

Execute **Plan Task 6**. HARD GATE: message the user for an explicit "Approve" before recreating the hermes container, and do not proceed on anything less. First save `docker inspect hermes` to `/home/admin/hermes-inspect-backup.json`. Never print the token or any .env contents.

## QA gate
- `curl -u USER:PASS https://tabs.brandpreneur.net/hermes/api/status` returns Hermes JSON
- hermes container healthy
- PROGRESS notes record HOW hermes is started (compose vs docker run) for future maintenance
