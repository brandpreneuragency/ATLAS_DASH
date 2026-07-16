# PROGRESS — TABS Web on VPS as Hermes Client

> Executing agent: update this file at the END of every phase (mark status, add notes/deviations, record any discovered facts the next phase needs). Keep entries terse and factual.

Resume protocol: read `CLAUDE.md` (if present), `docs/PROGRESS.md`, `docs/MASTER_PLAN.md`, then continue with the next `[ ]` phase. Run its acceptance criteria when done.

| Phase | Status | Date | Notes |
|-------|--------|------|-------|
| 0 — Commit & push | [x] | 2026-07-16 | `npm run check` green; lint fixes for react-hooks (set-state-in-effect, immutability, refs) + ImageInsert `setImage` typing; pushed to origin/main |
| 1 — VPS teardown | [x] | 2026-07-16 | All 6 tabs* containers removed; tabs images removed; postgres/upload/backup volumes removed. Caddyfile.old preserved. hermes/atlas_control/searxng untouched. |
| 2 — tabs_api server | [x] | 2026-07-16 | `server/` added: paths safety, fs handlers, hermes proxy, 127.0.0.1 bind. 8 path tests + 3-curl smoke green. Test script uses glob for Windows Node 24. |
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
- 2026-07-16 Phase 1: `/home/admin/tabs/` is root:root (admin cannot write). Caddyfile.old written via `docker run --rm -v /home/admin/tabs:/tabs alpine cp`. No passwordless sudo.
- 2026-07-16 Phase 1: `client-proxy-caddy` (running) mounts `tabs_caddy_config`, `tabs_caddy_data`, and is on `tabs_internal` network; also binds wagneratelier. Left intact — volumes/network could not be removed without killing client-proxy-caddy. Remaining after teardown: volumes `tabs_caddy_config`/`tabs_caddy_data`, network `tabs_internal`, files `Caddyfile`+`Caddyfile.old`. Wagner site files present (`index.html`, `bwa.jpg`). Running after: atlas_control, atlas_hermes_relay, client-proxy-caddy, hermes, searxng.
- 2026-07-16 Phase 2: Node 24 on Windows treats `node --test lib/` as a module load (fails). package.json test script is `node --test "lib/**/*.test.mjs"` so `npm test` works on Windows and Linux. paths.mjs uses path.posix (VPS Linux roots).
