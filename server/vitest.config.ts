import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import path from 'node:path';

// Load .env.test first, then .env (so .env can override defaults).
dotenv.config({ path: path.resolve(process.cwd(), '.env.test'), override: true, quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: false, quiet: true });

export default defineConfig({
  resolve: {
    alias: {
      '~': new URL('./src', import.meta.url).pathname,
    },
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    exclude: ['src/tests/**/setup.ts', 'src/tests/global-setup.ts'],
    // globalSetup runs once per `vitest run` invocation. It pushes the
    // Prisma schema to the test database. It throws if the DB is unreachable,
    // which fails the whole run fast.
    globalSetup: ['./src/tests/global-setup.ts'],
    // Per-file setup for integration tests: truncates tables before each test.
    setupFiles: ['./src/tests/integration/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Every integration test assumes a fresh DB (the first one bootstraps a
    // user; later ones would 403 on a re-bootstrap). We must run files
    // serially so the per-file `beforeEach` truncation isn't racing with
    // sibling files writing to the same tables. Pool: threads + a single
    // thread keeps the fast startup while eliminating the race.
    fileParallelism: false,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
});
