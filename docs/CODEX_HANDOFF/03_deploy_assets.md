# Phase 03 — Deploy assets (Dockerfiles, Caddyfile, compose)
**Model:** gpt-5.1-codex · reasoning medium

## Context (read before acting)

Repo: the TABS repository (you are running inside it). Read `docs/MASTER_PLAN.md` and `docs/PROGRESS.md` first. The canonical spec is `docs/superpowers/plans/2026-07-16-tabs-vps-hermes-client.md` — read ONLY the Task section named below and implement it exactly (it contains complete code, commands, and expected outputs). Obey MASTER_PLAN's "Non-negotiable constraints", especially: non-interactive SSH only (`ssh -o BatchMode=yes admin@142.132.230.137 "cmd"`), never print secrets/tokens/.env values, never expose ports 9119/8642/4010 publicly, never edit the read-only Hermes reference sources.

When done: run the QA gate below, fix all failures autonomously, update `docs/PROGRESS.md` (status, date, notes, discovered facts), and commit.

## Task

Execute **Plan Task 4**: create `deploy/Dockerfile.web`, `deploy/Dockerfile.api`, `deploy/Caddyfile`, `deploy/docker-compose.yml`, `deploy/.env.example`; add `deploy/.env` to .gitignore. Copy file contents from the plan verbatim — the Caddyfile must keep `atlas.brandpreneur.net` and `wagneratelier.co`. No npm dependencies to install.

## QA gate
- `docker compose -f deploy/docker-compose.yml config -q` OK
- `docker build -f deploy/Dockerfile.api .` succeeds locally
- Commit + push
