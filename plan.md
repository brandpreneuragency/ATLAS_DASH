# TABS VPS Multi-User Docker Migration Plan

## Summary

Migrate TABS from a local Dexie/Tauri-first app into a multi-user VPS-hosted web app. The VPS will run Docker services for the frontend, backend API, Postgres, Caddy reverse proxy, and backups. Postgres will store app data. Uploaded task files will live on the VPS filesystem in a mounted storage volume. Google Drive will be used only for encrypted backups.

The current app must stay the same in v1. This is a server migration of the existing TABS app, not a frontend rewrite. Do not redesign the app. Do not rebuild the app shell. Add only the UI required for login, account state, upload progress, server errors, and local-data import.

## Understanding Check

* Goal: host TABS on a Hetzner VPS with Docker and support browser access now, desktop app access later.
* Technical meaning: add backend API, Postgres, authenticated file storage, Docker deployment, and backup workflow.
* Confidence: High.
* Key assumption: v1 multi-user means separate private user accounts. It does not mean realtime collaboration, shared workspaces, roles, comments between users, or public file sharing.

## Non-Negotiable Rules

* Do not use Google Drive as live app storage.
* Do not store uploaded files as `dataUrl` in Postgres.
* Do not store uploaded file bytes in Postgres.
* Do not expose raw provider API keys to the frontend.
* Do not reconstruct the frontend from scratch.
* Do not replace the existing React app shell with a new app shell.
* Do not replace existing components when adding server support.
* Do not let React components call backend `fetch` directly.
* Do not let React components call Postgres, Prisma, filesystem APIs, or Docker paths directly.
* Do not remove existing Tauri files.
* Do not deploy the Tauri desktop bundle to the VPS.
* Do not run `npm run tauri:build` for the VPS Docker deployment.
* Do not copy `src-tauri/` into production Docker images.
* Do not redesign the existing app shell, panels, tabs, editor, task list, task detail panel, or AI sidebar.
* Do not add sharing, teams, realtime collaboration, or public links in v1.
* Do not refactor unrelated styling or component structure.

## Target Architecture

### Runtime Services

Create this Docker stack:

* `web`
  * Serves the built Vite React app.
  * Does not contain database credentials.
  * Talks only to `/api`.

* `api`
  * Node TypeScript backend.
  * Owns auth, data access, AI streaming, file upload/download, and import logic.

* `postgres`
  * Stores all server-side app data.

* `caddy`
  * Handles HTTPS.
  * Routes `/` to `web`.
  * Routes `/api/*` to `api`.

* `backup`
  * Runs scheduled encrypted backups to Google Drive using `rclone`.

### Deployment Target Clarification

The v1 VPS deployment target is the browser web app.

Deploy:

* Vite web build.
* Node backend API.
* Postgres.
* Caddy.
* Backup service.

Do not deploy:

* Tauri desktop bundle.
* Rust backend.
* Cargo build output.
* `src-tauri/`.

The Docker frontend build must use `npm run build`.

The Docker frontend build must not use `npm run tauri:build`.

Keep `src-tauri/` in the repository for future desktop support, but treat it as dormant during this VPS migration.

Only touch Tauri-related files when needed to isolate Tauri imports from the browser build.

### Data Ownership

Every private table must include `ownerId`.

All backend queries must filter by `ownerId`.

A user must never be able to read, update, delete, download, or infer another user’s data.

## UI Requirements

### Existing UI That Must Stay Exactly The Same

The VPS web app must be the exact current TABS app with server-backed data.

These areas must remain visually and structurally the same as the existing app:

* Header
* Tab bar
* Document editor workspace
* Task mode layout
* Task list panel
* Task detail panel
* Subtasks toggle bar
* AI sidebar
* File viewer panel
* Settings modal layout
* Agent/model/prompt management modals
* Current theme system and CSS structure

Allowed UI changes only:

* Add an auth screen before the app loads.
* Add account/logout entry in the existing header or settings modal.
* Add upload progress state inside the current task comment attachment flow.
* Add server error toasts using the existing toast system.
* Add an import-local-data modal or settings section.
* Hide or disable local folder connection controls in browser web mode.
* Keep local folder controls available only in desktop/Tauri mode.

Do not move existing controls to new locations unless this plan explicitly says to move them.

Do not rename visible UI labels unless the label is part of a new auth, upload, import, or server-error flow.

Do not change spacing, colors, typography, panel widths, tab behavior, or theme behavior unless required to fix a direct regression caused by the migration.

### Auth UI

