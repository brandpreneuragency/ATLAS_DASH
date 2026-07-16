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

/**
 * True when an inbound event belongs to the chat the UI is viewing.
 * Gateway events use the short *live* session_id; REST list uses *stored* ids.
 */
export function eventBelongsToActiveChat(
  ev: HermesGatewayEvent,
  liveSessionId: string | null,
  storedSessionId: string | null,
): boolean {
  if (!ev.session_id) return true;
  if (liveSessionId && ev.session_id === liveSessionId) return true;
  if (storedSessionId && ev.session_id === storedSessionId) return true;
  return false;
}

interface HermesStore {
  sessions: HermesSession[];
  /** Durable REST session id (list / history). Null = new draft chat. */
  storedSessionId: string | null;
  /** Live gateway session id for prompt.submit + stream events. */
  liveSessionId: string | null;
  /** @deprecated use storedSessionId — kept as alias for UI selection highlight */
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
  sendPrompt: (text: string) => Promise<void>;
  applyGatewayEvent: (ev: HermesGatewayEvent) => void;
  renameSession: (id: string, title: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  ensureChatConnection: () => HermesChatConnection;
  disconnectChat: () => void;
  /** Start /api/events subscription once (app-wide for approval badge). */
  ensureEventsSubscription: () => void;
  respondApproval: (id: string, approve: boolean) => Promise<void>;
}

let chatConn: HermesChatConnection | null = null;
let eventsUnsub: (() => void) | null = null;

async function ensureGatewayReady(): Promise<HermesChatConnection> {
  const conn = useHermesStore.getState().ensureChatConnection();
  await conn.whenOpen();
  return conn;
}

/**
 * Bind a live gateway session for the current chat.
 * - New draft: session.create
 * - Existing stored chat without live id: session.resume
 */
async function ensureLiveSession(
  conn: HermesChatConnection,
  storedSessionId: string | null,
  liveSessionId: string | null,
): Promise<{ liveSessionId: string; storedSessionId: string | null }> {
  if (liveSessionId) {
    return { liveSessionId, storedSessionId };
  }
  if (storedSessionId) {
    try {
      const resumed = await conn.resumeSession(storedSessionId);
      return {
        liveSessionId: resumed.sessionId,
        storedSessionId: resumed.storedSessionId ?? storedSessionId,
      };
    } catch {
      // Resume can fail if the row is gone; fall through to create.
    }
  }
  const created = await conn.createSession();
  return {
    liveSessionId: created.sessionId,
    storedSessionId: created.storedSessionId ?? storedSessionId,
  };
}

export const useHermesStore = create<HermesStore>((set, get) => ({
  sessions: [],
  storedSessionId: null,
  liveSessionId: null,
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
    // Approvals / events use the short *live* gateway id. REST history uses the
    // durable stored id. If the caller passed the live id for the active chat,
    // re-home to the stored id so list highlight + transcript fetch work.
    let restId = id;
    if (get().liveSessionId === id && get().storedSessionId) {
      restId = get().storedSessionId;
    }

    set({
      storedSessionId: restId,
      activeSessionId: restId,
      // Drop any previous live binding — must resume this stored id.
      liveSessionId: null,
      loadingMessages: true,
      error: null,
      pending: '',
      streaming: false,
    });
    try {
      const raw = await hermesClient.getMessages(restId);
      const messages = raw
        .map((m, i) => hermesMessageToBubble(m, i))
        .filter((m) => m.role === 'user' || m.role === 'assistant' || m.content);
      set({ messages, loadingMessages: false });
      get().ensureChatConnection();
      // Best-effort resume so the first send is fast and events match.
      void (async () => {
        try {
          const conn = await ensureGatewayReady();
          // Bail if user switched sessions while we waited.
          if (get().storedSessionId !== restId) return;
          const bound = await ensureLiveSession(conn, restId, null);
          if (get().storedSessionId !== restId) return;
          set({
            liveSessionId: bound.liveSessionId,
            storedSessionId: bound.storedSessionId ?? restId,
            activeSessionId: bound.storedSessionId ?? restId,
          });
        } catch {
          // Non-fatal: sendPrompt will resume/create on demand.
        }
      })();
    } catch (err) {
      // Live-only id with no stored mapping: keep the live binding, empty history.
      if (get().liveSessionId === id || (id.length <= 12 && !id.includes('_'))) {
        set({
          liveSessionId: id,
          storedSessionId: get().storedSessionId,
          activeSessionId: get().storedSessionId ?? id,
          loadingMessages: false,
          error: null,
          messages: get().messages,
        });
        get().ensureChatConnection();
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      set({ loadingMessages: false, error: message, messages: [] });
    }
  },

  newSession: () => {
    set({
      storedSessionId: null,
      liveSessionId: null,
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

    // Chat stream is scoped to the active live/stored session only.
    if (!eventBelongsToActiveChat(ev, get().liveSessionId, get().storedSessionId)) {
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

    // Capture live session_id if we somehow missed it from create/resume.
    if (!get().liveSessionId && ev.session_id) {
      set({ liveSessionId: ev.session_id });
    }
  },

  ensureChatConnection: () => {
    if (chatConn) return chatConn;
    set({ connectionState: 'connecting' });
    chatConn = hermesClient.connectChat({
      onEvent: (ev) => get().applyGatewayEvent(ev),
      onOpen: () => set({ connectionState: 'connected' }),
      onClose: () => {
        chatConn = null;
        set({ connectionState: 'disconnected', liveSessionId: null });
      },
    });
    return chatConn;
  },

  disconnectChat: () => {
    chatConn?.close();
    chatConn = null;
    set({
      connectionState: 'disconnected',
      streaming: false,
      liveSessionId: null,
    });
  },

  sendPrompt: async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

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

    try {
      const conn = await ensureGatewayReady();
      const bound = await ensureLiveSession(
        conn,
        get().storedSessionId,
        get().liveSessionId,
      );
      set({
        liveSessionId: bound.liveSessionId,
        storedSessionId: bound.storedSessionId,
        activeSessionId: bound.storedSessionId,
      });
      await conn.submitPrompt(bound.liveSessionId, trimmed);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set((s) => ({
        streaming: false,
        pending: '',
        error: message,
        messages: [
          ...s.messages,
          {
            id: `err-${Date.now()}`,
            role: 'system',
            content: message,
            timestamp: Date.now(),
          },
        ],
      }));
    }
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
      const wasActive =
        get().storedSessionId === id || get().activeSessionId === id;
      set((s) => ({
        sessions: s.sessions.filter((sess) => sess.id !== id),
        approvals: s.approvals.filter(
          (a) => a.sessionId !== id && a.sessionId !== s.liveSessionId,
        ),
        ...(wasActive
          ? {
              storedSessionId: null,
              liveSessionId: null,
              activeSessionId: null,
              messages: [],
              pending: '',
              streaming: false,
            }
          : {}),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  ensureEventsSubscription: () => {
    // Approvals and stream events arrive on the chat gateway WebSocket
    // (`/api/ws`). Hermes `/api/events` is a separate PTY-channel broadcast
    // (requires `?channel=`) used by the dashboard TUI sidebar — not a
    // general event bus. Keep the chat socket up so approval.request is
    // collected for the bell badge while CHAT mode is mounted.
    if (eventsUnsub) return;
    get().ensureChatConnection();
    eventsUnsub = () => {
      // Connection lifecycle is owned by ensureChatConnection / disconnectChat.
    };
    set({ eventsConnected: true });
  },

  respondApproval: async (id, approve) => {
    const entry = get().approvals.find((a) => a.id === id);
    if (!entry) return;

    try {
      const conn = await ensureGatewayReady();
      // Prefer live id when approval was emitted with it; fall back to stored.
      const sessionId =
        entry.sessionId ?? get().liveSessionId ?? get().storedSessionId ?? undefined;
      const choice: HermesApprovalChoice = approve ? 'once' : 'deny';
      await conn.request('approval.respond', {
        choice,
        session_id: sessionId,
      });
      set({ approvals: removeApprovalById(get().approvals, id) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },
}));
