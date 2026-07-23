import { create } from 'zustand';
import { useAIStore } from './aiStore';
import { secureStorage } from '../services/secureStorage';
import { streamChat } from '../services/ai/router';
import type { ChatMessage as AiChatMessage } from '../services/ai/types';
import type { AiChatPanelMessage } from '../components/aiChat/types';

/**
 * Agent -> Browser AI (M2 map row: DASH `src/components/aiChat/` "the
 * retained V1 direct-provider surface... explicitly not a second Hermes
 * chat path"). This store talks straight to the active AI provider config
 * from `aiStore` via `services/ai/router.ts::streamChat` — the same
 * OpenAI-compatible streaming client `useStreamingChat` uses for the
 * document/task sidebar chat — and never touches the Hermes gateway or
 * `/api/hermes/*`. Messages are in-memory only (no Dexie thread), matching
 * this being a standalone scratch chat rather than a per-document/task one.
 */

function shortId(): string {
  return Math.random().toString(36).slice(2, 10);
}

interface BrowserAiChatStore {
  messages: AiChatPanelMessage[];
  inputValue: string;
  isSending: boolean;
  error: string | null;
  setInput: (value: string) => void;
  send: (text: string) => Promise<void>;
  stop: () => void;
  reset: () => void;
}

let abortController: AbortController | null = null;

export const useBrowserAiChatStore = create<BrowserAiChatStore>((set, get) => ({
  messages: [],
  inputValue: '',
  isSending: false,
  error: null,

  setInput: (value) => set({ inputValue: value }),

  reset: () => {
    abortController?.abort();
    abortController = null;
    set({ messages: [], inputValue: '', isSending: false, error: null });
  },

  stop: () => {
    abortController?.abort();
  },

  send: async (text) => {
    const trimmed = text.trim();
    if (!trimmed || get().isSending) return;

    const provider = useAIStore.getState().getActiveProvider();
    if (!provider) {
      set({ error: 'No AI provider configured. Add one in Settings.' });
      return;
    }

    let storedKey: string | null = null;
    try {
      storedKey = await secureStorage.secureGet(`providerApiKey_${provider.id}`);
    } catch {
      // Fall through — provider.apiKey may already carry it.
    }
    const apiKey = (provider.apiKey || storedKey || '').trim();
    if (!apiKey) {
      set({ error: `No saved API key for ${provider.name}. Reconnect it in Settings.` });
      return;
    }

    const userMessage: AiChatPanelMessage = {
      id: `user-${shortId()}`,
      role: 'user',
      content: trimmed,
      createdAt: new Date(),
    };
    const assistantMessage: AiChatPanelMessage = {
      id: `assistant-${shortId()}`,
      role: 'assistant',
      content: '',
      createdAt: new Date(),
      isPending: true,
    };

    set((s) => ({
      messages: [...s.messages, userMessage, assistantMessage],
      inputValue: '',
      isSending: true,
      error: null,
    }));

    const history: AiChatMessage[] = get()
      .messages.filter((m) => m.id !== assistantMessage.id && m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }) as AiChatMessage);

    abortController = new AbortController();
    const signal = abortController.signal;
    const resolvedProvider = { ...provider, apiKey };

    try {
      let fullContent = '';
      for await (const chunk of streamChat(history, resolvedProvider, signal)) {
        fullContent += chunk.content;
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantMessage.id ? { ...m, content: fullContent } : m,
          ),
        }));
      }
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantMessage.id ? { ...m, content: fullContent, isPending: false } : m,
        ),
      }));
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantMessage.id ? { ...m, isPending: false } : m,
          ),
        }));
      } else {
        const message = err instanceof Error ? err.message : 'Unknown error';
        set((s) => ({
          error: message,
          messages: s.messages.map((m) =>
            m.id === assistantMessage.id ? { ...m, isPending: false, error: message } : m,
          ),
        }));
      }
    } finally {
      abortController = null;
      set({ isSending: false });
    }
  },
}));