Add a full-screen auth gate before `AppLayout`.

Screens:

* Login
* First-user setup
* Invite-code signup
* Loading session
* Session expired

Rules:

* If `/api/auth/me` returns a user, load the app.
* If no server users exist, show first-user setup.
* If users exist, show login and invite-code signup.
* Do not show the editor/task UI before auth succeeds.

### Browser File Explorer UI

For the VPS web app:

* Do not allow browser users to connect local folders.
* In the file explorer panel, show a clear disabled empty state:
  * “Local folders are available in the desktop app.”
* Do not remove the file explorer component.
* Do not break the Tauri desktop path.

### Task Attachment UI

Modify existing task comment attachment behavior:

* User picks a file in `TaskCommentInput`.
* UI shows selected file name and size.
* On send, upload through the backend.
* Show upload progress or a disabled sending state.
* Store only returned file metadata on the comment.
* File viewer opens file through backend URL, not `dataUrl`.

## Backend Plan

### Server Package

Create `server/`.

Use:

* TypeScript
* Express
* Prisma
* Postgres
* Zod
* Multer or Busboy for multipart uploads
* Argon2id for passwords
* Cookie-based sessions
* Node 22 or current LTS

Required scripts:

* `server:dev`
* `server:build`
* `server:start`
* `server:test`
* `prisma:migrate`
* `prisma:generate`

### Auth

Implement:

* `POST /api/auth/bootstrap`
* `POST /api/auth/login`
* `POST /api/auth/logout`
* `GET /api/auth/me`
* `POST /api/auth/invites`
* `POST /api/auth/register-with-invite`

Rules:

* Bootstrap is allowed only when user count is zero.
* First user becomes admin.
* After first user, signup requires invite code.
* Sessions are stored server-side.
* Session cookie is HttpOnly, Secure in production, SameSite=Lax.
* Passwords use Argon2id.
* Login responses must not include password hash or session token.

### Database Tables

Create these tables:

* `users`
  * `id`
  * `email`
  * `displayName`
  * `passwordHash`
  * `role`
  * `createdAt`
  * `updatedAt`

* `sessions`
  * `id`
  * `userId`
  * `tokenHash`
  * `expiresAt`
  * `createdAt`

* `invites`
  * `id`
  * `codeHash`
  * `createdByUserId`
  * `usedByUserId`
  * `expiresAt`
  * `usedAt`
  * `createdAt`

* `projects`
  * current `Project` fields
  * plus `ownerId`

* `tasks`
  * current `Task` fields
  * plus `ownerId`

* `task_comments`
  * current `TaskComment` fields
  * remove `attachmentDataUrl`
  * add nullable `fileId`
  * plus `ownerId`

* `files`
  * `id`
  * `ownerId`
  * `taskId`
  * `commentId`
  * `originalName`
  * `storedName`
  * `storagePath`
  * `mimeType`
  * `sizeBytes`
  * `sha256`
  * `createdAt`
  * `deletedAt`

* `documents`
  * current `Document` fields
  * plus `ownerId`

* `chat_threads`
  * current `ChatThreadMeta` fields
  * plus `ownerId`

* `chat_messages`
  * current `ChatMessage` fields
  * replace attachment `dataUrl` with `fileId` where needed
  * plus `ownerId`

* `agents`
  * current `Agent` fields
  * plus `ownerId`

* `provider_configs`
  * current `AIProviderConfig` fields
  * encrypt `apiKey`
  * plus `ownerId`

* `quick_prompts`
  * current `QuickPrompt` fields
  * plus `ownerId`

* `settings`
  * `ownerId`
  * `key`
  * `valueJson`

* `task_ai_change_batches`
  * current `TaskAIChangeBatch` fields
  * plus `ownerId`

### File Storage

Use VPS filesystem storage.

Base path:

```txt
/data/uploads/users/{ownerId}/
```

Rules:

* Never use client filename as filesystem path.
* Generate server file ID.
* Store file as:
  * `/data/uploads/users/{ownerId}/{fileId}/{safeStoredName}`
* Validate file size before saving.
* Validate MIME type where possible.
* Compute SHA-256.
* Save metadata in `files`.
* Do not expose `storagePath` to the client.
* Download only through backend.

Endpoints:

* `POST /api/tasks/:taskId/comments`
  * Accept multipart form.
  * Fields: `text`, optional `replyTo`, optional `file`.
  * Creates comment and file in one backend operation.

* `GET /api/files/:fileId/content`
  * Auth required.
  * Owner check required.
  * Streams file.

