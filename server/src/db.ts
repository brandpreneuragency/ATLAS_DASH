// Prisma client singleton. In dev (vite-style HMR via tsx watch) we cache the
// client on `globalThis` so we don't open a new connection on every reload.

import { PrismaClient } from '@prisma/client';
import { config } from './config.js';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: config.isTest ? [] : ['warn', 'error'],
  });

if (!config.isProduction) {
  globalForPrisma.prisma = prisma;
}
