// Task AI history sub-router. Mounted at `/api/tasks` (similar to the
// comments router) so the URL is `/api/tasks/:taskId/ai-history` as the
// plan specifies.
//
//   GET /api/tasks/:taskId/ai-history
//
// Returns the active (non-undone) change batches for a task, newest first.
// Expired batches (older than 7 days) are swept on read, matching the
// previous Dexie behaviour in src/stores/taskAIStore.ts.

import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { asyncHandler, NotFound } from '../errors.js';
import { purgeExpiredBatches } from '../services/taskAIEngine.js';
import type { TaskAIOperation } from '../services/taskAIPlanner.js';

export const taskAiHistoryRouter = Router();

taskAiHistoryRouter.use(requireAuth);

taskAiHistoryRouter.get(
  '/:taskId/ai-history',
  asyncHandler(async (req: AuthedRequest, res) => {
    // Lazy purge of expired batches on read.
    await purgeExpiredBatches(prisma);

    const task = await prisma.task.findFirst({
      where: { id: req.params.taskId, ownerId: req.user!.id },
      select: { id: true },
    });
    if (!task) throw new NotFound('Task not found');
    const rows = await prisma.taskAIChangeBatch.findMany({
      where: { taskId: task.id, ownerId: req.user!.id, undoneAt: null },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      history: rows.map((row) => ({
        id: row.id,
        taskId: row.taskId,
        summary: row.summary,
        operations: row.operations as unknown as TaskAIOperation[],
        inverseOperations: row.inverseOperations as unknown as TaskAIOperation[],
        createdAt: Number(row.createdAt),
        expiresAt: Number(row.expiresAt),
        undoneAt: row.undoneAt ? Number(row.undoneAt) : undefined,
        appliedByMessageId: row.appliedByMessageId ?? undefined,
      })),
    });
  }),
);
