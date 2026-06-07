// Task routes.
//
//   GET    /api/tasks?includeDeleted=true|false
//   POST   /api/tasks
//   PATCH  /api/tasks/:id
//   POST   /api/tasks/:id/soft-delete
//   POST   /api/tasks/:id/restore
//   DELETE /api/tasks/:id
//
// All handlers enforce `ownerId = req.user.id`. Cross-user access is a 404
// (not a 403) so a user cannot probe for the existence of other users'
// task IDs.
//
// The 7-day trash TTL is enforced lazily on read: when `includeDeleted=true`
// is requested, we run a single `deleteMany` for any task with a
// `deletedAt` older than 7 days before returning the list. This matches the
// behaviour of the previous Dexie-based store.

import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { asyncHandler, BadRequest, NotFound } from '../errors.js';
import { includeDeletedQuerySchema, taskCreateSchema, taskUpdateSchema } from '../validation/schemas.js';
import { now } from '../util/now.js';

export const tasksRouter = Router();

tasksRouter.use(requireAuth);

const SOFT_DELETE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

tasksRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const includeDeleted = includeDeletedQuerySchema.parse(req.query.includeDeleted);
    const sevenDaysAgo = now() - BigInt(SOFT_DELETE_TTL_MS);

    // Lazy cleanup: tasks soft-deleted more than 7 days ago are removed
    // before the list is returned. The DELETE cascade in the Prisma schema
    // also clears their comments.
    if (includeDeleted) {
      await prisma.task.deleteMany({
        where: { ownerId: req.user!.id, deletedAt: { lt: sevenDaysAgo } },
      });
    }

    const tasks = await prisma.task.findMany({
      where: {
        ownerId: req.user!.id,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ tasks });
  }),
);

tasksRouter.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = taskCreateSchema.parse(req.body);

    // If the client attached the task to a project, the project must belong
    // to the same user. We do not error on unknown projectId values: the
    // store sets it to null in that case to keep the row valid.
    let projectId: string | null = body.projectId;
    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, ownerId: req.user!.id },
        select: { id: true },
      });
      if (!project) projectId = null;
    }

    // `order` is the next integer in the current task list. This matches
    // the previous Dexie behaviour where new tasks appended to the end.
    const count = await prisma.task.count({ where: { ownerId: req.user!.id } });
    const created = now();
    const task = await prisma.task.create({
      data: {
        id: body.id,
        ownerId: req.user!.id,
        title: body.title,
        content: body.content,
        status: body.status,
        importance: body.importance,
        date: body.date,
        projectId,
        assignees: body.assignees,
        sourcePath: body.sourcePath ?? null,
        parentId: body.parentId ?? null,
        sourceChatMessageId: body.sourceChatMessageId ?? null,
        createdAt: created,
        updatedAt: created,
        order: count,
        deletedAt: null,
      },
    });
    res.json({ task });
  }),
);

tasksRouter.patch(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = taskUpdateSchema.parse(req.body);
    const existing = await prisma.task.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
    });
    if (!existing) throw new NotFound('Task not found');
    if (existing.deletedAt !== null) {
      // Editing a soft-deleted task is not allowed; the user must restore it
      // first. Returning 404 here would be confusing, so we use 400.
      throw new BadRequest('Task is in the trash; restore it before editing.');
    }

    // Verify any new projectId is owned by the same user.
    let projectId: string | null | undefined;
    if (body.projectId !== undefined) {
      if (body.projectId === null) {
        projectId = null;
      } else {
        const project = await prisma.project.findFirst({
          where: { id: body.projectId, ownerId: req.user!.id },
          select: { id: true },
        });
        if (!project) throw new NotFound('Project not found');
        projectId = project.id;
      }
    }

    const data: Prisma.TaskUpdateInput = {
      updatedAt: now(),
    };
    if (body.title !== undefined) data.title = body.title;
    if (body.content !== undefined) data.content = body.content;
    if (body.status !== undefined) data.status = body.status;
    if (body.importance !== undefined) data.importance = body.importance;
    if (body.date !== undefined) data.date = body.date;
    if (projectId !== undefined) {
      data.project = projectId === null
        ? { disconnect: true }
        : { connect: { id: projectId } };
    }
    if (body.assignees !== undefined) data.assignees = body.assignees;
    if (body.sourcePath !== undefined) data.sourcePath = body.sourcePath;
    if (body.parentId !== undefined) {
      data.parent = body.parentId === null
        ? { disconnect: true }
        : { connect: { id: body.parentId } };
    }

    const task = await prisma.task.update({ where: { id: existing.id }, data });
    res.json({ task });
  }),
);

tasksRouter.post(
  '/:id/soft-delete',
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await prisma.task.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
    });
    if (!existing) throw new NotFound('Task not found');
    const deletedAt = now();
    const task = await prisma.task.update({
      where: { id: existing.id },
      data: { deletedAt, updatedAt: deletedAt },
    });
    res.json({ task });
  }),
);

tasksRouter.post(
  '/:id/restore',
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await prisma.task.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
    });
    if (!existing) throw new NotFound('Task not found');
    const task = await prisma.task.update({
      where: { id: existing.id },
      data: { deletedAt: null, updatedAt: now() },
    });
    res.json({ task });
  }),
);

tasksRouter.delete(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await prisma.task.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
    });
    if (!existing) throw new NotFound('Task not found');
    // Comments cascade-delete via the Prisma schema (onDelete: Cascade).
    // Files referenced by this task have `onDelete: SetNull`; the File
    // service (Agent 3) is responsible for cleaning up orphaned files.
    await prisma.task.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  }),
);
