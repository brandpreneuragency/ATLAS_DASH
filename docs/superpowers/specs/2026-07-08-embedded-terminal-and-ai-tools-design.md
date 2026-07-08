# Embedded Terminal + AI Tools Integration

**Date:** 2026-07-08
**Status:** Approved for implementation

## Overview

Add a VS Code-style embedded terminal panel to TABS and expose a Claude Code-parity
tool surface (`shell_exec`, `file_read`, `file_write`, `file_edit`, `glob`, `grep`) to
the AI sidebar. The AI can invoke these tools mid-conversation with either per-call
user approval (**Ask & Approve**) or unattended execution (**Bypass**), toggled per
thread.

Two independent consumers share one Rust backend:

- **Terminal (interactive)** — PTY-backed shell tabs the user types into.
- **AI tools (programmatic)** — one-shot subprocess + filesystem primitives the AI calls
  via OpenAI-compatible function calling. Both are Tauri commands living under
  `src-tauri/src/` and both go through a shared workspace-root resolver.

## Goals

- Real, VS Code-parity terminal: ANSI color, cursor control, interactive prompts,
  resize handling.
- Multiple named terminal tabs, toggled with `Ctrl+J`.
- AI sidebar gains the same core tool surface as Claude Code, sandboxed to the active
  workspace folder.
- Unified tool-use pipeline across all providers (OpenAI, OpenRouter, Nvidia NIM,
  OpenCode Go) via the OpenAI `tools` + `tool_calls` schema.
- Persist tab list + panel state, not PTY session content, across restarts.

## Non-goals

- Restoring PTY output history across app restarts.
- Sandboxing the interactive terminal (this is the user's machine; the terminal has
  the same power `cmd.exe` normally does).
- Custom tool authoring by the user.
- Streaming AI tool results into an open terminal tab.

## Architecture

```
┌─ React UI (xterm.js) ─────────── src/components/terminal/
│    TerminalPanel · TerminalTabs · TerminalInstance · terminalStore
│    ⇅ Tauri IPC (invoke + event channel)
├─ Rust PTY manager ────────────── src-tauri/src/terminal/
│    PtySession (portable-pty) · TerminalRegistry (HashMap<id, session>)
├─ AI tool layer ───────────────── src-tauri/src/ai_tools/
│    shell_exec · file_read · file_write · file_edit · glob · grep
│    (all workspace-root sandboxed)
└─ Chat integration ────────────── src/services/aiTools.ts + services/ai/openai.ts
     Tool schema · streaming tool_calls parser · agent loop · approval UI
```

## 1. Terminal panel UI

- **Placement**: bottom panel spanning full width, below `#main-columns` in
  `AppLayout.tsx`. Resizable via a top-edge drag handle. Height persisted in
  `uiStore` as `terminalPanelHeight`, default `240px`, clamped to
  `[120px, window.innerHeight * 0.7]`.
- **Toggle**: `Ctrl+J` handler added to the existing `useEffect` in `App.tsx`. Also a
  toggle button in `Header.tsx` next to the file explorer toggle.
- **Tabs strip** across the top of the panel:
  `[+] [Terminal 1 ×] [Terminal 2 ×] …`. Click switches, `×` closes (kills PTY), double-click
  renames.
- **xterm.js instance per tab** kept mounted (hidden via `display: none`, not
  unmounted) so scrollback and cursor state survive tab switches.
- **Theme**: an xterm.js theme object derived from computed CSS custom properties
  (`--c-background-1`, `--c-text-1`, `--c-accent-*`). Re-derived when `themeStore`
  changes.
- **Keyboard**: `Ctrl+C` / `Ctrl+V` copy/paste; `Ctrl+Shift+C` copies (fallback);
  `Ctrl+PageUp/PageDown` cycles tabs.

## 2. Rust PTY backend

- New crate deps in `src-tauri/Cargo.toml`: `portable-pty = "0.8"`, `base64 = "0.22"`.
- New module `src-tauri/src/terminal/`:
  - `mod.rs` — public API + `TerminalRegistry`.
  - `session.rs` — `PtySession` owning `Box<dyn MasterPty>`, `Box<dyn Child>`, writer
    handle, reader thread join handle.
  - `registry.rs` — `Mutex<HashMap<String, PtySession>>` kept in Tauri managed state.
