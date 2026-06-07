# AGENTS.md

---
description: Implementation agent instructions for the TABS VPS multi-user Docker migration.
mode: primary
permission:
  edit: allow
  bash: allow
  write: allow
  patch: allow
---

# TABS Implementation Agent

## Mission

You are the Build agent for this repository.

Implement the approved migration in `plan.md`.

The goal is to migrate TABS from a local Dexie/Tauri-first app into a multi-user VPS-hosted web app with:

* Docker deployment.
* Backend API.
* Postgres database.
* Authenticated multi-user accounts.
* VPS filesystem file storage.
* Google Drive encrypted backups only.
* Future Tauri desktop compatibility through clean service boundaries.

## Source Of Truth

Read these first:

1. `plan.md` — the implementation contract
2. `progress.md` — the running journal of what has been done, what is next, and the conventions the next slice must follow
3. `package.json`
4. Current files in `src/services/`
5. Current files in `src/stores/`
6. Current task UI files in `src/components/taskManager/`
7. Current AI sidebar files in `src/components/sidebar/`

If `progress.md` and `plan.md` conflict, follow `plan.md` unless the conflict would cause a security, data-loss, or build failure. In that case, stop and report the conflict.

## Hard Rules

Do not redesign the app.

Do not reconstruct the frontend from scratch.

Do not replace the existing React app shell with a new app shell.

Do not replace existing components when adding server support. Modify the current components in place unless `plan.md` names a new component.

Do not make broad UI changes.

Do not refactor unrelated code.

Do not reformat unrelated files.

Do not remove existing Tauri files.

Do not deploy the Tauri desktop bundle to the VPS.

Do not run `npm run tauri:build` for the VPS Docker deployment.

Do not copy `src-tauri/` into production Docker images unless a future approved plan explicitly adds desktop build infrastructure.

Do not use Google Drive as live app storage.

Do not store uploaded file bytes in Postgres.

Do not store uploaded files as `dataUrl` in server records.

Do not expose raw provider API keys to the frontend.

Do not add realtime collaboration.

Do not add teams.

Do not add shared workspaces.

Do not add public file links.

Do not add roles beyond `admin` and `user` unless explicitly requested.

Do not let React components call `fetch` directly.

Do not let React components call Prisma, Postgres, filesystem paths, or Docker paths.

Do not let server APIs return private filesystem paths.

Do not skip ownership checks.

## Current Architecture Facts

The current app is Vite + React + TypeScript.

The current app uses Zustand stores.

The current app uses Dexie in `src/services/db.ts`.

The current task store writes task data to Dexie and also syncs markdown files through `src/services/fs-adapter.ts`.

The current file adapter is Tauri-local and imports `@tauri-apps/plugin-fs` and `@tauri-apps/plugin-dialog`.

The current secure storage uses Tauri invoke and OS keychain commands.

The current AI provider calls use Tauri HTTP.

Task comment attachments currently use `attachmentDataUrl`.

The migration must move server-backed shared data away from direct Dexie access.

The migration must isolate Tauri-only code from browser web builds.

## Deployment Target

The v1 VPS deployment target is the browser web app.

Deploy the Vite web build plus the Node API.

The VPS must not host a Tauri desktop build.

The VPS Docker stack must not depend on Rust, Cargo, Tauri CLI, or `src-tauri/`.

Use `npm run build` for the frontend web build.

Do not use `npm run tauri:build` for deployment.

Keep `src-tauri/` in the repository for future desktop support.

Treat Tauri as dormant desktop support during this migration.

Only touch Tauri-related files when needed to isolate Tauri imports from the browser build.

If Tauri code causes confusion, add clearer adapter boundaries. Do not delete it.

## UI Boundaries

The VPS web app must be the exact current TABS app with server-backed data.

This is not a rewrite.

This is not a new frontend.

This is not a new UX.

These areas must remain visually and structurally the same as the existing app:

* Header.
* Tab bar.
* Document editor workspace.
* Task mode layout.
* Task list panel.
* Task detail panel.
* Subtasks toggle bar.
* AI sidebar.
* File viewer panel.
* Settings modal layout.
* Agent, model, prompt, and task profile modals.
* Current theme CSS structure.

Allowed UI additions:

* Full-screen auth gate before `AppLayout`.
* Login form.
* First-user setup form.
* Invite-code signup form.
* Account/logout entry in the current header or settings modal.
* Upload progress or disabled sending state in task comment attachment flow.
* Server error toasts using the existing toast system.
* Local-data import modal or settings section.
* Browser-mode disabled state for local folder connection.

Do not create a landing page.

Do not add marketing copy.

Do not replace the existing app shell.

Do not replace `AppLayout`, the current panel structure, or the existing task/document/sidebar composition unless the change is strictly required to insert the auth gate before the app loads.

Do not move existing controls to new locations unless `plan.md` explicitly says to move them.

Do not rename visible UI labels unless the label is part of a new auth, upload, import, or server-error flow.

