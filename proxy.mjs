/**
 * Minimal Anthropic CORS proxy for local development.
 * Run: node proxy.mjs
 * Then set Anthropic base URL to: http://localhost:3001/anthropic
 */
import http from 'http';
import https from 'https';

const PORT = 3001;
const ANTHROPIC_HOST = 'api.anthropic.com';

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, anthropic-version');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!req.url?.startsWith('/anthropic')) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const targetPath = req.url.replace('/anthropic', '');
  const headers = { ...req.headers, host: ANTHROPIC_HOST };
  delete headers['origin'];

  const proxyReq = https.request(
    { hostname: ANTHROPIC_HOST, path: targetPath, method: req.method, headers },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err);
    res.writeHead(502);
    res.end('Proxy error');
  });

  req.pipe(proxyReq);
});

server.listen(PORT, () => {
  console.log(`Anthropic proxy running at http://localhost:${PORT}/anthropic`);
});
