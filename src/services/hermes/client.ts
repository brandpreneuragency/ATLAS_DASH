// src/services/hermes/client.ts — same-origin Hermes dashboard REST + WS client.
import type {
  HermesGatewayEvent,
  HermesMessage,
  HermesMessagesResponse,
  HermesSession,
  HermesSessionsResponse,
} from './types';

export function wsUrlFor(path: string, origin: string = typeof window !== 'undefined' ? window.location.href : 'http://localhost/'): string {
  const u = new URL(path, origin);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u.toString();
}

/**
 * Parse an inbound WS frame into a gateway event.
 * - /api/ws uses JSON-RPC: { method: "event", params: HermesGatewayEvent }
 * - /api/events rebroadcasts bare gateway events: { type, session_id?, payload? }
 */
export function parseGatewayFrame(raw: string): HermesGatewayEvent | null {
  try {
    const frame = JSON.parse(raw) as {
      method?: string;
      params?: HermesGatewayEvent;
      type?: string;
      session_id?: string;
      profile?: string;
      payload?: HermesGatewayEvent['payload'];
    };
    if (frame.method === 'event' && frame.params && typeof frame.params.type === 'string') {
      return frame.params;
    }
    if (typeof frame.type === 'string') {
      return frame as HermesGatewayEvent;
    }
    return null;
  } catch {
    return null;
  }
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

/** Result of gateway session.create / session.resume. */
export interface HermesLiveSession {
  /** Short runtime id used for prompt.submit and event session_id. */
  sessionId: string;
  /** Durable id used by REST /api/sessions (may equal sessionId on some paths). */
  storedSessionId: string | null;
}

export interface HermesChatConnection {
  /** Resolves when the socket is OPEN (or rejects if closed first). */
  whenOpen(timeoutMs?: number): Promise<void>;
  /**
   * JSON-RPC request/response on the chat gateway socket.
   * Used for session.create, session.resume, prompt.submit, approval.respond, etc.
   */
  request(method: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<unknown>;
  /** Create a new live gateway session (required before first prompt on a blank chat). */
  createSession(params?: Record<string, unknown>): Promise<HermesLiveSession>;
  /** Resume a stored REST session into a live gateway session_id. */
  resumeSession(storedSessionId: string, params?: Record<string, unknown>): Promise<HermesLiveSession>;
  /** Submit a prompt against a live session_id (not a REST id). */
  submitPrompt(sessionId: string, text: string): Promise<unknown>;
  close(): void;
  get readyState(): number;
}

let _rpcId = 0;

type PendingRpc = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

function parseLiveSession(result: unknown): HermesLiveSession {
  const r = (result ?? {}) as Record<string, unknown>;
  const sessionId =
    (typeof r.session_id === 'string' && r.session_id) ||
    (typeof r.id === 'string' && r.id) ||
    '';
  if (!sessionId) {
    throw new Error('gateway session response missing session_id');
  }
  const stored =
    (typeof r.stored_session_id === 'string' && r.stored_session_id) ||
    (typeof r.resumed === 'string' && r.resumed) ||
    null;
  return { sessionId, storedSessionId: stored };
}

export const hermesClient = {
  listSessions: () =>
    json<HermesSessionsResponse>('/hermes/api/sessions').then((r) => r.sessions as HermesSession[]),

  getMessages: (id: string) =>
    json<HermesMessagesResponse>(
      `/hermes/api/sessions/${encodeURIComponent(id)}/messages`,
    ).then((r) => r.messages as HermesMessage[]),

  deleteSession: (id: string) =>
    fetch(`/hermes/api/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  renameSession: (id: string, title: string) =>
    fetch(`/hermes/api/sessions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title }),
    }),

  connectChat(handlers: {
    onEvent: (ev: HermesGatewayEvent) => void;
    onOpen?: () => void;
    onClose?: () => void;
  }): HermesChatConnection {
    const ws = new WebSocket(wsUrlFor('/hermes/api/ws'));
    const pending = new Map<number, PendingRpc>();
    let openWaiters: Array<{ resolve: () => void; reject: (e: Error) => void }> = [];

    const rejectAll = (reason: string) => {
      for (const [, p] of pending) {
        clearTimeout(p.timer);
        p.reject(new Error(reason));
      }
      pending.clear();
      for (const w of openWaiters) w.reject(new Error(reason));
      openWaiters = [];
    };

    ws.onopen = () => {
      handlers.onOpen?.();
      for (const w of openWaiters) w.resolve();
      openWaiters = [];
    };
    ws.onclose = () => {
      rejectAll('WebSocket closed');
      handlers.onClose?.();
    };
    ws.onmessage = (m) => {
      const raw = typeof m.data === 'string' ? m.data : String(m.data);
      try {
        const frame = JSON.parse(raw) as {
          id?: number | string;
          result?: unknown;
          error?: { message?: string; code?: number };
          method?: string;
        };
        // JSON-RPC response (no method) — settle a pending request.
        if (
          frame.id != null &&
          frame.method === undefined &&
          (frame.result !== undefined || frame.error !== undefined)
        ) {
          const idNum = typeof frame.id === 'number' ? frame.id : Number(frame.id);
          const p = pending.get(idNum);
          if (p) {
            clearTimeout(p.timer);
            pending.delete(idNum);
            if (frame.error) {
              const code = frame.error.code != null ? ` (${frame.error.code})` : '';
              p.reject(new Error((frame.error.message ?? 'RPC error') + code));
            } else {
              p.resolve(frame.result);
            }
            return;
          }
        }
      } catch {
        // fall through to event parse
      }
      const ev = parseGatewayFrame(raw);
      if (ev) handlers.onEvent(ev);
    };

    const request = (
      method: string,
      params: Record<string, unknown> = {},
      timeoutMs = 30_000,
    ): Promise<unknown> =>
      new Promise((resolve, reject) => {
        if (ws.readyState !== WebSocket.OPEN) {
          reject(new Error('gateway not connected'));
          return;
        }
        const id = ++_rpcId;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`RPC timeout: ${method}`));
        }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id,
            method,
            params,
          }),
        );
      });

    return {
      whenOpen: (timeoutMs = 15_000) =>
        new Promise((resolve, reject) => {
          if (ws.readyState === WebSocket.OPEN) {
            resolve();
            return;
          }
          if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
            reject(new Error('WebSocket closed'));
            return;
          }
          const timer = setTimeout(() => {
            openWaiters = openWaiters.filter((w) => w.resolve !== onResolve);
            reject(new Error('WebSocket open timeout'));
          }, timeoutMs);
          const onResolve = () => {
            clearTimeout(timer);
            resolve();
          };
          const onReject = (e: Error) => {
            clearTimeout(timer);
            reject(e);
          };
          openWaiters.push({ resolve: onResolve, reject: onReject });
        }),
      request,
      createSession: async (params = {}) => {
        const result = await request('session.create', {
          source: 'tabs',
          cols: 96,
          ...params,
        });
        return parseLiveSession(result);
      },
      resumeSession: async (storedSessionId, params = {}) => {
        const result = await request('session.resume', {
          session_id: storedSessionId,
          source: 'tabs',
          cols: 96,
          ...params,
        });
        const live = parseLiveSession(result);
        // Prefer the stored id we asked for when gateway omits stored_session_id.
        return {
          sessionId: live.sessionId,
          storedSessionId: live.storedSessionId ?? storedSessionId,
        };
      },
      submitPrompt: (sessionId, text) =>
        request(
          'prompt.submit',
          { session_id: sessionId, text },
          // First turn can wait on agent build + model; match desktop order of magnitude.
          120_000,
        ),
      close: () => {
        rejectAll('WebSocket closed');
        ws.close();
      },
      get readyState() {
        return ws.readyState;
      },
    };
  },

  connectEvents(onEvent: (ev: HermesGatewayEvent) => void): () => void {
    let ws: WebSocket | null = null;
    let closed = false;
    let delay = 1000;
    const open = () => {
      if (closed) return;
      ws = new WebSocket(wsUrlFor('/hermes/api/events'));
      ws.onopen = () => {
        delay = 1000;
      };
      ws.onmessage = (m) => {
        const ev = parseGatewayFrame(typeof m.data === 'string' ? m.data : String(m.data));
        if (ev) onEvent(ev);
      };
      ws.onclose = () => {
        if (!closed) {
          const next = delay;
          delay = Math.min(delay * 2, 30000);
          setTimeout(open, next);
        }
      };
    };
    open();
    return () => {
      closed = true;
      ws?.close();
    };
  },
};
