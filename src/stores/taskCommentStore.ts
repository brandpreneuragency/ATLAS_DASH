// Task comment store. Server-backed as of Agent 5 (Frontend Task Migration).
//
// Comments live in the server's `TaskComment` table for the currently
// authenticated user. Reads go through `commentRepository.list`; writes
// hit the corresponding REST endpoints and the local Zustand state is
// updated after a successful response.
//
// File attachments are uploaded through the comment endpoint's multipart
// variant (`createWithFile`). The server returns the comment with a
// `fileId` and a populated `file` object (id, originalName, mimeType,
// sizeBytes). The store exposes an `addComment(input, file?)` signature
// that the comment input component uses; the `file` argument is optional
// and triggers the upload path when present.

import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { TaskComment, TaskCommentFile } from '../types';
import {
  commentRepository,
  type CommentCreateInput,
  type CommentUpdateInput,
  type ReplyToPayload,
} from '../repositories/commentRepository';
import { ApiError } from '../services/apiClient';
import { useUIStore } from './uiStore';

export interface AddCommentOptions {
  /** Optional upload progress callback (0..1). */
  onProgress?: (loaded: number, total: number) => void;
  /** Abort signal — store it on the upload so the caller can cancel. */
  signal?: AbortSignal;
}

export interface AddCommentResult {
  comment: TaskComment | null;
  file: TaskCommentFile | null;
}

function showError(err: unknown, fallback: string): void {
  const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : fallback;
  useUIStore.getState().showToast(msg, 'error');
}

function buildReplyData(source: TaskComment | null | undefined): ReplyToPayload | undefined {
  if (!source) return undefined;
  return {
    id: source.id,
    text: source.text.slice(0, 200),
    sender: 'You',
  };
}

function localCommentFromInput(
  taskId: string,
  input: CommentCreateInput,
  createdAt: number,
): TaskComment {
  return {
    id: input.id,
    taskId,
    sender: input.sender ?? 'You',
    text: input.text ?? '',
    replyTo: input.replyTo ?? undefined,
    createdAt,
  };
}

interface TaskCommentStore {
  commentsByTask: Record<string, TaskComment[]>;

  loadComments: (taskId: string) => Promise<void>;
  /**
   * Create a comment. If `file` is provided, the comment is uploaded
   * through the multipart variant of the server endpoint; otherwise it's
   * a text-only JSON request. Returns the created comment (with `file`
   * metadata if applicable) and `null` on error.
   */
  addComment: (
    taskId: string,
    input: Omit<CommentCreateInput, 'id'>,
    file?: File,
    options?: AddCommentOptions,
  ) => Promise<AddCommentResult>;
  updateComment: (id: string, updates: CommentUpdateInput) => Promise<void>;
  deleteComment: (id: string, taskId: string) => Promise<void>;
  clearComments: (taskId: string) => Promise<void>;
  getComments: (taskId: string) => TaskComment[];
}

export const useTaskCommentStore = create<TaskCommentStore>((set, get) => ({
  commentsByTask: {},

  loadComments: async (taskId) => {
    try {
      const { comments } = await commentRepository.list(taskId);
      set((s) => ({ commentsByTask: { ...s.commentsByTask, [taskId]: comments } }));
    } catch (err) {
      showError(err, 'Failed to load comments.');
    }
  },

  addComment: async (taskId, input, file, options) => {
    const id = nanoid(8);
    const fullInput: CommentCreateInput = { id, ...input };
    try {
      if (file) {
        const { comment, file: fileRow } = await commentRepository.createWithFile(
          taskId,
          fullInput,
          file,
          { onProgress: options?.onProgress, signal: options?.signal },
        );
        if (!fileRow) {
          // Defensive: the server's multipart endpoint always returns a
          // `file` row alongside the comment, so this is unexpected. We
          // surface a generic error rather than silently dropping the
          // attachment.
          showError(new Error('Server did not return file metadata'), 'Failed to upload file.');
          return { comment: null, file: null };
        }
        // Mirror the file metadata into the legacy display fields so
        // pre-existing components that read `attachmentName` /
        // `attachmentSize` keep working without churn.
        const enriched: TaskComment = {
          ...comment,
          file: comment.file ?? {
            id: fileRow.id,
            originalName: fileRow.originalName,
            mimeType: fileRow.mimeType,
            sizeBytes: fileRow.sizeBytes,
          },
          attachmentName: fileRow.originalName,
          attachmentSize:
            fileRow.sizeBytes < 1024
              ? `${fileRow.sizeBytes} B`
              : fileRow.sizeBytes < 1024 * 1024
                ? `${(fileRow.sizeBytes / 1024).toFixed(1)} KB`
                : `${(fileRow.sizeBytes / (1024 * 1024)).toFixed(1)} MB`,
        };
        set((s) => ({
          commentsByTask: {
            ...s.commentsByTask,
            [taskId]: [...(s.commentsByTask[taskId] ?? []), enriched],
          },
        }));
        return { comment: enriched, file: enriched.file ?? null };
      }
      const { comment } = await commentRepository.createText(taskId, fullInput);
      set((s) => ({
        commentsByTask: {
          ...s.commentsByTask,
          [taskId]: [...(s.commentsByTask[taskId] ?? []), comment],
        },
      }));
      return { comment, file: null };
    } catch (err) {
      showError(err, 'Failed to send comment.');
      return { comment: null, file: null };
    }
  },

  updateComment: async (id, updates) => {
    const previous = get().commentsByTask;
    // Optimistic local update.
    set((s) => {
      const updated: Record<string, TaskComment[]> = {};
      for (const [taskId, comments] of Object.entries(s.commentsByTask)) {
        updated[taskId] = comments.map((c) => (c.id === id ? { ...c, ...updates } : c));
      }
      return { commentsByTask: updated };
    });
    try {
      const { comment } = await commentRepository.update(id, updates);
      set((s) => {
        const updated: Record<string, TaskComment[]> = {};
        for (const [taskId, comments] of Object.entries(s.commentsByTask)) {
          updated[taskId] = comments.map((c) => (c.id === id ? comment : c));
        }
        return { commentsByTask: updated };
      });
    } catch (err) {
      set({ commentsByTask: previous });
      showError(err, 'Failed to update comment.');
    }
  },

  deleteComment: async (id, taskId) => {
    const previous = get().commentsByTask[taskId] ?? [];
    set((s) => ({
      commentsByTask: {
        ...s.commentsByTask,
        [taskId]: previous.filter((c) => c.id !== id),
      },
    }));
    try {
      await commentRepository.remove(id);
    } catch (err) {
      set((s) => ({
        commentsByTask: {
          ...s.commentsByTask,
          [taskId]: previous,
        },
      }));
      showError(err, 'Failed to delete comment.');
    }
  },

  clearComments: async (taskId) => {
    // Bulk-delete is not part of the v1 comment API; we leave this as a
    // client-side clear so callers that used it (e.g. bulk resets) keep
    // working. The actual rows persist on the server until the parent
    // task is hard-deleted.
    set((s) => ({ commentsByTask: { ...s.commentsByTask, [taskId]: [] } }));
  },

  getComments: (taskId) => get().commentsByTask[taskId] ?? [],
}));

/**
 * Re-export the helper that builds the `replyTo` payload from a source
 * comment. The comment input component uses this to keep the reply
 * metadata in the same shape the server expects.
 */
export { buildReplyData, localCommentFromInput };
