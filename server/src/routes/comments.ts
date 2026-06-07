// Task comment routes.
//
//   GET    /api/tasks/:taskId/comments    → list a task's comments
//   POST   /api/tasks/:taskId/comments    → create a comment (with optional file)
//   PATCH  /api/comments/:id              → edit comment text
//   DELETE /api/comments/:id              → delete the comment
//
// The router is mounted twice (once under `/api/tasks` for the nested list,
// once under `/api/comments` for the flat PATCH/DELETE). All handlers
// enforce ownership via `ownerId = req.user.id`.
//
// POST accepts two body shapes:
//
//   * `application/json` — text-only comments. The `fileId` field is
//     accepted but ignored; pre-existing files are not linked through this
//     path.
//   * `multipart/form-data` — comment + optional file. Form fields are
//     `id`, `text`, optional `sender`, optional `replyTo` (JSON-encoded),
//     and optional `file` (the upload). The comment and the File row are
//     created in a single Prisma transaction; if anything fails, the
//     physical bytes are cleaned up so we never leave a comment pointing
//     at a missing file or a file pointing at a missing comment.

import { Router, type Request, type RequestHandler } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { asyncHandler, BadRequest, NotFound, PayloadTooLarge } from '../errors.js';
import {
  commentCreateSchema,
  commentMultipartTextFieldsSchema,
  commentUpdateSchema,
  replyToSchema,
} from '../validation/schemas.js';
import {
  MAX_UPLOAD_BYTES,
  moveIntoStorage,
  removeFromStorage,
  resolveStoragePath,
  sanitizeFilename,
  sha256OfFile,
  tempUploadDir,
} from '../services/fileStorage.js';
import { publicFile } from './files.js';
import { now } from '../util/now.js';

export const commentsRouter = Router();

commentsRouter.use(requireAuth);

// ── Multer setup ───────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tempUploadDir()),
    filename: (_req, file, cb) => {
      // Temp filename. We never reuse this for storage; it just needs to be
      // collision-free. Keep a sanitized extension for diagnostics.
      const rand = crypto.randomBytes(16).toString('hex');
      const rawExt = path.extname(file.originalname);
      const ext = rawExt.replace(/[^.a-zA-Z0-9]/g, '').slice(0, 10);
      cb(null, `${Date.now()}-${rand}${ext}`);
    },
  }),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
    // Bound the text-field side of the multipart body too. The comment text
    // schema caps at 20 KB; we allow some slack for replyTo + multipart
    // boundaries.
    fieldSize: 64 * 1024,
    fields: 20,
  },
});

function isMultipart(req: Request): boolean {
  const ctype = req.headers['content-type'];
  return typeof ctype === 'string' && ctype.toLowerCase().startsWith('multipart/form-data');
}

/**
 * Run the multer single-file middleware only when the request is multipart.
 * For `application/json` requests the body is already parsed by express.json.
 * Multer errors are translated to our typed HttpErrors.
 */
const conditionalUpload: RequestHandler = (req, res, next) => {
  if (!isMultipart(req)) return next();
  upload.single('file')(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new PayloadTooLarge(`File exceeds ${MAX_UPLOAD_BYTES} bytes`));
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return next(new BadRequest('Only one file is allowed'));
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(new BadRequest(`Unexpected file field: ${err.field ?? ''}`));
      }
      return next(new BadRequest(`Multipart parse error: ${err.code}`));
    }
    return next(err);
  });
};

// ── Nested: /api/tasks/:taskId/comments ────────────────────────────────────

commentsRouter.get(
  '/:taskId/comments',
  asyncHandler(async (req: AuthedRequest, res) => {
    const task = await prisma.task.findFirst({
      where: { id: req.params.taskId, ownerId: req.user!.id },
      select: { id: true },
    });
    if (!task) throw new NotFound('Task not found');
    const comments = await prisma.taskComment.findMany({
      where: { taskId: task.id, ownerId: req.user!.id },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ comments });
  }),
);

commentsRouter.post(
  '/:taskId/comments',
  conditionalUpload,
  asyncHandler(async (req: AuthedRequest, res) => {
    const task = await prisma.task.findFirst({
      where: { id: req.params.taskId, ownerId: req.user!.id },
      select: { id: true },
    });
    if (!task) {
      // Clean up the upload (if any) before we throw — the auth check
      // succeeded but the task doesn't belong to this user.
      await cleanupUpload(req);
      throw new NotFound('Task not found');
    }

    try {
      if (req.file) {
        await handleMultipartCreate(req, res, task.id);
      } else {
        await handleJsonCreate(req, res, task.id);
      }
    } catch (err) {
      // Ensure any temp upload is cleaned up before we propagate the error.
      await cleanupUpload(req);
      throw err;
    }
  }),
);

