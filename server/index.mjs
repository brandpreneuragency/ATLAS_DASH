// server/index.mjs — 127.0.0.1-only API: /fs/*, /hermes/*, /terminal, /healthz.
// Auth happens at the Caddy edge; this process must never bind a public interface.
import http from 'node:http';
import { URL } from 'node:url';
import { createFsHandlers, HttpError } from './lib/fs-handlers.mjs';
import { createHermesProxy } from './lib/hermes-proxy.mjs';
import { createHermesSession } from './lib/hermes-session.mjs';
import { createTerminalWs } from './lib/terminal-ws.mjs';

const PORT = Number(process.env.ATLAS_DASH_API_PORT || 4010);
const roots = JSON.parse(process.env.ATLAS_DASH_FS_ROOTS || '[]');
const allowSensitive = process.env.ATLAS_DASH_FS_ALLOW_SENSITIVE === '1';
const fsHandlers = createFsHandlers({ roots, allowSensitive });
const hermesTarget = process.env.HERMES_DASHBOARD_URL || 'http://127.0.0.1:9119';
const hermesSession = createHermesSession({
  target: hermesTarget,
  username: process.env.HERMES_BASIC_AUTH_USER || '',
  password: process.env.HERMES_BASIC_AUTH_PASSWORD || '',
  // Local mint path (HMAC with dashboard.basic_auth.secret) when password is unset
  secret: process.env.HERMES_BASIC_AUTH_SECRET || '',
  provider: process.env.HERMES_BASIC_AUTH_PROVIDER || 'basic',
  accessTtlSeconds: Number(process.env.HERMES_BASIC_AUTH_TTL_SECONDS || 0) || undefined,
});
const hermes = createHermesProxy({
  target: hermesTarget,
  token: process.env.HERMES_DASHBOARD_SESSION_TOKEN || '',
  session: hermesSession,
});
const terminal = createTerminalWs();

async function readJsonBody(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

const GET_ROUTES = { '/fs/roots': 'roots', '/fs/list': 'list', '/fs/stat': 'stat', '/fs/exists': 'exists' };
const POST_ROUTES = { '/fs/write': 'write', '/fs/mkdir': 'mkdir', '/fs/remove': 'remove', '/fs/rename': 'rename' };

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end('{"ok":true}');
    }
    if (await hermes.handleHttp(req, res)) return;

    const url = new URL(req.url, 'http://x');
    const params = Object.fromEntries(url.searchParams);

    if (req.method === 'GET' && url.pathname === '/fs/read') {
      const text = await fsHandlers.readText(params);
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end(text);
    }
    if (req.method === 'GET' && url.pathname === '/fs/read-bin') {
      const buf = await fsHandlers.readBin(params);
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      return res.end(buf);
    }
    const getOp = req.method === 'GET' && GET_ROUTES[url.pathname];
    const postOp = req.method === 'POST' && POST_ROUTES[url.pathname];
    if (getOp || postOp) {
      const args = getOp ? params : await readJsonBody(req);
      const result = await fsHandlers[getOp || postOp](args);
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(result));
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end('{"error":"not found"}');
  } catch (err) {
    const status = err instanceof HttpError ? err.status : err.code === 'ENOENT' ? 404 : 500;
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.on('upgrade', (req, socket, head) => {
  if (terminal.handleUpgrade(req, socket, head)) return;
  Promise.resolve(hermes.handleUpgrade(req, socket, head))
    .then((handled) => {
      if (!handled) socket.destroy();
    })
    .catch((err) => {
      console.error('[atlas_dash_api] ws upgrade error:', err.message);
      socket.destroy();
    });
});

server.listen(PORT, '127.0.0.1', () => console.log(`atlas_dash_api on 127.0.0.1:${PORT}`));
