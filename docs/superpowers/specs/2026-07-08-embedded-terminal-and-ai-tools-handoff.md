# Handoff — Embedded Terminal + AI Tools (Phases 1–4)

**Date:** 2026-07-08
**Source spec:** `docs/superpowers/specs/2026-07-08-embedded-terminal-and-ai-tools-design.md`
**App:** TABS (Tauri v2 + React/TypeScript, Windows)

This handoff covers what is implemented and, critically, what is **missing or unverified** from the
work done so far. The next agent should treat the "Missing / unverified" section as the backlog.

---

## Status by phase

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Interactive terminal (PTY backend + UI) | Done (pre-existing before this session) |
| 2 | Tool-use streaming layer (`openai.ts`, `useAgentLoop`, `supportsTools`) | Done (pre-existing) |
| 3 | AI tools Rust commands (`ai_tools/` module + sandbox tests) | Implemented, **NOT compiled/verified** |
| 4 | AI tools UI wiring (schema, dispatch, permission control, bubbles, cap) | Implemented, **NOT type-checked/verified** |
| 5 | Polish + i18n (terminal settings section, doc updates) | Not started |

---

## What was implemented in this session

### Phase 3 — Rust `ai_tools/` module (`src-tauri/`)
- `src-tauri/Cargo.toml`: added `glob`, `grep-searcher`, `grep-regex`, `tempfile`.
- `src-tauri/src/ai_tools/mod.rs`, `sandbox.rs`, `shell.rs`, `fs_ops.rs`, `search.rs`:
  - `ai_shell_exec`, `ai_file_read`, `ai_file_write`, `ai_file_edit`, `ai_glob`, `ai_grep`.
  - `resolve_in_workspace` sandbox (canonicalizes nearest existing ancestor, rejects escapes,
    handles not-yet-existing write targets and missing-drive absolute paths → `PathOutsideWorkspace`).
  - Unit tests for the sandbox resolver (7 tests).
- `src-tauri/src/lib.rs`: `mod ai_tools;` + registered all 6 commands in `invoke_handler!`.
- `src-tauri/src/commands/mod.rs`: `pub use crate::ai_tools;`.

### Phase 4 — Frontend wiring
- `src/types/index.ts`: `ChatMessage.role` now includes `'tool_call' | 'system'`; added
  `ToolCallPayload`; `ChatThreadMeta.permissionMode?`.
- `src/services/ai/types.ts`: AI `ChatMessage` now includes `'tool'` role + `tool_call_id`
  (fixes a latent Phase 2 type error in `useAgentLoop`).
- `src/services/aiTools.ts` (NEW): `AI_TOOLS` schema, `dispatchToolCall` (Ask & Approve via
  approval-gate registry + Bypass), `getWorkspaceRoot()`, `registerApproval`/`resolveApproval`,
  result summarizers.
- `src/stores/chatStore.ts`: `setPermissionMode` action; new threads default `permissionMode: 'ask'`.
- `src/hooks/useStreamingChat.ts`: when active model `supportsTools` and a folder is connected,
  runs `useAgentLoop` with the dispatcher; renders pending (ask) / completed (bypass) bubbles;
  surfaces the 25-iteration cap as a `[agent-loop-cap-reached]` system message.
- `src/components/sidebar/ToolCallBubble.tsx` + `toolCallBubble.css` (NEW): tool-call card with
  Approve/Reject + collapsible JSON args.
- `src/components/sidebar/ChatThread.tsx`: routes `role: 'tool_call'` → `ToolCallBubble`.
- `src/components/sidebar/ChatInput.tsx`: `Ask & Approve` / `Bypass` segmented control
  (disabled + tooltip when model lacks `supportsTools`).
- `src/i18n/en.ts` + `src/i18n/tr.ts`: `chat.tools.*` strings.

---

## MISSING / UNVERIFIED — what the next agent must do

### 1. Compile & type-check (BLOCKING — nothing is verified)
- **Rust:** `cd src-tauri && cargo check` (and `cargo test ai_tools` for the sandbox unit tests).
  - Risk areas: `grep-searcher`/`grep-regex` 0.1 API usage in `search.rs` (the `UTF8` sink closure
    captures `tx` which is moved into the closure consumed by `search_path` — verify no
    use-after-move; the `drop(tx)` was already removed). `tempfile::Builder::new().prefix(...).tempfile_in(...).persist(...)` API in `fs_ops.rs`. `taskkill /T /F` in `shell.rs` (Windows-only, behind `#[cfg(windows)]`).
  - The `commands/mod.rs` uses `pub use crate::ai_tools;` — confirm the path `commands::ai_tools::shell::ai_shell_exec` resolves in `lib.rs`.
