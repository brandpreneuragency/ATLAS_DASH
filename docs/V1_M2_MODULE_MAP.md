# V1 M2 Module Map

## Baseline

- DASH: `b95913edc37b97f5d6d03f9a33cd87d145949a3f`
- Control: `df600c28814322ea72b0fc1b6cb522f0c9ef4fab`
- Both worktrees were clean; `docs/V1_M1_CAPABILITY_AUDIT.md` and `docs/ROADMAP.md` were present and non-empty. Evidence: `$RUN_DIR/baseline.txt`.

## Module map

Paths are repository-relative and prefixed by repository. A directory row owns that component area's shared structure; a more specific page row owns the named pages and is excluded from its parent directory row. This keeps every literal source path in one matrix row while exposing required sub-surfaces.

| Screen / surface | Source paths | Area | Owning milestone | Notes |
|---|---|---|---|---|
| Mission Control overview | Control: `frontend/src/pages/MissionControl.tsx` | Agent | M5 | Becomes Agent Overview: agent health, system health, event activity, and run counts. Its kill-switch control moves to the persistent header and is mapped separately. |
| Agent chat source screen | Control: `frontend/src/pages/Agent.tsx` | Agent | M5 | Rebuilt into DASH `chatMode`; it is not retained as a second chat presentation (D-CHAT). |
| Sessions list | Control: `frontend/src/pages/Sessions.tsx` | Agent | M5 | Becomes the session-list subview of the single Hermes chat presentation. |
| Session detail | Control: `frontend/src/pages/SessionDetail.tsx` | Agent | M5 | Becomes stored-message/session history inside the single Hermes chat presentation. |
| Automation list | Control: `frontend/src/pages/Automation.tsx` | Agent | M5 | Supplies Workflows, recent Runs, and Schedules/Hermes cron subviews; these are split by function inside Agent, not preserved as a Control island. |
| Workflow editor | Control: `frontend/src/pages/WorkflowEditor.tsx` | Agent | M5 | Opens from Agent → Workflows; preserves graph editing, validation, versions, enablement, dry run, and execution. |
| Run detail | Control: `frontend/src/pages/RunDetail.tsx` | Agent | M5 | Opens from Agent → Runs with status, steps, errors, usage, and cancellation. |
| VPS Files screen | Control: `frontend/src/pages/Files.tsx` | Files | M5 | Rebuilt as the Files-area browser/editor on Control's root-jailed backend (D-FILES); distinct from Work's document workspace. |
| Control approvals inbox | Control: `frontend/src/pages/Inbox.tsx` | Today | M5 | Functional placement only; DASH `ApprovalsInbox` is the single final presentation and Control remains backend owner (D-APPROVALS). |
| Brain Review | Control: `frontend/src/pages/Review.tsx` | Agent | M5 | Agent → Brain Review; explicit approve/reject remains delegated to the guarded brain workflow. |
| Models admin source screen | Control: `frontend/src/pages/Models.tsx` | Settings | M5 | Folded into one Settings models-admin design; no standalone Control-style models page (D-MODELS). |
| Control system settings | Control: `frontend/src/pages/Settings.tsx` | Settings | M5 | Folded into Settings for notifications, limits, backup, and system state with secrets masked. |
| Login | Control: `frontend/src/pages/Login.tsx` | Global | M5 | Pre-auth gate outside navigation; rewritten in DASH identity and backed by Control's argon2 session flow. |
| Standalone browser AI chat | DASH: `src/components/aiChat/` | Agent | M5 | Agent → Browser AI. This retained V1 direct-provider surface is explicitly not a second Hermes chat path; F8 owns its later disposition. |
| Hermes chat mode, excluding approvals | DASH: `src/components/chatMode/` | Agent | M5 | Single Hermes presentation for session list and chat pane, rewritten onto Control's canonical runs/session API (D-CHAT); `ApprovalsInbox.tsx` is mapped separately to Today. |
| DASH approvals inbox | DASH: `src/components/chatMode/ApprovalsInbox.tsx` | Today | M5 | The single approvals presentation, surfaced from Today and backed only by Control approvals records/guards (D-APPROVALS). |
| Context-window widgets | DASH: `src/components/contextWindow/` | Global | M5 | Non-navigable context ring, summary, and detail panel available where context-bearing work is shown. |
| CRM shared components, excluding pages | DASH: `src/components/crm/` | Clients | M5 | Client-record lists, detail surfaces, pipeline components, activities, and CRM assistant context support the Clients workspace; page routes are mapped separately. |
| CRM implemented pages | DASH: `src/components/crm/pages/` | Clients | M5 | Dashboard, Leads, Contacts, Companies, Pipeline, Activities, CRM Settings. Contacts, Companies, and Activities remain mapped despite `uiStore` currently remapping them to Leads. |
| Rich document editor | DASH: `src/components/editor/` | Work | M5 | Work → Documents center pane; retains rich editing and document interaction. Its fs adapter cutover is M6, but the screen remains an M5-owned presentation. |
| Document file explorer | DASH: `src/components/fileExplorer/` | Work | M5 | Work → Documents tree for workspace documents; not the Files area's operational VPS browser. Its Node `/fs/*` replacement is M6. |
| Document file viewer | DASH: `src/components/fileViewer/` | Work | M5 | Work document preview in the assistant/detail wrapper; its fs transport replacement is M6. |
| Forms shared components, excluding pages/builder | DASH: `src/components/forms/` | Clients | M5 | Forms follows CRM into Clients only because D-CRM-HOME chooses Clients and Forms is hosted as CRM's eighth page; page and builder directories are mapped separately. |
| Forms implemented pages | DASH: `src/components/forms/pages/` | Clients | M5 | Dashboard, List, Builder, Submissions, Settings; Templates remains a state alias of List. This is the explicit CRM-home exception to the default forms → Work placement. |
| Form builder sub-surfaces | DASH: `src/components/forms/builder/` | Clients | M5 | Build, Logic, Style, Embed, Settings, and Submissions remain builder sub-tabs under Clients → Forms. |
| Header shell | DASH: `src/components/header/` | Global | M5 | Reworked from module tabs into the six-area switcher and persistent status/actions; the kill-switch implementation is mapped separately. |
| Layout shell | DASH: `src/components/layout/` | Global | M5 | Sole resizable product shell hosting six areas, contextual wrapper, overlays, and bottom panel; CRM/Forms hosting is preserved during M5 relocation. |
| Modals and overlays | DASH: `src/components/modals/` | Global | M5 | Non-navigable Agent Editor, Quick Prompts, Trash, and model-provider overlays open over their invoking area. |
| Reusable page template | DASH: `src/components/pageTemplate/` | Global | M5 | Shared preview/resizing behavior; never a nav destination. |
| DASH settings presentation | DASH: `src/components/settings/` | Settings | M5 | One Settings shell for Tools/models, Actions, Appearance, and Agents; incorporates Control models/system administration without duplicating designs. |
| Assistant sidebar | DASH: `src/components/sidebar/` | Global | M5 | Persistent contextual wrapper for chat, actions, characters, models, and CRM assistance; it does not become a seventh destination. |
| Task manager | DASH: `src/components/taskManager/` | Work | M5 | Work → Tasks with List, Calendar, Projects Kanban, detail, comments, metadata, and subtasks. |
| Terminal bottom panel | DASH: `src/components/terminal/` | Global | M6 | Persistent tabbed/resizable/keyboard-toggleable panel; M6 replaces Tauri-only transport with a real Python PTY while preserving presentation behavior. |
| Editor toolbar | DASH: `src/components/toolbar/` | Global | M5 | Non-navigable document controls for formatting, find/replace, links, and images, shown in Work when applicable. |
| Shared UI | DASH: `src/components/ui/` | Global | M5 | Cross-area composer, confirmations, attachment preview, toasts, and model switching; no navigable screen is assigned here. |
| Persistent kill switch | Control: `frontend/src/components/ui/KillSwitch.tsx` | Global | M5 | Rebuilt into the DASH persistent header; backend pause semantics remain Control-owned and imported at M3. |

