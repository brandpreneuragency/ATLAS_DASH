# V1 M1 Capability Audit

## Baseline

Audit scope is pinned to clean worktrees recorded in `baseline.txt`:

- DASH: `e2092d1b514ff10eeb1c4f0769258167c5e6e2c8`
- Control: `df600c28814322ea72b0fc1b6cb522f0c9ef4fab`

The absent DASH `docs/ROADMAP.md` is not evidence for this audit. Program authority is the supplied `PROGRAM.md`: one Python backend, SQLite, six product areas, and retirement of the Node server by the end of V1.

## Capability matrix

A blank implementation cell means that repository has no implementation of that specifically named layer or surface. “Final owner” names one architectural owner; a `control-backend` capability can still be presented by the DASH shell.

| Capability | DASH paths | Control paths | Final owner | Disposition | Lands in | Protected behavior |
|---|---|---|---|---|---|---|
| Control screen — Agent chat | — | `frontend/src/pages/Agent.tsx` | dash-frontend | rewrite | M5 | A user can create or continue a Hermes-backed chat and see streamed output. |
| Control screen — Automation list | — | `frontend/src/pages/Automation.tsx` | dash-frontend | rewrite | M5 | Workflows and recent runs remain discoverable and actionable. |
| Control screen — Files | — | `frontend/src/pages/Files.tsx` | dash-frontend | rewrite | M5 | A user can browse, preview, edit, upload, copy, move, and delete within the allowed root. |
| Control screen — Inbox | — | `frontend/src/pages/Inbox.tsx` | dash-frontend | rewrite | M5 | Pending approvals remain visible and resolvable. |
| Control screen — Login | — | `frontend/src/pages/Login.tsx` | dash-frontend | rewrite | M5 | Product login establishes an authenticated session before protected views load. |
| Control screen — Mission Control | — | `frontend/src/pages/MissionControl.tsx` | dash-frontend | rewrite | M5 | Agent health, live activity, recent runs, and the kill switch remain visible from one screen. |
| Control screen — Models | — | `frontend/src/pages/Models.tsx` | dash-frontend | rewrite | M5 | Current Hermes model, choices, preferences, masked provider state, usage, and logs remain administrable without revealing secrets. |
| Control screen — Brain Review | — | `frontend/src/pages/Review.tsx` | dash-frontend | rewrite | M5 | Pending review notes can be inspected and approved or rejected through the guarded workflow. |
| Control screen — Run detail | — | `frontend/src/pages/RunDetail.tsx` | dash-frontend | rewrite | M5 | Run status, steps, errors, usage, and cancellation remain observable. |
| Control screen — Session detail | — | `frontend/src/pages/SessionDetail.tsx` | dash-frontend | rewrite | M5 | Stored Hermes messages for one session remain readable. |
| Control screen — Sessions | — | `frontend/src/pages/Sessions.tsx` | dash-frontend | rewrite | M5 | Hermes sessions remain searchable and openable. |
| Control screen — Settings | — | `frontend/src/pages/Settings.tsx` | dash-frontend | rewrite | M5 | Notification, limit, backup, and system settings remain usable with secrets masked. |
| Control screen — Workflow editor | — | `frontend/src/pages/WorkflowEditor.tsx` | dash-frontend | rewrite | M5 | Graph editing, validation, versioning, enablement, dry run, and execution remain available. |
| Control API router — agents | — | `backend/app/routers/agents.py` | control-backend | keep | M3 | Agent records seed from configured Hermes endpoints and health failures degrade to unreachable cards. |
| Control API router — approvals | `src/components/chatMode/ApprovalsInbox.tsx` | `backend/app/routers/approvals.py` | control-backend | keep | M3 | Only pending approvals resolve; Hermes and engine gates resume with the selected decision. |
| Control API router — events | — | `backend/app/routers/events.py` | control-backend | keep | M3 | Persisted events remain pageable and authenticated SSE emits live events plus heartbeats. |
| Control API router — files | `src/services/remote-folder-connector.ts` | `backend/app/routers/files.py`, `backend/app/files/safe_path.py` | control-backend | keep | M3 | Every path is root-jailed; writes retain mtime conflict detection and file events. |
| Control API router — Hermes | `src/services/hermes/client.ts` | `backend/app/routers/hermes.py`, `backend/app/hermes/client.py`, `backend/app/hermes/admin.py` | control-backend | rewrite | M5 | Runs, sessions, chat, cron, models, masked env state, analytics, and logs use one authenticated backend boundary. |
| Control API router — review | — | `backend/app/routers/review.py`, `backend/app/review/service.py` | control-backend | keep | M3 | Decisions dispatch the ATLAS brain workflow; the service itself never directly moves the trusted note. |
| Control API router — system | — | `backend/app/routers/system.py` | control-backend | keep | M3 | Health, session identity, model preferences, notifications, limits, backup status, and global pause remain available. |
| Control API router — workflows/runs/hooks | — | `backend/app/routers/workflows.py` | control-backend | keep | M3 | CRUD, immutable version snapshots, trigger resync, manual/webhook runs, run detail, and cancellation retain current contracts. |
| DASH server route — `GET /healthz` | `server/index.mjs` | `backend/app/routers/system.py` | control-backend | port | M6 | The replacement Python service exposes a loopback health probe for deployment health checks. |
| DASH server route — `GET /fs/read` | `server/index.mjs`, `server/lib/fs-handlers.mjs` | `backend/app/routers/files.py` | control-backend | port | M6 | Text reads remain confined to configured roots. |
| DASH server route — `GET /fs/read-bin` | `server/index.mjs`, `server/lib/fs-handlers.mjs` | — | control-backend | port | M6 | M6 adds/adapts a root-jailed binary-read contract for preview bytes. |
| DASH server route — `GET /fs/roots` | `server/index.mjs`, `server/lib/fs-handlers.mjs` | — | control-backend | rewrite | M6 | M6 adds/adapts root discovery so the frontend can discover only roots explicitly allowed by backend configuration. |
| DASH server route — `GET /fs/list` | `server/index.mjs`, `server/lib/fs-handlers.mjs` | `backend/app/routers/files.py` | control-backend | port | M6 | Directory listing remains root-jailed. |
| DASH server route — `GET /fs/stat` | `server/index.mjs`, `server/lib/fs-handlers.mjs` | — | control-backend | port | M6 | M6 adds/adapts a root-jailed stat contract so file type, size, and modification metadata remain available to the DASH file UI. |
| DASH server route — `GET /fs/exists` | `server/index.mjs`, `server/lib/fs-handlers.mjs` | — | control-backend | port | M6 | M6 adds/adapts a root-jailed exists contract. |
| DASH server route — `POST /fs/write` | `server/index.mjs`, `server/lib/fs-handlers.mjs`, `server/lib/paths.mjs` | `backend/app/routers/files.py`, `backend/app/files/safe_path.py` | control-backend | rewrite | M6 | Text edits remain safe and gain the canonical backend's mtime conflict check. |
| DASH server route — `POST /fs/mkdir` | `server/index.mjs`, `server/lib/fs-handlers.mjs`, `server/lib/paths.mjs` | `backend/app/routers/files.py`, `backend/app/files/safe_path.py` | control-backend | port | M6 | Folder creation remains root-jailed and reports conflicts. |
| DASH server route — `POST /fs/remove` | `server/index.mjs`, `server/lib/fs-handlers.mjs`, `server/lib/paths.mjs` | `backend/app/routers/files.py`, `backend/app/files/safe_path.py` | control-backend | rewrite | M6 | Explicit recursive deletion semantics and root jailing remain enforced. |
| DASH server route — `POST /fs/rename` | `server/index.mjs`, `server/lib/fs-handlers.mjs`, `server/lib/paths.mjs` | `backend/app/routers/files.py`, `backend/app/files/safe_path.py` | control-backend | rewrite | M6 | Rename/move remains root-jailed and preserves conflict handling. |
| DASH server surface — `/hermes/*` HTTP and WebSocket | `server/index.mjs`, `server/lib/hermes-proxy.mjs`, `server/lib/hermes-session.mjs` | `backend/app/routers/hermes.py`, `backend/app/hermes/client.py`, `backend/app/hermes/admin.py` | control-backend | port | M6 | Same-origin Hermes REST and gateway WebSockets retain gated cookie authentication and single-use WS tickets against loopback `:9119`. |
| DASH component area — AI chat | `src/components/aiChat/` | — | dash-frontend | keep | M5 | Standalone streamed AI conversation remains renderable in the merged shell. |
| DASH component area — Hermes chat mode | `src/components/chatMode/` | `frontend/src/pages/Agent.tsx`, `frontend/src/pages/Sessions.tsx` | dash-frontend | keep | M5 | Session list, chat pane, and approvals inbox become the single Hermes chat presentation. |
| DASH component area — context window | `src/components/contextWindow/` | — | dash-frontend | keep | M5 | Context usage remains visible as ring, summary, and detail panel. |
| DASH component area — CRM | `src/components/crm/` | — | dash-frontend | keep | M5 | Leads, contacts, companies, pipeline, activities, CRM settings, and CRM detail surfaces remain available for M2 mapping. |
| DASH component area — editor | `src/components/editor/` | — | dash-frontend | keep | M5 | Rich document editing and formatting remain intact. |
| DASH component area — file explorer | `src/components/fileExplorer/` | `frontend/src/components/files/Tree.tsx` | dash-frontend | keep | M5 | Allowed roots and folders remain browsable in the shell. |
| DASH component area — file viewer | `src/components/fileViewer/` | `frontend/src/components/files/Preview.tsx` | dash-frontend | keep | M5 | Selected files remain previewable without leaving the workspace. |
| DASH component area — forms | `src/components/forms/` | — | dash-frontend | keep | M5 | Forms list, builder, submissions, templates alias, settings, embed preview, and local submission handling remain available. |
| DASH component area — header | `src/components/header/` | `frontend/src/components/ui/Nav.tsx` | dash-frontend | keep | M5 | Existing module/tab navigation remains the shell entry point; M2 maps it to exactly six areas. |
| DASH component area — layout | `src/components/layout/` | `frontend/src/components/ui/Shell.tsx` | dash-frontend | keep | M5 | The resizable two-wrapper shell remains the sole product shell. |
| DASH component area — modals | `src/components/modals/` | — | dash-frontend | keep | M5 | Agent edit, quick prompt, trash, and model-switch overlays remain available. |
| DASH component area — reusable page template | `src/components/pageTemplate/` | — | dash-frontend | keep | M5 | Shared preview and resizable page-template behavior remains reusable. |
| DASH component area — settings | `src/components/settings/` | `frontend/src/pages/Models.tsx`, `frontend/src/pages/Settings.tsx` | dash-frontend | rewrite | M5 | Tools/models, actions, appearance, and agents use one settings presentation with masked secret state. |
| DASH component area — assistant sidebar | `src/components/sidebar/` | — | dash-frontend | keep | M5 | Contextual chat, actions, characters, models, and CRM assistant content remain available. |
| DASH component area — task manager | `src/components/taskManager/` | — | dash-frontend | keep | M5 | Task list, detail, comments, metadata, subtasks, calendar, and project Kanban remain available. |
| DASH component area — terminal presentation | `src/components/terminal/` | — | dash-frontend | rewrite | M6 | Tabs, resize behavior, keyboard toggle, and terminal interaction survive while transport changes to Python PTY. |
| DASH component area — editor toolbar | `src/components/toolbar/` | — | dash-frontend | keep | M5 | Formatting, find/replace, links, and image insertion remain available. |
| DASH component area — shared UI | `src/components/ui/` | `frontend/src/components/ui/` | dash-frontend | keep | M5 | Composer, confirmations, attachment preview, toasts, and model switching retain consistent shell behavior. |
| DASH browser AI provider stack | `src/services/ai/`, `src/services/secureStorage.ts`, `src/stores/aiStore.ts` | `backend/app/hermes/admin.py`, `frontend/src/pages/Models.tsx` | dash-frontend | keep | M5 | V1 keeps direct browser provider calls and existing local provider configuration; server-side provider calls are F8 (V2), not V1. |
| Terminal transport (Tauri-only baseline; no server `/terminal`) | `src/components/terminal/`, `src-tauri/src/commands/terminal.rs`, `server/index.mjs` | — | new-port | rewrite | M6 | M6 supplies a Python PTY transport because `server/index.mjs` implements only health, filesystem, and Hermes routes and contains no `/terminal` route. |
| Global kill switch | — | `frontend/src/components/ui/KillSwitch.tsx`, `backend/app/routers/system.py` | control-backend | keep | M3 | Engaging pause blocks engine work and pauses enabled Hermes cron jobs; release resumes only jobs paused by the switch. |
| Notifications | — | `backend/app/notify/telegram.py`, `backend/app/notify/email.py`, `backend/app/routers/system.py` | control-backend | keep | M3 | Telegram/email sends report failures as events and never return stored secret values to the UI. |
| Brain Review service | — | `backend/app/review/service.py`, `backend/app/routers/review.py` | control-backend | keep | M3 | Review remains a queued, explicit decision that delegates the approved ATLAS workflow and surfaces further approvals. |
| Workflow execution and scheduler | — | `backend/app/engine/engine.py`, `backend/app/engine/nodes.py`, `backend/app/engine/triggers.py`, `backend/app/engine/guards.py`, `backend/app/routers/workflows.py` | control-backend | keep | M3 | SQLite-backed workflow runs, cron/file/webhook triggers, provenance guard, circuit breaker, budget guard, approvals, and cancellation remain canonical. |
| Control live SQLite state | — | `backend/app/db.py`, `backend/app/migrations/001_core.sql`, `backend/app/migrations/002_chat_threads.sql`, `backend/app/migrations/003_workflows.sql` | control-backend | keep | M4 | Existing live data remains readable throughout migration and the original database is archived read-only at M7. |
| Product edge routing and public hosts | `deploy/Caddyfile`, `deploy/docker-compose.yml` | `deploy/Caddyfile.snippet`, `deploy/docker-compose.yml` | control-backend | rewrite | M7 | `atlasdash.brandpreneur.net`, `atlas.brandpreneur.net`, and `wagneratelier.co` continue through `atlas_dash_caddy` until their approved cutovers. |