- New commands module `src-tauri/src/commands/terminal.rs`:
  - `terminal_create(id: String, cwd: Option<String>, shell: Option<String>) -> Result<(), String>`
    — spawns `cmd.exe` (default on Windows) inside a PTY with the given cwd; falls
    back to `%USERPROFILE%` if `cwd` is `None` or empty.
  - `terminal_write(id: String, data: String) -> Result<(), String>` — writes UTF-8
    bytes to the PTY master's stdin.
  - `terminal_resize(id: String, cols: u16, rows: u16) -> Result<(), String>` —
    calls `MasterPty::resize` with the new size.
  - `terminal_kill(id: String) -> Result<(), String>` — kills the child, joins the
    reader thread, drops the master, removes from registry.
  - `terminal_list() -> Result<Vec<TerminalSummary>, String>` — for state hydration.
  - `home_dir() -> Result<String, String>` — returns `%USERPROFILE%` for the default
    cwd.
- **Reader thread**: bounded read from the PTY master (4 KiB buffer), base64-encodes
  raw bytes (to safely traverse the JSON IPC channel including invalid UTF-8), emits
  `terminal://output` with `{ id, data }`. On EOF or read error emits
  `terminal://exit` with `{ id, exit_code }` and exits.
- **Backpressure**: the reader emits at most 60 times per second (coalesces reads
  inside a 16 ms window) to avoid saturating the IPC channel during high-output
  commands like `cargo build`.

## 3. Tool-use pipeline (OpenAI-compatible)

Currently `src/services/ai/openai.ts` streams text-only completions. Add the following:

**Request side (`openai.ts`):**
- New optional parameters: `tools: OpenAITool[]`, `tool_choice: 'auto' | 'none'`.
- Include both in the POST body when non-empty. Do not add when tools are unused (keeps
  requests identical to today for text-only usage).

**Streaming delta parser:**
- Handle `delta.tool_calls[]` alongside `delta.content`. Each delta contains an `index`
  identifying the call and one or more of `{ id, function.name, function.arguments }`
  (arguments arrive as string fragments to concatenate). Accumulate by index into a
  `{ id, name, arguments: string }` map.
- On `finish_reason: 'tool_calls'`, `JSON.parse` each accumulated `arguments` string and
  yield `{ kind: 'tool_call_ready', calls: [{id,name,args}] }`.
- Yield `{ kind: 'tool_call_delta', index, argumentsChunk }` on each fragment so the UI
  can render partial arguments live.

**Agent loop (`src/hooks/useAgentLoop.ts` — new):**
1. Stream assistant message. Collect content + any tool calls.
2. If any tool calls arrived: for each call, dispatch through `services/aiTools.ts`.
   - **Ask & Approve**: insert a pending `tool_call` bubble in chat with
     `[Approve] [Reject]` buttons. Wait for user click. Reject → return
     `{ error: 'user_rejected' }` as the tool result. Approve → execute.
   - **Bypass**: execute immediately. Render the tool call as a completed bubble.
3. Append tool results to the message history as `role: 'tool'` messages
   (OpenAI format: `{ role: 'tool', tool_call_id, content }`).
4. Re-stream with the appended messages. Loop.
5. Terminate when the assistant returns `finish_reason: 'stop'`.
6. **Iteration cap**: 25. If exceeded, insert a system message
   `[agent-loop-cap-reached]` and stop. Prevents runaway agents.

**Per-model support**: extend `AIProviderConfig.models[]` with `supportsTools?: boolean`
(default `true`). Add a checkbox in the model editor. If the active model has
`supportsTools: false`, disable the Ask&Approve/Bypass composer switch with tooltip.

## 4. AI tool commands (Rust)

New module `src-tauri/src/ai_tools/` with the following commands. All take a
`workspace_root: String` parameter — the frontend passes
`fileSystemStore.getState().connectedFolders[activeFolderId].path`. If no folder is
connected, the frontend errors with a chat message before making the invoke call.

**Sandbox helper** (`ai_tools/sandbox.rs`):
```rust
fn resolve_in_workspace(root: &Path, requested: &str) -> Result<PathBuf, String>
```
- Interprets `requested` as workspace-relative unless it starts with `/` or a drive
  letter (in which case: strip leading `/`, join to root).
