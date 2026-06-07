// Chat thread routes.
//
//   GET    /api/chat-threads                → list owner's threads (filter by mode)
//   POST   /api/chat-threads                → create a new thread
//   DELETE /api/chat-threads/:id            → hard-delete a thread (messages cascade)
//
// Threads are user-scoped (ownerId on every query). The list endpoint accepts
// a `?mode=writer|task` query parameter so the AI sidebar can load only the
// threads that match the current mode (writer-mode vs task-mode). Threads
// are returned newest-first by `updatedAt` so the sidebar's "first thread"
// behaviour keeps the most recent one at the top.

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { asyncHandler, BadRequest, NotFound } from '../errors.js';
import { now } from '../util/now.js';

export const chatThreadsRouter = Router();

chatThreadsRouter.use(requireAuth);

const idSchema = z.string().min(1).max(64);

const threadCreateSchema = z.object({
  id: idSchema,
  mode: z.enum(['writer', 'task']),
  title: z.string().trim().max(200).default('New Chat'),
});

const modeQuerySchema = z
  .union([z.literal('writer'), z.literal('task'), z.undefined()])
  .transform((v) => v ?? undefined);

function publicThread(row: {
  id: string;
  mode: string;
  title: string;
  createdAt: bigint;
  updatedAt: bigint;
}) {
  return {
    id: row.id,
    mode: row.mode === 'task' ? 'task' : 'writer',
    title: row.title,
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
  };
}

chatThreadsRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const mode = modeQuerySchema.parse(req.query.mode);
    const where: { ownerId: string; mode?: string } = { ownerId: req.user!.id };
    if (mode) where.mode = mode;
    const threads = await prisma.chatThread.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ threads: threads.map(publicThread) });
  }),
);

chatThreadsRouter.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = threadCreateSchema.parse(req.body);
    const existing = await prisma.chatThread.findFirst({
      where: { id: body.id, ownerId: req.user!.id },
    });
    if (existing) throw new BadRequest('Thread with that id already exists');
    const created = now();
    const thread = await prisma.chatThread.create({
      data: {
        id: body.id,
        ownerId: req.user!.id,
        mode: body.mode,
        title: body.title,
        createdAt: created,
        updatedAt: created,
      },
    });
    res.json({ thread: publicThread(thread) });
  }),
);

chatThreadsRouter.delete(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await prisma.chatThread.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
    });
    if (!existing) throw new NotFound('Thread not found');
    // Cascade-deletes messages via the Prisma schema (onDelete: Cascade).
    await prisma.chatThread.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  }),
);