## Decisions

### D-CHAT
Decision: Use Control's Bearer-authenticated runs/session API client as the canonical backend chat owner, and keep DASH `chatMode` as the single presentation rewritten to that backend; do not retain two chat data paths.
Rationale: `backend/app/hermes/client.py` already covers runs, approvals, stored sessions, messages, and finite SSE chat against `:8642`, while `src/components/chatMode/` is the richer target shell. The M6 bridge separately preserves gateway WebSocket behavior where required; chat persistence and authorization remain behind the Python backend.
Rejected alternative: Retaining DASH's cookie-session `/hermes/*` chat as an independent product chat beside Control's runs API would duplicate threads, authentication, error handling, and approval semantics.
Affected paths: DASH — `src/components/chatMode/`, `src/services/hermes/client.ts`, `server/lib/hermes-proxy.mjs`, `server/lib/hermes-session.mjs`; Control — `frontend/src/pages/Agent.tsx`, `frontend/src/pages/Sessions.tsx`, `frontend/src/pages/SessionDetail.tsx`, `backend/app/hermes/client.py`, `backend/app/routers/hermes.py`.
Consuming milestone: M5 and M6.

### D-FILES
Decision: Make Control's Python files router and `safe_path` implementation the sole files backend; adapt DASH's file explorer/editor through `remote-folder-connector.ts` to that contract and retire the Node `/fs/*` handlers in M6.
Rationale: Control already centralizes path jailing, mtime conflict detection, batch prevalidation, upload/copy/move/delete, and file events. DASH supplies the stronger shell UI but its Node API has a second root/sensitive-path policy and fewer mutation guarantees.
Rejected alternative: Keeping both `/fs/*` and `/api/files/*` would preserve divergent root identifiers, delete semantics, conflict behavior, and security policy after the one-Python-backend cutover.
Affected paths: DASH — `src/components/fileExplorer/`, `src/components/fileViewer/`, `src/services/remote-folder-connector.ts`, `server/lib/fs-handlers.mjs`, `server/lib/paths.mjs`, `server/index.mjs`; Control — `frontend/src/pages/Files.tsx`, `frontend/src/components/files/`, `backend/app/routers/files.py`, `backend/app/files/safe_path.py`.
Consuming milestone: M5 and M6.

