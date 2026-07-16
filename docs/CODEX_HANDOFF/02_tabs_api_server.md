# Phase 02 — tabs_api server (fs API + Hermes proxy)
**Model:** gpt-5.1-codex-max · reasoning high

## Context (read before acting)

Repo: the TABS repository (you are running inside it). Read `docs/MASTER_PLAN.md` and `docs/PROGRESS.md` first. The canonical spec is `docs/superpowers/plans/2026-07-16-tabs-vps-hermes-client.md` — read ONLY the Task section named below and implement it exactly (it contains complete code, commands, and expected outputs). Obey MASTER_PLAN's "Non-negotiable constraints", especially: non-interactive SSH only (`ssh -o BatchMode=yes admin@142.132.230.137 "cmd"`), never print secrets/tokens/.env values, never expose ports 9119/8642/4010 publicly, never edit the read-only Hermes reference sources.

When done: run the QA gate below, fix all failures autonomously, update `docs/PROGRESS.md` (status, date, notes, discovered facts), and commit.

## Task

Execute **Plan Task 3**: create `server/package.json`, `server/lib/paths.mjs`, `server/lib/hermes-proxy.mjs`, `server/lib/fs-handlers.mjs`, `server/index.mjs`, `server/lib/paths.test.mjs`.

Dependencies (install before coding): `cd server && npm install http-proxy@^1.18.1`

TDD order as written in the plan (tests first). The path-escape and sensitive-file rules are security boundaries — implement them exactly as specified, no "improvements".

## QA gate
- `cd server && npm test` green
- The 3-curl smoke test from Task 3 Step 8 passes
