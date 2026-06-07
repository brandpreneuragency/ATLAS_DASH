// Chat message routes.
//
//   GET    /api/chat-threads/:id/messages   → list a thread's messages
//   POST   /api/chat-threads/:id/messages   → append a message to a thread
//   PATCH  /api/chat-messages/:id           → edit message fields
//   DELETE /api/chat-messages/:id           → delete a message
//
// The router is mounted twice (once under `/api/chat-threads` for the
// nested list/create, once under `/api/chat-messages` for the flat
// PATCH/DELETE). All handlers enforce ownership via `ownerId = req.user.id`.
//
// The wire shape mirrors the previous Dexie `ChatMessage` interface so the
// frontend store can be migrated with no shape changes. `attachments` is
// stored as a `Json?` column whose shape is `[{ fileId, name, size, mimeType }]`
// — we never write a `dataUrl` to the server.

import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { asyncHandler, BadRequest, NotFound } from '../errors.js';
import { now } from '../util/now.js';

export const chatMessagesRouter = Router();

chatMessagesRouter.use(requireAuth);

const idSchema = z.string().min(1).max(64);

const chatModeSchema = z.enum(['writer', 'task']);

const chatRoleSchema = z.enum(['user', 'assistant']);

const replyToSchema = z.object({
  id: z.string().min(1).max(64),
  role: chatRoleSchema,
  content: z.string().max(20_000).default(''),
  sender: z.string().max(80).default(''),
});

const attachmentSchema = z.object({
  fileId: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  size: z.union([z.string().max(40), z.number().int().nonnegative()]).optional(),
  mimeType: z.string().min(1).max(200).optional(),
});

const messageCreateSchema = z.object({
  id: idSchema,
  mode: chatModeSchema,
  documentId: z.string().max(64).nullable().optional(),
  taskId: z.string().max(64).nullable().optional(),
  agentId: z.string().min(1).max(64),
  role: chatRoleSchema,
  content: z.string().max(200_000).default(''),
  selectedText: z.string().max(40_000).nullable().optional(),
  selectionFrom: z.number().int().nonnegative().nullable().optional(),
  selectionTo: z.number().int().nonnegative().nullable().optional(),
  suggestedText: z.string().max(200_000).nullable().optional(),
  replyTo: replyToSchema.nullable().optional(),
  attachments: z.array(attachmentSchema).max(20).optional(),
  taskDraft: z.unknown().optional(),
  taskDraftStatus: z.enum(['draft', 'applied', 'rejected', 'invalid']).optional(),
  timestamp: z.number().int().nonnegative().optional(),
});