* `DELETE /api/files/:fileId`
  * Auth required.
  * Owner check required.
  * Soft-delete DB row.
  * Remove physical file or move it to a deleted area.

### Task API

Implement:

* `GET /api/projects`
* `POST /api/projects`
* `PATCH /api/projects/:id`
* `DELETE /api/projects/:id`

* `GET /api/tasks`
* `POST /api/tasks`
* `PATCH /api/tasks/:id`
* `POST /api/tasks/:id/soft-delete`
* `POST /api/tasks/:id/restore`
* `DELETE /api/tasks/:id`

* `GET /api/tasks/:taskId/comments`
* `PATCH /api/comments/:id`
* `DELETE /api/comments/:id`

Rules:

* Preserve current task fields and behavior.
* Preserve soft delete.
* Preserve 7-day trash cleanup behavior, but run it on the server.
* Preserve subtasks via `parentId`.
* Preserve task ordering.
* Preserve project colors.

### AI API

Move AI calls to backend.

Implement:

* `POST /api/ai/stream`
* `POST /api/ai/task-draft`
* `POST /api/task-ai/drafts/:messageId/apply`
* `POST /api/task-ai/batches/:batchId/undo`
* `GET /api/tasks/:taskId/ai-history`

Rules:

* Browser must not call provider APIs directly.
* Browser must not receive raw API keys.
* Provider keys are encrypted at rest.
* Preserve task draft validation.
* Preserve stale task detection.
* Preserve inverse operations for undo.
* Apply/undo must be transactional.

## Frontend Plan

### Repository Layer

Add frontend repository interfaces.

Suggested folder:

```txt
src/repositories/
```

Create:

* `authRepository.ts`
* `taskRepository.ts`
* `projectRepository.ts`
* `commentRepository.ts`
* `fileRepository.ts`
* `documentRepository.ts`
* `chatRepository.ts`
* `aiRepository.ts`
* `settingsRepository.ts`

Each store must call repositories.

Stores must not call `fetch` directly.

Stores must not call `db.*` for server-backed data after migration.

### API Client

Add:

```txt
src/services/apiClient.ts
```

Responsibilities:

* Base URL handling.
* JSON requests.
* Multipart requests.
* Credentialed cookies.
* 401 handling.
* Error normalization.
* Abort signal support.

Rules:

* All API calls use `credentials: 'include'`.
* API errors return a consistent shape to stores.
* Stores show errors through existing toast system.

### Store Migration Order

Migrate stores in this order:

1. `projectStore`
2. `taskStore`
3. `taskCommentStore`
4. `taskAIStore`
5. `chatStore`
6. `documentStore`
7. `aiStore`
8. `uiStore`

Do not migrate all stores in one uncontrolled edit.

After each store migration:

* Build TypeScript.
* Run app.
* Test the affected UI manually.

### Tauri Isolation

Browser build must not import Tauri modules.

Move Tauri-only code behind runtime-specific adapters.

Affected modules:

* `src/services/fs-adapter.ts`
* `src/services/secureStorage.ts`
* `src/services/ai/openai.ts`
* `src/services/ai/gemini.ts`
* `src/services/ai/anthropic.ts`
* `src/services/search.ts`
* `src/App.tsx` Tauri event listener

Required behavior:

* Browser web mode uses backend API.
* Tauri desktop mode can keep local adapters later.
* Any `@tauri-apps/*` import must be isolated from browser entry paths.

### Local Data Import

Add a post-login import flow.

Trigger:

* Settings modal button: “Import local browser data”
* Optional first-login prompt if Dexie contains local records.

Behavior:

* Read current Dexie data.
* Send data to backend import endpoint.
* Convert task comment `attachmentDataUrl` into real uploaded files.
* Keep original local Dexie data.
* Show report:
  * projects imported
  * tasks imported
  * comments imported
  * files imported
  * documents imported
  * chat messages imported
  * skipped records
  * failed records

Do not auto-delete local data.

## Docker Deployment Plan

Add:

* `docker-compose.yml`
* `server/Dockerfile`
* `Dockerfile.web`
* `Caddyfile`
* `.env.example`

Services:

* `caddy`
* `web`
* `api`
* `postgres`
* `backup`

Volumes:

* `postgres_data`
* `uploads_data`
* `caddy_data`
* `caddy_config`
* `backup_cache`

Environment variables:

