// AI chat routes.
//
//   POST /api/ai/stream
//   POST /api/ai/task-draft
//
// The browser never calls provider APIs directly. Every AI request hits one
// of these endpoints. The server decrypts the user's stored API key, calls
// the provider, and either pipes chunks back as Server-Sent Events (stream)
// or returns a single `TaskAIDraft` (task-draft).
//
// SSE wire format:
//
//   data: {"chunk": "hello"}\n\n
//   data: {"chunk": " world"}\n\n
//   data: {"done": true}\n\n
//
// We use JSON inside `data:` so the client can detect a `done` flag (vs the
// OpenAI/Anthropic `data: [DONE]` convention). The chunk string is what
// the model emitted; the client concatenates them.

import { Router, type Response } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { asyncHandler, NotFound } from '../errors.js';
import { aiStreamRequestSchema, taskAIDraftRequestSchema } from '../validation/schemas.js';
import {
  getStreamerFor,
  resolveProviderConfig,
} from '../services/aiProviders.js';
import { planTaskAIDraft } from '../services/taskAIPlanner.js';

export const aiRouter = Router();

aiRouter.use(requireAuth);

// ── POST /api/ai/stream ─────────────────────────────────────────────────────

aiRouter.post(
  '/stream',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const body = aiStreamRequestSchema.parse(req.body);
    const provider = await loadProvider(req.user!.id, body.providerId);
    if (!provider) throw new NotFound('AI provider not found');

    // Build the messages array. If a systemPrompt is provided, it goes
    // first (matching the previous frontend behaviour).
    const messages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [];
    if (body.systemPrompt.trim().length > 0) {
      messages.push({ role: 'system', content: body.systemPrompt });
    }
    for (const m of body.messages) {
      // The server-side streamer only accepts string content today. Image
      // parts are flattened to text in the frontend before this call; the
      // type system enforces that here too.
      if (typeof m.content === 'string') {
        messages.push({ role: m.role, content: m.content });
      } else {
        const text = m.content
          .map((part) => (part.type === 'text' ? part.text : ''))
          .join('\n');
        messages.push({ role: m.role, content: text });
      }
    }

    // Set up SSE headers.
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const stream = getStreamerFor(provider.provider)(provider, messages, {});
    try {
      for await (const chunk of stream) {
        if (req.aborted) {
          res.end();
          return;
        }
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'stream error';
      try {
        res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      } catch {
        // Client already disconnected.
      }
      res.end();
    }
  }),
);

// ── POST /api/ai/task-draft ─────────────────────────────────────────────────

aiRouter.post(
  '/task-draft',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = taskAIDraftRequestSchema.parse(req.body);
    const provider = await loadProvider(req.user!.id, body.providerId);
    if (!provider) throw new NotFound('AI provider not found');

    const validProjectIds = new Set(body.validProjectIds);
    const result = await planTaskAIDraft(prisma, {
      userText: body.userText,
      context: body.context,
      providerId: body.providerId,
      systemPrompt: body.systemPrompt,
      validProjectIds,
      searchResultsText: body.searchResultsText,
    });
    res.json({ draft: result.draft, provider: result.provider });
  }),
);

async function loadProvider(
  userId: string,
  providerId: string,
): Promise<ReturnType<typeof resolveProviderConfig> | null> {
  const row = await prisma.providerConfig.findFirst({
    where: { id: providerId, ownerId: userId },
  });
  if (!row) return null;
  return resolveProviderConfig({
    id: row.id,
    name: row.name,
    provider: row.provider,
    apiKey: row.apiKey,
    selectedModel: row.selectedModel,
    isActive: row.isActive,
    baseUrl: row.baseUrl,
    customModels: row.customModels,
  });
}