## Decisions

### D-CRM-HOME

Decision: Clients.

Rationale: Leads, contacts, companies, pipeline, activities, and their notes are records about client relationships, so Clients is the clearest stable noun in the six-area IA. Choosing Clients now gives W2 a migration path that adds `workspace_id` scope and client selection around the existing CRM home instead of moving the same records out of Work after users learn the V1 layout. Forms is already rendered as CRM's eighth page by `src/components/layout/CRMWorkspace.tsx`; keeping that host intact makes Forms part of Clients in V1 and makes form/submission ownership align with the same client records.

Rejected alternative: Work is a credible home because the roadmap's default groups docs, tasks, CRM, and forms as operational work, and it would keep all browser-local productivity data together before V3. It also avoids making Clients look more mature than the pre-W2 data model. It loses because W2 will make clients the grouping boundary for CRM and forms; a Work placement would then require either a disruptive move or duplicate entry points, exactly the two-home outcome M2 must prevent.

Affected paths: DASH — `src/components/crm/`, `src/components/forms/`, `src/components/layout/CRMWorkspace.tsx`, `src/components/layout/FormsWorkspace.tsx`, `src/stores/uiStore.ts`; Control — no CRM or Forms screen exists, so no Control path moves. Control operational screens remain assigned by function rather than origin.

