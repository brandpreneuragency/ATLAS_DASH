// Hermes CHAT mode store — sessions list + live gateway chat stream + approvals inbox.
import { create } from 'zustand';
import { hermesClient, type HermesChatConnection } from '../services/hermes/client';
import type {
  HermesApprovalChoice,
  HermesGatewayEvent,
  HermesMessage,
  HermesSession,
} from '../services/hermes/types';

export type HermesConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/** Normalized bubble used by the CHAT UI (Hermes transcripts are free-form). */
export interface HermesChatBubble {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: number;
}

export interface HermesChatReducerState {
  messages: HermesChatBubble[];
  pending: string;
}

/**
 * Pending dangerous-command / execute_code approval.
 * Desktop keys by session (one in-flight per session; no request_id).
 * Source: apps/desktop store/prompts.ts ApprovalRequest + gateway-event.ts.
 */
export interface PendingApproval {
  /** Stable id — session_id when present, else synthetic. */
  id: string;
  sessionId: string | null;
  command: string;
  /** Human risk/description label from payload.description. */
  risk: string;
  requestedAt: number;
  allowPermanent?: boolean;
  choices?: string[];
  smartDenied?: boolean;
}

function extractText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          const rec = part as Record<string, unknown>;
          if (typeof rec.text === 'string') return rec.text;
          if (typeof rec.content === 'string') return rec.content;
        }
        return '';
      })
      .filter(Boolean)
      .join('');
  }
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    if (typeof rec.text === 'string') return rec.text;
    if (typeof rec.content === 'string') return rec.content;
  }
  return '';
}

/** Map a REST transcript message into a UI bubble. */
export function hermesMessageToBubble(m: HermesMessage, index: number): HermesChatBubble {
  const content = extractText(m.text) || extractText(m.content);
  return {
    id: `hist-${index}-${m.role}-${m.timestamp ?? index}`,
    role: m.role,
    content,
    timestamp: m.timestamp,
  };
}

/**
 * Pure reducer for inbound gateway events (unit-tested).
 * Fixtures mirror desktop types: message.delta / message.complete / message.start.
 */
export function reduceGatewayEvent(
  state: HermesChatReducerState,
  ev: HermesGatewayEvent,
): HermesChatReducerState {
  switch (ev.type) {
    case 'message.start':
      return { ...state, pending: '' };

    case 'message.delta': {
      const chunk = extractText(ev.payload?.text);
      if (!chunk) return state;
      return { ...state, pending: state.pending + chunk };
    }

    case 'message.complete': {
      const finalText =
        extractText(ev.payload?.rendered) ||
        extractText(ev.payload?.text) ||
        state.pending;
      if (!finalText) {
        return { ...state, pending: '' };
      }
      const bubble: HermesChatBubble = {
        id: `asst-${Date.now()}-${state.messages.length}`,
        role: 'assistant',
        content: finalText,
        timestamp: Date.now(),
      };
      return {
        messages: [...state.messages, bubble],
        pending: '',
      };
    }

    case 'error': {
      const msg = extractText(ev.payload?.message) || 'Hermes error';
      const bubble: HermesChatBubble = {
        id: `err-${Date.now()}`,
        role: 'system',
        content: msg,
        timestamp: Date.now(),
      };
      return { messages: [...state.messages, bubble], pending: '' };
    }

    default:
      // Unknown types (tool.*, thinking.*, approval.*, …) are ignored here.
      return state;
  }
}

/** Build a stable approval id (session-keyed on the backend). */
export function approvalIdFor(sessionId: string | null | undefined, command: string): string {
  if (sessionId) return sessionId;
  return `anon:${command.slice(0, 64)}`;
}

/**
 * Pure reducer for approval-related gateway events (unit-tested).
 * - approval.request → add/update one entry (dedupe by id)
 * - message.complete / error for a session → clear that session's approval
 *   (matches desktop clearAllPrompts on complete/error)
 */
export function reduceApprovalEvent(
  approvals: PendingApproval[],
  ev: HermesGatewayEvent,
): PendingApproval[] {
  if (ev.type === 'approval.request') {
    const command = typeof ev.payload?.command === 'string' ? ev.payload.command : '';
    const description =
      typeof ev.payload?.description === 'string' ? ev.payload.description : 'dangerous command';
    const sessionId = ev.session_id ?? null;
    const id = approvalIdFor(sessionId, command);
    const next: PendingApproval = {
      id,
      sessionId,
      command,
      risk: description,
      requestedAt: Date.now(),
      allowPermanent: ev.payload?.allow_permanent !== false,
      choices: Array.isArray(ev.payload?.choices)
        ? ev.payload.choices.filter((c): c is string => typeof c === 'string')
        : undefined,
      smartDenied: ev.payload?.smart_denied === true,
    };
    const idx = approvals.findIndex((a) => a.id === id);
    if (idx >= 0) {
      const copy = approvals.slice();
      copy[idx] = next;
      return copy;
    }
    return [...approvals, next];
  }

  if (
    (ev.type === 'message.complete' || ev.type === 'error') &&
    ev.session_id
  ) {
    return approvals.filter((a) => a.sessionId !== ev.session_id);
  }

  return approvals;
}

export function removeApprovalById(
  approvals: PendingApproval[],
  id: string,
): PendingApproval[] {
  return approvals.filter((a) => a.id !== id);
}

interface HermesStore {
  sessions: HermesSession[];
  activeSessionId: string | null;
  messages: HermesChatBubble[];
  pending: string;
  streaming: boolean;
  connectionState: HermesConnectionState;
  loadingSessions: boolean;
  loadingMessages: boolean;
  error: string | null;
  approvals: PendingApproval[];
  eventsConnected: boolean;

