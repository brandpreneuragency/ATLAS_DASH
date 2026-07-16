// server/lib/hermes-proxy.mjs — proxies /hermes/* to the Hermes dashboard.
// Auth modes (first match wins for gated vs loopback Hermes installs):
//   1. Basic password credentials → session cookies + WS ?ticket= (gated/OAuth mode)
//   2. HERMES_DASHBOARD_SESSION_TOKEN → Bearer + WS ?token= (loopback mode only)
import httpProxy from 'http-proxy';
import { appendQueryParam } from './hermes-session.mjs';

export function createHermesProxy({ target, token = '', session = null }) {
  const proxy = httpProxy.createProxyServer({ target, changeOrigin: false, ws: true });

  proxy.on('proxyReq', (proxyReq, req) => {
    // Prefer cookie session when available (gated Hermes). Still send Bearer when
    // configured — harmless on gated mode, required on loopback.
    if (req._hermesCookie) {
      proxyReq.setHeader('Cookie', req._hermesCookie);
    }
    if (token) {
      proxyReq.setHeader('Authorization', `Bearer ${token}`);
      proxyReq.setHeader('X-Hermes-Session-Token', token);
    }
  });

  proxy.on('proxyRes', (proxyRes, req) => {
    // Drop upstream session on 401 so the next request re-logs in.
    if (proxyRes.statusCode === 401 && session?.hasCredentials?.()) {
      session.invalidate();
    }
  });

  async function attachCookie(req) {
    if (!session?.hasCredentials?.()) return;
    try {
      req._hermesCookie = await session.ensureCookie();
    } catch (err) {
      // Leave cookie empty; upstream will 401 and the client sees a clear error.
      console.error('[hermes-proxy] session ensure failed:', err.message);
      req._hermesCookie = '';
    }
  }

  return {
    /**
     * Strip the /hermes prefix and forward. Returns true if handled.
     * Async so we can mint/refresh the Hermes session cookie first.
     */
    async handleHttp(req, res) {
      if (!req.url.startsWith('/hermes/')) return false;
      req.url = req.url.slice('/hermes'.length);
      await attachCookie(req);
      proxy.web(req, res, {}, (err) => {
        res.writeHead(502, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: `hermes upstream: ${err.message}` }));
      });
      return true;
    },

    /**
     * WS upgrade. Gated mode needs a fresh single-use ?ticket=; loopback uses ?token=.
     */
    async handleUpgrade(req, socket, head) {
      if (!req.url.startsWith('/hermes/')) return false;
      let bare = req.url.slice('/hermes'.length);

      if (session?.hasCredentials?.()) {
        try {
          await attachCookie(req);
          const ticket = await session.mintWsTicket();
          bare = appendQueryParam(bare, 'ticket', ticket);
        } catch (err) {
          console.error('[hermes-proxy] ws ticket failed:', err.message);
          socket.write('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
          socket.destroy();
          return true;
        }
      } else if (token) {
        bare = appendQueryParam(bare, 'token', token);
      }

      req.url = bare;
      // Also forward cookie on upgrade (some Hermes paths may still inspect it).
      if (req._hermesCookie) {
        req.headers.cookie = req._hermesCookie;
      }
      proxy.ws(req, socket, head, {}, () => socket.destroy());
      return true;
    },
  };
}
