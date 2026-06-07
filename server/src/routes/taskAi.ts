// Task AI routes — apply / undo.
//
//   POST /api/task-ai/drafts/:messageId/apply
//   POST /api/task-ai/batches/:batchId/undo
//
// The apply path is the entry point used by the frontend when the user
// clicks "Apply" on a `TaskDraftPreview`. The undo path reverses a
// previously applied batch using the inverse operations recorded at apply
// time. Both run inside a Prisma `$transaction` (see services/taskAIEngine.ts)
// so a half-applied batch cannot leak.
//
// The route names use `:messageId` / `:batchId` as the URL parameter, but
// the body of the apply request also carries the actual operations and
// baseline. The URL parameter is kept for auditability / undo discoverability
// and matches the plan verbatim.
//
// The history endpoint (`GET /api/tasks/:taskId/ai-history`) lives in
// `routes/taskAiHistory.ts` so the URL is mounted under `/api/tasks` to
// match the plan.

import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { asyncHandler, BadRequest, NotFound } from '../errors.js';
import { taskAIApplyRequestSchema } from '../validation/schemas.js';
import {
  AlreadyUndoneError,
  BatchNotFoundError,
  applyTaskAIDraft,
  undoTaskAIBatch,
  StaleTaskError,
  InvalidOperationError,
} from '../services/taskAIEngine.js';
import type { TaskAIOperation } from '../services/taskAIPlanner.js';

export const taskAiRouter = Router();

taskAiRouter.use(requireAuth);

// ── POST /api/task-ai/drafts/:messageId/apply ───────────────────────────────

taskAiRouter.post(
  '/drafts/:messageId/apply',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = taskAIApplyRequestSchema.parse(req.body);
    const operations = body.operations as TaskAIOperation[];
    if (operations.length === 0) {
      throw new BadRequest('At least one operation is required to apply a draft.');
    }

    // The URL parameter is informational; the body's `messageId` wins if
    // both are present. We record the messageId for the audit trail.
    const messageId = body.messageId ?? req.params.messageId;

    // Find a taskId to associate the batch with. The plan ties a draft to a
    // task via `taskId`; the first operation that references a known task
    // wins. If none do, the apply path cannot proceed.
    const candidateTaskId = findPrimaryTaskId(operations);
    if (!candidateTaskId) {
      throw new BadRequest('Draft contains no task-scoped operations.');
    }
    const task = await prisma.task.findFirst({
      where: { id: candidateTaskId, ownerId: req.user!.id },
      select: { id: true },
    });
    if (!task) throw new NotFound('Task not found');

    try {
      const result = await applyTaskAIDraft(prisma, {
        ownerId: req.user!.id,
        taskId: task.id,
        messageId,
        summary: body.summary,
        operations,
        baselineUpdatedAt: body.baselineUpdatedAt,
      });
      res.json({
        batch: {
          id: result.batchId,
          taskId: task.id,
          summary: body.summary,
          operations: result.operations,
          inverseOperations: result.inverseOperations,
          createdAt: result.createdAt,
          expiresAt: result.expiresAt,
          undoneAt: null,
          appliedByMessageId: messageId ?? null,
        },
      });
    } catch (err) {
      if (err instanceof StaleTaskError) {
        res.status(409).json({
          error: 'stale_task',
          message: err.message,
          staleTaskIds: err.staleTaskIds,
        });
        return;
      }
      if (err instanceof InvalidOperationError) {
        res.status(400).json({ error: 'invalid_operation', message: err.message });
        return;
      }
      throw err;
    }
  }),
);

// ── POST /api/task-ai/batches/:batchId/undo ─────────────────────────────────

taskAiRouter.post(
  '/batches/:batchId/undo',
  asyncHandler(async (req: AuthedRequest, res) => {
    try {
      const result = await undoTaskAIBatch(prisma, {
        ownerId: req.user!.id,
        batchId: req.params.batchId,
      });
      res.json({
        batchId: result.batchId,
        undoneAt: result.undoneAt,
      });
    } catch (err) {
      if (err instanceof BatchNotFoundError) {
        // 404 — never leak that a foreign batch id exists.
        throw new NotFound('Batch not found');
      }
      if (err instanceof AlreadyUndoneError) {
        throw new BadRequest('Batch has already been undone.');
      }
      throw err;
    }
  }),
);

function findPrimaryTaskId(operations: TaskAIOperation[]): string | null {
  for (const op of operations) {
    if (op.type === 'update_task' || op.type === 'soft_delete_task' || op.type === 'restore_task') {
      return op.taskId;
    }
    if (op.type === 'add_comment' || op.type === 'delete_comment') {
      return op.taskId;
    }
  }
  return null;
}
