# ATLAS_DASH Roadmap

Positioning: **ATLAS_DASH** — a self-hosted workspace and mission-control system for delegating work to Hermes, managing client operations, and supervising agent activity on your own VPS. Not an IDE competitor. "ATLAS" refers to the wider system concept only; ATLAS Control is a historical migration source, not a sub-brand.

## Standing decisions

- **One product.** ATLAS Control (`/home/admin/atlas-control`, atlas.brandpreneur.net) is absorbed into ATLAS_DASH, then retired. No second dashboard, no second Hermes integration layer.
- **One backend, and it is the Python one.** ATLAS Control's FastAPI backend (~4.6k LOC, tested: runs, workflow engine, scheduler, approvals, guardrails, kill switch, notifications, SSE, files, auth) becomes the canonical ATLAS_DASH server. The current Node server is retired by the end of V1; its **two** unique pieces — the xterm terminal WebSocket *and* the Hermes dashboard session bridge (see M6) — are ported or explicitly dropped. No permanent parallel implementations.
- **Navigation is capped at 6 areas.** Today · Work (docs/tasks/CRM/forms) · Clients · Agent (runs/workflows/schedules/Brain) · Files · Settings. Kill switch lives in the persistent header; approvals surface into Today. New features must fit inside these areas — a 15-tab cockpit is a failed merge.
- **SQLite until it measurably hurts.** All versions run on ATLAS Control's existing SQLite (WAL mode). There is **no scheduled Postgres migration**: the product model is single-tenant (each client on their own VPS, a handful of users each), which sits comfortably inside SQLite's envelope, SQLite FTS5 covers search (W3), and one database file per instance keeps provisioning (P4), backups (F9), and fleet updates (P6) simple. The V3 review gate asks one question — "did anything actually need Postgres?" — and only a *measured* limit (write concurrency, query shape) triggers a migration, as a single move at that point. Zero migrations beats one. Schema discipline (workspace_id, revision, correlation_id) is applied from V1 via migrations regardless of engine.
- **Dexie becomes a cache/offline layer** once V3 lands. VPS filesystem stays authoritative for actual files. Hermes stays the execution engine.
- **Stable IDs.** Items are referenced by ID (`M*` merge, `F*` foundation, `D*` delegation, `W*` workspace, `Q*` quality, `P*` production). Versions are containers; IDs never change meaning. Excluded-by-design decisions are recorded inline so future sessions don't re-add them.

Each version ends with a **review gate**: behavioral checks the owner performs by using the product, not by reading code.

---

## V1 — One product (merge & dissolve)

Theme: everything ATLAS Control does, inside ATLAS_DASH, on one backend. No new features.

- **M1 — Capability audit.** Matrix of both repos; every capability gets exactly one final owner. True duplicates to resolve: Hermes chat (two *different* Hermes surfaces — Control speaks Bearer to the runs API `:8642`, DASH speaks cookie-sessions to the dashboard `:9119`; see M6), files API, approvals. To **unify, not dedup** (different features today, one final design): models admin (DASH = browser-side provider keys; Control = Hermes model admin) and live updates (Control = persisted SSE; DASH = WS terminal + fetch-streamed chat, no SSE at all).
  **✅ Completed 2026-07-19 — six decisions ratified** (full matrix and rationale: `docs/V1_M1_CAPABILITY_AUDIT.md`; these are law for M2–M7, do not relitigate):
  - **D-CHAT:** Control's Bearer runs-API client is the canonical chat backend; DASH `chatMode` is rewritten onto it as the single UI. No second chat data path.
  - **D-FILES:** Control's `files.py` + `safe_path` is the sole files backend; DASH `remote-folder-connector.ts` adapts to its contract; Node `/fs/*` retired at M6.
  - **D-APPROVALS:** Control's approvals router/records/guards are the only implementation; DASH contributes the inbox presentation.
  - **D-MODELS:** one models-admin design in the DASH settings shell; the Python backend owns Hermes model admin; DASH's browser-side provider keys remain a clearly labeled client-side domain until F8 (V2) decides their fate.
  - **D-LIVE:** Control's persisted-event SSE is the single product-wide live-update transport; finite chat/run streams feed the canonical event log via backend adapters. (Terminal WS stays, per M6.)
  - **D-M6-BRIDGE:** the dashboard session bridge is **ported into the Python backend**; the `:9119` proxy survives. See M6.
