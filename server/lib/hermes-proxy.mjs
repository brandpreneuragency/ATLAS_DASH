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
