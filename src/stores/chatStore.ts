import { create } from 'zustand';
import type { ChatMessage } from '../types';
import { db } from '../services/db';

interface ChatStore {
  messagesByDoc: Record<string, ChatMessage[]>;
  streamingMessageId: string | null;
  isStreaming: boolean;

  loadMessages: (documentId: string) => Promise<void>;
  addMessage: (msg: ChatMessage) => Promise<void>;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => Promise<void>;
  clearMessages: (documentId: string) => Promise<void>;
  setStreamingMessageId: (id: string | null) => void;
  setIsStreaming: (v: boolean) => void;
  getMessages: (documentId: string) => ChatMessage[];
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messagesByDoc: {},
  streamingMessageId: null,
  isStreaming: false,

  loadMessages: async (documentId) => {
    const msgs = await db.chatMessages
      .where('documentId')
      .equals(documentId)
      .sortBy('timestamp');
    set((s) => ({ messagesByDoc: { ...s.messagesByDoc, [documentId]: msgs } }));
  },

  addMessage: async (msg) => {
    await db.chatMessages.put(msg);
    set((s) => ({
      messagesByDoc: {
        ...s.messagesByDoc,
        [msg.documentId]: [...(s.messagesByDoc[msg.documentId] ?? []), msg],
      },
    }));
  },

  updateMessage: async (id, updates) => {
    await db.chatMessages.update(id, updates);
    set((s) => {
      const updated: Record<string, ChatMessage[]> = {};
      for (const [docId, msgs] of Object.entries(s.messagesByDoc)) {
        updated[docId] = msgs.map((m) => (m.id === id ? { ...m, ...updates } : m));
      }
      return { messagesByDoc: updated };
    });
  },

  clearMessages: async (documentId) => {
    const msgs = await db.chatMessages.where('documentId').equals(documentId).toArray();
    await db.chatMessages.bulkDelete(msgs.map((m) => m.id));
    set((s) => ({ messagesByDoc: { ...s.messagesByDoc, [documentId]: [] } }));
  },

  setStreamingMessageId: (id) => set({ streamingMessageId: id }),
  setIsStreaming: (v) => set({ isStreaming: v }),

  getMessages: (documentId) => get().messagesByDoc[documentId] ?? [],
}));