Do not change spacing, colors, typography, panel widths, tab behavior, or theme behavior unless required to fix a direct regression caused by the migration.

When adding auth, account, upload, import, or server-error UI, match the existing component style and CSS variables.

## Implementation Order

Work in vertical slices.

Do not implement all layers at once.

Use this order:

1. Backend foundation.
2. Auth.
3. Project, task, and comment API without files.
4. File service.
5. Frontend auth gate and API client.
6. Project, task, and comment repository migration.
7. AI server migration.
8. Remaining data migration.
9. Local Dexie import.
10. Docker deployment.
11. Google Drive backup and restore.

After each slice, run relevant checks before continuing.

## Backend Requirements

Create backend code under `server/`.

Use TypeScript.

Use Express.

Use Prisma.

Use Postgres.

Use Zod for request validation.

Use Argon2id for password hashing.

Use server-side sessions.

Use HttpOnly cookies.

Use `Secure` cookies in production.

Use `SameSite=Lax`.

Add health endpoints:

* `GET /api/health`
* `GET /api/ready`

All private tables must have `ownerId`.

All private queries must filter by `ownerId`.

All update and delete operations must prove ownership before mutation.

Do not trust IDs sent by the frontend for ownership.

Do not return password hashes, session token hashes, raw invite hashes, provider API keys, or storage paths.

## Auth Requirements

Implement:

* `POST /api/auth/bootstrap`
* `POST /api/auth/login`
* `POST /api/auth/logout`
* `GET /api/auth/me`
* `POST /api/auth/invites`
* `POST /api/auth/register-with-invite`

Rules:

* Bootstrap is allowed only when no users exist.
* First bootstrap user is `admin`.
* Later registration requires an invite.
* Invite codes must be stored hashed.
* Session tokens must be stored hashed.
* Logout must invalidate the current session.
* Expired sessions must be rejected.

## File Service Requirements

Use VPS filesystem storage for active files.

Default storage root:

```txt
/data/uploads
```

Store files under:

```txt
/data/uploads/users/{ownerId}/{fileId}/{safeStoredName}
```

Rules:

* Generate the file ID on the server.
* Sanitize the original filename.
* Never use the original filename as a path.
* Enforce max upload size.
* Compute SHA-256.
* Save file metadata in Postgres.
* Do not expose `storagePath`.
* Stream downloads through the backend.
* Check ownership before download.
* Check ownership before delete.

Required endpoints:

* `GET /api/files/:fileId/content`
* `DELETE /api/files/:fileId`

Task comment file upload should happen through:

* `POST /api/tasks/:taskId/comments`

This endpoint must accept multipart form data with:

* `text`
* optional `replyTo`
* optional `file`

The comment and file metadata must be created as one logical operation.

If file saving succeeds but DB write fails, clean up the physical file.

If DB write succeeds but file saving fails, do not leave a comment pointing to a missing file.

## Database Requirements

Use the current frontend types as the starting point.

Preserve current user-visible behavior.

Required server data groups:

* users
* sessions
* invites
* projects
* tasks
* task comments
* files
* documents
* chat threads
* chat messages
* agents
* provider configs
* quick prompts
* settings
* task AI change batches

Important mappings:

* Current `Task.content` remains the task notes/body field.
* Current `Task.parentId` remains the subtask link.
* Current task soft delete behavior remains.
* Current task AI undo history maps to `task_ai_change_batches`.
* Current `TaskComment.attachmentDataUrl` must not exist in server records.
* Server comments should reference uploaded file metadata with `fileId`.

## Frontend Bridge Requirements

Add repository interfaces under `src/repositories/`.

Stores call repositories.

Repositories call `src/services/apiClient.ts`.

React components call stores.

React components must not call `fetch` directly.

React components must not know server route URLs.

Suggested repositories:

* `authRepository.ts`
* `projectRepository.ts`
* `taskRepository.ts`
* `commentRepository.ts`
* `fileRepository.ts`
* `documentRepository.ts`
* `chatRepository.ts`
* `aiRepository.ts`
* `settingsRepository.ts`

`apiClient.ts` must handle:

* JSON requests.
* Multipart requests.
* `credentials: 'include'`.
* 401 responses.
* Error normalization.
* Abort signals.

## Store Migration Rules

Migrate stores in this order:

1. `projectStore`
2. `taskStore`
3. `taskCommentStore`
4. `taskAIStore`
5. `chatStore`
6. `documentStore`
7. `aiStore`
8. `uiStore`

For each store:

* Replace direct server-backed `db.*` operations with repository calls.
* Keep the public store API as stable as possible.
* Keep component call sites stable unless a change is required.
* Run TypeScript build after the store migration.
* Manually test the affected UI.

Do not remove Dexie immediately.

Dexie can remain for local import and temporary local-only state during migration.

## Tauri Isolation Rules

Browser web build must not import Tauri modules from normal app entry paths.

Tauri-only imports include:

* `@tauri-apps/api/*`
* `@tauri-apps/plugin-fs`
* `@tauri-apps/plugin-dialog`
* `@tauri-apps/plugin-http`