### D-APPROVALS
Decision: Keep Control's approvals router, SQLite records, and engine/Hermes resume guards as the only approvals implementation; use DASH's `ApprovalsInbox` only as the merged frontend presentation. M5 must add an atomic conditional approval claim/idempotency boundary before exactly-once resolution is made a regression requirement.
Rationale: DASH has a visible inbox component but no DASH server approvals route or durable approval engine. Control currently rejects an already non-pending row, records resolution metadata, resumes native engine gates, and maps Hermes decisions to the runs API; its read-then-resume/update flow is not an atomic claim. M5 must make one transactionally conditional status transition, and only its winner may call Hermes or resume the engine.
Rejected alternative: Adding a second DASH approvals service would create competing status stores and could compound the current concurrent-resolution risk or resume a run outside the canonical engine.
Affected paths: DASH — `src/components/chatMode/ApprovalsInbox.tsx`, `server/index.mjs`; Control — `frontend/src/pages/Inbox.tsx`, `backend/app/routers/approvals.py`, `backend/app/engine/engine.py`, `backend/app/engine/nodes.py`, `backend/app/engine/guards.py`.
Consuming milestone: M5.

### D-MODELS
Decision: Build one models-admin design in the DASH settings shell, with the Control Python backend as V1 owner of Hermes current-model selection, model options/preferences, masked environment state, analytics, and logs; retain DASH's local browser-provider catalog, keys, defaults, and direct provider execution as a clearly labeled V1 client-side domain.
Rationale: The unified screen must distinguish “Hermes runtime model” from “browser AI provider/defaults” while presenting both together. `backend/app/hermes/admin.py` remains the privileged Hermes boundary; `src/stores/aiStore.ts` and `src/services/secureStorage.ts` remain the V1 owner of browser-provider configuration. Moving browser provider calls server-side is F8 (V2), so this decision neither schedules nor designs that move in V1.
Rejected alternative: Treating the two model systems as duplicates and deleting either one would remove a real domain; pulling browser provider execution into Python during V1 would improperly advance F8 and expand M5/M6 risk.
Affected paths: DASH — `src/components/settings/`, `src/services/ai/`, `src/services/secureStorage.ts`, `src/stores/aiStore.ts`; Control — `frontend/src/pages/Models.tsx`, `backend/app/hermes/admin.py`, `backend/app/routers/hermes.py`, `backend/app/routers/system.py`.
Consuming milestone: M5; F8 remains V2.

