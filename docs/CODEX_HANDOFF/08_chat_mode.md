# Phase 08 — CHAT mode workspace
**Model:** gpt-5.1-codex-max · reasoning high

## Context (read before acting)

Repo: the TABS repository (you are running inside it). Read `docs/MASTER_PLAN.md` and `docs/PROGRESS.md` first. The canonical spec is `docs/superpowers/plans/2026-07-16-tabs-vps-hermes-client.md` — read ONLY the Task section named below and implement it exactly (it contains complete code, commands, and expected outputs). Obey MASTER_PLAN's "Non-negotiable constraints", especially: non-interactive SSH only (`ssh -o BatchMode=yes admin@142.132.230.137 "cmd"`), never print secrets/tokens/.env values, never expose ports 9119/8642/4010 publicly, never edit the read-only Hermes reference sources.

When done: run the QA gate below, fix all failures autonomously, update `docs/PROGRESS.md` (status, date, notes, discovered facts), and commit.

## Task

Execute **Plan Task 9**: add `chatMode` to `src/stores/uiStore.ts` (mirror `taskMode` verbatim — state ~L99, setter ~L441, persistence picks ~L225/246/295); nav button in `src/components/layout/LeftNarrowSidebar.tsx`; branch in `src/App.tsx` ~L175; create `src/components/chatMode/ChatWorkspace.tsx`, `src/components/chatMode/SessionListColumn.tsx`, `src/components/chatMode/ChatSessionPane.tsx` and `src/stores/hermesStore.ts` (+ tests).

Use the WS schema recorded in PROGRESS by Phase 06 — do not invent event shapes. For UI work before live data, use this mock (adjust field names to types.ts once wired):

```json
{
  "sessions": [{ "id": "s1", "title": "Greeting to Start Help", "updated_at": "2026-07-16T09:00:00Z" }],
  "messages": [
    { "role": "user", "content": "hello" },
    { "role": "assistant", "content": "Hi — Hermes here." }
  ]
}
```

Reuse the workspace shell components as `CRMWorkspace.tsx` does; reuse sidebar message components / `Composer` where props allow.

## QA gate
- hermesStore reducer tests green
- `npm run check` green
