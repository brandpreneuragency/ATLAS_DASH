// Local-Dexie import repository. The only module (other than `apiClient`)
// that knows the shape and URL of the import endpoint.
//
// Stores call these methods. React components call stores. Components do
// not import this file.
//
// Endpoint (see plan.md § "Local Data Import" and server/src/routes/import.ts):
//
//   POST /api/import    → { report: ImportReport }
//
// The endpoint accepts a single payload that mirrors a Dexie export (one
// array per table) and idempotently upserts every row under the current
// user's `ownerId`. The browser never sees the on-disk `storagePath`; the
// server decodes any legacy `attachmentDataUrl` values, writes the bytes
// to disk under the standard `{root}/users/{ownerId}/{fileId}/...` layout,
// and links the resulting `File` row back to the comment / chat message
// via `fileId`.
//
// The local Dexie rows are NEVER deleted by this flow. The plan is
// explicit: "Do not auto-delete local data." The user can wipe Dexie
// manually if they want to (out of scope for v1).

import { apiClient } from '../services/apiClient';
import { db } from '../services/db';
import type {
  Agent,
  AIProviderConfig,
  AppSettings,
  ChatMessage,
  ChatThreadMeta,
  Document,
  Project,
  QuickPrompt,
  Task,
  TaskAIChangeBatch,
  TaskComment,
} from '../types';

// ── Public types ────────────────────────────────────────────────────────────

/**
 * Per-table counts read from the local Dexie store. Used to render the
 * "X projects, Y tasks, … found in local storage" preview and the
 * "Import local browser data" button label.
 */
export interface ImportPreview {
  projects: number;
  tasks: number;
  /** Number of `TaskComment` rows. */
  comments: number;
  /** Number of legacy `attachmentDataUrl` payloads across comments + chat
   *  messages. These get uploaded to the file service during import. */
  files: number;
  documents: number;
  chatThreads: number;
  chatMessages: number;
  agents: number;
  providerConfigs: number;
  quickPrompts: number;
  settings: number;
  taskAIChangeBatches: number;
}

/** True when any Dexie table has at least one row. */
export function previewHasData(p: ImportPreview): boolean {
  return (
    p.projects > 0 ||
    p.tasks > 0 ||
    p.comments > 0 ||
    p.files > 0 ||
    p.documents > 0 ||
    p.chatThreads > 0 ||
    p.chatMessages > 0 ||
    p.agents > 0 ||
    p.providerConfigs > 0 ||
    p.quickPrompts > 0 ||
    p.settings > 0 ||
    p.taskAIChangeBatches > 0
  );
}

/**
 * Per-table counters returned by the server. `imported` is the number of
 * new rows created; `skipped` is the number of rows whose primary key
 * already existed under the current user (idempotent re-runs); `failed`
 * is the number of rows that the server could not process (validation,
 * FK target missing, DB error). The import is best-effort: a `failed`
 * row never aborts the rest of the import.
 */
export interface ImportReport {
  projects: { imported: number; skipped: number; failed: number };
  tasks: { imported: number; skipped: number; failed: number };
  taskComments: { imported: number; skipped: number; failed: number };
  documents: { imported: number; skipped: number; failed: number };
  chatThreads: { imported: number; skipped: number; failed: number };
  chatMessages: { imported: number; skipped: number; failed: number };
  agents: { imported: number; skipped: number; failed: number };
  providerConfigs: { imported: number; skipped: number; failed: number };
  quickPrompts: { imported: number; skipped: number; failed: number };
  settings: { imported: number; skipped: number; failed: number };
  taskAIChangeBatches: { imported: number; skipped: number; failed: number };
  files: { uploaded: number; failed: number };
}

// ── Wire shape ─────────────────────────────────────────────────────────────
//
// The Dexie row shapes use TypeScript interfaces from `src/types`. The
// server's import schema uses its own Zod-derived types in
// `server/src/validation/schemas.ts`. The two are intentionally
// compatible — the legacy fields like `attachmentDataUrl`, `attachmentPath`,
// and `providerConfigs.apiKey` are accepted (and processed) by the server
// even though the wire types in the rest of the app no longer carry them.

interface ImportPayload {
  projects: Project[];
  tasks: Task[];
  taskComments: TaskComment[];
  documents: Document[];
  chatThreads: ChatThreadMeta[];
  chatMessages: ChatMessage[];
  agents: Agent[];
  providerConfigs: Array<Omit<AIProviderConfig, 'apiKey'> & { apiKey: '' }>;
  quickPrompts: QuickPrompt[];
  settings: Array<{ key: string; value: unknown }>;
  taskAIChangeBatches: TaskAIChangeBatch[];
}

// ── Repository ─────────────────────────────────────────────────────────────