### D-LIVE
Decision: Use Control's persisted event log plus authenticated SSE as the single product-wide live-update transport; keep finite Hermes chat/run streams as backend adapters that append or translate into the canonical event vocabulary, rather than introducing another product event bus.
Rationale: `backend/app/events.py` and `backend/app/routers/events.py` provide replayable SQLite events, pagination, authenticated streaming, and heartbeats. DASH has direct Hermes WebSockets and fetch-streamed AI but no server SSE endpoint; those streams are capability-specific and should feed the Python boundary without becoming a second global state channel.
Rejected alternative: Keeping independent Control SSE and DASH WebSocket-driven product state would make screens disagree after reconnect and would provide no single replay source for runs, approvals, files, review, notifications, and kill-switch events.
Affected paths: DASH — `src/services/hermes/client.ts`, `src/hooks/useStreamingChat.ts`, `src/services/ai/`, `server/index.mjs`; Control — `backend/app/events.py`, `backend/app/routers/events.py`, `frontend/src/lib/sse.ts`, `backend/app/hermes/client.py`.
Consuming milestone: M5 and M6.

### D-M6-BRIDGE
Decision: port the bridge into the Python backend.
Rationale: M6 ports the `:9119` HTTP/WebSocket bridge, HMAC cookie mint/refresh behavior, and single-use WS-ticket flow from Node into the Python backend, then removes `server/index.mjs`. (a) This does not supply a terminal transport: the current terminal is Tauri-only in `src/components/terminal/` and `src-tauri/src/commands/terminal.rs`, and no server `/terminal` bridge exists, so M6 must replace it with the separately implemented Python PTY while retaining the DASH terminal presentation. (b) Hermes Desktop on the owner's PC is an unseen remote dependent assumed to connect through loopback `:8642`/`:9119`; both loopback endpoints and their authentication behavior must remain unchanged through V1, and the M3 prerequisite spike must verify reachability before M6 planning is committed. (c) The M7 `atlas_hermes_relay` removal remains a separate Risk-Carded step only after the merged Python backend has used the direct Hermes paths for a soak period; porting the bridge does not authorize early relay removal.
Rejected alternative: Dropping the `:9119` proxy and using the runs API only would remove the proven same-origin Hermes gateway/WebSocket and dashboard-admin seam before parity is demonstrated, while still failing to solve terminal PTY and increasing risk to the unseen Hermes Desktop dependency.
Affected paths: DASH — `server/lib/hermes-session.mjs`, `server/lib/hermes-proxy.mjs`, `server/index.mjs`, `src/services/hermes/client.ts`, `src/components/terminal/`, `src-tauri/src/commands/terminal.rs`; Control — `backend/app/hermes/client.py`, `backend/app/hermes/admin.py`, `backend/app/routers/hermes.py`, `deploy/hermes-relay.Caddyfile`, `deploy/docker-compose.yml`.
Consuming milestone: M6, with M3 prerequisite-spike evidence and M7 relay-removal sequencing.

