// Task store. Server-backed as of Agent 5 (Frontend Task Migration).
//
// The store mirrors the server's `Task` table for the currently
// authenticated user. The previous Tauri disk-sync (markdown-on-disk
// TASKS/<ProjectName>/<taskId>/task.md and INDEX.md) is removed for the
// web build per the user's explicit direction: Tauri desktop support is
// dormant during this migration, and the server is the source of truth.
//
// Reads go through `taskRepository.list`; writes hit the corresponding
// REST endpoints and the local Zustand state is updated optimistically
// after a successful response.
//
// Session-only state: `openTaskIds` and `activeTaskId` are kept in memory
// (no Dexie `settings` round-trip) — on page refresh the user starts
// with a single tab open on the first task. This is a small UX change
// from the pre-migration behaviour. If it becomes a problem in v1.1, a
// per-user server settings row can back it; out of scope for Agent 5.

import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { Task, TaskStatus } from '../types';
import { taskRepository, type TaskUpdateInput } from '../repositories/taskRepository';
import { ApiError } from '../services/apiClient';
import { useUIStore } from './uiStore';

function showError(err: unknown, fallback: string): void {
  const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : fallback;
  useUIStore.getState().showToast(msg, 'error');
}

interface TaskStore {
  tasks: Task[];
  activeTaskId: string | null;
  openTaskIds: string[];
  isLoaded: boolean;

  loadTasks: () => Promise<void>;
  createTask: (title: string, opts?: Partial<Task>) => Promise<Task | null>;
  updateTask: (id: string, updates: TaskUpdateInput) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  restoreTask: (id: string) => Promise<void>;
  permanentlyDeleteTask: (id: string) => Promise<void>;
  setActiveTask: (id: string | null) => void;
  closeTaskTab: (id: string) => void;
  getActiveTask: () => Task | null;
  getTasksByProject: (projectId: string | null) => Task[];
  getTasksByStatus: (status: TaskStatus) => Task[];
  getSubtasks: (parentId: string) => Task[];
  getDeletedTasks: () => Task[];
  fetchDeletedTasks: () => Promise<Task[]>;
  getLastSubtaskDate: (parentId: string) => number | null;
  createSubtask: (parentId: string, title: string, sourceChatMessageId?: string) => Promise<Task | null>;
  /**
   * No-op on the web build. The Tauri desktop bundle used to regenerate
   * `INDEX.md` on disk after every mutation; the web build has no such
   * side effect. Kept in the store's public surface so the AI store
   * (Agent 6) does not have to be touched in Agent 5.
   */
  regenerateIndex: () => Promise<void>;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  activeTaskId: null,
  openTaskIds: [],
  isLoaded: false,

  loadTasks: async () => {
    try {
      const { tasks } = await taskRepository.list({ includeDeleted: false });
      const firstId = tasks[0]?.id ?? null;
      set((s) => {
        const activeId = s.activeTaskId && tasks.some((t) => t.id === s.activeTaskId)
          ? s.activeTaskId
          : firstId;
        const open = activeId && !s.openTaskIds.includes(activeId)
          ? [activeId, ...s.openTaskIds]
          : s.openTaskIds.filter((id) => tasks.some((t) => t.id === id));
        return { tasks, activeTaskId: activeId, openTaskIds: open, isLoaded: true };
      });
    } catch (err) {
      set({ isLoaded: true });
      showError(err, 'Failed to load tasks.');
    }
  },

  createTask: async (title, opts = {}) => {
    const trimmed = title.trim();
    if (!trimmed) return null;
    const id = nanoid(8);
    try {
      const { task } = await taskRepository.create({
        id,
        title: trimmed,
        content: opts.content ?? '',
        status: opts.status ?? 'pending',
        importance: opts.importance ?? 'medium',
        date: opts.date ?? todayIso(),
        projectId: opts.projectId ?? null,
        assignees: opts.assignees ?? [],
        sourcePath: opts.sourcePath ?? null,
        parentId: opts.parentId ?? null,
        sourceChatMessageId: opts.sourceChatMessageId ?? null,
      });
      set((s) => ({
        tasks: [...s.tasks, task],
        activeTaskId: task.id,
        openTaskIds: s.openTaskIds.includes(task.id) ? s.openTaskIds : [...s.openTaskIds, task.id],
      }));
      return task;
    } catch (err) {
      showError(err, 'Failed to create task.');
      return null;
    }
  },

