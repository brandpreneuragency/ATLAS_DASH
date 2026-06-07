// Task AI store. Server-backed as of Agent 6 (Frontend AI Migration).
//
// The store is now a thin client for the apply / undo / history endpoints
// exposed by the server. All task / comment mutations happen server-side
// inside a Prisma `$transaction`; the client only:
//
//   1. Pre-flights the draft on the client (stale detection + validation
//      errors) so the UI can show a friendly message without an extra
//      round-trip.
//   2. Calls `aiRepository.applyTaskDraft(messageId, ...)` and, on
//      success, refreshes the local task / comment caches.
//   3. Calls `aiRepository.undoTaskBatch(batchId)` and refreshes again.
//
// The local `historyByTask` cache mirrors the server's
// `/api/tasks/:taskId/ai-history` response. The server already enforces the
// 7-day retention window (Agent 6 backend), so `purgeExpired` is no longer
// needed in the client.

import { create } from 'zustand';
import type { Task, TaskAIChangeBatch, TaskAIDraft } from '../types';
import { ApiError } from '../services/apiClient';
import { aiRepository } from '../repositories/aiRepository';
import { useTaskStore } from './taskStore';
import { useTaskCommentStore } from './taskCommentStore';

export interface ApplyResult {
  batch: TaskAIChangeBatch | null;
  error?: string;
  /** Server-detected stale task ids. Surfaced so the UI can show "stale,
    *  regenerate" hints. */
  staleTaskIds?: string[];
}

interface TaskAIStore {
  historyByTask: Record<string, TaskAIChangeBatch[]>;
  loadHistory: (taskId: string) => Promise<void>;
  getHistory: (taskId: string) => TaskAIChangeBatch[];
  applyDraft: (messageId: string, draft: TaskAIDraft) => Promise<ApplyResult>;
  undoBatch: (batchId: string) => Promise<void>;
}

/** Detect which task ids have changed since the draft was generated. Mirrors
 *  the server-side check so the client can short-circuit before the request. */
function detectStaleTaskIds(draft: TaskAIDraft, tasks: Task[]): string[] {
  const stale: string[] = [];
  for (const [taskId, updatedAt] of Object.entries(draft.baselineUpdatedAt)) {
    const current = tasks.find((task) => task.id === taskId);
    if (current && current.updatedAt !== updatedAt) {
      stale.push(taskId);
    }
  }
  return stale;
}

export const useTaskAIStore = create<TaskAIStore>((set, get) => ({
  historyByTask: {},

  loadHistory: async (taskId) => {
    try {
      const { history } = await aiRepository.getTaskAiHistory(taskId);
      set((state) => ({
        historyByTask: { ...state.historyByTask, [taskId]: history.filter((b) => !b.undoneAt) },
      }));
    } catch (err) {
      // History is best-effort. A failure here shouldn't blow up the UI.
      if (!(err instanceof ApiError && err.isUnauthorized)) {
        set((state) => ({ historyByTask: { ...state.historyByTask, [taskId]: [] } }));
      }
    }
  },

  getHistory: (taskId) => get().historyByTask[taskId] ?? [],

  applyDraft: async (messageId, draft) => {
    // Client-side pre-flight. The server also enforces this, but failing
    // fast gives a better UX and avoids burning an HTTP round-trip.
    const tasks = useTaskStore.getState().tasks;
    const staleTaskIds = detectStaleTaskIds(draft, tasks);
    if (staleTaskIds.length > 0) {
      return {
        batch: null,
        staleTaskIds,
        error:
          'Task data changed since this draft was generated. Please regenerate the draft before applying.',
      };
    }
    if (draft.validation.errors.length > 0) {
      return {
        batch: null,
        error: 'This draft has validation errors and cannot be applied.',
      };
    }

    try {
      const { batch } = await aiRepository.applyTaskDraft(messageId, {
        messageId,
        baselineUpdatedAt: draft.baselineUpdatedAt,
        summary: draft.summary,
        operations: draft.operations,
      });

      // Refresh local task + comment caches from the server so the
      // optimistic-looking local update is consistent with what's actually
      // persisted.
      await useTaskStore.getState().loadTasks();
      await useTaskCommentStore.getState().loadComments(draft.taskId);
      await get().loadHistory(draft.taskId);

      return { batch };
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.code === 'stale_task') {
        // Server says stale. Extract the stale task ids from the issues
        // payload so the UI can highlight them.
        const issues = (err.issues ?? {}) as { staleTaskIds?: string[] };
        return {
          batch: null,
          staleTaskIds: issues.staleTaskIds ?? [],
          error: err.message,
        };
      }
      const message = err instanceof Error ? err.message : 'Failed to apply draft.';
      return { batch: null, error: message };
    }
  },

  undoBatch: async (batchId) => {
    try {
      await aiRepository.undoTaskBatch(batchId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Undo failed.';
      throw new Error(message);
    }
    // The server is the source of truth. Refresh tasks and the affected
    // task's comments + history.
    const allBatches = Object.values(get().historyByTask).flat();
    const batch = allBatches.find((b) => b.id === batchId);
    await useTaskStore.getState().loadTasks();
    if (batch) {
      await useTaskCommentStore.getState().loadComments(batch.taskId);
      await get().loadHistory(batch.taskId);
    } else {
      // The batch isn't cached locally yet. We don't know which task it
      // touched, so just refresh tasks; the next history load will hydrate
      // the cache for whatever task the user opens.
      await useTaskStore.getState().loadTasks();
    }
  },
}));