- Canonicalises the resolved path.
- Rejects if the canonical path is not a descendant of `root.canonicalize()?`
  (`PathOutsideWorkspace`).

**Commands:**

| Command | Params | Returns |
|---------|--------|---------|
| `ai_shell_exec` | `{ workspace_root, cmd, timeout_ms? }` | `{ stdout, stderr, exit_code, timed_out }` |
| `ai_file_read` | `{ workspace_root, path, offset?, limit? }` | `{ content: string, line_count: number }` — `cat -n`-style line numbering |
| `ai_file_write` | `{ workspace_root, path, content }` | `{ bytes_written }` — creates parents, atomic write via tempfile+rename |
| `ai_file_edit` | `{ workspace_root, path, old, new, replace_all? }` | `{ replacements }` — errors if `old` not unique and `replace_all=false` |
| `ai_glob` | `{ workspace_root, pattern, path? }` | `string[]` (workspace-relative) |
| `ai_grep` | `{ workspace_root, pattern, path?, glob?, case_insensitive? }` | `Array<{ path, line, text }>` |

`ai_shell_exec` uses `std::process::Command` with `cwd = workspace_root`, `cmd.exe /C
<cmd>` on Windows. Default `timeout_ms` = 60_000; the command is killed on timeout and
`timed_out: true` is returned. Not a PTY — deterministic captured output for the
model.

`ai_glob` uses the `glob` crate. `ai_grep` uses `grep-searcher` + `grep-regex`. Add
these to `Cargo.toml`.

## 5. Permission mode UI

- `chatStore.threads[id].permissionMode: 'ask' | 'bypass'`, default `'ask'`, persisted
  per thread (Dexie migration on read: default missing to `'ask'`).
- Segmented control added to `ChatInput.tsx` composer row:
  `[🛡 Ask & Approve] [⚡ Bypass]`. State-persisted per thread.
- Tool-call bubbles in the message list:
  - **Ask mode, pending**: shows tool name, formatted arguments (JSON prettified with
    max 6 lines shown, "show more" for full), `[Approve] [Reject]` buttons. Assistant
    stream is paused (spinner replaced with "awaiting approval").
  - **Ask mode, approved**: same card, buttons replaced with duration + summary of
    the result (e.g. "42 files matched", exit code, first 3 lines of stdout).
  - **Bypass**: card renders as completed from the start.
