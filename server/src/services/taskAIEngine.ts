// Server-side Task AI apply/undo engine.
//
// Mirrors the previous frontend `applyOperation` in src/stores/taskAIStore.ts.
// Both apply and undo run inside a Prisma `$transaction` so a half-applied
// batch cannot leak — the plan mandates "Apply/undo must be transactional".
//
// This module knows nothing about Express, cookies, or HTTP shapes. It is
// pure server logic over `prisma`.

import { Prisma, type PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';
import { now } from '../util/now.js';
import type { TaskAIOperation } from './taskAIPlanner.js';

const HISTORY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface ApplyRequest {
  ownerId: string;
  taskId: string;
  messageId?: string;
  summary: string;
  operations: TaskAIOperation[];
  baselineUpdatedAt: Record<string, number>;
}

export interface ApplyResult {
  batchId: string;
  createdAt: number;
  expiresAt: number;
  operations: TaskAIOperation[];
  inverseOperations: TaskAIOperation[];
}

export class StaleTaskError extends Error {
  constructor(public readonly staleTaskIds: string[]) {
    super('Task data changed since this draft was generated.');
    this.name = 'StaleTaskError';
  }
}

export class InvalidOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOperationError';
  }
}

function opId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseIsoDate(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return fallback;
}

function normalizeStatus(value: unknown): 'pending' | 'in_progress' | 'completed' {
  if (value === 'pending' || value === 'in_progress' || value === 'completed') return value;
  return 'pending';
}

function normalizeImportance(value: unknown): 'low' | 'medium' | 'high' {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  return 'medium';
}

function isOwnerProject(
  tx: Prisma.TransactionClient,
  ownerId: string,
  projectId: string | null | undefined,
): Promise<boolean> {
  if (!projectId) return Promise.resolve(false);
  return tx.project
    .findFirst({ where: { id: projectId, ownerId }, select: { id: true } })
    .then((row) => Boolean(row));
}

/**
 * Apply the operations of a draft, producing inverse operations for undo.
 * All side effects are inside a single Prisma transaction. Throws on any
 * validation / ownership error so the transaction rolls back cleanly.
 */
export async function applyTaskAIDraft(
  prisma: PrismaClient,
  req: ApplyRequest,
): Promise<ApplyResult> {
  return prisma.$transaction(async (tx) => {
    // Validate task ownership and load the live updatedAt stamps for stale
    // detection. The apply endpoint does the same check up front (cheaper
    // failure path); this is the second line of defence.
    const taskIds = collectTaskIds(req.operations);
    const live = await tx.task.findMany({
      where: { id: { in: Array.from(taskIds) }, ownerId: req.ownerId },
      select: { id: true, updatedAt: true, deletedAt: true },
    });
    const liveById = new Map(live.map((row) => [row.id, row]));

    const stale: string[] = [];
    for (const [taskId, baseline] of Object.entries(req.baselineUpdatedAt)) {
      const current = liveById.get(taskId);
      if (current && Number(current.updatedAt) !== baseline) {
        stale.push(taskId);
      }
    }
    if (stale.length > 0) {
      throw new StaleTaskError(stale);
    }

    const inverseOperations: TaskAIOperation[] = [];

    for (const operation of req.operations) {
      await runOperation(tx, req.ownerId, operation, inverseOperations);
    }

    const created = now();
    const expiresAt = created + BigInt(HISTORY_WINDOW_MS);
    const batch = await tx.taskAIChangeBatch.create({
      data: {
        id: `batch_${nanoid(10)}`,
        ownerId: req.ownerId,
        taskId: req.taskId,
        summary: req.summary,
        operations: req.operations as unknown as Prisma.InputJsonValue,
        inverseOperations: inverseOperations as unknown as Prisma.InputJsonValue,
        createdAt: created,
        expiresAt,
        appliedByMessageId: req.messageId ?? null,
      },
    });

    return {
      batchId: batch.id,
      createdAt: Number(batch.createdAt),
      expiresAt: Number(batch.expiresAt),
      operations: req.operations,
      inverseOperations,
    };
  });
}

export interface UndoRequest {
  ownerId: string;
  batchId: string;
}

export interface UndoResult {
  batchId: string;
  undoneAt: number;
}

export class BatchNotFoundError extends Error {
  constructor() {
    super('Change batch not found');
    this.name = 'BatchNotFoundError';
  }
}

export class AlreadyUndoneError extends Error {
  constructor() {
    super('Batch has already been undone');
    this.name = 'AlreadyUndoneError';
  }
}

export async function undoTaskAIBatch(
  prisma: PrismaClient,
  req: UndoRequest,
): Promise<UndoResult> {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.taskAIChangeBatch.findFirst({
      where: { id: req.batchId, ownerId: req.ownerId },
    });
    if (!batch) throw new BatchNotFoundError();
    if (batch.undoneAt !== null) throw new AlreadyUndoneError();

    const inverses = batch.inverseOperations as unknown as TaskAIOperation[];
    for (const operation of inverses) {
      // Undo operations don't accumulate further inverses; we just want to
      // restore the previous state. Pass `undefined` for the inverses array.
      await runOperation(tx, req.ownerId, operation, undefined);
    }

    const undoneAt = now();
    await tx.taskAIChangeBatch.update({
      where: { id: batch.id },
      data: { undoneAt },
    });

    return {
      batchId: batch.id,
      undoneAt: Number(undoneAt),
    };
  });
}

// ── Single-operation runner ────────────────────────────────────────────────

