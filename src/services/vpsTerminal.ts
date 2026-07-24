// Browser client for the VPS shell WebSocket served by atlas_dash_api.
// Protocol mirrors Hermes PTY framing: binary I/O, resize via `\x1b[RESIZE:cols;rows]`.

import { wsUrlFor } from './hermes/client';

export interface VpsTerminalHandlers {
  id: string;
  cols: number;
  rows: number;
  onData: (text: string) => void;
  onOpen?: () => void;
  onClose?: (reason?: string) => void;
  onError?: (message: string) => void;
}

export interface VpsTerminalSession {
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  close: () => void;
}

function decodeBytes(data: ArrayBuffer | Blob | string): Promise<string> {
  if (typeof data === 'string') return Promise.resolve(data);
  if (data instanceof ArrayBuffer) {
    return Promise.resolve(new TextDecoder('utf-8', { fatal: false }).decode(data));
  }
  return data.arrayBuffer().then((buf) =>
    new TextDecoder('utf-8', { fatal: false }).decode(buf),
  );
}

export function connectVpsTerminal(handlers: VpsTerminalHandlers): VpsTerminalSession {
  const params = new URLSearchParams({
    id: handlers.id,
    cols: String(handlers.cols),
    rows: String(handlers.rows),
  });
  const url = wsUrlFor(`/terminal?${params.toString()}`);
  const ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';

  let closedByClient = false;

  ws.onopen = () => {
    handlers.onOpen?.();
    // Push an initial resize so the PTY matches the viewport.
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(`\x1b[RESIZE:${handlers.cols};${handlers.rows}]`);
    }
  };

  ws.onmessage = (ev) => {
    void decodeBytes(ev.data as ArrayBuffer | Blob | string).then((text) => {
      handlers.onData(text);
    });
  };

  ws.onerror = () => {
    handlers.onError?.(
      'VPS terminal connection failed. Is atlas_dash_api running with /terminal enabled?',
    );
  };

  ws.onclose = (ev) => {
    if (closedByClient) return;
    const reason = ev.reason || (ev.code ? `code ${ev.code}` : undefined);
    handlers.onClose?.(reason);
  };

  return {
    write(data: string) {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    },
    resize(cols: number, rows: number) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(`\x1b[RESIZE:${cols};${rows}]`);
      }
    },
    close() {
      closedByClient = true;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    },
  };
}
