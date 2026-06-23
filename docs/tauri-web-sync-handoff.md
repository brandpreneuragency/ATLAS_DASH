# Handoff: Sync Tauri/Rust Backend with Web App

## Task
Update the Rust/Tauri desktop backend (`src-tauri/`) so it matches the latest web app (`src/`) expectations. The web app is the source of truth; the Tauri shell is behind.

## Status: Investigation complete, implementation NOT started.

---

## Key Findings — 3 Mismatches Found

### 1. 🔴 CRITICAL: secureStorage command name & signature mismatch

**Web app expects** (`src/services/secureStorage.ts` lines 127-156):
```ts
invoke('plugin://secure-storage', { command: 'get', key })
invoke('plugin://secure-storage', { command: 'set', key, value })
invoke('plugin://secure-storage', { command: 'delete', key })
```

**Tauri backend provides** (`src-tauri/src/commands/secrets.rs`):
```rust
secret_get(account: String) -> Result<Option<String>, String>
secret_set(account: String, value: String) -> Result<(), String>
secret_delete(account: String) -> Result<(), String>
```

**Problems:**
- Command name: web calls `plugin://secure-storage` with a `command` field; Tauri registers `secret_get`/`secret_set`/`secret_delete` as separate commands.
- Parameter name: web sends `key`; Tauri expects `account`.
- The `plugin://secure-storage` invoke style implies a plugin namespace that doesn't exist.

**Fix options (pick one):**
- **Option A (recommended):** Change the web app's `secureStorage.ts` to call the actual command names (`secret_get`, `secret_set`, `secret_delete`) with `{ account: key }`. This is the smaller change.
- **Option B:** Rename the Rust commands to match the `plugin://secure-storage` convention and add a `command` dispatcher. More work, no clear benefit.

**Impact if unfixed:** Every API key read/write in the desktop app fails silently. AI chat, provider config, and agent selection all break. This is the #1 blocker.

---

### 2. 🟡 MISSING: `search_web` Tauri command

**Web app expects** (`src/services/search.ts`):
```ts
invoke<SearchResult[]>('search_web', { query, exaKey, tavilyKey })
```

**Tauri backend:** No `search_web` command exists. The `invoke_handler!` in `lib.rs` only registers `test_notification`, `secret_get`, `secret_set`, `secret_delete`.

**Result:** Web search feature throws `"Web search requires the TABS desktop app."` — but even in the desktop app it fails because the command doesn't exist.

**Fix:** Add a `search_web` command in `src-tauri/src/commands/` that calls Tavily/Exa APIs. The `SearchResult` type is `{ title: string; url: string; snippet: string }` (`src/types/index.ts` line 215). The web app passes empty strings for keys currently (`useStreamingChat.ts` line 120: `invokeWebSearch(userText.trim(), '', '')`), so key plumbing also needs attention.

**Note:** The `http` plugin is already in `Cargo.toml` and capabilities allow `https://api.tavily.com/*` and `https://api.firecrawl.dev/*`, so the HTTP plumbing exists.

---

### 3. 🟡 AI streaming uses `fetch()` directly, not Tauri HTTP plugin

**Web app** (`src/services/ai/openai.ts`, `anthropic.ts`, `gemini.ts`): All use browser `fetch()` to call AI provider APIs directly.

**Tauri backend:** Has `tauri-plugin-http` with `unsafe-headers` feature and capabilities allowlisting the AI provider URLs. But the AI code never imports or uses `@tauri-apps/plugin-http`.

**Impact:** In the Tauri webview, `fetch()` to external APIs may work (Tauri 2 allows this by default) but bypasses the configured HTTP plugin. The `router.ts` comment says "Used by the dormant Tauri desktop build" — suggesting this was intended to route through Tauri but never was wired up.

**Fix (optional / lower priority):** Either confirm `fetch()` works in the Tauri webview for these endpoints (likely yes), or migrate AI calls to use `@tauri-apps/plugin-http` for consistency with the capability allowlist. The `tauri-plugin-http` `fetch` API is a drop-in replacement for browser `fetch`.

---

## What Already Works (No Changes Needed)

- ✅ **Folder connector** (`src/services/tauri-folder-connector.ts` ↔ `tauri-plugin-fs`/`tauri-plugin-dialog`): Fully wired and matches the `FolderConnector` interface.
- ✅ **File open via argv** (`src/App.tsx` lines 64-78 ↔ `lib.rs` lines 96-112): `tabs://open-file` event emission and frontend listener are aligned.
- ✅ **Tray icon** (`src-tauri/src/tray.rs`): Self-contained, no web dependency.
- ✅ **Global shortcut / single instance / notification**: Backend-only, no web contract.
- ✅ **Capabilities** (`src-tauri/capabilities/default.json`): FS, dialog, http, notification, global-shortcut permissions all present and correct.

---

## Recommended Implementation Order

1. **Fix secureStorage** (Finding #1) — highest impact, smallest change. Edit `src/services/secureStorage.ts` to call `secret_get`/`secret_set`/`secret_delete` with `{ account: key }`.
2. **Add `search_web` command** (Finding #2) — new file `src-tauri/src/commands/search.rs`, register in `lib.rs` `invoke_handler!`.
3. **Verify AI streaming** (Finding #3) — test in Tauri dev; only migrate to plugin-http if `fetch()` fails.

## Files to Edit

| File | Change |
|------|--------|
| `src/services/secureStorage.ts` | Change invoke calls to match Rust command names |
| `src-tauri/src/commands/search.rs` | **NEW** — `search_web` command |
| `src-tauri/src/commands/mod.rs` | Add `pub mod search;` |
| `src-tauri/src/lib.rs` | Register `search_web` in `invoke_handler!` |
| `src-tauri/Cargo.toml` | Add `reqwest` + `serde_json` (if not already) for search command |

## Key Context Files to Read

- `src-tauri/src/lib.rs` — plugin registration, command handler, setup
- `src-tauri/src/commands/secrets.rs` — existing secret command pattern to follow
- `src/services/secureStorage.ts` — web-side secure storage contract
- `src/services/search.ts` — web-side search contract
- `src/services/ai/router.ts` — AI routing (note: comment says "dormant Tauri build")
- `src-tauri/capabilities/default.json` — permission allowlists
- `src/types/index.ts` lines 215-227 — `SearchResult` and `SearchConfig` types

## Build & Test

- `npm run tauri:dev` — run desktop app in dev mode
- `npm run tauri:build` — production build
- Rust checks: `cargo check` in `src-tauri/`
- The web app runs at `http://localhost:5173/` and is the same frontend served by Tauri

## Notes

- The web app is the primary experience; Tauri is the desktop shell. Do not change web app behavior for browser users — all Tauri-specific code paths are guarded by `isTauri()` checks.
- `secureStorage.ts` has a working browser fallback (Web Crypto + localStorage), so only the Tauri path is broken.
- The `plan.md` in the root is about Model Management provider import — unrelated to this task.
