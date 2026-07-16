# TABS Web on VPS as Hermes Client — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the obsolete TABS stack on the VPS with the current TABS web build, served behind Caddy basic-auth, acting as the client to the Hermes agent: gateway proxy, a new CHAT mode with session history, VPS folders in Doc Mode, an approvals inbox, and a memory browser.

**Architecture:** A small Node service (`tabs_api`) runs with **host networking** on the VPS so it can reach the Hermes dashboard API on `127.0.0.1:9119` (loopback-only) and the local filesystem. Caddy (also host network) terminates TLS + basic-auth, serves the static TABS web build, and proxies `/hermes/*` and `/fs/*` to `tabs_api` on `127.0.0.1:4010`. The React app detects the remote runtime and swaps in a `RemoteFolderConnector` (the codebase already has a Tauri/Browser connector bridge for exactly this).

**Tech Stack:** React 19 + Vite + Zustand (existing TABS), Node 22 + `http-proxy` (new `server/`), Caddy 2, Docker Compose, Hermes dashboard REST/WS API.

## Global Constraints

- Domain: `tabs.brandpreneur.net` (unchanged). Caddy must ALSO keep serving `atlas.brandpreneur.net` (proxy to `127.0.0.1:8700`) and `wagneratelier.co` (static files at `/var/www/wagneratelier`) — user decision 2026-07-16.
- Edge auth: Caddy `basic_auth` on the TABS site only. `tabs_api` binds `127.0.0.1:4010` and is never exposed publicly. Hermes ports 9119/8642 are NEVER exposed publicly.
- Doc Mode roots (user decision): `home` → `/home/admin` (rw), `atlas` → `/home/admin/atlas` (rw), `memories` → `/home/admin/.hermes/memories` (rw). The fs API must refuse to serve `.env*` files and anything under `/.hermes/` **except** the memories root, unless `TABS_FS_ALLOW_SENSITIVE=1`.
- VPS access: non-interactive SSH only — `ssh -o BatchMode=yes admin@142.132.230.137 "cmd"`. Canonical rulebook `C:\00_ATLAS\VPS_AGENTS.md` applies. Never print secrets (`/opt/data/.env`, `~/.hermes/*`, tokens) to the transcript.
- Hermes container: read-only for this plan EXCEPT Task 6 (adding `HERMES_DASHBOARD_SESSION_TOKEN`), which recreates the container and requires the user's explicit "Approve" in-session before running.
- Reference source (read-only, do not modify): Hermes desktop app at `C:\Users\burak\AppData\Local\hermes\hermes-agent\apps\desktop\src\` and dashboard server at `C:\Users\burak\AppData\Local\hermes\hermes-agent\hermes_cli\web_server.py`.
- Frontend conventions: components under `src/components/<area>/`, stores under `src/stores/`, services under `src/services/`. Tests with Vitest (`npm run test`). Full gate: `npm run check` (typecheck + lint + test + build).
- Node server code: ESM (`.mjs`), zero framework, only dependency `http-proxy@^1.18.1`. Testable logic goes in pure modules under `server/lib/`.
- Commit style: `feat:`/`fix:`/`chore:` prefixes, matching repo history.

## Verified Facts (do not re-derive)

- TABS repo: `https://github.com/brandpreneuragency/TABS.git`, branch `main`. There is NO Dockerfile/compose in the repo yet.
- Old VPS stack: compose project `tabs` (compose file already deleted from disk; containers still exist): `tabs_caddy_1` (exited), `tabs_web_1`, `a99f0d032e49_tabs_api_1`, `tabs_postgres_1`, `tabs-restore-postgres-1`, `tabs_backup_1` (exited). Images: `tabs-api`, `tabs_api`, `tabs-web`, `tabs_web`, `tabs-backup`, `tabs_backup`. Old Caddyfile lives at `/home/admin/tabs/Caddyfile` (KEEP as reference for the two carried-over sites).
- User approved deleting the old stack **including all data** (Postgres volumes). No backup required.
- Hermes dashboard server: `127.0.0.1:9119`, REST under `/api/*` (sessions, fs, memory, cron, analytics…), WebSockets `/api/ws`, `/api/events`, `/api/pub`, `/api/pty`, `/api/console`. Auth: if env `HERMES_DASHBOARD_SESSION_TOKEN` is set, `Authorization: Bearer <token>` works for HTTP and `?token=<token>` for WS upgrades (see `web_server.py:274-354`).
- `FolderConnector` interface: `src/services/folder-connector.ts` (state, `isAvailable`, `connectFolder`, `readDir`, `readTextFile`, `readBinaryFile`, `writeTextFile`, `mkdir`, `remove`, `rename`, `exists`, `getMetadata`, `pickSavePath`, `pickOpenFile`, `onStateChange`). Runtime selection: `src/services/runtime.ts` (`getFolderConnector()` picks `TauriFolderConnector` or `BrowserFolderConnector`).
- Mode switching: `src/stores/uiStore.ts` has `taskMode`/`crmMode` booleans (`setTaskMode` at ~line 441, `setCrmMode` at ~454, persisted via `db.settings.put`). `src/App.tsx` (~line 175) renders `<CRMWorkspace />` when `crmMode`. Mode buttons: `src/components/layout/LeftNarrowSidebar.tsx`.

---

### Task 1: Commit and push local working tree

**Files:**
- Modify: none (git only)

**Interfaces:**
- Produces: `origin/main` contains all current local work; VPS deploys from it.

- [ ] **Step 1: Run the full check gate**

Run: `npm run check`
Expected: typecheck, lint, tests, build all pass. If anything fails, fix it before proceeding (report to user if non-trivial).

- [ ] **Step 2: Review and stage everything**

```bash
git status --short   # review; expect the modified settings/editor/task files + deleted AGENTS.md, ModelsSection.tsx, ToolDetailPanel.tsx
git add -A
```

- [ ] **Step 3: Commit and push**

```bash
git commit -m "feat: sync working tree before VPS web deployment"
git push origin main
```

Expected: push succeeds; `git log origin/main -1` shows the new commit.

---

### Task 2: Tear down the old TABS stack on the VPS (DESTRUCTIVE — user pre-approved 2026-07-16)

**Files:**
- VPS only. Preserve: `/home/admin/tabs/Caddyfile` (reference), `/var/www/wagneratelier` (live site files).

**Interfaces:**
- Produces: no `tabs*` containers/images/volumes on the VPS; `/home/admin/tabs/` empty except `Caddyfile.old`.

- [ ] **Step 1: Snapshot what exists (evidence before deletion)**

```bash
ssh -o BatchMode=yes admin@142.132.230.137 "docker ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}' | grep -i tabs; docker volume ls --format '{{.Name}}' | grep -i tabs; ls /var/www/wagneratelier | head -5"
```