  loadSessions: () => Promise<void>;
  openSession: (id: string) => Promise<void>;
  newSession: () => void;
  sendPrompt: (text: string) => void;
  applyGatewayEvent: (ev: HermesGatewayEvent) => void;
  renameSession: (id: string, title: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  ensureChatConnection: () => void;
  disconnectChat: () => void;
  /** Start /api/events subscription once (app-wide for approval badge). */
  ensureEventsSubscription: () => void;
  respondApproval: (id: string, approve: boolean) => Promise<void>;
}

let chatConn: HermesChatConnection | null = null;
let eventsUnsub: (() => void) | null = null;

export const useHermesStore = create<HermesStore>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: [],
  pending: '',
  streaming: false,
  connectionState: 'disconnected',
  loadingSessions: false,
  loadingMessages: false,
  error: null,
  approvals: [],
  eventsConnected: false,

  loadSessions: async () => {
    set({ loadingSessions: true, error: null });
    try {
      const sessions = await hermesClient.listSessions();
      set({ sessions, loadingSessions: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ loadingSessions: false, error: message, sessions: [] });
    }
  },

  openSession: async (id) => {
    set({
      activeSessionId: id,
      loadingMessages: true,
      error: null,
      pending: '',
      streaming: false,
    });
    try {
      const raw = await hermesClient.getMessages(id);
      const messages = raw
        .map((m, i) => hermesMessageToBubble(m, i))
        .filter((m) => m.role === 'user' || m.role === 'assistant' || m.content);
      set({ messages, loadingMessages: false });
      get().ensureChatConnection();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ loadingMessages: false, error: message, messages: [] });
    }
  },

  newSession: () => {
    set({
      activeSessionId: null,
      messages: [],
      pending: '',
      streaming: false,
      error: null,
    });
    get().ensureChatConnection();
  },

  applyGatewayEvent: (ev) => {
    // Approvals are session-keyed but must be collected for *all* sessions
    // (inbox badge / background turns). Always reduce first.
    const nextApprovals = reduceApprovalEvent(get().approvals, ev);
    if (nextApprovals !== get().approvals) {
      set({ approvals: nextApprovals });
    }

    // Chat stream is scoped to the active session only.
    const active = get().activeSessionId;
    if (ev.session_id && active && ev.session_id !== active) {
      return;
    }
    if (ev.type === 'approval.request') {
      return;
    }

    if (ev.type === 'message.start' || ev.type === 'message.delta') {
      set({ streaming: true });
    }

    const next = reduceGatewayEvent(
      { messages: get().messages, pending: get().pending },
      ev,
    );

    if (ev.type === 'message.complete' || ev.type === 'error') {
      set({
        messages: next.messages,
        pending: next.pending,
        streaming: false,
      });
      // Refresh session list so titles/previews update after a turn.
      void get().loadSessions();
      return;
    }

    set({ messages: next.messages, pending: next.pending });

    // Gateway may assign a session_id on the first reply of a new chat.
    if (!active && ev.session_id) {
      set({ activeSessionId: ev.session_id });
    }
  },

  ensureChatConnection: () => {
    if (chatConn) return;
    set({ connectionState: 'connecting' });
    chatConn = hermesClient.connectChat({
      onEvent: (ev) => get().applyGatewayEvent(ev),
      onOpen: () => set({ connectionState: 'connected' }),
      onClose: () => {
        chatConn = null;
        set({ connectionState: 'disconnected' });
      },
    });
  },

  disconnectChat: () => {
    chatConn?.close();
    chatConn = null;
    set({ connectionState: 'disconnected', streaming: false });
  },

  sendPrompt: (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    get().ensureChatConnection();

    const userBubble: HermesChatBubble = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };
    set((s) => ({
      messages: [...s.messages, userBubble],
      streaming: true,
      pending: '',
      error: null,
    }));

    chatConn?.send(trimmed, get().activeSessionId);
  },

  renameSession: async (id, title) => {
    try {
      await hermesClient.renameSession(id, title);
      set((s) => ({
        sessions: s.sessions.map((sess) =>
          sess.id === id ? { ...sess, title } : sess,
        ),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  deleteSession: async (id) => {
    try {
      await hermesClient.deleteSession(id);
      const wasActive = get().activeSessionId === id;
      set((s) => ({
        sessions: s.sessions.filter((sess) => sess.id !== id),
        approvals: s.approvals.filter((a) => a.sessionId !== id),
        ...(wasActive
          ? { activeSessionId: null, messages: [], pending: '', streaming: false }
          : {}),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  ensureEventsSubscription: () => {
    if (eventsUnsub) return;
    eventsUnsub = hermesClient.connectEvents((ev) => {
      get().applyGatewayEvent(ev);
    });
    set({ eventsConnected: true });
  },

  respondApproval: async (id, approve) => {
    const entry = get().approvals.find((a) => a.id === id);
    if (!entry) return;

    get().ensureChatConnection();

    // Wait briefly for the chat gateway socket to open (WS is async).
    const deadline = Date.now() + 10_000;
    while ((!chatConn || get().connectionState !== 'connected') && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }
    if (!chatConn || get().connectionState !== 'connected') {
      set({ error: 'gateway not connected' });
      return;
    }

    // Desktop: approval.respond { choice: "once" | "deny", session_id }
    const choice: HermesApprovalChoice = approve ? 'once' : 'deny';
    try {
      await chatConn.request('approval.respond', {
        choice,
        session_id: entry.sessionId ?? undefined,
      });
      set({ approvals: removeApprovalById(get().approvals, id) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },
}));
