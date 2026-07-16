# Phase 04 — VPS install & 3-domain verification
**Model:** gpt-5.1-codex · reasoning medium — HUMAN CHECKPOINT inside

## Context (read before acting)

Repo: the TABS repository (you are running inside it). Read `docs/MASTER_PLAN.md` and `docs/PROGRESS.md` first. The canonical spec is `docs/superpowers/plans/2026-07-16-tabs-vps-hermes-client.md` — read ONLY the Task section named below and implement it exactly (it contains complete code, commands, and expected outputs). Obey MASTER_PLAN's "Non-negotiable constraints", especially: non-interactive SSH only (`ssh -o BatchMode=yes admin@142.132.230.137 "cmd"`), never print secrets/tokens/.env values, never expose ports 9119/8642/4010 publicly, never edit the read-only Hermes reference sources.

When done: run the QA gate below, fix all failures autonomously, update `docs/PROGRESS.md` (status, date, notes, discovered facts), and commit.

## Task

Execute **Plan Task 5**. Before Step 2, ASK THE USER in chat for the basic-auth username and password (or offer them the one-liner to run themselves — never invent credentials, never echo the hash into the transcript). `HERMES_DASHBOARD_SESSION_TOKEN` stays empty for now (expected: `/hermes/*` returns 401 until Phase 05).

## QA gate
- The 5 curl checks in Task 5 Step 4 return the annotated status codes (401 unauth, 200 authed, atlas 200, wagneratelier 200, /fs/roots JSON)