Consuming milestone: M5 implements the Clients placement; W2 in V3 adds client-workspace scope in place.

Consequence for W2: W2 must treat Clients as the only navigation home for these CRM records and Forms. It adds client/workspace selection and filters to the existing Clients hierarchy; it must not create mirror CRM or Forms destinations under Work. The current CRM and Forms records migrate to workspace-scoped storage once, while Forms remains under Clients → Forms because `CRMWorkspace.tsx` hosts it as the eighth CRM page. Work remains the home for documents and tasks, which W2 may filter by client without relocating CRM records there.

## Area sketches

### Area: Today

Left nav: `Today` opens directly to `Approvals`; no second Control inbox route remains. The screen set is Control approvals inbox and DASH approvals inbox. The user first sees the DASH `ApprovalsInbox` presentation populated from Control's canonical pending-approval records, with approve/deny actions and links back to the relevant Agent session/run. V1 Today is intentionally thin; Q1 in V3 adds due tasks, in-flight runs, and CRM follow-ups without changing approvals ownership.

### Area: Work

Left nav: `Work`; sub-tabs `Documents` and `Tasks`. Documents contains the rich document editor, document file explorer, and document file viewer; the Global editor toolbar appears contextually without becoming part of Work navigation. Tasks contains List, Calendar, Projects Kanban, task detail, comments, metadata, and subtasks. The user first sees Documents with its tree and editor; returning state may reopen the last Work sub-tab. Forms is not here only because D-CRM-HOME moves the currently embedded Forms module with CRM to Clients.

### Area: Clients

Left nav: `Clients`; sub-tabs `Overview`, `Relationships`, `Pipeline`, `Activities`, `Forms`, and `CRM Settings`. Relationships exposes Leads, Contacts, and Companies. Forms exposes Dashboard, List (including Templates alias), Builder with Build/Logic/Style/Embed/Settings/Submissions, top-level Submissions, and Forms Settings. The screen set is CRM shared components/pages plus Forms shared components/pages/builder. The user first sees CRM Dashboard/overview; M5 must restore direct reachability for implemented Contacts, Companies, and Activities rather than preserve the current `uiStore` remap. V1 is record- and pipeline-oriented; W2 in V3 adds client-workspace selection and groups docs, tasks, chats, files, and runs around these same records without creating a second CRM home.

### Area: Agent

Left nav: `Agent`; sub-tabs `Overview`, `Chat`, `Browser AI`, `Runs`, `Workflows`, `Schedules`, and `Brain Review`. Overview contains Mission Control health/activity without the kill switch; Chat combines the Control Agent, Sessions, and Session Detail capabilities inside DASH `chatMode`; Browser AI contains standalone `aiChat`; Runs contains Run Detail and recent-run access; Workflows and Schedules split the functional contents of Automation, with Workflow Editor under Workflows; Brain Review contains Review. The user first sees Agent Overview with health, live activity, and recent runs. Approvals are absent because their single presentation is in Today.

### Area: Files

Left nav: `Files`; sub-tabs `Browse` and contextual `Preview/Edit` for the selected item. Its screen set is the rebuilt Control VPS Files screen. The user first sees configured allowed roots and their tree, then can preview or edit within the root jail. Work's document explorer/viewer remains in Work; both presentations share Control's canonical files backend after M6 rather than becoming origin-based islands.

### Area: Settings

