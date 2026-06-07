// Document repository. The only module (other than `apiClient`) that knows
// the shape and URLs of the document endpoints.
//
// Stores call these methods. React components call stores. Components do
// not import this file.
//
// Endpoints (see server/src/routes/documents.ts):
//
//   GET    /api/documents
//   POST   /api/documents
//   PATCH  /api/documents/:id
//   DELETE /api/documents/:id
//
// All documents are owner-scoped (ownerId on every row). Cross-user access
// returns 404 (never 403).

import type { Document } from '../types';
import { apiClient } from '../services/apiClient';

export interface DocumentCreateInput {
  id: string;
  title?: string;
  content?: string;
  sourcePath?: string | null;
  order?: number;
}

export interface DocumentUpdateInput {
  title?: string;
  content?: string;
  sourcePath?: string | null;
  isDirty?: boolean;
  splitEditorOpen?: boolean;
  order?: number;
}

export const documentRepository = {
  list(signal?: AbortSignal): Promise<{ documents: Document[] }> {
    return apiClient.get<{ documents: Document[] }>('/documents', { signal });
  },

  create(input: DocumentCreateInput): Promise<{ document: Document }> {
    return apiClient.post<{ document: Document }>('/documents', input);
  },

  update(id: string, updates: DocumentUpdateInput): Promise<{ document: Document }> {
    return apiClient.patch<{ document: Document }>(
      `/documents/${encodeURIComponent(id)}`,
      updates,
    );
  },

  remove(id: string): Promise<{ ok: true }> {
    return apiClient.delete<{ ok: true }>(`/documents/${encodeURIComponent(id)}`);
  },
};