- **M2 — Module map + 6-area IA design.** Decide where every existing DASH and Control screen lands inside the 6 areas before writing UI code. Resolve **CRM's single home** (Work vs Clients) in writing — the same records must not have two homes once W2 lands.
- **M3 — Import the FastAPI backend** into this repo as the canonical `server/` (Python app, migrations, tests). `make check` covers **both toolchains** (uv: pytest/ruff/mypy + npm: typecheck/lint/test/build) from day one. Rename services/env vars, strip ATLAS Control branding. Old Control UI may temporarily point at the migrated backend during the transition — this is a formal **mid-V1 checkpoint**: everything still works end-to-end before any UI merge begins.
  - **M3 prerequisite spike (do first, ~30 min):** from a host-network container, verify the merged backend can reach the Hermes runs API `:8642` and dashboard `:9119` directly. Host-loopback `:8642` has been observed to connection-reset on plain HTTP (VPS_AGENTS §8) — the relay exists *because* this path is fragile. Until the spike passes, the relay stays and M6/M7 plans don't get committed.
- **M4 — Schema hardening migrations** (on SQLite): `workspace_id` on all entities (single default workspace), `revision`/`updated_at`/`updated_by` for optimistic locking, `correlation_id` linking task ↔ run ↔ events ↔ session, formalize `waiting_for_approval` in the run state machine (`queued → starting → running → waiting_for_approval → paused → completed | failed | cancelled`). **Audit before building:** persisted events, run/step statuses, and workflow version snapshots already exist in Control (`001_core.sql`, `003_workflows.sql`) — M4 extends, it does not re-implement. M1 flag: before "exactly-once approval resolution" is treated as a regression invariant (M5), the atomic approval-claim/idempotency boundary must be specified and tested here.
  **✅ Completed 2026-07-23 — migrations 004/005/006 applied to the live database** (`/data/atlas.db`, container `atlas_control`); `schema_migrations` = [1..6], integrity ok, status triggers proven enforcing. The atomic conditional approval claim is implemented and tested, so exactly-once resolution is now a real invariant rather than an assumption. Evidence: `CP_M4_SIGNOFF.md`.
- **M5 — Rebuild Control's screens in the DASH shell** per M2: runs, workflows, schedules, approvals, models, Brain Review, files, kill switch (header). Adapt to DASH interaction patterns — no "Control island." **Control's argon2 login replaces Caddy basic-auth here — this is a hard V1 gate criterion, not a P1 option.** Post-merge the product exposes a VPS shell, file writes, and a kill switch; a single shared basic-auth secret guarding that until V4 is not acceptable.
  **✅ Completed 2026-07-24 — six areas rebuilt and the CP-M5 auth cutover executed.** `atlasdash.brandpreneur.net` no longer issues a basic-auth challenge; the gate is the product's own argon2 cookie login. Verified after cutover: `/api/me` unauthenticated → 401, every protected route → 401, login → 204 + HttpOnly `atlas_session`, wrong password → 401. Two decisions were ratified here rather than deferred: DP-1 (two approval domains are real — see `docs/V1_M2_MODULE_MAP.md`) and DP-2 (JSON workflow editor ships for V1; the canvas becomes **D6**). One gap is now load-bearing: there is still no change-password route (**F10**), so rotating that password means touching the database by hand. Evidence: `CP_M5_SIGNOFF.md`.
- **M6 — Replace DASH duplicates + retire Node server.** DASH web UI consumes the canonical backend for Hermes chat/session, fs, models. The Node server has **two** unique pieces, not one: (a) the terminal WebSocket (`node-pty` → Python pty — a rewrite, not a port), and (b) the Hermes **dashboard session bridge** (`hermes-session.mjs`: password login / HMAC cookie mint, single-use WS tickets against `:9119`) which has *no equivalent* in Control's Bearer-key client. **Decided at M1 (D-M6-BRIDGE): the bridge is ported into the Python backend** — the merged product keeps the `:9119` proxy; port `hermes-session.mjs` semantics (HMAC cookie mint, single-use WS tickets) rather than dropping dashboard features. Then remove `server/index.mjs` stack.
- **M7 — Retire ATLAS Control.** Criteria: all operational screens exist in DASH; workflows and schedules run; approvals gate; Brain queue accessible; kill switch works; Telegram notifications verified; file ops work; run history preserved (old SQLite kept as read-only archive — no data-migration project). Then: archive repo, remove deployment, redirect or retire atlas.brandpreneur.net, keep a migration tag + DB export. Removing the **`atlas_hermes_relay` container is its own gated step with a Risk Card and rollback** — executed only after the M3 spike proved direct connectivity and the merged backend has run against Hermes for a while, never as a side effect of the retirement.

