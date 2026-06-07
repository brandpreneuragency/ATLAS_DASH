// File routes.
//
//   GET    /api/files/:fileId/content   → stream the file (auth + owner check)
//   DELETE /api/files/:fileId           → soft-delete DB row + remove bytes
//
// The actual upload entry point lives in `routes/comments.ts` (the multipart
// `POST /api/tasks/:taskId/comments` endpoint). This router only owns the
// after-upload lifecycle: serving the bytes back to the owner, and tearing
// them down. The on-disk path is never returned in any response — the
// download endpoint streams the file directly through Express.

import { Router } from 'express';
import mime from 'mime-types';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { asyncHandler, NotFound } from '../errors.js';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { removeFromStorage } from '../services/fileStorage.js';
import { now } from '../util/now.js';
import type { File as FileRow } from '@prisma/client';

export const filesRouter = Router();

filesRouter.use(requireAuth);

// ── Public-shape helper ────────────────────────────────────────────────────

/**
 * Strip `storagePath` (which is private) from a File row before sending it
 * to the client. Every response that mentions a file must go through this.
 *
 * Casts BigInt → number at the boundary so the JSON wire format stays plain.
 */
export function publicFile(f: FileRow) {
  return {
    id: f.id,
    ownerId: f.ownerId,
    taskId: f.taskId,
    commentId: f.commentId,
    originalName: f.originalName,
    storedName: f.storedName,
    mimeType: f.mimeType,
    sizeBytes: f.sizeBytes,
    sha256: f.sha256,
    createdAt: Number(f.createdAt),
    deletedAt: f.deletedAt === null ? null : Number(f.deletedAt),
  };
}

// ── GET /api/files/:fileId/content ─────────────────────────────────────────

filesRouter.get(
  '/:fileId/content',
  asyncHandler(async (req: AuthedRequest, res) => {
    const file = await prisma.file.findFirst({
      where: { id: req.params.fileId, ownerId: req.user!.id, deletedAt: null },
    });
    if (!file) throw new NotFound('File not found');

    // Verify the physical file is still present. If the DB row exists but the
    // bytes are missing (e.g. failed migration, disk recovery), return 404
    // instead of letting Express crash on the missing file.
    try {
      await stat(file.storagePath);
    } catch {
      throw new NotFound('File not found');
    }

    // `mime-types` resolves "application/octet-stream" when it can't infer.
    // We trust the DB value first (recorded at upload time from the multer
    // mimetype) and fall back to extension sniffing.
    const contentType = file.mimeType || mime.lookup(file.originalName) || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(file.sizeBytes));
    // `inline` lets the browser render images/PDFs in place; the original
    // filename is escaped for the legacy and UTF-8 forms so non-ASCII
    // characters survive download.
    const safeName = file.originalName.replace(/"/g, '');
    const encodedName = encodeURIComponent(file.originalName);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${safeName}"; filename*=UTF-8''${encodedName}`,
    );
    // Don't let intermediaries cache user-owned content.
    res.setHeader('Cache-Control', 'private, no-store');

    const stream = createReadStream(file.storagePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(404).json({ error: 'not_found', message: 'File not found' });
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
  }),
);

// ── DELETE /api/files/:fileId ──────────────────────────────────────────────

filesRouter.delete(
  '/:fileId',
  asyncHandler(async (req: AuthedRequest, res) => {
    const file = await prisma.file.findFirst({
      where: { id: req.params.fileId, ownerId: req.user!.id },
    });
    if (!file) throw new NotFound('File not found');

    // Already soft-deleted? Treat as idempotent success. The physical file
    // is presumed already gone.
    if (file.deletedAt !== null) {
      res.json({ ok: true, file: publicFile(file) });
      return;
    }

    // Soft-delete first so the DB record matches reality if the disk op
    // fails. The physical-file removal is best-effort.
    const updated = await prisma.file.update({
      where: { id: file.id },
      data: { deletedAt: now() },
    });
    await removeFromStorage(file.storagePath);
    res.json({ ok: true, file: publicFile(updated) });
  }),
);
