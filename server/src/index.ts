// Server entry point. Boots the Express app and listens on $PORT.

import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();
const port = config.port;

const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[tabs-server] listening on port ${port} (env=${config.nodeEnv})`);
});

function shutdown(signal: string) {
  // eslint-disable-next-line no-console
  console.log(`[tabs-server] received ${signal}, shutting down`);
  server.close(() => {
    process.exit(0);
  });
  // Hard exit if close hangs.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