## Protected behaviors

- Hermes Desktop connectivity · The owner's PC can continue reaching Hermes through the existing loopback-dependent `:8642` runs API and `:9119` dashboard/gateway behavior · through M7 and all of V1.
- Public edge hosts · `atlasdash.brandpreneur.net`, `atlas.brandpreneur.net`, and `wagneratelier.co` remain served through `atlas_dash_caddy`, including the `www.wagneratelier.co` redirect · through the individually approved M5–M7 cutovers.
- Control live SQLite data · Existing agents, events, settings, approvals, chat threads, workflows, versions, runs, and run steps remain readable; the source database is archived read-only rather than discarded · through M7.
- Loopback-only bindings · Application/runtime ports `4010`, `8642`, `8700`, `8888`, and `9119` remain bound for loopback-only access and are not newly exposed publicly · through M7.
- Hermes/relay topology · `hermes` and `atlas_hermes_relay` remain available while the merged backend proves direct Hermes access · through the separate CP-M7 relay-removal Risk Card.
- Product login · Protected product APIs reject unauthenticated access and M5 argon2 product login replaces edge basic-auth only at its approved cutover · through M7.
- File root jailing · All file reads and mutations stay within configured ATLAS roots; traversal and absolute-path escape are rejected · through M7.
- File conflict detection · Control's expected-mtime stale-write rejection is preserved when DASH file editing cuts over; M6 adds it to the DASH editing contract · through M7.
- Approvals · Current requests reject rows that are no longer pending; M5 must add an atomic conditional claim/idempotency boundary so only its winner calls Hermes or resumes the engine, then preserve exactly-once resolution with durable status and correct run resumption · through M7.
- Kill switch · Engage blocks new engine submissions and pauses enabled Hermes cron jobs; release resumes only the jobs it paused · through M7.
- Workflow execution · Manual, cron, file, and webhook triggers retain graph validation, version history, limits, provenance protection, budget accounting, live status, and cancellation · through M7.
- Live updates · Persisted events remain pageable and the authenticated SSE stream reconnects with heartbeats while capability-specific Hermes streams terminate or fail visibly · through M7.
- Brain Review · Raw pending notes require an explicit decision and trusted-brain changes remain delegated to the ATLAS brain workflow, not performed directly by the review service · through M7.
- Notifications · Telegram and email configuration remains masked in responses; missing or failed delivery is observable without leaking credentials · through M7.
- Terminal · The visible terminal remains tabbed, resizable, keyboard-toggleable, interactive, and backed by a real PTY after the Tauri transport is retired · through M7.
- Six-area shell · Every retained screen lands in exactly one of the six M2 areas; no additional top-level navigation area is introduced · through M7.

