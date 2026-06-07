// Vitest global setup. Runs once before any tests. Pushes the Prisma schema
// to the test database (destructive, idempotent: `prisma db push --force-reset`).
// If the database is unreachable, this throws with a clear message so the
// entire run fails fast instead of producing 500s in every test.

import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

export default async function globalSetup() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url) {
    throw new Error(
      'DATABASE_URL is required to run integration tests. ' +
        'Start the test Postgres with: docker compose -f server/docker-compose.test.yml up -d',
    );
  }
  // Refuse to run tests against anything that doesn't look like a test DB.
  // We check the URL (not just the pathname) so connection strings like
  // `postgresql://.../tabs_test` and `...?schema=test` are both caught.
  if (!/test/i.test(url)) {
    throw new Error(`Refusing to run tests against a non-test database: ${url}`);
  }

  // Probe connectivity first so we fail with a clear message.
  const probe = new PrismaClient({ log: ['error'] });
  try {
    await probe.$queryRaw`SELECT 1`;
  } catch (err) {
    throw new Error(
      `Cannot reach test database at ${url}.\n` +
        `Start it with: docker compose -f server/docker-compose.test.yml up -d\n` +
        `Underlying error: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    await probe.$disconnect();
  }

  // Push schema. --force-reset drops and recreates. --skip-generate because
  // CI / local dev runs `prisma generate` separately.
  try {
    execSync('npx prisma db push --force-reset --skip-generate', {
      stdio: 'pipe',
      env: process.env,
    });
  } catch (err) {
    const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? String(err);
    throw new Error(`prisma db push failed:\n${stderr}`);
  }

  // eslint-disable-next-line no-console
  console.log('[globalSetup] test database schema pushed');
}