/**
 * JSON-only path: text + optional replyTo. No files.
 */
async function handleJsonCreate(
  req: AuthedRequest,
  res: import('express').Response,
  taskId: string,
): Promise<void> {
  const body = commentCreateSchema.parse(req.body);
  const comment = await prisma.taskComment.create({
    data: {
      id: body.id,
      ownerId: req.user!.id,
      taskId,
      sender: body.sender ?? null,
      text: body.text,
      // No file linked through the JSON path. fileId is accepted in the
      // schema for forward compatibility but ignored here.
      fileId: null,
      replyTo: body.replyTo ?? Prisma.JsonNull,
      createdAt: now(),
      attachmentName: null,
      attachmentSize: null,
      attachmentPath: null,
    },
  });
  res.json({ comment });
}

/**
 * Multipart path: comment + uploaded file. The file is moved into permanent
 * storage and the File + TaskComment rows are created in a single Prisma
 * transaction. If the transaction fails after the move, the on-disk file is
 * removed so we don't leak orphaned bytes.
 */
async function handleMultipartCreate(
  req: AuthedRequest,
  res: import('express').Response,
  taskId: string,
): Promise<void> {
  const fileUpload = req.file!;
  const ownerId = req.user!.id;

  // Parse text fields. Multer puts them on req.body as strings.
  const textFields = commentMultipartTextFieldsSchema.parse(req.body);
  let replyTo: Prisma.InputJsonValue | typeof Prisma.JsonNull = Prisma.JsonNull;
  if (typeof textFields.replyTo === 'string' && textFields.replyTo.length > 0) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(textFields.replyTo);
    } catch {
      throw new BadRequest('replyTo must be valid JSON');
    }
    const result = replyToSchema.safeParse(parsed);
    if (!result.success) throw new BadRequest('replyTo failed validation');
    replyTo = result.data as Prisma.InputJsonValue;
  }

  // Sanitize the upload's original filename for on-disk storage.
  const originalName = fileUpload.originalname;
  const storedName = sanitizeFilename(originalName);
  const fileId = crypto.randomUUID().replace(/-/g, '').slice(0, 24);

  // Compute SHA-256 from the temp file (streamed, no full-buffer load).
  const sha256 = await sha256OfFile(fileUpload.path);

  // Resolve the final on-disk path. resolveStoragePath validates the IDs
  // and ensures the result stays inside FILE_STORAGE_ROOT.
  const finalPath = resolveStoragePath(ownerId, fileId, storedName);

  // Move temp → permanent. This is the first irreversible side effect.
  await moveIntoStorage(fileUpload.path, finalPath);

  try {
    const created = now();
    const result = await prisma.$transaction(async (tx) => {
      const fileRow = await tx.file.create({
        data: {
          id: fileId,
          ownerId,
          taskId,
          commentId: textFields.id,
          originalName,
          storedName,
          storagePath: finalPath,
          mimeType: fileUpload.mimetype || 'application/octet-stream',
          sizeBytes: fileUpload.size,
          sha256,
          createdAt: created,
          deletedAt: null,
        },
      });
      const commentRow = await tx.taskComment.create({
        data: {
          id: textFields.id,
          ownerId,
          taskId,
          sender: textFields.sender ?? null,
          text: textFields.text,
          fileId: fileRow.id,
          replyTo,
          createdAt: created,
          attachmentName: null,
          attachmentSize: null,
          attachmentPath: null,
        },
      });
      return { fileRow, commentRow };
    });
    res.json({ comment: result.commentRow, file: publicFile(result.fileRow) });
  } catch (err) {
    // DB write failed — undo the disk write so we don't leak bytes for a
    // comment/file pair that doesn't exist.
    await removeFromStorage(finalPath);
    throw err;
  }
}

/**
 * Best-effort: if multer stored a temp file but the request failed before
 * we moved it into storage, rm the temp file so it doesn't leak.
 */
async function cleanupUpload(req: AuthedRequest): Promise<void> {
  const uploaded = req.file;
  if (!uploaded) return;
  await removeFromStorage(uploaded.path);
}

// ── Flat: /api/comments/:id ────────────────────────────────────────────────

commentsRouter.patch(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = commentUpdateSchema.parse(req.body);
    const existing = await prisma.taskComment.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
    });
    if (!existing) throw new NotFound('Comment not found');
    const comment = await prisma.taskComment.update({
      where: { id: existing.id },
      data: { text: body.text },
    });
    res.json({ comment });
  }),
);

commentsRouter.delete(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await prisma.taskComment.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
    });
    if (!existing) throw new NotFound('Comment not found');
    await prisma.taskComment.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  }),
);
