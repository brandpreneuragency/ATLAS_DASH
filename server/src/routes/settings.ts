// Per-user settings routes.
//
// Settings are a tiny key-value store keyed on `(ownerId, key)`. The plan
// calls out three specific persisted values that used to live in Dexie or
// in the Tauri keychain:
//
//   * `activeAgentId` (writer)
//   * `activeTaskAgentId` (task)
//   * `activeProviderId`
//   * `appManagementProviderId`
//   * `hiddenModels`     (JSON array of `"configId:modelSlug"` strings)
//
// `searchConfig` and `systemInstructions` also used to live in the Tauri
// keychain. They are also stored as settings rows here. Both are read
// together under `/api/search-config` and `/api/system-instructions` for
// convenience (the Tauri store had them under dedicated secure-storage
// keys, so the API mirrors that).

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { asyncHandler, NotFound } from '../errors.js';
import { searchConfigSchema, settingKeySchema, settingPutSchema, settingsKeysSchema } from '../validation/schemas.js';
import { BadRequest } from '../errors.js';

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

// ── Generic settings ────────────────────────────────────────────────────────

const settingsListSchema = z.object({
  keys: settingsKeysSchema,
});

settingsRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = settingsListSchema.parse(req.query);
    // Validate every key against the closed set so an attacker can't query
    // for arbitrary row contents (the row is still owner-scoped but the
    // schema enforces what is a real key).
    let keys: string[] | undefined;
    if (parsed.keys && parsed.keys.length > 0) {
      if (parsed.keys.length > 200) throw new BadRequest('too many keys');
      for (const k of parsed.keys) settingKeySchema.parse(k);
      keys = parsed.keys;
    }
    const where: { ownerId: string; key?: { in: string[] } } = { ownerId: req.user!.id };
    if (keys && keys.length > 0) where.key = { in: keys };
    const rows = await prisma.setting.findMany({ where });
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        result[row.key] = JSON.parse(row.valueJson);
      } catch {
        result[row.key] = row.valueJson;
      }
    }
    res.json({ settings: result });
  }),
);

settingsRouter.put(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = settingPutSchema.parse(req.body);
    const valueJson = JSON.stringify(body.value);
    await prisma.setting.upsert({
      where: { ownerId_key: { ownerId: req.user!.id, key: body.key } },
      create: { ownerId: req.user!.id, key: body.key, valueJson },
      update: { valueJson },
    });
    res.json({ ok: true });
  }),
);

settingsRouter.delete(
  '/:key',
  asyncHandler(async (req: AuthedRequest, res) => {
    const key = settingKeySchema.parse(req.params.key);
    const existing = await prisma.setting.findUnique({
      where: { ownerId_key: { ownerId: req.user!.id, key } },
    });
    if (!existing) throw new NotFound('Setting not found');
    await prisma.setting.delete({
      where: { ownerId_key: { ownerId: req.user!.id, key } },
    });
    res.json({ ok: true });
  }),
);

// ── Search config (stored as settings rows for forward compatibility) ─────

const SEARCH_CONFIG_KEY = 'searchConfig';

settingsRouter.get(
  '/search-config',
  asyncHandler(async (req: AuthedRequest, res) => {
    const row = await prisma.setting.findUnique({
      where: { ownerId_key: { ownerId: req.user!.id, key: SEARCH_CONFIG_KEY } },
    });
    if (!row) {
      res.json({
        searchConfig: {
          exaKey: '',
          tavilyKey: '',
          firecrawlKey: '',
          braveKey: '',
          enabled: false,
          searchProvider: 'tavily',
        },
      });
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.valueJson);
    } catch {
      parsed = {};
    }
    const safe = searchConfigSchema.parse(parsed);
    res.json({ searchConfig: safe });
  }),
);

settingsRouter.put(
  '/search-config',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = searchConfigSchema.parse(req.body);
    await prisma.setting.upsert({
      where: { ownerId_key: { ownerId: req.user!.id, key: SEARCH_CONFIG_KEY } },
      create: {
        ownerId: req.user!.id,
        key: SEARCH_CONFIG_KEY,
        valueJson: JSON.stringify(body),
      },
      update: { valueJson: JSON.stringify(body) },
    });
    res.json({ searchConfig: body });
  }),
);

// ── System instructions (also a settings row) ─────────────────────────────

const SYSTEM_INSTRUCTIONS_KEY = 'systemInstructions';

settingsRouter.get(
  '/system-instructions',
  asyncHandler(async (req: AuthedRequest, res) => {
    const row = await prisma.setting.findUnique({
      where: { ownerId_key: { ownerId: req.user!.id, key: SYSTEM_INSTRUCTIONS_KEY } },
    });
    res.json({ systemInstructions: asString(row ? safeJson(row.valueJson) : '') });
  }),
);

settingsRouter.put(
  '/system-instructions',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z.object({ systemInstructions: z.string().max(40_000) }).parse(req.body ?? {});
    await prisma.setting.upsert({
      where: { ownerId_key: { ownerId: req.user!.id, key: SYSTEM_INSTRUCTIONS_KEY } },
      create: {
        ownerId: req.user!.id,
        key: SYSTEM_INSTRUCTIONS_KEY,
        valueJson: JSON.stringify(body.systemInstructions),
      },
      update: { valueJson: JSON.stringify(body.systemInstructions) },
    });
    res.json({ systemInstructions: body.systemInstructions });
  }),
);

function safeJson(valueJson: string): unknown {
  try {
    return JSON.parse(valueJson);
  } catch {
    return '';
  }
}
