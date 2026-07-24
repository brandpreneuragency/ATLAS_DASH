// server/lib/terminal-ws.mjs — interactive VPS shell over WebSocket.
// Protocol: binary/text I/O; resize via `\x1b[RESIZE:cols;rows]` (Hermes-compatible).
import { WebSocketServer } from 'ws';
import pty from 'node-pty';

const RESIZE_RE = /^\x1b\[RESIZE:(\d+);(\d+)\]$/;

/**
 * @param {{
 *   enabled?: boolean,
 *   shell?: string,
 *   cwd?: string,
 *   pathPrefix?: string,
 * }} [opts]
 */
export function createTerminalWs(opts = {}) {
  const enabled = opts.enabled !== false && process.env.ATLAS_DASH_TERMINAL_ENABLED !== '0';
  const shell =
    opts.shell ||
    process.env.ATLAS_DASH_TERMINAL_SHELL ||
    (process.platform === 'win32' ? 'powershell.exe' : '/bin/bash');
  const cwd =
    opts.cwd ||
    process.env.ATLAS_DASH_TERMINAL_CWD ||
    process.env.HOME ||
    '/home/admin';
  const pathPrefix = opts.pathPrefix || '/terminal';

  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/', 'http://x');
    const cols = Math.max(20, Number(url.searchParams.get('cols') || 80) || 80);
    const rows = Math.max(5, Number(url.searchParams.get('rows') || 24) || 24);

    let term;
    try {
      term = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          HOME: process.env.HOME || cwd,
        },
      });
    } catch (err) {
      ws.send(`\r\n\x1b[31mFailed to start shell: ${err.message}\x1b[0m\r\n`);
      ws.close(1011, 'pty spawn failed');
      return;
    }

    term.onData((data) => {
      if (ws.readyState === ws.OPEN) ws.send(data);
    });

    term.onExit(({ exitCode }) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(`\r\n\x1b[90m[shell exited: ${exitCode ?? '?'}]\x1b[0m\r\n`);
        ws.close(1000, 'shell exited');
      }
    });

    ws.on('message', (raw) => {
      const text = typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf8');
      const match = RESIZE_RE.exec(text);
      if (match) {
        const nextCols = Math.max(20, Number(match[1]) || cols);
        const nextRows = Math.max(5, Number(match[2]) || rows);
        try {
          term.resize(nextCols, nextRows);
        } catch {
          /* ignore */
        }
        return;
      }
      term.write(text);
    });

    const kill = () => {
      try {
        term.kill();
      } catch {
        /* ignore */
      }
    };
    ws.on('close', kill);
    ws.on('error', kill);
  });

  return {
    /**
     * Handle an HTTP upgrade. Returns true if claimed (including rejected
     * /terminal when disabled).
     * @param {import('node:http').IncomingMessage} req
     * @param {import('node:stream').Duplex} socket
     * @param {Buffer} head
     */
    handleUpgrade(req, socket, head) {
      const url = new URL(req.url || '/', 'http://x');
      if (url.pathname !== pathPrefix) return false;

      if (!enabled) {
        socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return true;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
      return true;
    },
  };
}
