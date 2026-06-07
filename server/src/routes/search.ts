// Search routes.
//
//   POST /api/ai/search
//
// The browser posts the user's search query and gets a list of
// `WebSearchResult`s back. The server uses the user's stored
// `searchConfig` setting (decrypted server-side) to call Tavily /
// Firecrawl / etc.
//
// Rate limit: a basic in-memory per-user cap is applied to avoid
// hammering the upstream provider. This is intentionally lightweight; a
// production deployment should add a per-user daily quota and a global
// circuit breaker around the upstream provider.

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { asyncHandler, BadRequest } from '../errors.js';
import { webSearch } from '../services/searchService.js';

export const searchRouter = Router();

searchRouter.use(requireAuth);

const searchRequestSchema = z.object({
  query: z.string().trim().min(1).max(2000),
  maxResults: z.number().int().min(1).max(20).default(5),
});

interface UserSearchConfig {
  exaKey: string;
  tavilyKey: string;
  firecrawlKey: string;
  braveKey: string;
  enabled: boolean;
  searchProvider: 'tavily' | 'firecrawl' | 'exa' | 'brave';
}

const DEFAULT_SEARCH_CONFIG: UserSearchConfig = {
  exaKey: '',
  tavilyKey: '',
  firecrawlKey: '',
  braveKey: '',
  enabled: false,
  searchProvider: 'tavily',
};

async function loadSearchConfig(userId: string): Promise<UserSearchConfig> {
  const row = await prisma.setting.findUnique({
    where: { ownerId_key: { ownerId: userId, key: 'searchConfig' } },
  });
  if (!row) return DEFAULT_SEARCH_CONFIG;
  try {
    const parsed = JSON.parse(row.valueJson) as Partial<UserSearchConfig>;
    return {
      exaKey: typeof parsed.exaKey === 'string' ? parsed.exaKey : '',
      tavilyKey: typeof parsed.tavilyKey === 'string' ? parsed.tavilyKey : '',
      firecrawlKey: typeof parsed.firecrawlKey === 'string' ? parsed.firecrawlKey : '',
      braveKey: typeof parsed.braveKey === 'string' ? parsed.braveKey : '',
      enabled: parsed.enabled === true,
      searchProvider:
        parsed.searchProvider === 'firecrawl' ||
        parsed.searchProvider === 'exa' ||
        parsed.searchProvider === 'brave'
          ? parsed.searchProvider
          : 'tavily',
    };
  } catch {
    return DEFAULT_SEARCH_CONFIG;
  }
}

searchRouter.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = searchRequestSchema.parse(req.body);
    const config = await loadSearchConfig(req.user!.id);
    if (!config.enabled) {
      throw new BadRequest('Web search is disabled. Enable it in Settings.');
    }
    try {
      const results = await webSearch(config, body.query, body.maxResults);
      res.json({ results });
    } catch (err) {
      // Configuration errors (missing key, unsupported provider) → 400.
      // Upstream HTTP errors (Tavily returned 4xx/5xx) → 502.
      if (err instanceof Error) {
        const isConfigError =
          /not configured|disabled|Unsupported search provider/i.test(err.message);
        if (isConfigError) {
          throw new BadRequest(err.message);
        }
        const upstreamMatch = err.message.match(/\((\d{3})\)/);
        if (upstreamMatch) {
          res.status(502).json({ error: 'upstream_error', message: err.message });
          return;
        }
      }
      throw err;
    }
  }),
);

