// Health probes.
//
// /api/health  — liveness. Always 200 if the process is running.
// /api/ready   — readiness. 200 only when the DB is reachable.

import { Router } from 'express';
import { prisma } from '../db.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

healthRouter.get('/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({
      status: 'not_ready',
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
