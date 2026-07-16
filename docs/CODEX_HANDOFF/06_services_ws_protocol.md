# Phase 06 — Frontend services + WS protocol extraction
**Model:** gpt-5.1-codex-max · reasoning **xhigh** — hardest phase; errors here poison Phases 08/09

## Context (read before acting)

Repo: the TABS repository (you are running inside it). Read `docs/MASTER_PLAN.md` and `docs/PROGRESS.md` first. The canonical spec is `docs/superpowers/plans/2026-07-16-tabs-vps-hermes-client.md` — read ONLY the Task section named below and implement it exactly (it contains complete code, commands, and expected outputs). Obey MASTER_PLAN's "Non-negotiable constraints", especially: non-interactive SSH only (`ssh -o BatchMode=yes admin@142.132.230.137 "cmd"`), never print secrets/tokens/.env values, never expose ports 9119/8642/4010 publicly, never edit the read-only Hermes reference sources.

When done: run the QA gate below, fix all failures autonomously, update `docs/PROGRESS.md` (status, date, notes, discovered facts), and commit.

## Task

Execute **Plan Task 7**. CRITICAL Step 1: extract the real WS message/event schema from the read-only reference sources listed in the task (`hermes.ts`, `use-message-stream/gateway-event.ts` under `C:\Users\burak\AppData\Local\hermes\hermes-agent\apps\desktop\src\`) into `src/services/hermes/types.ts`. Copy field/type names EXACTLY — invent nothing. Record the extracted schema (message-delta, completion, error, approval events + outbound prompt frame + the role of `/api/pub`) in PROGRESS's discovered-facts log; Phases 08-09 depend on it.

Then implement `src/services/tabsApi.ts` and `src/services/hermes/client.ts` per the plan, adjusting `connectChat`'s `send()` frame to the recorded schema.

## QA gate
- `npx vitest run src/services/hermes/client.test.ts` green
- `npm run check` green
- PROGRESS discovered-facts contains the WS schema summary
