// Provider config routes.
//
//   GET    /api/provider-configs
//   POST   /api/provider-configs
//   PATCH  /api/provider-configs/:id
//   DELETE /api/provider-configs/:id
//
// Provider configs store the user's API key encrypted at rest. The
// `publicProviderConfig` helper in `services/aiProviders.ts` strips the
// `apiKey` and replaces it with a boolean `hasApiKey` flag before returning
// the row. The raw key is never sent to the frontend.

import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { asyncHandler, NotFound } from '../errors.js';
import { providerConfigCreateSchema, providerConfigUpdateSchema } from '../validation/schemas.js';
import { encrypt, decrypt } from '../encryption.js';
import { publicProviderConfig } from '../services/aiProviders.js';

export const providerConfigsRouter = Router();

providerConfigsRouter.use(requireAuth);

providerConfigsRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const rows = await prisma.providerConfig.findMany({ where: { ownerId: req.user!.id } });
    res.json({ providerConfigs: rows.map(publicProviderConfig) });
  }),
);

providerConfigsRouter.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = providerConfigCreateSchema.parse(req.body);
    const row = await prisma.providerConfig.create({
      data: {
        id: body.id,
        ownerId: req.user!.id,
        name: body.name,
        provider: body.provider,
        apiKey: encrypt(body.apiKey),
        selectedModel: body.selectedModel,
        isActive: body.isActive,
        baseUrl: body.baseUrl,
        customModels: body.customModels,
      },
    });
    res.json({ providerConfig: publicProviderConfig(row) });
  }),
);

providerConfigsRouter.patch(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = providerConfigUpdateSchema.parse(req.body);
    const existing = await prisma.providerConfig.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
    });
    if (!existing) throw new NotFound('Provider config not found');
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.provider !== undefined) data.provider = body.provider;
    if (body.apiKey !== undefined) data.apiKey = encrypt(body.apiKey);
    if (body.selectedModel !== undefined) data.selectedModel = body.selectedModel;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.baseUrl !== undefined) data.baseUrl = body.baseUrl;
    if (body.customModels !== undefined) data.customModels = body.customModels;
    const row = await prisma.providerConfig.update({ where: { id: existing.id }, data });
    res.json({ providerConfig: publicProviderConfig(row) });
  }),
);

providerConfigsRouter.delete(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await prisma.providerConfig.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
    });
    if (!existing) throw new NotFound('Provider config not found');
    await prisma.providerConfig.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  }),
);

// Allow internal callers to fetch a decrypted key without going through HTTP.
// Used by the AI service and the search service when actually making
// outbound API calls. Always requires a `userId` argument so a route
// handler can pass `req.user!.id`.
export async function loadDecryptedProviderConfig(userId: string, id: string) {
  const row = await prisma.providerConfig.findFirst({
    where: { id, ownerId: userId },
  });
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    selectedModel: row.selectedModel,
    isActive: row.isActive,
    baseUrl: row.baseUrl,
    customModels: row.customModels,
    apiKey: row.apiKey ? decrypt(row.apiKey) : '',
  };
}