function collectTaskIds(operations: TaskAIOperation[]): Set<string> {
  const ids = new Set<string>();
  for (const op of operations) {
    if (op.type === 'update_task' || op.type === 'soft_delete_task' || op.type === 'restore_task') {
      ids.add(op.taskId);
    }
    if (op.type === 'create_task' && op.parentId) ids.add(op.parentId);
    if (op.type === 'add_comment' || op.type === 'delete_comment') ids.add(op.taskId);
  }
  return ids;
}

async function runOperation(
  tx: Prisma.TransactionClient,
  ownerId: string,
  operation: TaskAIOperation,
  inverseOperations: TaskAIOperation[] | undefined,
): Promise<void> {
  if (operation.type === 'create_task') {
    const parent = operation.parentId
      ? await tx.task.findFirst({
          where: { id: operation.parentId, ownerId },
          select: { date: true, projectId: true },
        })
      : null;
    const created = now();
    const taskCount = await tx.task.count({ where: { ownerId } });
    const newId = `t_${nanoid(8)}`;
    await tx.task.create({
      data: {
        id: newId,
        ownerId,
        title: operation.title.trim(),
        content: operation.content ?? '',
        status: normalizeStatus(
          operation.status ?? (operation.parentId ? 'in_progress' : 'pending'),
        ),
        importance: normalizeImportance(operation.importance ?? 'medium'),
        date: parseIsoDate(operation.date, parent?.date ?? new Date().toISOString().slice(0, 10)),
        projectId:
          operation.projectId === undefined
            ? (parent?.projectId ?? null)
            : operation.projectId,
        assignees: Array.isArray(operation.assignees) ? operation.assignees : [],
        sourcePath: null,
        parentId: operation.parentId ?? null,
        sourceChatMessageId: null,
        createdAt: created,
        updatedAt: created,
        order: taskCount,
        deletedAt: null,
      },
    });
    inverseOperations?.push({
      id: opId('inv_delete_created'),
      type: 'soft_delete_task',
      taskId: newId,
      reason: 'Undo created task',
    });
    return;
  }

  if (operation.type === 'update_task') {
    const existing = await tx.task.findFirst({
      where: { id: operation.taskId, ownerId },
    });
    if (!existing) return;
    if (inverseOperations) {
      const previous: Record<string, unknown> = {};
      for (const key of Object.keys(operation.updates)) {
        (previous as Record<string, unknown>)[key] = (existing as unknown as Record<string, unknown>)[key];
      }
      inverseOperations.push({
        id: opId('inv_update'),
        type: 'update_task',
        taskId: operation.taskId,
        updates: previous as TaskAIOperation extends { updates: infer U } ? U : never,
      });
    }
    // Verify any new projectId is owned by the same user.
    const updates: Record<string, unknown> = { updatedAt: now() };
    for (const [k, v] of Object.entries(operation.updates)) {
      if (k === 'projectId') {
        if (v === null) {
          updates.projectId = null;
        } else if (typeof v === 'string') {
          const ok = await isOwnerProject(tx, ownerId, v);
          if (!ok) throw new InvalidOperationError(`Unknown project: ${v}`);
          updates.projectId = v;
        }
      } else if (v !== undefined) {
        updates[k] = v;
      }
    }
    await tx.task.update({ where: { id: operation.taskId }, data: updates });
    return;
  }

  if (operation.type === 'soft_delete_task') {
    const existing = await tx.task.findFirst({
      where: { id: operation.taskId, ownerId },
    });
    if (!existing) return;
    inverseOperations?.push({
      id: opId('inv_restore'),
      type: 'restore_task',
      taskId: operation.taskId,
    });
    const ts = now();
    await tx.task.update({
      where: { id: operation.taskId },
      data: { deletedAt: ts, updatedAt: ts },
    });
    return;
  }

  if (operation.type === 'restore_task') {
    const existing = await tx.task.findFirst({
      where: { id: operation.taskId, ownerId },
    });
    if (!existing) return;
    await tx.task.update({
      where: { id: operation.taskId },
      data: { deletedAt: null, updatedAt: now() },
    });
    return;
  }

  if (operation.type === 'add_comment') {
    const task = await tx.task.findFirst({
      where: { id: operation.taskId, ownerId },
      select: { id: true },
    });
    if (!task) return;
    const created = now();
    const newId = `c_${nanoid(8)}`;
    await tx.taskComment.create({
      data: {
        id: newId,
        ownerId,
        taskId: operation.taskId,
        sender: null,
        text: operation.text.trim(),
        fileId: null,
        replyTo: Prisma.JsonNull,
        createdAt: created,
        attachmentName: null,
        attachmentSize: null,
        attachmentPath: null,
      },
    });
    await tx.task.update({
      where: { id: task.id },
      data: { updatedAt: created },
    });
    inverseOperations?.push({
      id: opId('inv_delete_comment'),
      type: 'delete_comment',
      taskId: operation.taskId,
      commentId: newId,
    });
    return;
  }

  if (operation.type === 'delete_comment') {
    const existing = await tx.taskComment.findFirst({
      where: { id: operation.commentId, ownerId },
    });
    if (!existing) return;
    inverseOperations?.push({
      id: opId('inv_add_comment'),
      type: 'add_comment',
      taskId: operation.taskId,
      text: existing.text,
    });
    await tx.taskComment.delete({ where: { id: operation.commentId } });
    return;
  }
}

/**
 * Sweep expired change batches (older than 7 days). Mirrors the previous
 * Dexie purgeExpired behaviour. Returns the count of purged rows.
 */
export async function purgeExpiredBatches(prisma: PrismaClient): Promise<number> {
  const result = await prisma.taskAIChangeBatch.deleteMany({
    where: { expiresAt: { lt: now() } },
  });
  return result.count;
}
