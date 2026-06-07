// Chat store. Server-backed as of Agent 6 (Frontend AI Migration).
//
// The store is now a thin client for the chat thread and message endpoints
// exposed by the server. Thread / message rows live in Postgres; the local
// Zustand state mirrors what the server returned.
//
// `loadThreads` → `GET /api/chat-threads?mode=…`
// `newChat`     → `POST /api/chat-threads` (server auto-bumps `updatedAt`
//                 on the first message — see chatMessages.ts).
// `selectThread`→ `GET /api/chat-threads/:id/messages`
// `addMessage`  → `POST /api/chat-threads/:id/messages` (server may
//                 auto-rename the thread on the first user message).
// `updateMessage` → `PATCH /api/chat-messages/:id`
// `deleteMessage` → `DELETE /api/chat-messages/:id`
//
// The local optimistic update in `addMessage` / `updateMessage` keeps the UI
// snappy; on success we replace the optimistic row with the server's
// authoritative one (which is the same shape). On failure the optimistic row
// is rolled back.

import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { ChatMessage, ChatThreadMeta } from '../types';
import { chatRepository } from '../repositories/chatRepository';

interface ChatStore {
  threads: ChatThreadMeta[];
  activeThreadId: string | null;
  messagesByThread: Record<string, ChatMessage[]>;
  streamingMessageId: string | null;
  isStreaming: boolean;

  loadThreads: (mode: 'writer' | 'task') => Promise<void>;
  newChat: (mode: 'writer' | 'task') => Promise<void>;
  selectThread: (threadId: string) => Promise<void>;
  addMessage: (msg: ChatMessage) => Promise<void>;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  setStreamingMessageId: (id: string | null) => void;
  setIsStreaming: (v: boolean) => void;
  getActiveThreadMessages: () => ChatMessage[];
}

/** Replace an optimistic message with the server's authoritative version
 *  (or insert it if it's not in the local cache yet). */
function upsertMessage(
  messages: ChatMessage[],
  message: ChatMessage,
): ChatMessage[] {
  const idx = messages.findIndex((m) => m.id === message.id);
  if (idx === -1) return [...messages, message];
  const next = messages.slice();
  next[idx] = { ...messages[idx], ...message };
  return next;
}

function replaceOrRemoveMessage(messages: ChatMessage[], id: string): ChatMessage[] {
  return messages.filter((m) => m.id !== id);
}

