// Task comment repository. The only module (other than `apiClient`) that
// knows the shape and URLs of the comment endpoints.
//
// Stores call these methods. React components call stores. Components do
// not import this file.
//
// Endpoints (see plan.md § "File Service Requirements" and
// server/src/routes/comments.ts):
//
//   GET    /api/tasks/:taskId/comments          → list comments
//   POST   /api/tasks/:taskId/comments          → create (text or multipart)
//   PATCH  /api/comments/:id                    → edit text
//   DELETE /api/comments/:id                    → delete
//
// The POST endpoint accepts two body shapes:
//   * application/json             — text + optional replyTo
//   * multipart/form-data          — text + optional file
// File uploads go through `createWithFile` (multipart). The server creates
// the `File` row and the `TaskComment` row in a single transaction. If the
// transaction fails after the bytes are moved to permanent storage, the
// server removes the bytes so we never leave a comment pointing at a
// missing file or a file pointing at a missing comment.

import type { TaskComment, TaskCommentFile } from '../types';
import { apiClient, ApiError } from '../services/apiClient';
import { fileRepository, type FileMetadata } from './fileRepository';

export interface ReplyToPayload {
  id: string;
  text: string;
  sender: string;
}

export interface CommentCreateInput {
  /** Client-generated nanoid(8). Server uses it as the primary key. */
  id: string;
  text?: string;
  /** Display name of the commenter. The UI falls back to "You" when missing. */
  sender?: string | null;
  replyTo?: ReplyToPayload | null;
}

export interface CommentUpdateInput {
  text: string;
}

export interface CreateCommentResult {
  comment: TaskComment;
  file?: FileMetadata;
}

export interface FileUploadCallbacks {
  /** Progress callback (loaded bytes, total bytes). Fires 0..1 typical. */
  onProgress?: (loaded: number, total: number) => void;
  signal?: AbortSignal;
}

/**
 * Convert a server `File` row into the `TaskComment.file` shape that
 * components consume. Exported so the store can normalise the response
 * from the multipart endpoint.
 */
export function toCommentFile(f: FileMetadata): TaskCommentFile {
  return {
    id: f.id,
    originalName: f.originalName,
    mimeType: f.mimeType,
    sizeBytes: f.sizeBytes,
  };
}

export const commentRepository = {
  list(taskId: string, signal?: AbortSignal): Promise<{ comments: TaskComment[] }> {
    return apiClient.get<{ comments: TaskComment[] }>(
      `/tasks/${encodeURIComponent(taskId)}/comments`,
      { signal },
    );
  },

  /**
   * Text-only comment. Use this when no file is attached. The server
   * accepts `fileId` in the JSON body for forward compatibility but
   * ignores it — the multipart variant owns file linkage.
   */
  async createText(
    taskId: string,
    input: CommentCreateInput,
  ): Promise<CreateCommentResult> {
    const { comment } = await apiClient.post<{ comment: TaskComment }>(
      `/tasks/${encodeURIComponent(taskId)}/comments`,
      input,
    );
    return { comment };
  },

  /**
   * Multipart comment with an optional file. The file is uploaded with
   * real progress callbacks (XHR upload events) so the UI can show a
   * progress bar. The server returns both the new comment and the new
   * `File` row; the comment's `fileId` points at the file.
   */
  async createWithFile(
    taskId: string,
    input: CommentCreateInput,
    file: File,
    options: FileUploadCallbacks = {},
  ): Promise<CreateCommentResult> {
    const form = new FormData();
    form.append('id', input.id);
    if (input.text !== undefined) form.append('text', input.text);
    if (input.sender) form.append('sender', input.sender);
    if (input.replyTo) form.append('replyTo', JSON.stringify(input.replyTo));
    form.append('file', file, file.name);

    const result = await apiClient.postMultipart<{ comment: TaskComment; file: FileMetadata }>(
      `/tasks/${encodeURIComponent(taskId)}/comments`,
      form,
      { onProgress: options.onProgress, signal: options.signal },
    );
    return {
      comment: { ...result.comment, file: toCommentFile(result.file) },
      file: result.file,
    };
  },

  update(id: string, input: CommentUpdateInput): Promise<{ comment: TaskComment }> {
    return apiClient.patch<{ comment: TaskComment }>(
      `/comments/${encodeURIComponent(id)}`,
      input,
    );
  },

  remove(id: string): Promise<{ ok: true }> {
    return apiClient.delete<{ ok: true }>(`/comments/${encodeURIComponent(id)}`);
  },
};

/**
 * Returns a stable, server-relative URL for a comment attachment. Centralised
 * so the thread and the file viewer agree on the URL shape. Always goes
 * through the file service (the server enforces ownership + soft-delete).
 */
export function commentFileUrl(fileId: string): string {
  return fileRepository.getContentUrl(fileId);
}

/**
 * Helper to extract a typed error message from an unknown thrown value.
 * Components and stores use this to surface a useful toast.
 */
export function explainError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}
