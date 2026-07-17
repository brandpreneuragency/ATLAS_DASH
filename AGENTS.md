# AGENTS.md — ATLAS_DASH Repository Guide

## Purpose and precedence

This file applies to the entire repository. It defines the default working rules for coding agents; a more specific `AGENTS.md` in a subdirectory overrides it for that subtree.

**Source of truth:** develop and deploy only from `C:\02_APPS\ATLAS_DASH`. Do not use `C:\02_APPS\TABS` unless the user explicitly asks.

Follow instructions in this order:

1. The user's current request and explicit approvals.
2. The active canonical plan, specification, or handoff named by the user.
3. This file.
4. Existing repository conventions.

Do not revive requirements from deleted or superseded plans. If current code and a named source of truth disagree, inspect branch history and ask only when the intended behavior cannot be determined safely.

## Required start-up checks

Before editing:

1. Run `git status --short` and inspect relevant diffs. This repository may contain substantial user WIP.
2. Read the named plan, spec, handoff, and progress tracker before implementation.
3. Read every file you intend to change and search all references to affected symbols, selectors, commands, persisted keys, and types.
4. Identify which runtime is in scope: browser/Vite, Tauri desktop, deployed web, Node service, or more than one.
5. Confirm the acceptance criteria and verification commands for the active scope.

Use `rg` and `rg --files` for repository searches. Do not infer system behavior from a single component.

## Product and deploy identity

| Item | Value |
|------|--------|
| Local workspace | `C:\02_APPS\ATLAS_DASH` |
| GitHub remote (target) | `brandpreneuragency/ATLAS_DASH` |
| Public host | `https://atlasdash.brandpreneur.net` |
| VPS clone | `/home/admin/atlas_dash/app` |
| Compose project | `atlas_dash` |
| Containers | `atlas_dash_caddy`, `atlas_dash_api` |
| Env file (VPS only) | `deploy/.env` (`ATLAS_DASH_*` + `HERMES_*` keys) |
| Deploy skill | `.grok/skills/atlas-dash-vps-deploy` / `/atlas-dash-vps-deploy` |
| Deploy doc | `docs/ATLAS_DASH_DEPLOY.md` |

The historical program **TABS Web on VPS as Hermes Client** (phases 0–13) is complete. Its plans remain under `docs/` for evidence; do not re-open them for naming. Ongoing ops use the ATLAS_DASH paths above.

Legacy local folder `C:\02_APPS\TABS` is out of scope unless the user explicitly names it. Never delete it without explicit "Approve".

## Repository map

- `src/components/<area>/`: React feature and shared UI components.
- `src/stores/`: Zustand state and persisted application state.
- `src/services/`: runtime adapters, persistence, AI providers, filesystem access, search, and external integrations.
- `src/hooks/`: shared React behavior.
- `src/types/`: cross-feature TypeScript contracts.
- `src/i18n/`: English and Turkish UI strings.
- `src/styles/` and feature CSS files: tokens, shell layout, and scoped feature styles.
- `src-tauri/src/`: Rust desktop commands, AI tools, tray, and terminal backend.
- `src-tauri/capabilities/`: Tauri permission scopes.
- `server/`: deployed Node service when introduced by the active plan.
- `deploy/`: deployment assets when introduced by the active plan.
- `docs/`: plans, specifications, progress, and handoffs.

Generated or runtime data is not source: `node_modules/`, `dist/`, `src-tauri/target/`, and `src-tauri/TASKS/`.

## Runtime and architecture rules

ATLAS_DASH has multiple runtime paths. A browser preview is not proof that Tauri behavior works, and a local desktop build is not proof that the deployed web path works.

- Vite development uses port `1420` with a strict port setting.
- Keep runtime detection and runtime-specific behavior in service/adaptor layers. Reuse `src/services/runtime.ts`, `src/services/http.ts`, and the `FolderConnector` abstraction instead of importing Tauri APIs into feature UI.
- Browser-only features must degrade safely when native APIs are unavailable.
- Tauri command changes must stay aligned across Rust command registration, frontend invocation, and `src-tauri/capabilities/default.json` permissions.
- Preserve stable component identity for editors, chat, forms, and selections; avoid keys or conditional branches that remount stateful UI accidentally.
- Put shared state invariants in Zustand actions rather than duplicating them in event handlers. Use narrow selectors in large components.
- Follow existing Dexie patterns for persisted settings and provide deliberate migration/fallback behavior when keys change.

## Implementation conventions

### TypeScript and React