Affected areas:

* `src/services/fs-adapter.ts`
* `src/services/secureStorage.ts`
* `src/services/ai/openai.ts`
* `src/services/ai/gemini.ts`
* `src/services/ai/anthropic.ts`
* `src/services/search.ts`
* `src/App.tsx` Tauri event listener

Use runtime-specific adapters.

Browser mode uses backend API.

Tauri mode can keep local filesystem behavior for future desktop work.

Do not break Tauri intentionally.

If preserving Tauri and browser support requires a design decision not covered by `plan.md`, stop and report it.

## Task Mode AI Requirements

Preserve task-mode safety behavior.

Do not turn task AI into free-form mutation.

Keep structured draft/apply behavior.

Keep stale task detection.

Keep validation errors.

Keep inverse operations for undo.

Keep undo history window.

Apply and undo must be transactional on the backend.

Task AI must use active task context unless the existing confirmation flow explicitly widens scope.

Destructive or bulk task AI operations must keep preview/confirmation behavior.

## Provider API Key Requirements

Provider API keys must be stored encrypted at rest on the server.

The frontend may display masked key state.

The frontend must not receive raw provider API keys.

AI requests must go through backend endpoints.

Browser code must not call OpenAI-compatible provider APIs directly.

## Local Data Import Requirements

Add an import flow after login.

Do not automatically delete local Dexie data.

Import should read current Dexie tables and send them to the server.

Convert `attachmentDataUrl` values into uploaded files.

Show an import report with counts:

* projects imported
* tasks imported
* comments imported
* files imported
* documents imported
* chat messages imported
* skipped records
* failed records

If one record fails, continue importing other records where safe.

Do not create duplicate records on repeated import if stable IDs can be matched safely.

If duplicate handling is unclear, stop and report before guessing.

## Docker Requirements

Add:

* `docker-compose.yml`
* `server/Dockerfile`
* frontend Dockerfile if needed
* `Caddyfile`
* `.env.example`

Services:

* `caddy`
* `web`
* `api`
* `postgres`
* `backup`

Required persistent volumes:

* Postgres data
* uploaded files
* Caddy data
* Caddy config
* backup cache

The `web` service must not contain database credentials.

The `api` service owns database access.

Caddy routes `/api/*` to `api`.

Caddy routes all other web requests to `web`.

## Backup Requirements

Google Drive is backup only.

Use `rclone`.

Prefer `rclone crypt`.

Backup job must:

1. Run `pg_dump`.
2. Archive uploaded files.
3. Encrypt backup.
4. Upload to Google Drive.
5. Retain daily and weekly backups according to `plan.md`.
6. Log success or failure.

Backup is incomplete until restore is tested.

Write restore instructions.

Run or document a restore test.

## Testing Requirements

Run checks after each vertical slice.

Minimum frontend checks:

* `npm run build`
* `npm run lint` if existing lint state allows it

Minimum backend checks:

* server TypeScript build
* server tests
* Prisma generate
* Prisma migration validation

Required security tests:

* user A cannot read user B projects
* user A cannot read user B tasks
* user A cannot download user B files
* path traversal filename is rejected or sanitized
* upload size limit works
* raw provider API key is not returned to frontend

Required manual checks:

* login screen appears before app shell
* first-user setup works
* invite signup works
* task mode opens
* project create works
* task create/update/delete/restore works
* subtask create works
* task comment without file works
* task comment with file works
* file viewer opens uploaded file
* page refresh keeps data
* second user cannot see first user data
* browser file explorer does not offer local folder access

## Model Quality Guidance

Use the strongest available model for:

* Backend foundation.
* Auth and sessions.
* Prisma schema design.
* File service.
* Store repository migration pattern.
* AI server migration.
* Local Dexie import.
* Backup and restore.

Use medium or cheaper models only after a strong model has established a working pattern.

Cheaper models may copy established patterns for:

* repetitive CRUD tests
* simple endpoints
* simple loading states
* `.env.example`
* documentation cleanup

All security-sensitive output from cheaper models must be reviewed by a stronger model.

## Stop Conditions

Stop and report before continuing if:

* `plan.md` conflicts with current code in a way that changes architecture.
* You need to change the database schema beyond the plan.
* You need to redesign UI to complete a task.
* You cannot preserve Tauri isolation cleanly.
* You are unsure how to handle duplicate import records.
* Any ownership check is hard to prove.
* A migration risks deleting local Dexie data.
* A backup cannot be restored.
* Tests fail for reasons you do not understand.

Report:

* blocking file
* blocking behavior
* why it blocks implementation
* safest proposed next step

## Final Report Format

At the end of each implementation slice, report:

```md
## Slice Completed

### Implemented
- ...

### Files Changed
- ...

### Checks Run
- ...

### Manual Tests
- ...

### Known Gaps
- ...

### Next Slice
- ...
```

Do not claim a slice is complete if required checks were not run.

If a check could not be run, say why.
