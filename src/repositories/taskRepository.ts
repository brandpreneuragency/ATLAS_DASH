// Task repository. The only module (other than `apiClient`) that knows the
// shape and URLs of the task endpoints.
//
// Stores call these methods. React components call stores. Components do
// not import this file.
//
// Endpoints (see plan.md § "Task API" and server/src/routes/tasks.ts):
//
//   GET    /api/tasks?includeDeleted=true|false
//   POST   /api/tasks
//   PATCH  /api/tasks/:id
//   POST   /api/tasks/:id/soft-delete
//   POST   /api/tasks/:id/restore
//   DELETE /api/tasks/:id
//
// The server always overrides `ownerId`, `createdAt`, `updatedAt`, and
// `order` from `req.user.id` and `Date.now()` — those fields are NOT
// part of the input shapes defined here.

import type { Task, TaskImportance, TaskStatus } from '../types';
import { apiClient } from '../services/apiClient';

export interface TaskCreateInput {
  /** Client-generated nanoid(8). Server uses it as the primary key. */
  id: string;
  title: string;
  content?: string;
  status?: TaskStatus;
  importance?: TaskImportance;
  date?: string;
  projectId?: string | null;
  assignees?: string[];
  sourcePath?: string | null;
  parentId?: string | null;
  sourceChatMessageId?: string | null;
}

export type TaskUpdateInput = Partial<
  Pick<
    Task,
    | 'title'
    | 'content'
    | 'status'
    | 'importance'
    | 'date'
    | 'projectId'
    | 'assignees'
    | 'sourcePath'
    | 'parentId'
    | 'updatedAt'
  >
>;

export interface TaskListOptions {
  /** When true, soft-deleted tasks are included in the response. The server
   *  also runs a lazy hard-delete of tasks that have been in trash for more
   *  than 7 days before returning. */
  includeDeleted?: boolean;
  signal?: AbortSignal;
}

export const taskRepository = {
  list(opts: TaskListOptions = {}): Promise<{ tasks: Task[] }> {
    return apiClient.get<{ tasks: Task[] }>('/tasks', {
      query: { includeDeleted: opts.includeDeleted ?? false },
      signal: opts.signal,
    });
  },

  create(input: TaskCreateInput): Promise<{ task: Task }> {
    return apiClient.post<{ task: Task }>('/tasks', input);
  },

  update(id: string, updates: TaskUpdateInput): Promise<{ task: Task }> {
    return apiClient.patch<{ task: Task }>(`/tasks/${encodeURIComponent(id)}`, updates);
  },

  softDelete(id: string): Promise<{ task: Task }> {
    return apiClient.post<{ task: Task }>(`/tasks/${encodeURIComponent(id)}/soft-delete`);
  },

  restore(id: string): Promise<{ task: Task }> {
    return apiClient.post<{ task: Task }>(`/tasks/${encodeURIComponent(id)}/restore`);
  },

  permanentDelete(id: string): Promise<{ ok: true }> {
    return apiClient.delete<{ ok: true }>(`/tasks/${encodeURIComponent(id)}`);
  },
};
