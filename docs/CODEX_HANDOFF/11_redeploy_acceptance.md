# Phase 11 — Redeploy + final acceptance
**Model:** gpt-5.1-codex · reasoning medium

## Context (read before acting)

Repo: the TABS repository (you are running inside it). Read `docs/MASTER_PLAN.md` and `docs/PROGRESS.md` first. The canonical spec is `docs/superpowers/plans/2026-07-16-tabs-vps-hermes-client.md` — read ONLY the Task section named below and implement it exactly (it contains complete code, commands, and expected outputs). Obey MASTER_PLAN's "Non-negotiable constraints", especially: non-interactive SSH only (`ssh -o BatchMode=yes admin@142.132.230.137 "cmd"`), never print secrets/tokens/.env values, never expose ports 9119/8642/4010 publicly, never edit the read-only Hermes reference sources.

When done: run the QA gate below, fix all failures autonomously, update `docs/PROGRESS.md` (status, date, notes, discovered facts), and commit.

## Task

Execute **Plan Task 12**: push, pull+rebuild on the VPS, then run the full 8-point acceptance checklist (browser checks + the two security probes: unauthenticated `/hermes/*` → 401; `ss` shows 9119/8642/4010 loopback-only). Report each point pass/fail with evidence; log deviations in PROGRESS and mark the project complete.

## QA gate
- All 8 checklist points pass (or deviations explicitly reported to the user)
- PROGRESS fully updated; final commit pushed