- **Frontend:** `npx tsc --noEmit` from repo root.
  - Risk areas: `useStreamingChat.ts` agent-loop branch (closure capture of `addPendingBubble`/
    `updateBubble`; `AppChatMessage['toolCall']` cast; `shortId()` used for cap message id).
  - `useAgentLoop.ts` `ToolDispatcher` type vs the wrapper passed in `useStreamingChat.ts`.
  - `ChatThread.tsx` now imports `ToolCallBubble` + `resolveApproval` — confirm no circular import.
  - `ChatInput.tsx` `PermissionModeControl` uses inline styles (the file already triggers the
    "CSS inline styles" lint rule ~30 times; this is pre-existing, not a new blocker, but the
    project lint may fail CI — consider moving to a CSS file later).

### 2. `system` role rendering (Phase 4 gap)
- The agent-loop cap message is added as `role: 'system'` with content `[agent-loop-cap-reached]`.
  `ChatThread.tsx` falls through to `AssistantMessage` for any non-user/non-tool_call role, so it
  renders as a plain assistant bubble. **Decide:** either style system messages distinctly, or
  change the cap indicator to a `tool_call`/assistant variant. Not a crash, but a UX gap.

### 3. Task-mode tools (Phase 4 gap)
- The agent loop is only wired into the **non-task** (`writer`/`settings`) path in
  `useStreamingChat.ts`. The `isTaskMode && contextTaskId` branch still uses the plain
  `streamChat` (no tools). If tools are wanted in task mode, replicate the agent-loop branch
  there (it needs the same `aiMessages` build from task context).

### 4. `supportsTools` default semantics
- `ModelItem.supportsTools` defaults to `true` when unset (per spec). The composer control is
  disabled only when explicitly `false`. Confirm the model editor checkbox (`ProviderModelsTab`)
  persists `false` correctly — it reads `model.supportsTools ?? true`, so an explicit `false`
  should disable the control. Verify end-to-end.

### 5. No-folder-connected behavior
- `toolsEnabled` is false when `getWorkspaceRoot()` is null, so the chat silently falls back to
  normal streaming. The spec says the frontend should "error with a chat message before making
  the invoke call." Currently the error only fires inside `dispatchToolCall` if somehow invoked.
  Consider surfacing a hint in the composer when tools are off due to no connected folder.

### 6. Phase 5 — Polish + i18n (NOT STARTED)
- Terminal settings section: default shell, default CWD, env-var stripping (spec §5/§9 Phase 5).
- Verify ALL new user-facing strings are present in both `en.ts` and `tr.ts` (done for
  `chat.tools.*`, but terminal strings from Phase 1 may still be missing — check `terminalStore`
  / `TerminalPanel` for hardcoded text that bypasses i18n; AGENTS.md requires all UI text via i18n).
- Documentation update if any user-facing docs exist (`docs/` has several guides).

### 7. Manual test plan (spec §10) — run before declaring done
- Terminal: spawn, type, resize (PTY resize), paste multi-line, `cargo build` (no IPC saturation),
  close tab (kills PTY), kill process from Task Manager (`terminal://exit` fires).
- Sandbox: `resolve_in_workspace` unit tests (escape attempts, symlinks, canonical descendants).
- Tool loop: ask model to read/edit/run; verify Ask & Approve blocks, Bypass runs; verify 25-cap.

---

## Key file map (for the next agent)
- Rust backend: `src-tauri/src/ai_tools/*`, `src-tauri/src/terminal/*`, `src-tauri/src/lib.rs`,
  `src-tauri/src/commands/mod.rs`, `src-tauri/Cargo.toml`.
- Frontend tools: `src/services/aiTools.ts`, `src/hooks/useAgentLoop.ts`,
  `src/hooks/useStreamingChat.ts`, `src/stores/chatStore.ts`, `src/types/index.ts`,
  `src/services/ai/types.ts`, `src/services/ai/openai.ts`.
- UI: `src/components/sidebar/ToolCallBubble.tsx` (+`.css`), `ChatThread.tsx`, `ChatInput.tsx`.
- i18n: `src/i18n/en.ts`, `src/i18n/tr.ts`.

## First action for next agent
Run `npx tsc --noEmit` and `cd src-tauri && cargo check`, then fix any errors before touching
feature code. Most likely there are 1–3 type errors in the Phase 4 wiring that were not caught
because no compiler was available in the previous session.
