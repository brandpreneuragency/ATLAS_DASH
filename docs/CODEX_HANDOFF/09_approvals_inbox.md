# Phase 09 — Approvals inbox
**Model:** gpt-5.1-codex-max · reasoning high

## Context (read before acting)

Repo: the TABS repository (you are running inside it). Read `docs/MASTER_PLAN.md` and `docs/PROGRESS.md` first. The canonical spec is `docs/superpowers/plans/2026-07-16-tabs-vps-hermes-client.md` — read ONLY the Task section named below and implement it exactly (it contains complete code, commands, and expected outputs). Obey MASTER_PLAN's "Non-negotiable constraints", especially: non-interactive SSH only (`ssh -o BatchMode=yes admin@142.132.230.137 "cmd"`), never print secrets/tokens/.env values, never expose ports 9119/8642/4010 publicly, never edit the read-only Hermes reference sources.

When done: run the QA gate below, fix all failures autonomously, update `docs/PROGRESS.md` (status, date, notes, discovered facts), and commit.

## Task

Execute **Plan Task 10**. Step 1 is discovery with exact sources (`hermes_cli/web_server.py` ~L699/L12190; the desktop app's `approval-mode-event` tests) — record the approval request/response protocol in `types.ts` and PROGRESS before coding. Then implement the approvals slice in `src/stores/hermesStore.ts`, `respondApproval`, and `src/components/chatMode/ApprovalsInbox.tsx` with a header bell + pending-count badge. The events subscription must run app-wide (badge visible from any mode).

## QA gate
- Reducer tests (add / resolve / dedupe) green
- `npm run check` green
