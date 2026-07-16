# Phase 07 — RemoteFolderConnector (VPS folders in Doc Mode)
**Model:** gpt-5.1-codex-max · reasoning high

## Context (read before acting)

Repo: the TABS repository (you are running inside it). Read `docs/MASTER_PLAN.md` and `docs/PROGRESS.md` first. The canonical spec is `docs/superpowers/plans/2026-07-16-tabs-vps-hermes-client.md` — read ONLY the Task section named below and implement it exactly (it contains complete code, commands, and expected outputs). Obey MASTER_PLAN's "Non-negotiable constraints", especially: non-interactive SSH only (`ssh -o BatchMode=yes admin@142.132.230.137 "cmd"`), never print secrets/tokens/.env values, never expose ports 9119/8642/4010 publicly, never edit the read-only Hermes reference sources.

When done: run the QA gate below, fix all failures autonomously, update `docs/PROGRESS.md` (status, date, notes, discovered facts), and commit.

## Task

Execute **Plan Task 8**: create `src/services/remote-folder-connector.ts` (+ `remote-folder-connector.test.ts`), modify the browser branch of `src/services/runtime.ts`, and add the VPS root-picker UI to the file explorer (find it via `grep -rn "connectFolder|unsupported" src/components/fileExplorer/`). Use the `root:rel` path scheme exactly; watch for existing code that assumes OS-absolute paths (log any findings in PROGRESS). Do not break the Tauri connector path.

## QA gate
- Connector vitest green
- `npm run check` green (includes existing Doc Mode tests)