```txt
APP_URL=
API_URL=
DATABASE_URL=
SESSION_SECRET=
FILE_STORAGE_ROOT=/data/uploads
MAX_UPLOAD_MB=50
ENCRYPTION_KEY=
POSTGRES_DB=
POSTGRES_USER=
POSTGRES_PASSWORD=
RCLONE_CONFIG_PATH=
BACKUP_RETENTION_DAYS=14
```

Deployment checks:

* `docker compose up --build`
* HTTPS works.
* Login works.
* Task creation persists after container restart.
* File upload persists after container restart.
* Backup job can run manually.

## Backup Plan

Use Google Drive only as backup target.

Use `rclone crypt`.

Backup job:

1. Run `pg_dump`.
2. Archive uploads directory.
3. Encrypt backup through `rclone crypt`.
4. Upload to Google Drive.
5. Keep 14 daily backups.
6. Keep 8 weekly backups.
7. Log success or failure.

Required restore test:

1. Start clean temporary Postgres.
2. Restore latest dump.
3. Restore uploads archive.
4. Start app.
5. Confirm user login, tasks, and files work.

Backup is not complete until restore is tested.

## Validation Plan

### Backend Tests

Test:

* first-user bootstrap
* bootstrap blocked after first user exists
* login success
* login failure
* logout
* invite creation
* invite signup
* expired invite rejected
* user A cannot access user B projects
* user A cannot access user B tasks
* user A cannot download user B file
* task create/update/soft-delete/restore/permanent-delete
* subtask create and list
* comment create/update/delete
* comment with attachment upload
* file download
* file delete
* path traversal upload name rejected or sanitized
* file size limit
* AI draft apply
* AI draft stale detection
* AI undo batch

### Frontend Manual Tests

Test in browser:

* login screen appears before app
* first user setup works
* logout returns to login
* existing layout appears after login
* task mode opens
* create project
* create task
* edit task title/content/status/date/importance
* create subtask
* delete and restore task
* add comment without attachment
* add comment with image attachment
* open image attachment in file viewer
* refresh browser and confirm data persists
* second user cannot see first user’s data
* local folder controls are disabled or desktop-only in browser
* import local Dexie data
* imported task attachment opens from server file URL

### Deployment Tests

Test on VPS:

* HTTPS certificate works.
* `/api/health` returns healthy.
* `/api/ready` returns ready.
* Postgres volume persists after restart.
* Upload volume persists after restart.
* Backup runs manually.
* Restore works on clean temporary stack.

## Agent Implementation Order

### Agent 1: Backend Foundation

Implement server package, Prisma schema, auth, sessions, user bootstrap, invites, and health endpoints.

Stop after tests pass.

### Agent 2: Task and Project API

Implement project/task/comment CRUD without files first.

Preserve current data fields.

Add ownership checks.

Stop after backend tests pass.

### Agent 3: File Service

Implement upload, download, delete, metadata, path safety, and task comment file attachment support.

Stop after file tests pass.

### Agent 4: Frontend Auth and API Client

Add auth gate, API client, auth repository, and session state.

Do not change app layout after auth.

Stop after login/logout works.

### Agent 5: Frontend Task Migration

Migrate project, task, and task comment stores to repositories.

Wire task comments to server file upload.

Stop after task mode works from server.

### Agent 6: AI Server Migration

Move AI streaming and task draft/apply/undo to backend.

Migrate AI store and task AI store.

Stop after task-mode AI draft/apply/undo works.

### Agent 7: Remaining Data Migration

Migrate documents, chats, agents, quick prompts, provider configs, and settings.

Add local Dexie import.

Stop after import report works.

### Agent 8: Docker and Backup

Add Docker stack, Caddy, environment examples, backup container, and restore instructions.

Stop after VPS-style local Docker test passes.

## Build Agent Handoff

```md
Implement only this approved plan.

Do not redesign the UI.

Do not change existing visual styling except for required auth, upload, import, and error states.

Do not remove Tauri support.

Do not use Google Drive as live storage.

Do not store uploaded file bytes in Postgres.

Do not store uploaded files as dataUrl in server records.

Do not expose provider API keys to the frontend.

Do not add collaboration, teams, sharing, public links, or roles beyond admin/user.

Use repository interfaces between Zustand stores and API calls.

Add ownerId checks to every user-owned backend query.

Migrate by vertical slice.

After each slice, run the relevant build/tests before continuing.

If code conflicts with this plan, stop and report:
- conflicting file
- conflicting behavior
- safest proposed adjustment

After implementation, report:
- files changed
- features implemented
- tests run
- manual checks completed
- known gaps
```
