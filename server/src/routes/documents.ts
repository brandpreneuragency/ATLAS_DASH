// Document routes.
//
//   GET    /api/documents
//   POST   /api/documents
//   PATCH  /api/documents/:id
//   DELETE /api/documents/:id
//
// All documents are user-scoped (ownerId on every query). The list endpoint
// returns documents in the user's preferred `order`. Documents are
// server-owned but client-id'd: the client provides a nanoid-style primary
// key on create so it can keep the same id as it did with Dexie.

import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { asyncHandler, BadRequest, NotFound } from '../errors.js';
import { now } from '../util/now.js';

export const documentsRouter = Router();

documentsRouter.use(requireAuth);

const idSchema = z.string().min(1).max(64);

const documentCreateSchema = z.object({
  id: idSchema,
  title: z.string().trim().max(200).default('Untitled'),
  content: z.string().max(2_000_000).default(''),
  sourcePath: z.string().max(2000).nullable().optional(),
  order: z.number().int().nonnegative().optional(),
});

const documentUpdateSchema = z
  .object({
    title: z.string().trim().max(200).optional(),
    content: z.string().max(2_000_000).optional(),
    sourcePath: z.string().max(2000).nullable().optional(),
    isDirty: z.boolean().optional(),
    splitEditorOpen: z.boolean().optional(),
    order: z.number().int().nonnegative().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });

function publicDocument(row: {
  id: string;
  title: string;
  content: string;
  sourcePath: string | null;
  isDirty: boolean;
  splitEditorOpen: boolean;
  order: number;
  createdAt: bigint;
  updatedAt: bigint;
}) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    sourcePath: row.sourcePath ?? undefined,
    isDirty: row.isDirty,
    splitEditorOpen: row.splitEditorOpen,
    order: row.order,
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
  };
}

documentsRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const documents = await prisma.document.findMany({
      where: { ownerId: req.user!.id },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ documents: documents.map(publicDocument) });
  }),
);

documentsRouter.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = documentCreateSchema.parse(req.body);
    const existing = await prisma.document.findFirst({
      where: { id: body.id, ownerId: req.user!.id },
    });
    if (existing) throw new BadRequest('Document with that id already exists');
    const count = await prisma.document.count({ where: { ownerId: req.user!.id } });
    const created = now();
    const document = await prisma.document.create({
      data: {
        id: body.id,
        ownerId: req.user!.id,
        title: body.title,
        content: body.content,
        sourcePath: body.sourcePath ?? null,
        order: body.order ?? count,
        isDirty: false,
        splitEditorOpen: false,
        createdAt: created,
        updatedAt: created,
      },
    });
    res.json({ document: publicDocument(document) });
  }),
);

documentsRouter.patch(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = documentUpdateSchema.parse(req.body);
    const existing = await prisma.document.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
    });
    if (!existing) throw new NotFound('Document not found');
    const data: Prisma.DocumentUpdateInput = { updatedAt: now() };
    if (body.title !== undefined) data.title = body.title;
    if (body.content !== undefined) data.content = body.content;
    if (body.sourcePath !== undefined) data.sourcePath = body.sourcePath;
    if (body.isDirty !== undefined) data.isDirty = body.isDirty;
    if (body.splitEditorOpen !== undefined) data.splitEditorOpen = body.splitEditorOpen;
    if (body.order !== undefined) data.order = body.order;
    const document = await prisma.document.update({
      where: { id: existing.id },
      data,
    });
    res.json({ document: publicDocument(document) });
  }),
);

documentsRouter.delete(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await prisma.document.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
    });
    if (!existing) throw new NotFound('Document not found');
    await prisma.document.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  }),
);
