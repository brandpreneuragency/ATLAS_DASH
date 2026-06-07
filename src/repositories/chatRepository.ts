// Chat repository. The only module (other than `apiClient`) that knows the
// shape and URLs of the chat thread and message endpoints.
//
// Stores call these methods. React components call stores. Components do
// not import this file.
//
// Endpoints (see server/src/routes/chatThreads.ts and chatMessages.ts):
//
//   GET    /api/chat-threads?mode=writer|task
//   POST   /api/chat-threads
//   DELETE /api/chat-threads/:id
//
//   GET    /api/chat-threads/:id/messages
//   POST   /api/chat-threads/:id/messages
//   PATCH  /api/chat-messages/:id
//   DELETE /api/chat-messages/:id
//
// All endpoints enforce ownerId = req.user.id server-side. Cross-user
// access returns 404 (never 403) so users cannot probe for other users'
// thread / message IDs.

import type { ChatMessage, ChatThreadMeta } from '../types';
import { apiClient } from '../services/apiClient';

export interface ThreadCreateInput {
  /** Client-generated nanoid(8). Server uses it as the primary key. */
  id: string;
  mode: 'writer' | 'task';
  title?: string;
}

export interface MessageCreateInput {
  /** Client-generated message id. Server uses it as the primary key. */
  id: string;
  mode: 'writer' | 'task';
  documentId?: string | null;
  taskId?: string | null;
  agentId: string;
  role: 'user' | 'assistant';
  content: string;
  selectedText?: string | null;
  selectionFrom?: number | null;
  selectionTo?: number | null;
  suggestedText?: string | null;
  replyTo?: ChatMessage['replyTo'] | null;
  attachments?: ChatMessage['attachments'];
  taskDraft?: ChatMessage['taskDraft'];
  taskDraftStatus?: 'draft' | 'applied' | 'rejected' | 'invalid';
  timestamp?: number;
}

export interface MessageUpdateInput {
  content?: string;
  suggestedText?: string | null;
  taskDraft?: ChatMessage['taskDraft'];
  taskDraftStatus?: 'draft' | 'applied' | 'rejected' | 'invalid';
}

export const chatRepository = {
  // ── Threads ───────────────────────────────────────────────────────────

  listThreads(
    mode: 'writer' | 'task' | undefined,
    signal?: AbortSignal,
  ): Promise<{ threads: ChatThreadMeta[] }> {
    return apiClient.get<{ threads: ChatThreadMeta[] }>('/chat-threads', {
      query: mode ? { mode } : undefined,
      signal,
    });
  },

  createThread(input: ThreadCreateInput): Promise<{ thread: ChatThreadMeta }> {
    return apiClient.post<{ thread: ChatThreadMeta }>('/chat-threads', input);
  },

  deleteThread(id: string): Promise<{ ok: true }> {
    return apiClient.delete<{ ok: true }>(`/chat-threads/${encodeURIComponent(id)}`);
  },

  // ── Messages ──────────────────────────────────────────────────────────

  listMessages(threadId: string, signal?: AbortSignal): Promise<{ messages: ChatMessage[] }> {
    return apiClient.get<{ messages: ChatMessage[] }>(
      `/chat-threads/${encodeURIComponent(threadId)}/messages`,
      { signal },
    );
  },

  createMessage(threadId: string, input: MessageCreateInput): Promise<{ message: ChatMessage }> {
    return apiClient.post<{ message: ChatMessage }>(
      `/chat-threads/${encodeURIComponent(threadId)}/messages`,
      input,
    );
  },

  updateMessage(id: string, input: MessageUpdateInput): Promise<{ message: ChatMessage }> {
    return apiClient.patch<{ message: ChatMessage }>(
      `/chat-messages/${encodeURIComponent(id)}`,
      input,
    );
  },

  deleteMessage(id: string): Promise<{ ok: true }> {
    return apiClient.delete<{ ok: true }>(`/chat-messages/${encodeURIComponent(id)}`);
  },
};
