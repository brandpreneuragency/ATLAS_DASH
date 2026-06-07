// Project repository. The only module (other than `apiClient`) that knows
// the shape and URLs of the project endpoints.
//
// Stores call these methods. React components call stores. Components do
// not import this file.
//
// Endpoints (see plan.md § "Task API" and server/src/routes/projects.ts):
//
//   GET    /api/projects       → list owner's projects (alphabetical)
//   POST   /api/projects       → create
//   PATCH  /api/projects/:id   → rename / recolor
//   DELETE /api/projects/:id   → hard-delete (tasks keep the row but lose
//                                their projectId via the FK)
//
// The server always overrides `ownerId` and `createdAt` from
// `req.user.id` / `Date.now()` — those fields are NOT part of the input
// shapes defined here.

import type { Project } from '../types';
import { apiClient } from '../services/apiClient';

export interface ProjectCreateInput {
  /** Client-generated nanoid(8). Server uses it as the primary key. */
  id: string;
  name: string;
  /** Free-form colour string. The client picks a Tailwind class name. */
  color: string;
}

export type ProjectUpdateInput = Partial<Pick<Project, 'name' | 'color'>>;

export const projectRepository = {
  list(signal?: AbortSignal): Promise<{ projects: Project[] }> {
    return apiClient.get<{ projects: Project[] }>('/projects', { signal });
  },

  create(input: ProjectCreateInput): Promise<{ project: Project }> {
    return apiClient.post<{ project: Project }>('/projects', input);
  },

  update(id: string, updates: ProjectUpdateInput): Promise<{ project: Project }> {
    return apiClient.patch<{ project: Project }>(`/projects/${encodeURIComponent(id)}`, updates);
  },

  remove(id: string): Promise<{ ok: true }> {
    return apiClient.delete<{ ok: true }>(`/projects/${encodeURIComponent(id)}`);
  },
};
