// Centralised environment configuration. Loaded once at startup and re-exported
// as a frozen object so the rest of the server can import `config` directly.
//
// All env vars are validated with Zod. The server refuses to start with
// missing or malformed values.

import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().nonnegative().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  APP_URL: z.string().url().optional(),
  // 32 bytes hex (64 hex chars) — used to encrypt provider API keys at rest.
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, 'ENCRYPTION_KEY must be 32 bytes hex (64 hex chars)')
    .optional(),
  FILE_STORAGE_ROOT: z.string().min(1).default('/data/uploads'),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(50),
  COOKIE_DOMAIN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('[tabs-server] invalid environment:');
  // eslint-disable-next-line no-console
  console.error(parsed.error.format());
  process.exit(1);
}

const data = parsed.data;

export const config = Object.freeze({
  nodeEnv: data.NODE_ENV,
  isProduction: data.NODE_ENV === 'production',
  isTest: data.NODE_ENV === 'test',
  port: data.PORT,
  databaseUrl: data.DATABASE_URL,
  appUrl: data.APP_URL,
  encryptionKey: data.ENCRYPTION_KEY,
  fileStorageRoot: data.FILE_STORAGE_ROOT,
  maxUploadMb: data.MAX_UPLOAD_MB,
  cookieDomain: data.COOKIE_DOMAIN && data.COOKIE_DOMAIN.length > 0 ? data.COOKIE_DOMAIN : undefined,
});

export type Config = typeof config;