  updateTask: async (id, updates) => {
    const previous = get().tasks.find((t) => t.id === id);
    // Optimistic local update with an `updatedAt` tick so the UI shows the
    // new "last modified" immediately. The server response overwrites
    // `updatedAt` with its own timestamp on success.
    const optimisticPatch = { ...updates, updatedAt: Date.now() } as Task;
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...optimisticPatch } : t)),
    }));
    try {
      const { task } = await taskRepository.update(id, updates);
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? task : t)),
      }));
    } catch (err) {
      if (previous) {
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? previous : t)),
        }));
      }
      showError(err, 'Failed to update task.');
    }
  },

  deleteTask: async (id) => {
    const previous = get().tasks;
    // Soft-delete locally: drop from the active list, pick a neighbour as
    // the new active task if necessary, close the tab. Matches the
    // previous Dexie behaviour.
    set((s) => {
      const remaining = s.tasks.filter((t) => t.id !== id);
      const stillOpen = s.openTaskIds.filter((tid) => tid !== id);
      let nextActive = s.activeTaskId;
      if (nextActive === id) {
        nextActive = stillOpen[stillOpen.length - 1] ?? null;
      }
      return {
        tasks: remaining,
        openTaskIds: stillOpen,
        activeTaskId: nextActive,
      };
    });
    useUIStore.getState().setActiveTaskId(get().activeTaskId);
    try {
      await taskRepository.softDelete(id);
    } catch (err) {
      set({ tasks: previous });
      showError(err, 'Failed to delete task.');
    }
  },

  restoreTask: async (id) => {
    try {
      await taskRepository.restore(id);
      // Re-fetch the active list so the restored task reappears with
      // the canonical server `order` and `updatedAt`.
      const { tasks } = await taskRepository.list({ includeDeleted: false });
      set((s) => {
        const open = s.openTaskIds.includes(id) ? s.openTaskIds : [...s.openTaskIds, id];
        return { tasks, activeTaskId: id, openTaskIds: open };
      });
      useUIStore.getState().setActiveTaskId(id);
    } catch (err) {
      showError(err, 'Failed to restore task.');
    }
  },

  permanentlyDeleteTask: async (id) => {
    const previous = get().tasks;
    set((s) => {
      const remaining = s.tasks.filter((t) => t.id !== id);
      const stillOpen = s.openTaskIds.filter((tid) => tid !== id);
      let nextActive = s.activeTaskId;
      if (nextActive === id) {
        nextActive = stillOpen[stillOpen.length - 1] ?? null;
      }
      return {
        tasks: remaining,
        openTaskIds: stillOpen,
        activeTaskId: nextActive,
      };
    });
    try {
      await taskRepository.permanentDelete(id);
    } catch (err) {
      set({ tasks: previous });
      showError(err, 'Failed to permanently delete task.');
    }
  },

  setActiveTask: (id) => {
    const openIds = get().openTaskIds;
    if (id) {
      useUIStore.getState().setActiveTaskId(id);
      if (!openIds.includes(id)) {
        set({ openTaskIds: [...openIds, id], activeTaskId: id });
      } else {
        set({ activeTaskId: id });
      }
    } else {
      set({ activeTaskId: null });
    }
  },

  closeTaskTab: (id) => {
    const openIds = get().openTaskIds.filter((tid) => tid !== id);
    let nextActive = get().activeTaskId;
    if (nextActive === id) {
      nextActive = openIds[openIds.length - 1] ?? null;
      useUIStore.getState().setActiveTaskId(nextActive);
    }
    set({ openTaskIds: openIds, activeTaskId: nextActive });
  },

  getActiveTask: () => {
    const { tasks, activeTaskId } = get();
    return tasks.find((t) => t.id === activeTaskId) ?? null;
  },

  getTasksByProject: (projectId) => {
    return get().tasks.filter((t) => t.projectId === projectId && !t.deletedAt);
  },

  getTasksByStatus: (status) => {
    return get().tasks.filter((t) => t.status === status && !t.deletedAt);
  },

  getSubtasks: (parentId) => get().tasks.filter((t) => t.parentId === parentId && !t.deletedAt),

  getDeletedTasks: () => {
    return [] as Task[]; // Sync placeholder — use fetchDeletedTasks() instead
  },

  fetchDeletedTasks: async (): Promise<Task[]> => {
    try {
      const { tasks } = await taskRepository.list({ includeDeleted: true });
      return tasks.filter((t) => Boolean(t.deletedAt));
    } catch (err) {
      showError(err, 'Failed to load deleted tasks.');
      return [];
    }
  },

  getLastSubtaskDate: (parentId) => {
    const subs = get().getSubtasks(parentId);
    if (subs.length === 0) return null;
    return Math.max(...subs.map((s) => s.createdAt));
  },

  createSubtask: async (parentId, title, sourceChatMessageId) => {
    const parent = get().tasks.find((t) => t.id === parentId);
    if (!parent) {
      showError(new Error('Parent task not found'), 'Parent task not found');
      return null;
    }
    const id = nanoid(8);
    try {
      const { task } = await taskRepository.create({
        id,
        title: title.trim(),
        content: '',
        status: 'in_progress',
        importance: 'medium',
        date: parent.date,
        projectId: parent.projectId,
        assignees: [],
        parentId,
        sourceChatMessageId: sourceChatMessageId ?? null,
      });
      set((s) => ({ tasks: [...s.tasks, task] }));
      return task;
    } catch (err) {
      showError(err, 'Failed to add subtask.');
      return null;
    }
  },

  regenerateIndex: async () => {
    // No-op on the web build. The Tauri desktop bundle used to write
    // INDEX.md to the local folder after every mutation; the server is
    // the source of truth here and there is no on-disk side effect to
    // regenerate. Kept in the public surface for the AI store's
    // `syncTouchedTasks` hook (Agent 6).
  },
}));