export const importRepository = {
  /**
   * Read counts from the local Dexie store. Used to render the import
   * preview without a network round-trip. Runs all `count()` calls in
   * parallel so the call returns in O(1) round-trip latency.
   */
  async getLocalPreview(): Promise<ImportPreview> {
    const [
      projects,
      tasks,
      taskComments,
      documents,
      chatThreads,
      chatMessages,
      agents,
      providerConfigs,
      quickPrompts,
      settings,
      taskAIChangeBatches,
      // Legacy attachment count across comments + chat messages.
      commentsWithFiles,
      chatMessagesWithFiles,
    ] = await Promise.all([
      db.projects.count(),
      db.tasks.count(),
      db.taskComments.count(),
      db.documents.count(),
      db.chatThreads.count(),
      db.chatMessages.count(),
      db.agents.count(),
      db.providerConfigs.count(),
      db.quickPrompts.count(),
      db.settings.count(),
      db.taskAIChangeBatches.count(),
      db.taskComments.filter((c) => !!c.attachmentDataUrl).count(),
      db.chatMessages.filter((m) => (m.attachments ?? []).some((a) => 'dataUrl' in a)).count(),
    ]);
    return {
      projects,
      tasks,
      comments: taskComments,
      files: commentsWithFiles + chatMessagesWithFiles,
      documents,
      chatThreads,
      chatMessages,
      agents,
      providerConfigs,
      quickPrompts,
      settings,
      taskAIChangeBatches,
    };
  },

  /**
   * Serialise the local Dexie store into a single import payload and POST
   * it to the server. Returns the per-table report.
   *
   * The local Dexie rows are NOT deleted. The user can wipe them manually
   * if they want to (out of scope for v1). The server is idempotent — a
   * second invocation with the same payload is safe and just bumps the
   * `skipped` counters.
   */
  async importFromDexie(): Promise<ImportReport> {
    const [
      projects,
      tasks,
      taskComments,
      documents,
      chatThreads,
      chatMessages,
      agents,
      providerConfigs,
      quickPrompts,
      settings,
      taskAIChangeBatches,
    ] = await Promise.all([
      db.projects.toArray(),
      db.tasks.toArray(),
      db.taskComments.toArray(),
      db.documents.toArray(),
      db.chatThreads.toArray(),
      db.chatMessages.toArray(),
      db.agents.toArray(),
      db.providerConfigs.toArray(),
      db.quickPrompts.toArray(),
      db.settings.toArray(),
      db.taskAIChangeBatches.toArray(),
    ]);

    // Strip the API key from every provider config. The plan is explicit:
    // the user re-enters keys after import. Sending the raw key over the
    // wire just to discard it server-side would be a needless risk.
    const safeProviderConfigs: ImportPayload['providerConfigs'] = providerConfigs.map(
      ({ id, name, provider, selectedModel, isActive, baseUrl, customModels }) => ({
        id,
        name,
        provider,
        apiKey: '',
        selectedModel,
        isActive,
        baseUrl,
        customModels,
      }),
    );

    // Convert the AppSettings rows into the wire shape. The local store
    // typed `value` as `string | number | boolean`; the server's schema is
    // `unknown` and JSON-encodes whatever we send. We pass the value
    // through as-is.
    const settingsPayload: ImportPayload['settings'] = settings
      .map((row: AppSettings) => ({ key: row.key, value: row.value as unknown }))
      // Drop the well-known system flags that should not be re-imported.
      .filter((s) => !NON_IMPORTABLE_SETTING_KEYS.has(s.key));

    const payload: ImportPayload = {
      projects,
      tasks,
      taskComments,
      documents,
      chatThreads,
      chatMessages,
      agents,
      providerConfigs: safeProviderConfigs,
      quickPrompts,
      settings: settingsPayload,
      taskAIChangeBatches,
    };

    const { report } = await apiClient.post<{ report: ImportReport }>('/import', payload);
    return report;
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Settings keys that should not be carried over to the server. The
 * `secureStorageMigratedToKeychain` flag is Tauri-only state; the
 * `lastActiveDocumentId` / `lastActiveTaskId` / `taskMode` / `sidebarOpen`
 * / `sidebarWidth` / `fileExplorerOpen` / `fileExplorerWidth` /
 * `fileExplorerExpandedPaths` / `splitEditorWidth` / `taskListOpen` /
 * `editorFontSize` / `editorFontFamily` / `language` values are
 * client-side UI state. The server already has its own copies via the
 * `Settings` table where appropriate (active agent / active provider),
 * and the rest of the prefs are session-only and rebuilt from scratch
 * on every browser session.
 */
const NON_IMPORTABLE_SETTING_KEYS = new Set<string>([
  'secureStorageMigratedToKeychain',
  'lastActiveDocumentId',
  'lastActiveTaskId',
  'taskMode',
  'sidebarOpen',
  'sidebarWidth',
  'fileExplorerOpen',
  'fileExplorerWidth',
  'fileExplorerExpandedPaths',
  'splitEditorWidth',
  'taskListOpen',
  'editorFontSize',
  'editorFontFamily',
  'language',
]);
