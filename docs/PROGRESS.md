# PROGRESS — TABS Web on VPS as Hermes Client

> Executing agent: update this file at the END of every phase (mark status, add notes/deviations, record any discovered facts the next phase needs). Keep entries terse and factual.

Resume protocol: read `CLAUDE.md` (if present), `docs/PROGRESS.md`, `docs/MASTER_PLAN.md`, then continue with the next `[ ]` phase. Run its acceptance criteria when done.

| Phase | Status | Date | Notes |
|-------|--------|------|-------|
| 0 — Commit & push | [x] | 2026-07-16 | `npm run check` green; lint fixes for react-hooks (set-state-in-effect, immutability, refs) + ImageInsert `setImage` typing; pushed to origin/main |
| 1 — VPS teardown | [ ] | | |
| 2 — tabs_api server | [ ] | | |
| 3 — Deploy assets | [ ] | | |
| 4 — VPS install | [ ] | | |
| 5 — Hermes token (user "Approve" required) | [ ] | | |
| 6 — Frontend services + WS protocol | [ ] | | |
| 7 — RemoteFolderConnector | [ ] | | |
| 8 — CHAT mode | [ ] | | |
| 9 — Approvals inbox | [ ] | | |
| 10 — Memory browser | [ ] | | |
| 11 — Redeploy + acceptance | [ ] | | |

## Discovered facts / deviations log

- 2026-07-16 Phase 0: `eslint-plugin-react-hooks` v7 flags setState-in-effect / immutability as errors when disable is on the `useEffect` line (must be on the setState line, or avoid mutating `editor.view.dom` via `useEditor` return — use wrapper `.ProseMirror` query instead). Working tree included substantial pre-existing WIP (settings, editor, tasks, Tauri, docs/plans) beyond the plan's expected file list.
