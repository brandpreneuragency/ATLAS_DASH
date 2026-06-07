// Express app factory. Tests import `createApp` and use supertest against the
// returned app; production calls `createApp()` once and listens.

import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { ZodError } from 'zod';
import { config } from './config.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { projectsRouter } from './routes/projects.js';
import { tasksRouter } from './routes/tasks.js';
import { commentsRouter } from './routes/comments.js';
import { filesRouter } from './routes/files.js';
import { agentsRouter } from './routes/agents.js';
import { providerConfigsRouter } from './routes/providerConfigs.js';
import { settingsRouter } from './routes/settings.js';
import { aiRouter } from './routes/ai.js';
import { taskAiRouter } from './routes/taskAi.js';
import { taskAiHistoryRouter } from './routes/taskAiHistory.js';
import { chatThreadsRouter } from './routes/chatThreads.js';
import { chatMessagesRouter } from './routes/chatMessages.js';
import { documentsRouter } from './routes/documents.js';
import { searchRouter } from './routes/search.js';
import { importRouter } from './routes/import.js';
import { attachUser } from './auth/middleware.js';
import { HttpError } from './errors.js';

// `JSON.stringify` (and therefore Express's `res.json`) throws on BigInt by
// default. Our Prisma schema stores timestamps as BIGINT (Unix ms), so
// every row returned by the API has BigInt fields. Define a `toJSON` method
// on the prototype so the wire format stays plain JSON numbers. The values
// (Unix ms) fit comfortably in `Number.MAX_SAFE_INTEGER` for the next
// 285 millennia, so this round-trip is lossless.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function () {
  return Number(this);
};

export function createApp(): Express {
  const app = express();

  // Trust the Caddy / nginx reverse proxy in front of us so that
  // `req.ip` and `req.secure` reflect the real client.
  app.set('trust proxy', 1);

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(attachUser);

  // Routes
  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/tasks', tasksRouter);
  // The comments router is mounted twice: once under /api/tasks for the
  // nested `/:taskId/comments` list, and once under /api/comments for the
  // flat PATCH/DELETE on `/:id`. See `routes/comments.ts` for details.
  app.use('/api/tasks', commentsRouter);
  app.use('/api/tasks', taskAiHistoryRouter);
  app.use('/api/comments', commentsRouter);
  app.use('/api/files', filesRouter);
  app.use('/api/agents', agentsRouter);
  app.use('/api/provider-configs', providerConfigsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/task-ai', taskAiRouter);
  // The chat messages router is mounted twice: once under
  // `/api/chat-threads` for the nested list/create, and once under
  // `/api/chat-messages` for the flat PATCH/DELETE.
  app.use('/api/chat-threads', chatThreadsRouter);
  app.use('/api/chat-threads', chatMessagesRouter);
  app.use('/api/chat-messages', chatMessagesRouter);
  app.use('/api/documents', documentsRouter);
  app.use('/api/ai/search', searchRouter);
  app.use('/api/import', importRouter);

  // 404
  app.use((req, res) => {
    res.status(404).json({ error: 'not_found', path: req.path });
  });

  // Central error handler.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.code, message: err.message });
      return;
    }
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'validation_error', issues: err.issues });
      return;
    }
    // Unexpected — log and return a generic 500. Do not leak details.
    // eslint-disable-next-line no-console
    console.error('[tabs-server] unhandled error:', err);
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}

// Reference config so unused-import linters don't trip on the dev-only
// startup banner.
void config;