Left nav: `Settings`; sub-tabs `Tools & Models`, `Actions`, `Appearance`, `Agents`, and `System`. The screen set is Control Models, Control Settings, and DASH Settings. The user first sees Tools & Models, with clearly separated “Hermes runtime model” and “browser AI provider/defaults” domains in one design; System holds notifications, limits, backup, and masked state. No standalone Models page survives.

## Global surfaces

- Header and kill switch — DASH `src/components/header/`; Control `frontend/src/components/ui/KillSwitch.tsx`. The DASH header carries exactly six area choices plus a persistent kill switch whose engage/release behavior stays backed by Control's system router.
- Layout and shared UI — DASH `src/components/layout/`, `src/components/ui/`, and `src/components/pageTemplate/`. One resizable shell and shared interaction primitives frame every authenticated area without becoming destinations.
- Terminal panel — DASH `src/components/terminal/`. A bottom panel remains available across areas; M6 preserves tabs, resize, keyboard toggle, and interaction while replacing transport with Python PTY.
- Assistant sidebar — DASH `src/components/sidebar/`. The contextual assistant remains mounted beside the active area and changes context without owning navigation.
- Context and toolbar — DASH `src/components/contextWindow/` and `src/components/toolbar/`. Context usage and document controls appear only when relevant and never consume nav slots.
- Overlays — DASH `src/components/modals/`. Agent Editor, Quick Prompts, Trash, and model-provider dialogs overlay the invoking area and return to it on close.
- Login — Control `frontend/src/pages/Login.tsx`. The pre-auth screen gates the shell, uses product-owned argon2 session auth, and is not visible in the six-area navigation.

## Milestone ownership

M5 rebuild list: Agent Overview from Mission Control; the single Hermes Chat presentation from Control Agent/Sessions/Session Detail plus DASH `chatMode`; Browser AI; Runs, Workflows, Schedules, Workflow Editor, Run Detail; Brain Review; Today approvals using DASH `ApprovalsInbox`; Files using the Control screen capability in the DASH shell; unified Models/System Settings; product Login; persistent-header kill switch; Work Documents and Tasks; Clients CRM and hosted Forms; and all M5 global shell, sidebar, context, overlay, toolbar, template, and shared-UI presentations.

M6 replacement list: terminal presentation transport (`src/components/terminal/`, `src-tauri/src/commands/terminal.rs`) becomes Python PTY; current `/hermes/*` consumers centered on `src/services/hermes/client.ts` are separated so M5's `chatMode` stays on Control's canonical runs/session API (D-CHAT), while only dashboard/gateway behavior that genuinely requires `:9119` moves from `server/lib/hermes-proxy.mjs` and `server/lib/hermes-session.mjs` to the ported Python bridge (D-M6-BRIDGE); fs-backed Work views (`src/components/fileExplorer/`, `src/components/fileViewer/`, `src/components/editor/`) and the Files screen consume Control's files contract through the adapted `src/services/remote-folder-connector.ts`; `server/index.mjs`, `server/lib/fs-handlers.mjs`, and `server/lib/paths.mjs` are retired after health and `/fs/*` parity exists in Python.

There is no M1 ownership deviation. Matrix ownership describes screen/presentation work: every row is M5 except terminal, which the audit assigns to M6. M6 still performs cross-cutting transport/backend swaps beneath M5-owned chat, files, editor, and settings presentations; this does not reassign those screens. Likewise, the kill-switch backend lands with M3's system router, while its new persistent-header presentation is an M5 rebuild.

## Notes for M3

Preserve router contracts needed by the map: Today depends on `approvals.py` plus `events.py`; Agent Overview depends on `agents.py`, `system.py`, and events; Chat/sessions/models/cron depend on `hermes.py` and its Hermes client/admin layer; Runs, Workflows, and Schedules depend on `workflows.py`/hooks and the engine; Brain Review depends on `review.py` and its service; Files depends on `files.py`, `safe_path`, and file events; Settings depends on `system.py` and Hermes admin. Login depends on `app.auth.create_auth_router` and auth/CSRF middleware in `app.main`, not a standalone router file.

During import and Control-brand stripping, M3 must preserve route shapes, auth/CSRF/session behavior, SSE event vocabulary/replay, workflow and run IDs/statuses, approval decision/resume semantics, file root IDs plus mtime conflict handling, masked settings/model fields, and review delegation boundaries. Keep names stable enough for M5 adapters to target these contracts; do not carry Control navigation or presentation structure into the canonical `server/`.