## Notes for M2

Full Control screen inventory (13 routed pages):

- Mission Control — `frontend/src/pages/MissionControl.tsx`; Agent chat — `frontend/src/pages/Agent.tsx`; Sessions — `frontend/src/pages/Sessions.tsx`; Session detail — `frontend/src/pages/SessionDetail.tsx`.
- Automation list — `frontend/src/pages/Automation.tsx`; Workflow editor — `frontend/src/pages/WorkflowEditor.tsx`; Run detail — `frontend/src/pages/RunDetail.tsx`.
- Files — `frontend/src/pages/Files.tsx`; Inbox/approvals — `frontend/src/pages/Inbox.tsx`; Brain Review — `frontend/src/pages/Review.tsx`.
- Models — `frontend/src/pages/Models.tsx`; Settings — `frontend/src/pages/Settings.tsx`; Login — `frontend/src/pages/Login.tsx`.

Full DASH screen/workspace inventory at this baseline:

- Product shell and modes — `src/App.tsx`, `src/components/layout/AppLayout.tsx`: Documents, Tasks, Hermes Chat, CRM with embedded Forms, and Settings; the terminal is a bottom panel rather than a top-level area.
- Documents — file explorer `src/components/fileExplorer/`, rich editor `src/components/editor/`, file viewer `src/components/fileViewer/`, formatting/search/link/image controls `src/components/toolbar/`, and context usage `src/components/contextWindow/`.
- Tasks — list/detail/comments/metadata/subtasks, Calendar, and Projects Kanban in `src/components/taskManager/`; the three header choices are declared in `src/components/header/moduleNav.ts`.
- Hermes Chat — session list, chat session pane, chat workspace, and approvals inbox in `src/components/chatMode/`; assistant chat/actions/characters/models surfaces are in `src/components/sidebar/`.
- CRM implemented page components — Dashboard, Leads, Contacts, Companies, Pipeline, Activities, and Settings in `src/components/crm/pages/`, plus Forms hosted as the eighth CRM page by `src/components/layout/CRMWorkspace.tsx`. At this baseline `src/stores/uiStore.ts` remaps legacy Contacts, Companies, and Activities selections to Leads; M2 must map the implemented screens without assuming all are currently reachable.
- Forms implemented page components — Dashboard, List, Builder, Submissions, and Settings in `src/components/forms/pages/`; Templates is a state value that aliases the List page in `src/components/layout/FormsWorkspace.tsx`. Builder sub-surfaces cover Build, Logic, Style, Embed, Settings, and Submissions in `src/components/forms/builder/`.
- Settings — Tools (including model providers and search tools), Actions, Appearance, and Agents, declared in `src/components/header/moduleNav.ts` and implemented in `src/components/settings/`; model switching also appears in `src/components/ui/ModelSwitcher.tsx` and `src/components/modals/modelProvider/`.
- Overlays and auxiliary screens — Agent Editor, Quick Prompts, Trash, and model-provider overlays in `src/components/modals/`; standalone AI chat in `src/components/aiChat/`; reusable page preview in `src/components/pageTemplate/`; terminal tabs/panel/instances in `src/components/terminal/`.

CRM naturally sits with the DASH CRM workspace because it already owns CRM entities, pipeline, CRM assistant context, and hosts Forms. M2, not M1, must decide CRM's single home among the six areas and map every Control and DASH screen above without creating a seventh area.