Expected: the 6 containers listed in Verified Facts; confirm `/var/www/wagneratelier` has site files (if it's missing, STOP — the new Caddy would serve an empty site).

- [ ] **Step 2: Preserve the old Caddyfile**

```bash
ssh -o BatchMode=yes admin@142.132.230.137 "cp /home/admin/tabs/Caddyfile /home/admin/tabs/Caddyfile.old"
```

- [ ] **Step 3: Remove containers, images, volumes**

```bash
ssh -o BatchMode=yes admin@142.132.230.137 "docker rm -f tabs_caddy_1 tabs_web_1 a99f0d032e49_tabs_api_1 tabs_postgres_1 tabs-restore-postgres-1 tabs_backup_1; docker volume ls --format '{{.Name}}' | grep -i tabs | xargs -r docker volume rm; docker rmi -f tabs-api tabs_api tabs-web tabs_web tabs-backup tabs_backup; docker network rm tabs_internal tabs_restore_internal 2>/dev/null || true"
```

Expected: all removed. Note: `atlas_control`, `hermes`, `searxng` must remain untouched — verify with `docker ps`.

- [ ] **Step 4: Verify teardown and report**

```bash
ssh -o BatchMode=yes admin@142.132.230.137 "docker ps -a | grep -i tabs || echo CLEAN; docker ps --format '{{.Names}}' | sort"
```

Expected: `CLEAN`, and `atlas_control`, `hermes`, `searxng` (+ others) still running. `atlas.brandpreneur.net` and `wagneratelier.co` are DOWN from this moment until Task 5 — acceptable, they were already down (old Caddy exited).

---

### Task 3: `tabs_api` server — filesystem API + Hermes proxy

**Files:**
- Create: `server/package.json`
- Create: `server/lib/paths.mjs`
- Create: `server/lib/hermes-proxy.mjs`
- Create: `server/lib/fs-handlers.mjs`
- Create: `server/index.mjs`
- Test: `server/lib/paths.test.mjs` (run with `node --test server/lib/`)

**Interfaces:**
- Consumes: env `TABS_API_PORT` (default 4010), `TABS_FS_ROOTS` (JSON array `[{id,label,path}]`), `TABS_FS_ALLOW_SENSITIVE` (`"1"` disables the sensitive-file block), `HERMES_DASHBOARD_URL` (default `http://127.0.0.1:9119`), `HERMES_DASHBOARD_SESSION_TOKEN`.
- Produces HTTP API on `127.0.0.1:<port>` used by Tasks 7-11:
  - `GET  /fs/roots` → `{ roots: [{id,label,path}] }`
  - `GET  /fs/list?root=<id>&path=<rel>` → `{ entries: [{name,path,kind}] }` (`path` is root-relative, `kind` is `"file"|"directory"`)
  - `GET  /fs/read?root=&path=` → text body; `GET /fs/read-bin?root=&path=` → raw bytes
  - `POST /fs/write` `{root,path,content}` → `{ok:true}`; `POST /fs/mkdir` `{root,path,recursive}`; `POST /fs/remove` `{root,path,recursive}`; `POST /fs/rename` `{root,from,to}`
  - `GET  /fs/stat?root=&path=` → `{size,modifiedAt,isDirectory,isFile}`; `GET /fs/exists?root=&path=` → `{exists:boolean}`
  - `ANY  /hermes/*` → proxied to `${HERMES_DASHBOARD_URL}/*` with `Authorization: Bearer <token>` injected (e.g. `GET /hermes/api/sessions` → `GET http://127.0.0.1:9119/api/sessions`). WS upgrades on `/hermes/api/ws|events|pub` proxied with `?token=<token>` appended.
  - `GET  /healthz` → `{ok:true}` (no auth, used by compose healthcheck)
- Errors: JSON `{error: string}` with 400 (bad path/root), 403 (sensitive), 404, 500.

- [ ] **Step 1: Write failing tests for path safety and sensitive-file rules**

```js
// server/lib/paths.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSafe, isSensitive } from './paths.mjs';

const roots = [
  { id: 'home', label: 'VPS Home', path: '/home/admin' },
  { id: 'memories', label: 'Hermes Memories', path: '/home/admin/.hermes/memories' },
];

test('resolves a normal relative path inside the root', () => {
  assert.equal(resolveSafe(roots[0], 'atlas/notes.md'), '/home/admin/atlas/notes.md');
});

test('rejects .. escape', () => {
  assert.equal(resolveSafe(roots[0], '../etc/passwd'), null);
  assert.equal(resolveSafe(roots[0], 'a/../../etc/passwd'), null);
});

test('rejects absolute path input', () => {
  assert.equal(resolveSafe(roots[0], '/etc/passwd'), null);
});

test('empty path resolves to the root itself', () => {
  assert.equal(resolveSafe(roots[0], ''), '/home/admin');
});

test('.env files are sensitive under any root', () => {
  assert.equal(isSensitive('/home/admin/project/.env', roots[0], roots), true);
  assert.equal(isSensitive('/home/admin/project/.env.local', roots[0], roots), true);
});

test('.hermes is sensitive via the home root', () => {
  assert.equal(isSensitive('/home/admin/.hermes/config.yaml', roots[0], roots), true);
});

test('.hermes/memories is NOT sensitive via the memories root', () => {
  assert.equal(isSensitive('/home/admin/.hermes/memories/notes.md', roots[1], roots), false);
});

test('regular files are not sensitive', () => {
  assert.equal(isSensitive('/home/admin/atlas/notes.md', roots[0], roots), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test server/lib/`
Expected: FAIL — `Cannot find module './paths.mjs'`

- [ ] **Step 3: Implement `server/lib/paths.mjs`**

```js
// Path-safety helpers for the fs API. Pure functions — no I/O.
import path from 'node:path';

/** Resolve a root-relative path; null if it escapes the root or is absolute. */
export function resolveSafe(root, relPath) {
  if (typeof relPath !== 'string') return null;
  if (relPath.startsWith('/') || relPath.startsWith('\\')) return null;
  const abs = path.posix.normalize(path.posix.join(root.path, relPath));
  if (abs !== root.path && !abs.startsWith(root.path + '/')) return null;
  return abs;
}

/**
 * A path is sensitive when it is an .env* file, or lives under a `.hermes/`
 * segment — unless the ACTIVE root is itself inside `.hermes` (the memories
 * root), which whitelists its own subtree.
 */
export function isSensitive(absPath, activeRoot, _roots) {
  const base = path.posix.basename(absPath);
  if (base === '.env' || base.startsWith('.env.')) return true;
  if (activeRoot.path.includes('/.hermes')) return false;
  return absPath.includes('/.hermes/') || absPath.endsWith('/.hermes');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test server/lib/`
Expected: all PASS.

- [ ] **Step 5: Implement the Hermes proxy module**

```js
// server/lib/hermes-proxy.mjs — proxies /hermes/* to the Hermes dashboard,
// injecting the session token (Bearer header for HTTP, ?token= for WS).
import httpProxy from 'http-proxy';

export function createHermesProxy({ target, token }) {
  const proxy = httpProxy.createProxyServer({ target, changeOrigin: false, ws: true });

  proxy.on('proxyReq', (proxyReq) => {
    if (token) proxyReq.setHeader('Authorization', `Bearer ${token}`);
  });

  return {
    /** Strip the /hermes prefix and forward. Returns true if handled. */
    handleHttp(req, res) {
      if (!req.url.startsWith('/hermes/')) return false;
      req.url = req.url.slice('/hermes'.length);
      proxy.web(req, res, {}, (err) => {
        res.writeHead(502, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: `hermes upstream: ${err.message}` }));
      });
      return true;
    },
    handleUpgrade(req, socket, head) {
      if (!req.url.startsWith('/hermes/')) return false;
      const bare = req.url.slice('/hermes'.length);
      req.url = token ? bare + (bare.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token) : bare;
      proxy.ws(req, socket, head, {}, () => socket.destroy());
      return true;
    },
  };
}
```

- [ ] **Step 6: Implement `server/lib/fs-handlers.mjs`**

```js
// server/lib/fs-handlers.mjs — one async handler per fs endpoint.
// All take (roots, allowSensitive) config and parsed request params.
import fs from 'node:fs/promises';
import { resolveSafe, isSensitive } from './paths.mjs';

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function locate(roots, allowSensitive, rootId, relPath) {
  const root = roots.find((r) => r.id === rootId);
  if (!root) throw new HttpError(400, `unknown root '${rootId}'`);
  const abs = resolveSafe(root, relPath ?? '');
  if (abs === null) throw new HttpError(400, 'path escapes root');
  if (!allowSensitive && isSensitive(abs, root, roots)) throw new HttpError(403, 'sensitive path blocked');
  return abs;
}

export function createFsHandlers({ roots, allowSensitive }) {
  return {
    roots: async () => ({ roots }),
    list: async ({ root, path: rel }) => {
      const abs = locate(roots, allowSensitive, root, rel);
      const dirents = await fs.readdir(abs, { withFileTypes: true });
      return {
        entries: dirents.map((d) => ({
          name: d.name,
          path: rel ? `${rel}/${d.name}` : d.name,
          kind: d.isDirectory() ? 'directory' : 'file',
        })),
      };
    },
    readText: async ({ root, path: rel }) =>
      fs.readFile(locate(roots, allowSensitive, root, rel), 'utf8'),
    readBin: async ({ root, path: rel }) =>
      fs.readFile(locate(roots, allowSensitive, root, rel)),
    write: async ({ root, path: rel, content }) => {
      await fs.writeFile(locate(roots, allowSensitive, root, rel), content ?? '', 'utf8');
      return { ok: true };
    },
    mkdir: async ({ root, path: rel, recursive }) => {
      await fs.mkdir(locate(roots, allowSensitive, root, rel), { recursive: recursive !== false });
      return { ok: true };
    },
    remove: async ({ root, path: rel, recursive }) => {
      await fs.rm(locate(roots, allowSensitive, root, rel), { recursive: !!recursive, force: false });
      return { ok: true };
    },
    rename: async ({ root, from, to }) => {
      await fs.rename(
        locate(roots, allowSensitive, root, from),
        locate(roots, allowSensitive, root, to),
      );
      return { ok: true };
    },
    stat: async ({ root, path: rel }) => {
      const s = await fs.stat(locate(roots, allowSensitive, root, rel));
      return { size: s.size, modifiedAt: s.mtime.toISOString(), isDirectory: s.isDirectory(), isFile: s.isFile() };
    },
    exists: async ({ root, path: rel }) => {
      try { await fs.access(locate(roots, allowSensitive, root, rel)); return { exists: true }; }
      catch (e) { if (e.status) throw e; return { exists: false }; }
    },
  };
}
export { HttpError };
```

- [ ] **Step 7: Implement `server/index.mjs` and `server/package.json`**

```json
{
  "name": "tabs-api",
  "private": true,
  "type": "module",
  "scripts": { "start": "node index.mjs", "test": "node --test lib/" },
  "dependencies": { "http-proxy": "^1.18.1" }
}
```

```js
// server/index.mjs — 127.0.0.1-only API: /fs/* (VPS files), /hermes/* (proxy), /healthz.
// Auth happens at the Caddy edge; this process must never bind a public interface.
import http from 'node:http';
import { URL } from 'node:url';
import { createFsHandlers, HttpError } from './lib/fs-handlers.mjs';
import { createHermesProxy } from './lib/hermes-proxy.mjs';

const PORT = Number(process.env.TABS_API_PORT || 4010);
const roots = JSON.parse(process.env.TABS_FS_ROOTS || '[]');
const allowSensitive = process.env.TABS_FS_ALLOW_SENSITIVE === '1';
const fsHandlers = createFsHandlers({ roots, allowSensitive });
const hermes = createHermesProxy({
  target: process.env.HERMES_DASHBOARD_URL || 'http://127.0.0.1:9119',
  token: process.env.HERMES_DASHBOARD_SESSION_TOKEN || '',
});

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
    if (hermes.handleHttp(req, res)) return;

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
  if (!hermes.handleUpgrade(req, socket, head)) socket.destroy();
});

server.listen(PORT, '127.0.0.1', () => console.log(`tabs_api on 127.0.0.1:${PORT}`));
```

- [ ] **Step 8: Install dep, run tests, smoke-test locally**

```bash
cd server && npm install && npm test
TABS_FS_ROOTS='[{"id":"tmp","label":"Tmp","path":"'"$PWD"'"}]' node index.mjs &
curl -s http://127.0.0.1:4010/healthz          # {"ok":true}
curl -s "http://127.0.0.1:4010/fs/roots"       # roots JSON
curl -s "http://127.0.0.1:4010/fs/list?root=tmp&path="  # entries incl. package.json
kill %1
```

Expected: tests pass, all three curls return expected JSON.

- [ ] **Step 9: Commit**

```bash
git add server/
git commit -m "feat(server): tabs_api with VPS fs API and Hermes dashboard proxy"
```

---

### Task 4: Deploy assets — Dockerfiles, Caddyfile, compose

**Files:**
- Create: `deploy/Dockerfile.web`
- Create: `deploy/Dockerfile.api`
- Create: `deploy/Caddyfile`
- Create: `deploy/docker-compose.yml`
- Create: `deploy/.env.example`

**Interfaces:**
- Consumes: `server/` from Task 3; Vite build (`npm run build` → `dist/`).
- Produces: `docker compose -p tabs -f deploy/docker-compose.yml up -d --build` brings up `tabs_caddy` + `tabs_api`, both `network_mode: host`.
- `.env` keys (VPS-only, never committed): `TABS_BASIC_AUTH_USER`, `TABS_BASIC_AUTH_HASH` (bcrypt from `caddy hash-password`), `HERMES_DASHBOARD_SESSION_TOKEN`, `TABS_FS_ROOTS`.

- [ ] **Step 1: Write `deploy/Dockerfile.web`**

```dockerfile
# Build the TABS web bundle, serve it (plus 2 legacy sites) with Caddy.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv/tabs-web
```

- [ ] **Step 2: Write `deploy/Dockerfile.api`**

```dockerfile
FROM node:22-alpine
WORKDIR /srv/tabs-api
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev
COPY server/ .
USER 1000:1000
CMD ["node", "index.mjs"]
```

- [ ] **Step 3: Write `deploy/Caddyfile`**

```
# TABS web + API (basic-auth protected)
tabs.brandpreneur.net {
	encode zstd gzip
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
		-Server
	}
	basic_auth {
		{$TABS_BASIC_AUTH_USER} {$TABS_BASIC_AUTH_HASH}
	}
	handle /fs/* {
		reverse_proxy 127.0.0.1:4010
	}
	handle /hermes/* {
		reverse_proxy 127.0.0.1:4010
	}
	handle {
		root * /srv/tabs-web
		try_files {path} /index.html
		file_server
	}
}

# Atlas Control (carried over; atlas_control publishes 127.0.0.1:8700)
atlas.brandpreneur.net {
	encode zstd gzip
	reverse_proxy 127.0.0.1:8700
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
		-Server
	}
}

# Wagner Atelier (carried over; static)
wagneratelier.co {
	encode zstd gzip
	root * /var/www/wagneratelier
	file_server
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
		-Server
	}
}
www.wagneratelier.co {
	redir https://wagneratelier.co{uri}
}
```

Note: the old Caddyfile proxied by docker-DNS names (`api:4000`, `atlas_control:8700`); the new one is host-network so everything is `127.0.0.1`. WebSocket upgrades pass through `reverse_proxy` automatically.

- [ ] **Step 4: Write `deploy/docker-compose.yml` and `.env.example`**

```yaml
services:
  caddy:
    build:
      context: ..
      dockerfile: deploy/Dockerfile.web
    container_name: tabs_caddy
    network_mode: host
    restart: unless-stopped
    environment:
      TABS_BASIC_AUTH_USER: ${TABS_BASIC_AUTH_USER}
      TABS_BASIC_AUTH_HASH: ${TABS_BASIC_AUTH_HASH}
    volumes:
      - caddy_data:/data
      - caddy_config:/config
      - /var/www/wagneratelier:/var/www/wagneratelier:ro

  api:
    build:
      context: ..
      dockerfile: deploy/Dockerfile.api
    container_name: tabs_api
    network_mode: host
    restart: unless-stopped
    environment:
      TABS_API_PORT: "4010"
      TABS_FS_ROOTS: ${TABS_FS_ROOTS}
      HERMES_DASHBOARD_URL: "http://127.0.0.1:9119"
      HERMES_DASHBOARD_SESSION_TOKEN: ${HERMES_DASHBOARD_SESSION_TOKEN}
    volumes:
      - /home/admin:/home/admin
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:4010/healthz"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  caddy_data:
  caddy_config:
```

```bash
# deploy/.env.example — copy to .env on the VPS and fill in. NEVER commit .env.
TABS_BASIC_AUTH_USER=burak
TABS_BASIC_AUTH_HASH=   # docker run --rm caddy:2-alpine caddy hash-password --plaintext 'YOUR-PASSWORD'
HERMES_DASHBOARD_SESSION_TOKEN=   # generated in Task 6
TABS_FS_ROOTS=[{"id":"home","label":"VPS Home","path":"/home/admin"},{"id":"atlas","label":"ATLAS","path":"/home/admin/atlas"},{"id":"memories","label":"Hermes Memories","path":"/home/admin/.hermes/memories"}]
```

- [ ] **Step 5: Verify compose parses and the web image builds locally**

```bash
docker compose -f deploy/docker-compose.yml config -q && echo COMPOSE-OK
docker build -f deploy/Dockerfile.api -t tabs-api-test . && echo API-IMAGE-OK
```

Expected: `COMPOSE-OK`, `API-IMAGE-OK`. (Skip the web image locally if slow — it builds on the VPS in Task 5.)

- [ ] **Step 6: Add `.env` to gitignore scope and commit**

```bash
grep -q "deploy/.env" .gitignore || echo "deploy/.env" >> .gitignore
git add deploy/ .gitignore
git commit -m "feat(deploy): dockerized web+api stack with host networking and carried-over Caddy sites"
git push origin main
```

---

### Task 5: Install on the VPS

**Files:**
- VPS: clone at `/home/admin/tabs/app`, env at `/home/admin/tabs/app/deploy/.env`.

**Interfaces:**
- Consumes: pushed `main` (Tasks 1-4), user-provided basic-auth password (ask in chat — the agent must NOT invent or handle it beyond passing the user's chosen value into the remote `.env`; better: give the user the one-liner to run themselves if they prefer).
- Produces: `https://tabs.brandpreneur.net` serving TABS behind basic-auth; atlas + wagneratelier live again.

- [ ] **Step 1: Clone the repo on the VPS**

```bash
ssh -o BatchMode=yes admin@142.132.230.137 "git clone https://github.com/brandpreneuragency/TABS.git /home/admin/tabs/app && cd /home/admin/tabs/app && git log -1 --format='%h %s'"
```

Expected: latest commit from Task 4.

- [ ] **Step 2: Create `.env` on the VPS**

Ask the user in chat for the basic-auth username+password OR have them run the hash command themselves. Then:

```bash
# hash the password on the VPS (does not echo the hash into chat if run by user)
ssh -o BatchMode=yes admin@142.132.230.137 "cd /home/admin/tabs/app/deploy && cp .env.example .env && docker run --rm caddy:2-alpine caddy hash-password --plaintext 'PASSWORD-FROM-USER' | xargs -I{} sed -i 's|^TABS_BASIC_AUTH_HASH=.*|TABS_BASIC_AUTH_HASH={}|' .env && sed -i 's|^TABS_BASIC_AUTH_USER=.*|TABS_BASIC_AUTH_USER=USERNAME-FROM-USER|' .env && chmod 600 .env"
```

`HERMES_DASHBOARD_SESSION_TOKEN` stays empty until Task 6 — the stack still starts; only `/hermes/*` calls will 401.

- [ ] **Step 3: Build and start**

```bash
ssh -o BatchMode=yes admin@142.132.230.137 "cd /home/admin/tabs/app/deploy && docker compose -p tabs up -d --build 2>&1 | tail -5; docker ps --format '{{.Names}}\t{{.Status}}' | grep tabs"
```

Expected: `tabs_caddy` and `tabs_api` Up. First build takes several minutes (npm ci + vite build).

- [ ] **Step 4: Verify all three sites end-to-end**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://tabs.brandpreneur.net          # 401 (basic-auth challenge)
curl -s -o /dev/null -w "%{http_code}\n" -u USER:PASS https://tabs.brandpreneur.net   # 200
curl -s -o /dev/null -w "%{http_code}\n" https://atlas.brandpreneur.net        # 200 (or Atlas's own auth page)
curl -s -o /dev/null -w "%{http_code}\n" https://wagneratelier.co              # 200
curl -s -u USER:PASS "https://tabs.brandpreneur.net/fs/roots"                  # roots JSON
```

Expected codes as annotated. If TLS fails, wait ~1 min for Caddy's ACME issuance and check `docker logs tabs_caddy`.

---

### Task 6: Hermes session token (REQUIRES USER "Approve" — recreates the hermes container)

**Files:**
- VPS: hermes container env; `/home/admin/tabs/app/deploy/.env`.

**Interfaces:**
- Produces: a stable `HERMES_DASHBOARD_SESSION_TOKEN` shared by hermes and tabs_api; `GET https://tabs.brandpreneur.net/hermes/api/status` returns 200.

- [ ] **Step 1: Ask the user for explicit approval**

Message: "Task 6 recreates the `hermes` container to add the `HERMES_DASHBOARD_SESSION_TOKEN` env var (required so tabs_api can authenticate to the dashboard). Hermes will restart (sessions persist in /opt/data). Approve?" Do NOT proceed without an explicit "Approve".

- [ ] **Step 2: Discover how hermes is started**

```bash
ssh -o BatchMode=yes admin@142.132.230.137 "docker inspect hermes --format '{{index .Config.Labels \"com.docker.compose.project.working_dir\"}}'; ls /home/admin/hermes-config-bootstrap 2>/dev/null"
```

If compose-managed: edit that compose file to add the env var. If started by `docker run`: capture the full config first (`docker inspect hermes > /home/admin/hermes-inspect-backup.json`), then recreate with the same mounts/network plus the new env. Follow `C:\00_ATLAS\VPS_AGENTS.md` Risk Card protocol.

- [ ] **Step 3: Generate token and wire it into BOTH env locations**

```bash
ssh -o BatchMode=yes admin@142.132.230.137 "TOKEN=\$(openssl rand -hex 32); sed -i \"s|^HERMES_DASHBOARD_SESSION_TOKEN=.*|HERMES_DASHBOARD_SESSION_TOKEN=\$TOKEN|\" /home/admin/tabs/app/deploy/.env; echo \$TOKEN > /home/admin/.hermes-dashboard-token && chmod 600 /home/admin/.hermes-dashboard-token && echo TOKEN-STORED"
```

Then add `HERMES_DASHBOARD_SESSION_TOKEN` (reading from `/home/admin/.hermes-dashboard-token`) to the hermes container definition found in Step 2 and recreate it. Never echo the token value into the transcript.

- [ ] **Step 4: Restart tabs_api and verify the proxy chain**

```bash
ssh -o BatchMode=yes admin@142.132.230.137 "cd /home/admin/tabs/app/deploy && docker compose -p tabs up -d api"
curl -s -u USER:PASS "https://tabs.brandpreneur.net/hermes/api/status" | head -c 200
```

Expected: JSON status from Hermes (not `{"error":...}` and not a 401).

---

### Task 7: Frontend service layer — `tabsApi` + Hermes client

**Files:**
- Create: `src/services/tabsApi.ts`
- Create: `src/services/hermes/client.ts`
- Create: `src/services/hermes/types.ts`
- Test: `src/services/hermes/client.test.ts`

**Interfaces:**
- Produces (used by Tasks 8-11):
  - `tabsApi.available(): Promise<boolean>` — probes `GET /fs/roots` (2s timeout, cached)
  - `tabsApi.fs.<op>` — thin typed wrappers over every `/fs/*` endpoint from Task 3
  - `hermesClient.listSessions(): Promise<HermesSession[]>` — `GET /hermes/api/sessions`
  - `hermesClient.getMessages(sessionId): Promise<HermesMessage[]>` — `GET /hermes/api/sessions/{id}/messages`
  - `hermesClient.deleteSession(id)`, `hermesClient.renameSession(id, title)` (`DELETE`/`PATCH /hermes/api/sessions/{id}`)
  - `hermesClient.connectChat(handlers): HermesChatConnection` — WS to `/hermes/api/ws`; `connection.send(text, sessionId?)`; handlers: `onEvent(raw)`, `onOpen`, `onClose`
  - `hermesClient.connectEvents(onEvent): () => void` — WS to `/hermes/api/events`, returns disconnect fn, auto-reconnects with backoff
- All URLs are same-origin relative (`/hermes/...`, `/fs/...`) — basic-auth rides along automatically; WS URLs via `new URL(path, location.href)` with `ws(s)` protocol swap.

- [ ] **Step 1: Extract the exact WS message schema from the reference desktop client**

Read these reference files (read-only) and record the message/event type names into `src/services/hermes/types.ts`:
- `C:\Users\burak\AppData\Local\hermes\hermes-agent\apps\desktop\src\hermes.ts` (functions `listAllProfileSessions` at line ~231, `getSessionMessages` at ~295, and the send/connect logic around its WS usage)
- `C:\Users\burak\AppData\Local\hermes\hermes-agent\apps\desktop\src\app\session\hooks\use-message-stream\gateway-event.ts` (event discrimination)

Acceptance for this step: `types.ts` contains a `HermesGatewayEvent` union covering at minimum message-delta, message-complete, error, and approval events, with field names copied from the reference — not invented.

- [ ] **Step 2: Write failing tests for the pure parts**

```ts
// src/services/hermes/client.test.ts
import { describe, expect, it } from 'vitest';
import { wsUrlFor } from './client';

describe('wsUrlFor', () => {
  it('builds a same-origin ws url from a relative path', () => {
    expect(wsUrlFor('/hermes/api/ws', 'https://tabs.brandpreneur.net/'))
      .toBe('wss://tabs.brandpreneur.net/hermes/api/ws');
  });
  it('uses ws for http origins', () => {
    expect(wsUrlFor('/hermes/api/events', 'http://localhost:5173/'))
      .toBe('ws://localhost:5173/hermes/api/events');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/services/hermes/client.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `tabsApi.ts` and `hermes/client.ts`**

`tabsApi.ts` — availability probe + fs wrappers:

```ts
// src/services/tabsApi.ts — same-origin client for the tabs_api service.
export interface FsRoot { id: string; label: string; path: string }
export interface FsEntry { name: string; path: string; kind: 'file' | 'directory' }

let _available: boolean | null = null;

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text().catch(() => '')}`);
  return res.json() as Promise<T>;
}

export const tabsApi = {
  async available(): Promise<boolean> {
    if (_available !== null) return _available;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2000);
      const res = await fetch('/fs/roots', { signal: ctrl.signal });
      clearTimeout(t);
      _available = res.ok;
    } catch { _available = false; }
    return _available;
  },
  fs: {
    roots: () => json<{ roots: FsRoot[] }>('/fs/roots').then((r) => r.roots),
    list: (root: string, path: string) =>
      json<{ entries: FsEntry[] }>(`/fs/list?root=${root}&path=${encodeURIComponent(path)}`).then((r) => r.entries),
    readText: (root: string, path: string) =>
      fetch(`/fs/read?root=${root}&path=${encodeURIComponent(path)}`).then((r) => {
        if (!r.ok) throw new Error(`read ${path}: ${r.status}`);
        return r.text();
      }),
    readBin: (root: string, path: string) =>
      fetch(`/fs/read-bin?root=${root}&path=${encodeURIComponent(path)}`).then(async (r) => {
        if (!r.ok) throw new Error(`read-bin ${path}: ${r.status}`);
        return new Uint8Array(await r.arrayBuffer());
      }),
    write: (root: string, path: string, content: string) =>
      json<{ ok: true }>('/fs/write', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ root, path, content }) }),
    mkdir: (root: string, path: string, recursive = true) =>
      json<{ ok: true }>('/fs/mkdir', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ root, path, recursive }) }),
    remove: (root: string, path: string, recursive = false) =>
      json<{ ok: true }>('/fs/remove', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ root, path, recursive }) }),
    rename: (root: string, from: string, to: string) =>
      json<{ ok: true }>('/fs/rename', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ root, from, to }) }),
    stat: (root: string, path: string) =>
      json<{ size: number; modifiedAt: string; isDirectory: boolean; isFile: boolean }>(`/fs/stat?root=${root}&path=${encodeURIComponent(path)}`),
    exists: (root: string, path: string) =>
      json<{ exists: boolean }>(`/fs/exists?root=${root}&path=${encodeURIComponent(path)}`).then((r) => r.exists),
  },
};
```

`hermes/client.ts` — sessions REST + chat/events WS (event payload types from Step 1's `types.ts`):

```ts
// src/services/hermes/client.ts
import type { HermesGatewayEvent, HermesMessage, HermesSession } from './types';

export function wsUrlFor(path: string, origin: string = window.location.href): string {
  const u = new URL(path, origin);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u.toString();
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export interface HermesChatConnection {
  send(text: string, sessionId?: string | null): void;
  close(): void;
}

export const hermesClient = {
  listSessions: () => json<HermesSession[]>('/hermes/api/sessions'),
  getMessages: (id: string) => json<HermesMessage[]>(`/hermes/api/sessions/${encodeURIComponent(id)}/messages`),
  deleteSession: (id: string) => fetch(`/hermes/api/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  renameSession: (id: string, title: string) =>
    fetch(`/hermes/api/sessions/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title }),
    }),

  connectChat(handlers: {
    onEvent: (ev: HermesGatewayEvent) => void; onOpen?: () => void; onClose?: () => void;
  }): HermesChatConnection {
    const ws = new WebSocket(wsUrlFor('/hermes/api/ws'));
    ws.onopen = () => handlers.onOpen?.();
    ws.onclose = () => handlers.onClose?.();
    ws.onmessage = (m) => { try { handlers.onEvent(JSON.parse(m.data)); } catch { /* non-JSON frame */ } };
    return {
      // NOTE: exact outbound frame shape comes from Step 1 (desktop hermes.ts).
      // Adjust the object below to match the recorded schema before shipping.
      send: (text, sessionId) => ws.send(JSON.stringify({ type: 'prompt', text, session_id: sessionId ?? null })),
      close: () => ws.close(),
    };
  },

  connectEvents(onEvent: (ev: HermesGatewayEvent) => void): () => void {
    let ws: WebSocket | null = null;
    let closed = false;
    let delay = 1000;
    const open = () => {
      if (closed) return;
      ws = new WebSocket(wsUrlFor('/hermes/api/events'));
      ws.onopen = () => { delay = 1000; };
      ws.onmessage = (m) => { try { onEvent(JSON.parse(m.data)); } catch { /* skip */ } };
      ws.onclose = () => { if (!closed) setTimeout(open, delay = Math.min(delay * 2, 30000)); };
    };
    open();
    return () => { closed = true; ws?.close(); };
  },
};
```

- [ ] **Step 5: Run tests, typecheck**

Run: `npx vitest run src/services/hermes/client.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/tabsApi.ts src/services/hermes/
git commit -m "feat(services): tabs_api client and Hermes session/chat/events client"
```

---

### Task 8: `RemoteFolderConnector` — VPS folders in Doc Mode

**Files:**
- Create: `src/services/remote-folder-connector.ts`
- Modify: `src/services/runtime.ts` (browser branch picks remote when tabs_api is reachable)
- Modify: the Doc Mode folder-connect UI (find with `grep -rn "connectFolder" src/components/` — the file-explorer panel that currently shows "open the desktop app" in browsers) to list VPS roots when the connector is remote.
- Test: `src/services/remote-folder-connector.test.ts`

**Interfaces:**
- Consumes: `tabsApi.fs.*` (Task 7), `FolderConnector` interface (`src/services/folder-connector.ts` — signatures in Verified Facts).
- Produces: `RemoteFolderConnector implements FolderConnector` plus two extras the UI uses: `listRoots(): Promise<FsRoot[]>` and `connectRoot(rootId: string): Promise<string>`.
- Path convention: connector paths are `"<rootId>:<relative/path>"` (e.g. `"atlas:notes/today.md"`). A `splitRemotePath(p): {root, rel}` helper is exported and unit-tested.

- [ ] **Step 1: Write failing tests**

```ts
// src/services/remote-folder-connector.test.ts
import { describe, expect, it } from 'vitest';
import { joinRemotePath, splitRemotePath } from './remote-folder-connector';

describe('remote path codec', () => {
  it('splits root:rel', () => {
    expect(splitRemotePath('atlas:notes/today.md')).toEqual({ root: 'atlas', rel: 'notes/today.md' });
  });
  it('handles root-only paths', () => {
    expect(splitRemotePath('atlas:')).toEqual({ root: 'atlas', rel: '' });
  });
  it('joins back', () => {
    expect(joinRemotePath('atlas', 'notes/today.md')).toBe('atlas:notes/today.md');
  });
  it('throws on paths without a root prefix', () => {
    expect(() => splitRemotePath('/etc/passwd')).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/services/remote-folder-connector.test.ts` — FAIL (module not found).

- [ ] **Step 3: Implement the connector**

```ts
// src/services/remote-folder-connector.ts — FolderConnector over tabs_api /fs.
import type { FolderConnectionState, FolderConnector, FolderDirEntry, FolderMetadata } from './folder-connector';
import { type FsRoot, tabsApi } from './tabsApi';

export function splitRemotePath(p: string): { root: string; rel: string } {
  const i = p.indexOf(':');
  if (i <= 0) throw new Error(`remote path missing root prefix: ${p}`);
  return { root: p.slice(0, i), rel: p.slice(i + 1) };
}
export function joinRemotePath(root: string, rel: string): string {
  return `${root}:${rel}`;
}

export class RemoteFolderConnector implements FolderConnector {
  state: FolderConnectionState = 'available';
  onStateChange?: (state: FolderConnectionState) => void;
  private activeRoot: FsRoot | null = null;

  private setState(s: FolderConnectionState) { this.state = s; this.onStateChange?.(s); }

  isAvailable(): boolean { return true; }

  listRoots(): Promise<FsRoot[]> { return tabsApi.fs.roots(); }

  async connectRoot(rootId: string): Promise<string> {
    this.setState('connecting');
    const roots = await tabsApi.fs.roots();
    const root = roots.find((r) => r.id === rootId);
    if (!root) { this.setState('error'); throw new Error(`unknown root ${rootId}`); }
    this.activeRoot = root;
    this.setState('connected');
    return joinRemotePath(root.id, '');
  }

  async connectFolder(): Promise<string | null> {
    const roots = await this.listRoots();
    return roots.length ? this.connectRoot(roots[0].id) : null;
  }

  async readDir(path: string): Promise<FolderDirEntry[]> {
    const { root, rel } = splitRemotePath(path);
    const entries = await tabsApi.fs.list(root, rel);
    return entries.map((e) => ({ name: e.name, path: joinRemotePath(root, e.path), kind: e.kind }));
  }
  readTextFile(path: string): Promise<string> {
    const { root, rel } = splitRemotePath(path);
    return tabsApi.fs.readText(root, rel);
  }
  readBinaryFile(path: string): Promise<Uint8Array> {
    const { root, rel } = splitRemotePath(path);
    return tabsApi.fs.readBin(root, rel);
  }
  async writeTextFile(path: string, content: string): Promise<void> {
    const { root, rel } = splitRemotePath(path);
    await tabsApi.fs.write(root, rel, content);
  }
  async mkdir(path: string, recursive = true): Promise<void> {
    const { root, rel } = splitRemotePath(path);
    await tabsApi.fs.mkdir(root, rel, recursive);
  }
  async remove(path: string, recursive = false): Promise<void> {
    const { root, rel } = splitRemotePath(path);
    await tabsApi.fs.remove(root, rel, recursive);
  }
  async rename(from: string, to: string): Promise<void> {
    const a = splitRemotePath(from); const b = splitRemotePath(to);
    if (a.root !== b.root) throw new Error('cross-root rename not supported');
    await tabsApi.fs.rename(a.root, a.rel, b.rel);
  }
  exists(path: string): Promise<boolean> {
    const { root, rel } = splitRemotePath(path);
    return tabsApi.fs.exists(root, rel);
  }
  async getMetadata(path: string): Promise<FolderMetadata> {
    const { root, rel } = splitRemotePath(path);
    const s = await tabsApi.fs.stat(root, rel);
    return { size: s.size, modifiedAt: s.modifiedAt ? new Date(s.modifiedAt) : null, isDirectory: s.isDirectory, isFile: s.isFile };
  }
  // No native dialogs in the browser: Save As falls back to the active root's top level.
  async pickSavePath(suggestedName: string): Promise<string | null> {
    return this.activeRoot ? joinRemotePath(this.activeRoot.id, suggestedName) : null;
  }
  async pickOpenFile(): Promise<string | null> { return null; }
}
```

- [ ] **Step 4: Wire into `runtime.ts`**

In `src/services/runtime.ts`, replace the browser branch of `getFolderConnector()`:

```ts
  if (isTauriRuntime()) {
    const { TauriFolderConnector } = await import('./tauri-folder-connector');
    _connector = new TauriFolderConnector();
  } else {
    const { tabsApi } = await import('./tabsApi');
    if (await tabsApi.available()) {
      const { RemoteFolderConnector } = await import('./remote-folder-connector');
      _connector = new RemoteFolderConnector();
    } else {
      _connector = new BrowserFolderConnector();
    }
  }
```

- [ ] **Step 5: Root picker UI**

Locate the Doc Mode connect UI: `grep -rn "connectFolder\|unsupported" src/components/fileExplorer/`. In the panel that currently renders the browser "unsupported" message, add: when the connector is a `RemoteFolderConnector` (`'listRoots' in connector`), render a root list (label per root from `listRoots()`), each item calling `connector.connectRoot(root.id)` and then the exact same tree-load path the Tauri flow uses after `connectFolder()`. Follow the file-explorer's existing item/button styles (`src/components/fileExplorer/`), no new CSS files.

- [ ] **Step 6: Test, verify in dev against the live VPS, commit**

```bash
npx vitest run src/services/remote-folder-connector.test.ts && npm run check
```

Manual: `npm run dev` won't have `/fs` locally — verify via the deployed site after Task 12's redeploy, or temporarily `ssh -L 4010:127.0.0.1:4010 admin@142.132.230.137` + a Vite proxy entry for `/fs` → `http://127.0.0.1:4010` in `vite.config.ts` (dev-only, keep it committed — it's inert in prod builds).

```bash
git add -A && git commit -m "feat(docmode): remote VPS folder connector with root picker"
```

---

### Task 9: CHAT mode — new workspace with session-history column

**Files:**
- Modify: `src/stores/uiStore.ts` (add `chatMode`, mirroring `taskMode` exactly: state field ~line 99, setter ~line 441, persistence keys, hydration pick at ~line 225/246)
- Modify: `src/components/layout/LeftNarrowSidebar.tsx` (add Chat mode button after Documents, `MessageSquare` icon from lucide)
- Modify: `src/App.tsx` (~line 175: render `<ChatWorkspace />` when `chatMode`, above the crm/doc branches, mirroring how `crmMode ? <CRMWorkspace /> : ...` is done)
- Create: `src/components/chatMode/ChatWorkspace.tsx`
- Create: `src/components/chatMode/SessionListColumn.tsx`
- Create: `src/components/chatMode/ChatSessionPane.tsx`
- Create: `src/stores/hermesStore.ts`
- Test: `src/stores/hermesStore.test.ts`

**Interfaces:**
- Consumes: `hermesClient` (Task 7): `listSessions`, `getMessages`, `connectChat`, `deleteSession`, `renameSession`; types from `src/services/hermes/types.ts`.
- Produces: `useHermesStore` (zustand) with `{ sessions, activeSessionId, messages, streaming, connectionState, loadSessions(), openSession(id), sendPrompt(text), applyGatewayEvent(ev) }`. `applyGatewayEvent` is a pure-ish reducer entry point — unit-test it with fixture events recorded in Task 7 Step 1.
- Layout contract: visual duplicate of Doc Mode — reuse the workspace shell components (`src/components/layout/workspace/`: `PrimaryWorkspaceWrapper`, `ContextualPanel`, `CenterContentPanel`, `AssistantWrapper`) exactly as `App.tsx` composes them for documents. The **contextual (left) panel hosts `SessionListColumn`** (this is the "inner 2nd column" — same slot the file tree uses in Doc Mode); the center hosts `ChatSessionPane`; the AI sidebar stays as-is.

- [ ] **Step 1: uiStore — add `chatMode` (copy the `taskMode` pattern verbatim)**

Add to state: `chatMode: boolean;` — setter:

```ts
setChatMode: (v) => {
  set({ chatMode: v, taskMode: false, crmMode: false, activeView: 'document', primaryWrapperOpen: true });
  void db.settings.put({ key: 'chatMode', value: v });
  void db.settings.put({ key: 'taskMode', value: false });
  void db.settings.put({ key: 'crmMode', value: false });
},
```

Also set `chatMode: false` inside `setTaskMode` and `setCrmMode` (and persist it false there), add `chatMode: false` to initial state, and include `chatMode` in the hydration/persistence picks next to `taskMode` (~lines 225, 246, 295). Add `setChatMode` to the store interface (~line 165).

- [ ] **Step 2: hermesStore with a tested event reducer**

```ts
// src/stores/hermesStore.test.ts — fixture events must be the ones recorded
// from the reference client in Task 7 Step 1 (types.ts). Skeleton:
import { describe, expect, it } from 'vitest';
import { reduceGatewayEvent } from './hermesStore';

describe('reduceGatewayEvent', () => {
  it('appends streamed delta text to the pending assistant message', () => {
    const s0 = { messages: [], pending: '' };
    const s1 = reduceGatewayEvent(s0, /* delta fixture from types.ts */ { /* … */ } as never);
    expect(s1.pending.length).toBeGreaterThan(0);
  });
  it('finalizes the pending message on completion event', () => { /* fixture-based */ });
  it('ignores unknown event types without throwing', () => {
    expect(() => reduceGatewayEvent({ messages: [], pending: '' }, { type: 'unknown' } as never)).not.toThrow();
  });
});
```

Implement `src/stores/hermesStore.ts`: zustand store; `reduceGatewayEvent(chatState, ev)` exported as a pure function used by `applyGatewayEvent`; `loadSessions()` → `hermesClient.listSessions()`; `openSession(id)` → `getMessages(id)`; `sendPrompt(text)` opens/reuses the `connectChat` connection and appends the user message optimistically. Run the tests (fail → implement → pass).

- [ ] **Step 3: Components**

`SessionListColumn.tsx`: renders `sessions` (title, relative time via `src/utils/timeFormat.ts`), active highlight, click → `openSession`; "New session" button on top (clears `activeSessionId`); hover actions: rename (inline input → `renameSession`), delete (confirm → `deleteSession`). Follow the styling of the task list panel (`src/components/taskManager/TaskListPanel.tsx`) for list/item classes.

`ChatSessionPane.tsx`: message list (user/assistant bubbles — reuse the AI sidebar's message components from `src/components/sidebar/` (`UserMessage.tsx` and its assistant counterpart) if their props allow; otherwise mirror their markup/classes) + composer at the bottom reusing `src/components/ui/Composer.tsx`; submit → `sendPrompt`. Show `connectionState` as a slim banner when not connected ("Hermes offline — check gateway").

`ChatWorkspace.tsx`: compose the workspace shell exactly as App.tsx does for Doc Mode, with `SessionListColumn` in the contextual panel slot and `ChatSessionPane` in the center. Look at `CRMWorkspace.tsx` for the composition pattern.

- [ ] **Step 4: Nav button + App wiring**

`LeftNarrowSidebar.tsx`: add between Documents and Tasks:

```tsx
<button
  id="nav-btn-chat"
  type="button"
  onClick={() => { setChatMode(true); }}
  title="Chat"
  className={`mode-btn${chatMode ? ' mode-btn--on' : ''}`}
>
  <MessageSquare size={15} />
</button>
```

(Existing mode buttons must also clear `chatMode` — they do via the store setters from Step 1.) In `App.tsx`, add the `chatMode ? <ChatWorkspace /> : …` branch above the CRM branch (~line 175). Hide/disable the Chat button when `tabsApi.available()` is false (Tauri desktop without remote): probe once in `ChatWorkspace`'s parent or reuse the connector-selection signal.

- [ ] **Step 5: Verify and commit**

```bash
npm run check
```

Manual against the deployed stack (after redeploy in Task 12): open Chat mode → sessions list shows real Hermes sessions (33+ existed on 2026-07-16); open one → messages render; send a prompt → streamed reply appears.

```bash
git add -A && git commit -m "feat(chat): CHAT mode with Hermes session history and live chat"
```

---

### Task 10: Approvals inbox

**Files:**
- Create: `src/components/chatMode/ApprovalsInbox.tsx`
- Modify: `src/stores/hermesStore.ts` (approvals slice: `approvals: PendingApproval[]`, populated by `connectEvents`; `respondApproval(id, approve)`)
- Modify: `src/components/chatMode/ChatWorkspace.tsx` (bell button with pending-count badge in the workspace header, opens the inbox panel)
- Test: extend `src/stores/hermesStore.test.ts`

**Interfaces:**
- Consumes: `hermesClient.connectEvents` (Task 7); approval event schema recorded in `types.ts` (Task 7 Step 1).
- Produces: `PendingApproval { id, sessionId, command, risk, requestedAt }`; `respondApproval(id, approve: boolean)` — the exact respond call (HTTP route or WS frame) must be taken from the reference implementation.

- [ ] **Step 1: Pin down the approval protocol (discovery with exact sources)**

- Server side: `C:\Users\burak\AppData\Local\hermes\hermes-agent\hermes_cli\web_server.py` — `grep -n "approval" hermes_cli/web_server.py` (line ~12190 `shell_hooks._record_approval(event, command)` and surroundings; also `~/.hermes` config keys `approvals.mode` at ~699).
- Client side: `apps/desktop/src/app/session/hooks/use-message-stream/gateway-event.ts` and `approval-mode-event.test.tsx` (event names + response frames).

Record into `types.ts`: the approval-request event type name/fields and the approve/deny response mechanism. Acceptance: `respondApproval` compiles against real names, not guesses.

- [ ] **Step 2: Failing reducer tests**

Add to `hermesStore.test.ts`: an approval-request fixture event adds one entry to `approvals`; a resolution event (or a successful `respondApproval`) removes it; duplicate request ids don't double-add. Run → FAIL.

- [ ] **Step 3: Implement store slice + `respondApproval`**

Wire `connectEvents` subscription once per app session (start it when Chat mode first mounts; keep it running app-wide so the badge works from any mode). Implement per the recorded protocol. Run tests → PASS.

- [ ] **Step 4: UI**

`ApprovalsInbox.tsx`: panel listing pending approvals — command text in a `<code>` block, risk label, session link (click → `openSession(sessionId)`), Approve / Deny buttons calling `respondApproval`. Empty state: "No pending approvals." Bell button in `ChatWorkspace` header shows `approvals.length` badge when > 0. Reuse `HeaderDropdown` (`src/components/ui/HeaderDropdown.tsx`) if it fits, else a simple popover following its classes.

- [ ] **Step 5: Verify and commit**

`npm run check`; manual: trigger a dangerous command in a Hermes session (e.g. ask the agent to run `rm` something) → approval appears in inbox → Approve → command proceeds in session.

```bash
git add -A && git commit -m "feat(chat): approvals inbox over Hermes events websocket"
```

---

### Task 11: Memory browser

**Files:**
- Modify: the Doc Mode root-picker UI from Task 8 Step 5 (no new page — the memories root IS the memory browser)
- Modify: `src/components/fileExplorer/FileExplorerPanel.tsx` (or wherever the root list renders): pin the `memories` root with a distinct icon (`Brain` from lucide) and the label "Hermes Memories".

**Interfaces:**
- Consumes: `RemoteFolderConnector.listRoots()` — the `memories` root configured in `TABS_FS_ROOTS` (Task 4).

- [ ] **Step 1: Pin the memories root in the picker**

In the root list UI, sort `memories` first after `atlas`, give it the `Brain` icon and label from the server (`Hermes Memories`). No other special-casing — read/edit/rename all come free via the connector.

- [ ] **Step 2: Verify end-to-end**

On the deployed site: Doc Mode → connect "Hermes Memories" → tree shows memory files → open one → edit → save → confirm on VPS:

```bash
ssh -o BatchMode=yes admin@142.132.230.137 "ls -la /home/admin/.hermes/memories | head -5"
```

Expected: edited file has a fresh mtime. (If `/home/admin/.hermes/memories` does not exist, check the actual memories path with `ssh ... "ls /home/admin/.hermes"` and update `TABS_FS_ROOTS` in the VPS `.env` — do NOT guess-create directories inside `.hermes`.)

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(docmode): pinned Hermes memories root as memory browser"
```

---

### Task 12: Redeploy and final verification

**Files:** none (ops)

- [ ] **Step 1: Push and redeploy**

```bash
git push origin main
ssh -o BatchMode=yes admin@142.132.230.137 "cd /home/admin/tabs/app && git pull && cd deploy && docker compose -p tabs up -d --build 2>&1 | tail -3"
```

- [ ] **Step 2: Full acceptance checklist (manual, in the browser)**

1. `https://tabs.brandpreneur.net` → basic-auth prompt → TABS loads.
2. Doc Mode → root picker shows VPS Home / ATLAS / Hermes Memories → open + edit + save a file in ATLAS.
3. CHAT mode → session list loads → open an old session → send a prompt → streamed reply.
4. Approvals: dangerous command → badge appears → Approve works.
5. Memories root: open, edit, save.
6. `https://atlas.brandpreneur.net` and `https://wagneratelier.co` still serve.
7. From a non-authed shell: `curl -s -o /dev/null -w "%{http_code}" https://tabs.brandpreneur.net/hermes/api/status` → **401** (proxy is behind basic-auth).
8. On the VPS: `ss -ltnp | grep -E "9119|8642|4010"` → all bound to `127.0.0.1` only.

- [ ] **Step 3: Report results to the user with any deviations.**

---

## Known Risks / Open Points

1. **WS chat protocol** (Task 7 Step 1) is the only genuinely unverified contract — it MUST be extracted from the desktop source before Task 9; the desktop app also uses `/api/pub`, whose role should be noted during extraction.
2. **Hermes container recreation** (Task 6) is the one step touching Hermes — gated on explicit user approval; capture `docker inspect hermes` to a file first.
3. **Doc Mode UI coupling**: `FileExplorerPanel`/file-tree code may assume absolute OS paths; the `root:rel` scheme isolates this, but watch for path-splitting assumptions (`path.split('/')` on the prefix) during Task 8 Step 5.
4. **Old TABS web login**: the old stack had Postgres-backed accounts; the new stack intentionally has none (Caddy basic-auth instead). Any bookmarking of old `/api/*` routes is dead — expected.