**Review gate V1:** log in via the product's own login (basic-auth retired), then — without touching atlas.brandpreneur.net — run a workflow, watch a live run, approve a gated action, flip the kill switch, browse/edit a VPS file, use the terminal, receive a Telegram notification. `make check` (both toolchains) and the existing Control test suite pass in the new repo. atlas.brandpreneur.net is gone.

**Highest-risk step:** M6 (swapping live integrations — two Hermes auth surfaces, a flaky `:8642`, and Hermes Desktop as an invisible remote dependent). M4 is mechanical; M6 is where regressions hide.

---

## V2 — Delegation (Hermes becomes an employee)

Theme: delegate, walk away, get notified. Runs are durable and survive restarts.

- **F3 — Durable run lifecycle hardening.** Heartbeats (detect dead agents), cancellation that terminates the underlying process, recovery after dashboard/Hermes/VPS restart, idempotency keys for schedule/Telegram triggers. Excluded by design: auto-retry (half-completed agent work must stop and report; manual retry button only), priority queues, concurrency tuning beyond a simple cap.
- **F4 — Event stream hardening.** Control's SSE becomes the persisted, replayable event stream; UI is a consumer, never the owner of run state; reconnect replays cleanly.
- **F5 — Adapter capability contract.** Formalize the interface: `capabilities / createRun / streamRun / cancelRun / resumeRun / respondToApproval / getArtifacts`. Hermes is the primary backend; no Hermes assumptions outside the adapter. Two obligations ride on the contract: (a) a **fake in-process adapter** implements the same interface for tests — Q5 and CI run against it, never against production Hermes; (b) the Hermes adapter **records the Hermes contract version it was verified against** — upgrading Hermes is a deliberate compatibility check, not silent drift (this matters more at V4, when Hermes ships per-client).
- **F6 — Approval policy (single global table).** Per-action defaults (read = auto; write existing file = diff/policy; delete, package install, secret access, server config = approval; network = configurable) + command deny-list, per-run working dir, timeouts, path-traversal checks. Plus one item pulled forward from P3 because it is cheap and cuts blast radius: **runs execute as a dedicated non-admin exec user where possible** (full container sandboxing still waits for P3). Excluded by design in V1–V3: per-run container sandboxing (Hermes's job is managing the VPS; the safety boundary is approvals) and multi-level policy hierarchies — both arrive at P3/P2. Be clear-eyed: until P3, this table is the *only* wall between a prompt-injected run and the VPS — W1/Q6 widen that surface in V3.
- **F7 — Provenance & audit.** Every run retains instruction, inputs, backend+model, prompt/template snapshot, tool calls, diffs, output, cost/tokens, timings, parent task, trigger source. Snapshot-per-run replaces any separate prompt-versioning system; schedules snapshot their template at creation.
- **F8 — Secrets settings screen + browser-AI decision.** Keys entered in UI, encrypted at rest (extends Control's models/env admin). This item also owns the fate of DASH's current **browser-side AI stack** (`services/ai/*` calls providers directly from the browser with keys in client storage): provider calls move behind the server so keys never live in the browser, and it is decided here whether direct-provider chat survives alongside Hermes chat or is retired. This is a real workstream — it must not stay unowned.
- **D1 — Delegate to Hermes from a task.** Task description + linked files → run; result/artifacts attach back. (Tasks still live client-side until V3; the run link is stored server-side by correlation_id.)
- **D2 — Runs dashboard polish.** Status, live progress, halt/resume, manual retry.
- **D3 — Notifications.** Telegram/browser push on finished, failed, needs-approval (wire Control's notify to F4 triggers).
- **D4 — Approval inbox.** Everything `waiting_for_approval` in one queue, red/green diff view, one-click apply; surfaces in Today.
- **D5 — Scheduled delegation.** Recurring Hermes jobs (morning brief, weekly reports); idempotent, template-snapshotted.
- **D6 — Workflow editor visual canvas.** *(Logged at CP-M5, 2026-07-24, resolving DP-2.)* V1's Workflow Editor ships as a structured **JSON graph editor**, not the drag/drop canvas Control had. Every capability the M2 map lists is present and tested — graph editing, server-side `validate_graph` with the 422 detail surfaced verbatim, versions + rollback, enablement, dry run, execution — but editing a workflow graph means editing JSON, and per-node run state is seen afterwards in Agent → Runs → Run Detail rather than painted live onto a graph. That is a real usability regression against Control and is recorded as a known gap, not quietly accepted as done. The work: add `@xyflow/react` (not currently a DASH dependency), port `NodePalette` / `Canvas` / `ConfigPanel` / `VersionsDrawer` / `RunPanel` from `atlas-control/frontend/src/components/flow/`, and wire the live per-node overlay to the F4 event stream. `src/stores/workflowsStore.ts` is reusable as-is — only the presentation changes. Detail: `PARKED.md` P-1.
- **F10 — Change password. ✅ Completed 2026-07-24**, same day it was logged, because CP-M5 made it load-bearing. `POST /api/auth/password` next to login/logout, plus Settings → System → Password. Rotation now also revokes every other session: cookies carry a session epoch that is bumped on change, so a cookie stolen under the old password stops working, while the caller is re-minted and stays signed in. Tests written first — 7 backend, 6 frontend. Deployed to production the same day, which required backporting the identical change into the `atlas-control` repo (`ad47dad`), since `atlas_control` still builds from there rather than from this repo's `server/` until M6/M7 — a deliberate, temporary duplication that dies with that repo at M7. Original entry below. *(Logged at CP-M5, 2026-07-24, resolving P-3.)* Control's Settings had a "Change password" panel calling `POST /api/settings/password`; **no such route was ever ported** — `server/app/auth.py` has only `hash_password` / `verify_password` / `bootstrap_password`. M5 correctly omitted the UI rather than wire a form to a 404. This matters more now that CP-M5 has made that password the *only* gate on the public product: rotating it currently means touching the database by hand. The work is small and self-contained — add the route hashing with the existing argon2 helpers and updating the same `password_hash` settings row `bootstrap_password` seeds, then add the panel to `SystemSection.tsx` using its established masked-secret pattern. Folded into F8's secrets work, or done before it if a rotation is needed sooner. Detail: `PARKED.md` P-3.
- **Q5 — Agent regression suite** (starts here, runs before every release): create doc, modify file + diff, delegate task, pause for approval, resume after restart, reject dangerous command, complete scheduled job, deliver notification. Runs against the **fake adapter from F5** — never against the production VPS or live Hermes. One manual smoke pass against real Hermes per release is allowed; automated suites are not.

**Review gate V2 (the walk-away test):** delegate a task from your phone or desk, close the laptop, get a Telegram ping, open the run, review the diff, approve it, see the result attached to the task. Restart the VPS mid-run; the run recovers or fails loudly — never vanishes. Q5 suite green.

---

## V3 — Connected workspace (the second brain clicks in)

Theme: one storage, one search, one Today. The agent can touch your workspace.

- **F9 — Backups with verified restore (runs FIRST — before the storage move).** Nightly DB+files off-VPS, status panel (last success, retention, destination, last restore-test result), manual backup button, and the **raw dump-everything JSON export** as solo insurance. Ordering is deliberate: the riskiest data operation in the whole roadmap (F1/F2) does not begin until the safety net exists and the export has been exercised — the Hermes backup cron does not cover data that still lives in the browser.
- **F1/F2 — The one storage move.** Move docs, tasks, CRM, forms, chats out of Dexie to the server, on SQLite (Dexie demoted to cache). Postgres only if the V3 gate's measured-need question says yes — see standing decisions. Budget honestly: this is the **largest single engineering item in the roadmap**, bigger than M3 — 10+ services and stores talk to Dexie directly today, so this is a data-layer rearchitecture of a 54k-LOC frontend, not a storage swap. Do it in two steps: (1) repository-interface refactor, still Dexie-backed, shipped and verified; (2) server-backed implementation swapped in behind the interface. Each step gets its own test pass and runs behind the V2 regression suite.
- **W1 — Agent tools into workspace data.** Hermes can create/read tasks, docs, CRM entries.
- **W2 — Client workspaces.** Docs, tasks, CRM, forms, chats, VPS folder, runs grouped per client (thin UI over `workspace_id`).
- **W3 — Global search + command palette (Ctrl+K).** SQLite FTS5 behind a search interface (swappable for Meilisearch — or Postgres FTS if the engine ever changes — later). Indexed: DB records, chats, markdown/text files, agent outputs, CRM notes.
- **W4 — Quick-capture inbox.** Hotkey + Telegram bot → triage inbox.
- **W5 — VPS file preview/editing** upgrades (tree already lists folders; open, markdown/code preview, light editing — largely absorbed from Control in M5, polished here).
- **Q1 — Today view home screen.** Tasks due, runs in flight, approvals pending, CRM follow-ups.
- **Q2 — Workflow templates.** "New client onboarding" = folder + docs + tasks + kickoff plan in one click.
- **Q3 — Mobile PWA layout.** Today, runs, approvals usable from a phone.
- **Q4 — Cost/usage meter.** Spend per run/day (basic recording; fancy charts later).
- **Q6 — Claude Code adapter.** Second plug into F5, only after the Hermes contract has proven stable in daily V2 use.

**Review gate V3:** clear your browser storage — nothing is lost. Ctrl+K finds a doc, a task, a chat line, and a VPS file. Ask Hermes to "summarize this call and create follow-up tasks" — the tasks appear in the right client workspace. Restore last night's backup onto a scratch database successfully. Run the app from your phone. Answer the standing-decision question on record: **did anything in V3 actually need Postgres?** (Expected answer: no.)

---

## V4 — Sellable edition (production, multi-client)

Theme: turn the working solo product into a provisioned, supportable offering on each client's own VPS. **V4 ships in two halves.** V4a sells to the first ~3 clients with deliberately manual ops; V4b automates the fleet. The control plane, staged updates, licensing, white-labeling, and compliance stack serve client #10, not client #1 — building them before the first sale is over-engineering.

### V4a — First clients (manual ops are fine)

- **P1 — Login system.** Accounts, email+password, 2FA, roles (owner/staff/viewer). Builds on the auth adopted at M5 — mostly done already.
- **P4 — Provisioning, lite.** Fresh VPS + domain → full install via a script the *operator* runs (SSH allowed, checklists allowed), hardening baked in (rate limiting, fail2ban, non-root containers, auto OS updates). The one-command polish waits for V4b.
- **P9 — Tenant lifecycle + portability.** Create, rotate secrets, change domain, transfer ownership, suspend without destroying data, full machine-readable export, restore onto a new VPS, secure decommission. **Full export exists before the first sale.**
- **P10 — Support access model.** Off by default; client-generated temporary scoped token; every support action audited.

**Review gate V4a:** provision a blank VPS into a working instance in under an hour using the runbook; export a tenant and restore it onto a scratch VPS; suspend and restore a tenant; hand a stranger the user guide and watch them onboard. First client can be signed after this gate.

### V4b — Fleet (build when clients exist)

- **P2 — Multi-user per tenant.** Per-user chats, ownership, assigned tasks; approval policy gains per-workspace/agent/template layers (extends F6).
- **P3 — Execution isolation, tiered.** Sandboxed runs (container, CPU/memory limits, network policy, env allowlist; the separate exec user landed at F6) vs. explicit privileged server-admin mode — required once strangers' employees write prompts.
- **P4 (full) — One-command provisioning.** The V4a script hardened into fresh VPS + domain → full install (~15 min), no manual SSH.
- **P5 — Instance control plane.** Outbound-only agent per client VPS reporting ID, version, health, disk, backup, migration status, heartbeat. Commands signed and narrowly scoped; client DBs/APIs never exposed directly.
- **P6 — Staged fleet updates.** Stable/preview channels, canary, pre-update backup, migration dry-run, post-update health check, auto-rollback where possible, per-instance freeze. Never update all customers simultaneously. Includes the **Hermes upgrade story**: the F5 contract-version pin decides when a dashboard update may also bump Hermes on a client VPS.
- **P7 — Fleet monitoring** over P5 telemetry.
- **P8 — Licensing/billing.** License check + subscription; clients bring their own API keys.
- **P11 — White-labeling + onboarding wizard.**
- **P12 — Observability for support.** Health checks, queue depth, agent connection state, DB/disk status, secret-stripped diagnostic bundle.
- **P13 — Compliance foundations.** Data/log retention, secret rotation, vuln response, dependency scanning, SBOM, breach procedure, subprocessor list.
- **P14 — Docs, support channel, legal.** Admin/user guides, support path, contract: client owns data + VPS.

**Review gate V4b:** provision a blank VPS into a working white-labeled instance in under an hour without SSH-ing in manually; run a canary update across two instances; suspend and restore a tenant.

---

## Sequence

**V1:** M1 → M2 → M3 (spike first, mid-V1 checkpoint after) → M4 → M5 → M6 → M7
**V2:** F3 → F4 → F5 → D1 → D2 → F6 → D4 → F7 → D3 → D5 → F8 (Q5 continuous from D1, against the F5 fake adapter)
**V3:** F9 → F1/F2 → W1 → W3 → Q1 → W2 → W4 → W5 → Q2 → Q3 → Q4 → Q6
**V4a:** P1 → P4 (lite) → P9 → P10 — first sale allowed after the V4a gate
**V4b:** P2 → P5 → P6 → P7 → P3 → P4 (full) → P8 → P11 → P12 → P13 → P14

Each version is reviewed at its gate before the next begins. Mid-version scope additions go to the *next* version by default.