- Strict TypeScript is enabled. Do not hide errors with `any`, `@ts-ignore`, or broad casts.
- Prefer small, explicit types and pure helpers for logic that can be unit tested.
- Keep feature components in their existing area and shared primitives under `src/components/ui/`.
- Preserve accessibility: semantic controls, keyboard behavior, visible focus, accurate labels, and ARIA state where native semantics are insufficient.
- Add or update Vitest tests for non-trivial logic and regressions. Tests are colocated as `*.test.ts` or `*.test.tsx` under `src/`.
- When user-facing copy changes, update both `src/i18n/en.ts` and `src/i18n/tr.ts` unless the text is intentionally not localized.

### Styling

- Reuse tokens from `src/styles/tokens.css` and existing feature classes before adding new values.
- Keep structural styles in scoped feature CSS rather than large inline style objects; inline values are appropriate for truly dynamic geometry or CSS custom properties.
- Audit `min-width: 0`, `min-height: 0`, overflow ownership, and responsive behavior when changing nested layouts.
- Remove obsolete selectors when their final use is removed, but do not perform unrelated global CSS cleanup.

### Rust and Tauri

- Keep commands focused and return actionable errors without leaking sensitive data.
- Update capability scopes narrowly; never broaden filesystem, shell, or HTTP permissions merely to make a failing call pass.
- Run Rust formatting and compile checks when Rust or Tauri configuration changes.
- Distinguish the local debug executable from the installed application when diagnosing desktop behavior. Stop stale development processes before rebuilding a locked executable.

### Node service and deployment

- Follow the canonical plan for the `server/` and `deploy/` architecture; do not invent protocol fields or deployment topology.
- Server code is ESM (`.mjs`). Put testable logic in pure modules under `server/lib/`.
- Keep secrets in environment files that are ignored by Git. Never commit credentials, tokens, password hashes, or production `.env` files.

## Security and operations

- Never print API keys, access tokens, session tokens, password hashes, secure-storage values, or `.env` contents in commands, logs, tests, diffs, or chat.
- Do not modify reference-only Hermes sources. They are evidence for protocol discovery, not part of this repository.
- For the current VPS plan, use non-interactive SSH exactly as documented in the canonical plan.
- Keep `atlas_dash_api` bound to loopback. Never expose ports `4010`, `9119`, or `8642` publicly.
- Preserve the existing Atlas and Wagner Atelier sites when changing Caddy or deployment assets.
- Recreating or changing the Hermes container for the session token requires the user's exact in-session approval specified by the phase. Prior approval for a different destructive step does not transfer.
- Before any destructive operation, verify the target, capture the required evidence, and confirm that the active phase explicitly authorizes it. Stop on unexpected infrastructure state.

## Scope and repository safety

- Make the smallest coherent change that satisfies the active request.
- Preserve unrelated modifications and untracked files. If user WIP overlaps a target file, patch around it and call out any unavoidable conflict.
- Do not add or upgrade dependencies unless the task requires it and no existing dependency or platform API fits.
- Do not create worktrees, delegate work, or broaden the phase unless explicitly requested.
- Do not commit or push unless the user request or an active, user-approved phase explicitly requires it.
- Never run destructive Git commands such as `git reset --hard`, `git clean -fd`, bulk `git restore`, or force-push without explicit user authorization.
- Do not weaken TypeScript, ESLint, tests, Tauri capabilities, authentication, or filesystem guards to make a check pass.

## Verification

Use the narrowest checks during iteration, then run the full gate required by the scope.

Frontend/full code gate:

```powershell
npm run check
```

This runs typecheck, lint, Vitest, and the production build. If `server/` changed, also run its tests as specified by the active plan (normally `cd server; npm test`).

For Rust or Tauri changes, additionally run from `src-tauri/` as appropriate:

```powershell
cargo fmt --check
cargo check
```

Run `cargo test` when Rust behavior has unit coverage. Use `npm run tauri:build` only when packaging is part of the acceptance criteria; it is heavier than a compile check.

Documentation-only changes do not require the full build gate. Inspect the rendered structure, links, and `git diff --check` instead.

Manual verification must name the runtime and path tested. Report browser preview, local Tauri debug, installed desktop, and deployed web checks separately. Never claim a command or flow passed unless it was actually run.

## Handoff format

End implementation work with a concise factual report containing:

- Summary and files changed.
- Behavior implemented and compatibility/migration notes.
- Commands run and exact results.
- Manual checks, including the runtime used.
- Remaining risks, unverified paths, and the next phase when applicable.

Findings come before summaries on review tasks. Do not advance progress or mark completion until the stated pass gate is met.