- The tool-call bubble is a new `ChatBubble` variant handled by the existing bubble
  renderer in the sidebar; message type discriminator: `role: 'tool_call'` (frontend
  synthetic, distinct from OpenAI's `role: 'tool'` for results).

## 6. State & persistence

- **New store** `src/stores/terminalStore.ts` (Zustand, persisted via Dexie like the
  other stores):
  - `terminals: { id: string, name: string, cwd: string, shell: string }[]`
  - `activeTerminalId: string | null`
  - Actions: `createTerminal`, `renameTerminal(id, name)`, `closeTerminal(id)`,
    `setActiveTerminal(id)`, `setCwd(id, cwd)`.
- **PTY sessions are NOT restored** across restarts. On app start the tab entries are
  loaded but each xterm.js instance starts fresh; the user hits Enter or types
  anything to spawn the underlying PTY (lazy start). This is simpler than trying to
  restore process state.
- `uiStore` additions: `terminalPanelOpen: boolean` (default `false`),
  `terminalPanelHeight: number` (default `240`).

## 7. Security posture

- Interactive terminal is intentionally unrestricted — same power as `cmd.exe`
  launched from Explorer. Not a sandbox.
- AI tool commands are workspace-root sandboxed in Rust as described in §4. Sandbox
  is enforced in Rust, not the frontend, so a compromised frontend can't escape it.
- Tauri capability additions: none required. The new commands are custom Tauri
  commands registered in `invoke_handler!`, which are allowed by the existing
  `core:default` capability.
- **AI shell exec**: same sandbox rules only for the cwd; the *command* itself
  can be anything (`rm -rf`, `curl | sh`, etc.). The Ask & Approve default is what
  keeps the user safe. Bypass mode is documented as "the AI can do anything to this
  workspace and beyond via shell commands — use only for trusted models".

## 8. Files touched

**New files:**
- `src-tauri/src/terminal/mod.rs`, `session.rs`, `registry.rs`
- `src-tauri/src/commands/terminal.rs`
- `src-tauri/src/ai_tools/mod.rs`, `shell.rs`, `fs_ops.rs`, `search.rs`, `sandbox.rs`
- `src/components/terminal/TerminalPanel.tsx`
- `src/components/terminal/TerminalTabs.tsx`
- `src/components/terminal/TerminalInstance.tsx`
- `src/components/terminal/terminal.css`
- `src/stores/terminalStore.ts`
- `src/services/aiTools.ts` (tool schema + dispatch)
- `src/hooks/useAgentLoop.ts`

**Modified files:**
- `src-tauri/Cargo.toml` — add `portable-pty`, `base64`, `glob`, `grep-searcher`,
  `grep-regex`, `tempfile`
- `src-tauri/src/lib.rs` — register handlers, manage `TerminalRegistry` state
- `src-tauri/src/commands/mod.rs` — add `terminal` submodule
- `src/components/layout/AppLayout.tsx` — mount `<TerminalPanel />` below
  `#main-columns`
- `src/App.tsx` — `Ctrl+J` handler
- `src/components/header/Header.tsx` — terminal toggle button
- `src/components/sidebar/ChatInput.tsx` — permission mode segmented control
- `src/services/ai/openai.ts` — tools + tool_calls streaming
- `src/services/ai/router.ts` — plumb tools option through
- `src/services/ai/types.ts` — new `StreamChunk` variants, `OpenAITool` type
- `src/stores/uiStore.ts` — `terminalPanelOpen`, `terminalPanelHeight`
- `src/stores/chatStore.ts` — `permissionMode` per thread
- `src/types/index.ts` — `AIProviderModel.supportsTools`
- `src/i18n/en.ts`, `src/i18n/tr.ts` — new strings

## 9. Implementation phases

Deliverable in phases so each phase is a coherent commit and testable in isolation.

**Phase 1 — Interactive terminal (backend + UI, no AI):**
- Rust PTY backend (§2) + Tauri commands
- `terminalStore` + UI components (§1)
- `Ctrl+J` toggle + header button
- Layout integration
- No AI tool changes yet. This alone gives the user a working VS Code-style terminal.

**Phase 2 — Tool-use pipeline (streaming layer, no UI yet):**
- Extend `openai.ts` to send `tools` and parse `tool_calls`
- New `StreamChunk` variants + `useAgentLoop` hook
- Per-model `supportsTools` flag
- No tools implemented yet; wired against a placeholder no-op tool to verify the
  parsing/loop end-to-end.

**Phase 3 — AI tools (Rust commands):**
- `ai_tools/` module with all 6 commands + sandbox helper
- Unit tests for the sandbox resolver (canonical descendant check, escape attempts)

**Phase 4 — AI tools UI wiring:**
- `services/aiTools.ts` (schema + dispatch)
- Permission mode segmented control in composer
- Tool-call bubble variant in the message list
- Ask & Approve interruption + Bypass execution
- 25-iteration cap surfaced as a system message

**Phase 5 — Polish + i18n:**
- Translations for all new strings (en + tr)
- Terminal settings section (default shell, default CWD, env var stripping)
- Documentation update if any user-facing docs exist

## 10. Testing

- **Terminal**: manual test — spawn, type, resize the window (verify PTY resize),
  paste multi-line, run `cargo build` (verify no IPC saturation), close a tab, kill
  the process from Task Manager (verify `terminal://exit` fires).
- **Sandbox**: Rust unit tests for `resolve_in_workspace` — reject `..\..\etc`,
  reject absolute paths outside root, accept nested descendants, canonicalise
  symlinks.
- **Tool-use loop**: manual test — ask the model to read a file, edit it, run a
  command; verify Ask & Approve blocks, Bypass runs; verify loop cap.

## 11. Open risks

- `portable-pty` on Windows uses ConPTY (Win10 1809+). All target machines are
  Win10+; this is fine.
- Some OpenAI-compatible providers ignore `tools` silently rather than erroring. If a
  user has `supportsTools: true` on a model that doesn't actually support tools, the
  model will just never emit a `tool_calls` delta. The composer switch will still
  appear active but the tools won't be called. This is acceptable — the user will
  notice quickly and can disable the flag.
- Nvidia NIM's OpenAI-compatible endpoint has partial `tools` support depending on
  the model; document this in the model config help text.
