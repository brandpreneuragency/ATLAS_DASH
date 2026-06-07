// Project routes.
//
//   GET    /api/projects          → list owner's projects (alphabetical)
//   POST   /api/projects          → create
//   PATCH  /api/projects/:id      → rename / recolor
//   DELETE /api/projects/:id      → hard-delete (tasks keep the row but
//                                   lose their projectId via the FK)
//
// All handlers enforce `ownerId = req.user.id`. Cross-user access is a 404
// (not a 403) so a user cannot probe for the existence of other users'
// project IDs.

import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { asyncHandler, NotFound } from '../errors.js';
import { projectCreateSchema, projectUpdateSchema } from '../validation/schemas.js';
import { now } from '../util/now.js';

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

projectsRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const projects = await prisma.project.findMany({
      where: { ownerId: req.user!.id },
      orderBy: { name: 'asc' },
    });
    res.json({ projects });
  }),
);

projectsRouter.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = projectCreateSchema.parse(req.body);
    const project = await prisma.project.create({
      data: {
        id: body.id,
        ownerId: req.user!.id,
        name: body.name,
        color: body.color,
        createdAt: now(),
      },
    });
    res.json({ project });
  }),
);

projectsRouter.patch(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = projectUpdateSchema.parse(req.body);
    const existing = await prisma.project.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
    });
    if (!existing) throw new NotFound('Project not found');
    const project = await prisma.project.update({
      where: { id: existing.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.color !== undefined ? { color: body.color } : {}),
      },
    });
    res.json({ project });
  }),
);

projectsRouter.delete(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await prisma.project.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
    });
    if (!existing) throw new NotFound('Project not found');
    // Tasks referencing this project have `onDelete: SetNull` so they keep
    // existing rows with `projectId = null` after the project is removed.
    await prisma.project.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  }),
);