export const useChatStore = create<ChatStore>((set, get) => ({
  threads: [],
  activeThreadId: null,
  messagesByThread: {},
  streamingMessageId: null,
  isStreaming: false,

  loadThreads: async (mode) => {
    try {
      const { threads } = await chatRepository.listThreads(mode);
      set({ threads });
    } catch {
      // Keep the previous list on transient errors.
    }
  },

  newChat: async (mode) => {
    const id = nanoid(8);
    const nowMs = Date.now();
    const optimistic: ChatThreadMeta = {
      id,
      mode,
      title: 'New Chat',
      createdAt: nowMs,
      updatedAt: nowMs,
    };
    set((s) => ({
      threads: [optimistic, ...s.threads],
      activeThreadId: id,
      messagesByThread: { ...s.messagesByThread, [id]: [] },
    }));
    try {
      const { thread } = await chatRepository.createThread({ id, mode, title: 'New Chat' });
      set((s) => ({
        threads: s.threads.map((t) => (t.id === id ? { ...t, ...thread } : t)),
      }));
    } catch {
      // Roll back the optimistic insert on failure.
      set((s) => ({
        threads: s.threads.filter((t) => t.id !== id),
        activeThreadId: s.activeThreadId === id ? null : s.activeThreadId,
        messagesByThread: Object.fromEntries(
          Object.entries(s.messagesByThread).filter(([tid]) => tid !== id),
        ),
      }));
    }
  },

  selectThread: async (threadId) => {
    set((s) => ({
      activeThreadId: threadId,
      messagesByThread: { ...s.messagesByThread, [threadId]: s.messagesByThread[threadId] ?? [] },
    }));
    try {
      const { messages } = await chatRepository.listMessages(threadId);
      set((s) => ({ messagesByThread: { ...s.messagesByThread, [threadId]: messages } }));
    } catch {
      // Keep whatever we already had cached.
    }
  },

  addMessage: async (msg) => {
    // Optimistic insert: the UI sees the message immediately, then we
    // reconcile with the server response (which may carry a server-set
    // `timestamp`).
    set((s) => ({
      messagesByThread: {
        ...s.messagesByThread,
        [msg.threadId]: [...(s.messagesByThread[msg.threadId] ?? []), msg],
      },
    }));
    try {
      const { message } = await chatRepository.createMessage(msg.threadId, {
        id: msg.id,
        mode: msg.mode,
        documentId: msg.documentId ?? null,
        taskId: msg.taskId ?? null,
        agentId: msg.agentId,
        role: msg.role,
        content: msg.content,
        selectedText: msg.selectedText ?? null,
        selectionFrom: msg.selectionFrom ?? null,
        selectionTo: msg.selectionTo ?? null,
        suggestedText: msg.suggestedText ?? null,
        replyTo: msg.replyTo ?? null,
        attachments: msg.attachments,
        taskDraft: msg.taskDraft,
        taskDraftStatus: msg.taskDraftStatus,
        timestamp: msg.timestamp,
      });
      set((s) => ({
        messagesByThread: {
          ...s.messagesByThread,
          [msg.threadId]: upsertMessage(s.messagesByThread[msg.threadId] ?? [], message),
        },
      }));
      // The server may have renamed the thread on the first user message.
      // We refresh the thread list so the sidebar title updates.
      if (msg.role === 'user') {
        await get().loadThreads(msg.mode);
      }
    } catch {
      // Roll back the optimistic insert.
      set((s) => ({
        messagesByThread: {
          ...s.messagesByThread,
          [msg.threadId]: (s.messagesByThread[msg.threadId] ?? []).filter((m) => m.id !== msg.id),
        },
      }));
    }
  },

  updateMessage: async (id, updates) => {
    // Apply optimistically across every thread cache that holds this id.
    set((s) => {
      const next: Record<string, ChatMessage[]> = {};
      for (const [tid, msgs] of Object.entries(s.messagesByThread)) {
        next[tid] = msgs.map((m) => (m.id === id ? { ...m, ...updates } : m));
      }
      return { messagesByThread: next };
    });
    try {
      const { message } = await chatRepository.updateMessage(id, {
        content: updates.content,
        suggestedText: updates.suggestedText ?? null,
        taskDraft: updates.taskDraft,
        taskDraftStatus: updates.taskDraftStatus,
      });
      set((s) => {
        const next: Record<string, ChatMessage[]> = {};
        for (const [tid, msgs] of Object.entries(s.messagesByThread)) {
          next[tid] = upsertMessage(msgs, message);
        }
        return { messagesByThread: next };
      });
    } catch {
      // Re-fetch the message from the server to recover authoritative state.
      // We don't have a direct get-by-id endpoint, so reload each thread
      // cache that referenced this id. Simpler: just refetch the active
      // thread.
      const { activeThreadId } = get();
      if (activeThreadId) {
        try {
          const { messages } = await chatRepository.listMessages(activeThreadId);
          set((s) => ({ messagesByThread: { ...s.messagesByThread, [activeThreadId]: messages } }));
        } catch {
          /* ignore */
        }
      }
    }
  },

  deleteMessage: async (id) => {
    set((s) => {
      const next: Record<string, ChatMessage[]> = {};
      for (const [tid, msgs] of Object.entries(s.messagesByThread)) {
        next[tid] = replaceOrRemoveMessage(msgs, id);
      }
      return { messagesByThread: next };
    });
    try {
      await chatRepository.deleteMessage(id);
    } catch {
      // Refetch active thread to recover.
      const { activeThreadId } = get();
      if (activeThreadId) {
        try {
          const { messages } = await chatRepository.listMessages(activeThreadId);
          set((s) => ({ messagesByThread: { ...s.messagesByThread, [activeThreadId]: messages } }));
        } catch {
          /* ignore */
        }
      }
    }
  },

  setStreamingMessageId: (id) => set({ streamingMessageId: id }),
  setIsStreaming: (v) => set({ isStreaming: v }),

  getActiveThreadMessages: () => {
    const { activeThreadId, messagesByThread } = get();
    return activeThreadId ? messagesByThread[activeThreadId] ?? [] : [];
  },
}));
