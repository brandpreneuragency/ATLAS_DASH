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

export interface HermesChatConnection {
  send(text: string, sessionId?: string | null): void;
  /** JSON-RPC request/response on the chat gateway socket (approval.respond, etc.). */
  request(method: string, params: Record<string, unknown>): Promise<unknown>;
  close(): void;
}

let _rpcId = 0;

type PendingRpc = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

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

    const rejectAll = (reason: string) => {
      for (const [, p] of pending) {
        clearTimeout(p.timer);
        p.reject(new Error(reason));
      }
      pending.clear();
    };

    ws.onopen = () => handlers.onOpen?.();
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
          error?: { message?: string };
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
              p.reject(new Error(frame.error.message ?? 'RPC error'));
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
    return {
      // Desktop outbound frame (apps/shared JsonRpcGatewayClient + prompt.submit):
      // { jsonrpc: "2.0", id, method: "prompt.submit", params: { session_id, text } }
      send: (text, sessionId) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id: ++_rpcId,
            method: 'prompt.submit',
            params: { session_id: sessionId ?? null, text },
          }),
        );
      },
      request: (method, params) =>
        new Promise((resolve, reject) => {
          if (ws.readyState !== WebSocket.OPEN) {
            reject(new Error('gateway not connected'));
            return;
          }
          const id = ++_rpcId;
          const timer = setTimeout(() => {
            pending.delete(id);
            reject(new Error(`RPC timeout: ${method}`));
          }, 30_000);
          pending.set(id, { resolve, reject, timer });
          ws.send(
            JSON.stringify({
              jsonrpc: '2.0',
              id,
              method,
              params,
            }),
          );
        }),
      close: () => {
        rejectAll('WebSocket closed');
        ws.close();
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