const messageUpdateSchema = z
  .object({
    content: z.string().max(200_000).optional(),
    suggestedText: z.string().max(200_000).nullable().optional(),
    taskDraft: z.unknown().optional(),
    taskDraftStatus: z.enum(['draft', 'applied', 'rejected', 'invalid']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });

function publicMessage(row: {
  id: string;
  threadId: string;
  mode: string;
  documentId: string | null;
  taskId: string | null;
  agentId: string;
  role: string;
  content: string;
  selectedText: string | null;
  selectionFrom: number | null;
  selectionTo: number | null;
  suggestedText: string | null;
  replyTo: unknown;
  attachments: unknown;
  taskDraft: unknown;
  taskDraftStatus: string | null;
  timestamp: bigint;
}) {
  return {
    id: row.id,
    threadId: row.threadId,
    mode: row.mode === 'task' ? 'task' : 'writer',
    documentId: row.documentId ?? undefined,
    taskId: row.taskId ?? undefined,
    agentId: row.agentId,
    role: row.role === 'assistant' ? 'assistant' : 'user',
    content: row.content,
    selectedText: row.selectedText ?? undefined,
    selectionFrom: row.selectionFrom ?? undefined,
    selectionTo: row.selectionTo ?? undefined,
    suggestedText: row.suggestedText ?? undefined,
    replyTo: row.replyTo ?? undefined,
    attachments: row.attachments ?? undefined,
    taskDraft: row.taskDraft ?? undefined,
    taskDraftStatus: row.taskDraftStatus ?? undefined,
    timestamp: Number(row.timestamp),
  };
}

// ── Nested: /api/chat-threads/:threadId/messages ───────────────────────────

chatMessagesRouter.get(
  '/:threadId/messages',
  asyncHandler(async (req: AuthedRequest, res) => {
    const thread = await prisma.chatThread.findFirst({
      where: { id: req.params.threadId, ownerId: req.user!.id },
      select: { id: true },
    });
    if (!thread) throw new NotFound('Thread not found');
    const messages = await prisma.chatMessage.findMany({
      where: { threadId: thread.id, ownerId: req.user!.id },
      orderBy: { timestamp: 'asc' },
    });
    res.json({ messages: messages.map(publicMessage) });
  }),
);

chatMessagesRouter.post(
  '/:threadId/messages',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = messageCreateSchema.parse(req.body);
    const thread = await prisma.chatThread.findFirst({
      where: { id: req.params.threadId, ownerId: req.user!.id },
      select: { id: true, title: true },
    });
    if (!thread) throw new NotFound('Thread not found');
    const existing = await prisma.chatMessage.findFirst({
      where: { id: body.id, ownerId: req.user!.id },
    });
    if (existing) throw new BadRequest('Message with that id already exists');

    const created = now();
    const createdMessage = await prisma.chatMessage.create({
      data: {
        id: body.id,
        ownerId: req.user!.id,
        threadId: thread.id,
        mode: body.mode,
        documentId: body.documentId ?? null,
        taskId: body.taskId ?? null,
        agentId: body.agentId,
        role: body.role,
        content: body.content,
        selectedText: body.selectedText ?? null,
        selectionFrom: body.selectionFrom ?? null,
        selectionTo: body.selectionTo ?? null,
        suggestedText: body.suggestedText ?? null,
        replyTo: body.replyTo ? (body.replyTo as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        attachments: body.attachments
          ? (body.attachments as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        taskDraft: body.taskDraft ? (body.taskDraft as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        taskDraftStatus: body.taskDraftStatus ?? null,
        timestamp: body.timestamp !== undefined ? BigInt(body.timestamp) : created,
      },
    });

    // Bump the thread's `updatedAt` so it bubbles to the top of the sidebar
    // list. If the user posted the very first message into a freshly-created
    // "New Chat" thread, rename the thread to the start of that message.
    const nextThreadTitle =
      body.role === 'user' && thread.title === 'New Chat' && body.content.trim().length > 0
        ? body.content.slice(0, 60)
        : thread.title;
    await prisma.chatThread.update({
      where: { id: thread.id },
      data: { updatedAt: created, title: nextThreadTitle },
    });

    res.json({ message: publicMessage(createdMessage) });
  }),
);

// ── Flat: /api/chat-messages/:id ────────────────────────────────────────────

chatMessagesRouter.patch(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = messageUpdateSchema.parse(req.body);
    const existing = await prisma.chatMessage.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
    });
    if (!existing) throw new NotFound('Message not found');
    const data: Prisma.ChatMessageUpdateInput = {};
    if (body.content !== undefined) data.content = body.content;
    if (body.suggestedText !== undefined) {
      data.suggestedText = body.suggestedText;
    }
    if (body.taskDraft !== undefined) {
      data.taskDraft =
        body.taskDraft === null
          ? Prisma.JsonNull
          : (body.taskDraft as unknown as Prisma.InputJsonValue);
    }
    if (body.taskDraftStatus !== undefined) data.taskDraftStatus = body.taskDraftStatus;
    const message = await prisma.chatMessage.update({
      where: { id: existing.id },
      data,
    });
    res.json({ message: publicMessage(message) });
  }),
);

chatMessagesRouter.delete(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await prisma.chatMessage.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
    });
    if (!existing) throw new NotFound('Message not found');
    await prisma.chatMessage.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  }),
);
