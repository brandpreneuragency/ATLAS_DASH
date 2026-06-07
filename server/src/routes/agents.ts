// Agent CRUD routes.
//
//   GET    /api/agents
//   POST   /api/agents
//   PATCH  /api/agents/:id
//   DELETE /api/agents/:id
//
// Agents are user-scoped (ownerId on every query). The plan mandates that
// the frontend's default writer + task agents be present on first load, so
// the GET route auto-seeds them on a fresh account (matching the previous
// Dexie behaviour in src/stores/aiStore.ts).

import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { asyncHandler, BadRequest, NotFound } from '../errors.js';
import { agentCreateSchema, agentUpdateSchema } from '../validation/schemas.js';

export const agentsRouter = Router();

agentsRouter.use(requireAuth);

const DEFAULT_WRITER_AGENT = {
  id: 'default_writer',
  name: 'Aaron the Script Writer',
  avatarUrl: '',
  systemPrompt:
    'You are Aaron, a skilled writing assistant. Help the user improve their writing, suggest edits, and provide creative ideas. When suggesting text changes, provide the revised text clearly so it can be applied directly.',
  isDefault: true,
  scope: 'writer',
};

const DEFAULT_TASK_AGENT = {
  id: 'default_task',
  name: 'Task Manager',
  avatarUrl: '',
  systemPrompt:
    'You are a task management assistant. Produce practical, actionable outputs for task planning, summaries, subtasks, dependencies, and execution tracking.',
  isDefault: true,
  scope: 'task',
};

const DEFAULT_AGENTS = [DEFAULT_WRITER_AGENT, DEFAULT_TASK_AGENT];

function publicAgent(row: {
  id: string;
  name: string;
  avatarUrl: string;
  systemPrompt: string;
  isDefault: boolean;
  scope: string;
}) {
  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatarUrl,
    systemPrompt: row.systemPrompt,
    isDefault: row.isDefault,
    scope: row.scope === 'task' ? 'task' : 'writer',
  };
}

agentsRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    // Auto-seed the two default agents the first time a user lists them.
    const existing = await prisma.agent.findMany({ where: { ownerId: req.user!.id } });
    const ids = new Set(existing.map((a) => a.id));
    for (const def of DEFAULT_AGENTS) {
      if (ids.has(def.id)) continue;
      await prisma.agent.create({
        data: {
          id: def.id,
          ownerId: req.user!.id,
          name: def.name,
          avatarUrl: def.avatarUrl,
          systemPrompt: def.systemPrompt,
          isDefault: def.isDefault,
          scope: def.scope,
        },
      });
    }
    const agents = await prisma.agent.findMany({ where: { ownerId: req.user!.id } });
    res.json({ agents: agents.map(publicAgent) });
  }),
);

agentsRouter.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = agentCreateSchema.parse(req.body);
    const existing = await prisma.agent.findFirst({
      where: { id: body.id, ownerId: req.user!.id },
    });
    if (existing) throw new BadRequest('Agent with that id already exists');
    const agent = await prisma.agent.create({
      data: {
        id: body.id,
        ownerId: req.user!.id,
        name: body.name,
        avatarUrl: body.avatarUrl,
        systemPrompt: body.systemPrompt,
        isDefault: body.isDefault,
        scope: body.scope,
      },
    });
    res.json({ agent: publicAgent(agent) });
  }),
);

agentsRouter.patch(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = agentUpdateSchema.parse(req.body);
    const existing = await prisma.agent.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
    });
    if (!existing) throw new NotFound('Agent not found');
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl;
    if (body.systemPrompt !== undefined) data.systemPrompt = body.systemPrompt;
    if (body.isDefault !== undefined) data.isDefault = body.isDefault;
    if (body.scope !== undefined) data.scope = body.scope;
    const agent = await prisma.agent.update({ where: { id: existing.id }, data });
    res.json({ agent: publicAgent(agent) });
  }),
);

agentsRouter.delete(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await prisma.agent.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
    });
    if (!existing) throw new NotFound('Agent not found');
    if (existing.isDefault) throw new BadRequest('Default agents cannot be deleted');
    await prisma.agent.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  }),
);
