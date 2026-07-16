# Phase 00 — Commit & push working tree
**Model:** gpt-5.1-codex-mini · reasoning low

## Context (read before acting)

Repo: the TABS repository (you are running inside it). Read `docs/MASTER_PLAN.md` and `docs/PROGRESS.md` first. The canonical spec is `docs/superpowers/plans/2026-07-16-tabs-vps-hermes-client.md` — read ONLY the Task section named below and implement it exactly (it contains complete code, commands, and expected outputs). Obey MASTER_PLAN's "Non-negotiable constraints", especially: non-interactive SSH only (`ssh -o BatchMode=yes admin@142.132.230.137 "cmd"`), never print secrets/tokens/.env values, never expose ports 9119/8642/4010 publicly, never edit the read-only Hermes reference sources.

When done: run the QA gate below, fix all failures autonomously, update `docs/PROGRESS.md` (status, date, notes, discovered facts), and commit.

## Task

Execute **Plan Task 1**. Run `npm run check`; if it fails, fix autonomously (report non-trivial fixes in PROGRESS notes). Stage everything, commit `feat: sync working tree before VPS web deployment`, push origin main.

## QA gate
- `npm run check` green
- `git status` clean; push confirmed on origin/main
