# Phase 10 — Memory browser
**Model:** gpt-5.1-codex-mini · reasoning low

## Context (read before acting)

Repo: the TABS repository (you are running inside it). Read `docs/MASTER_PLAN.md` and `docs/PROGRESS.md` first. The canonical spec is `docs/superpowers/plans/2026-07-16-tabs-vps-hermes-client.md` — read ONLY the Task section named below and implement it exactly (it contains complete code, commands, and expected outputs). Obey MASTER_PLAN's "Non-negotiable constraints", especially: non-interactive SSH only (`ssh -o BatchMode=yes admin@142.132.230.137 "cmd"`), never print secrets/tokens/.env values, never expose ports 9119/8642/4010 publicly, never edit the read-only Hermes reference sources.

When done: run the QA gate below, fix all failures autonomously, update `docs/PROGRESS.md` (status, date, notes, discovered facts), and commit.

## Task

Execute **Plan Task 11**: pin the `memories` root in the Doc Mode root picker (Brain icon from lucide, sorted after atlas, label from the server). No new pages. If `/home/admin/.hermes/memories` doesn't exist on the VPS, follow the task's fallback (list `/home/admin/.hermes`, fix `TABS_FS_ROOTS` in the VPS .env) — never guess-create directories inside `.hermes`.

## QA gate
- `npm run check` green
- VPS mtime check from Task 11 Step 2 passes
