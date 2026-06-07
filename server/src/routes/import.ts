// Local-Dexie import route.
//
//   POST /api/import    → idempotent upsert of every Dexie table
//
// The endpoint accepts a single payload that mirrors a Dexie export (one
// array per table). Each table is processed independently:
//
//   1. Rows whose primary key already exists under the current user are
//      counted as `skipped` (idempotent re-runs are safe).
//   2. Rows whose primary key is unknown are inserted under `ownerId =
//      req.user.id` and counted as `imported`.
//   3. Rows that fail validation or violate a DB constraint are counted as
//      `failed` — the rest of the import keeps going.
//
// Foreign-key references that point to a project / thread / task the user
// didn't import (or that already existed) are preserved: a comment on a
// known task lands, a comment on an unknown task is counted as `failed`.
//
// Comment `attachmentDataUrl` values are decoded, written to disk under
// the same `File` rows the regular upload path creates, and the resulting
// `fileId` is linked to the new `TaskComment`. The same applies to legacy
// chat-message attachments (the Dexie `Attachment` shape with a `dataUrl`).
//
// The endpoint is large-payload friendly: a separate `express.json`
// middleware mounted just for this route raises the body limit. The default
// 1 MB cap is too small for users with hundreds of base64-encoded
// attachments.

import { Router, type RequestHandler } from 'express';
import express from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import crypto from 'node:crypto';
import path from 'node:path';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { asyncHandler, BadRequest } from '../errors.js';
import {
  importPayloadSchema,
  type ImportPayload,
} from '../validation/schemas.js';
import {
  moveIntoStorage,
  resolveStoragePath,
  sanitizeFilename,
  sha256OfFile,
  tempUploadDir,
  removeFromStorage,
  MAX_UPLOAD_BYTES,
} from '../services/fileStorage.js';
import { encrypt } from '../encryption.js';
import { now } from '../util/now.js';

// ── Router setup ────────────────────────────────────────────────────────────

export const importRouter = Router();
importRouter.use(requireAuth);

// The import body can be large (base64 attachments). Mount a dedicated JSON
// parser with a much higher cap, scoped to this router only.
const importJson: RequestHandler = express.json({ limit: '200mb' });
importRouter.use(importJson);

// ── Per-table counters ──────────────────────────────────────────────────────

const ZERO_COUNTS = {
  imported: 0,
  skipped: 0,
  failed: 0,
} as const;

interface ImportReport {
  projects: { imported: number; skipped: number; failed: number };
  tasks: { imported: number; skipped: number; failed: number };
  taskComments: { imported: number; skipped: number; failed: number };
  documents: { imported: number; skipped: number; failed: number };
  chatThreads: { imported: number; skipped: number; failed: number };
  chatMessages: { imported: number; skipped: number; failed: number };
  agents: { imported: number; skipped: number; failed: number };
  providerConfigs: { imported: number; skipped: number; failed: number };
  quickPrompts: { imported: number; skipped: number; failed: number };
  settings: { imported: number; skipped: number; failed: number };
  taskAIChangeBatches: { imported: number; skipped: number; failed: number };
  files: { uploaded: number; failed: number };
}

// ── Data-URL helpers ───────────────────────────────────────────────────────

interface DecodedDataUrl {
  mimeType: string;
  bytes: Buffer;
  /** Human-readable name (best-effort from the data URL; often not present). */
  fallbackName: string;
}

const DATA_URL_RE = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([a-zA-Z0-9+/=]+)$/u;

/**
 * Parse a `data:<mime>;base64,<bytes>` string. Returns `null` if the string
 * doesn't match — callers should treat that as a failed attachment.
 */
function decodeDataUrl(value: string): DecodedDataUrl | null {
  const match = DATA_URL_RE.exec(value);
  if (!match) return null;
  const mimeType = match[1] ?? 'application/octet-stream';
  const b64 = match[2] ?? '';
  try {
    const bytes = Buffer.from(b64, 'base64');
    if (bytes.length === 0) return null;
    return { mimeType, bytes, fallbackName: 'attachment' };
  } catch {
    return null;
  }
}

/**
 * Write a comment / message attachment to permanent storage under the
 * standard `{root}/users/{ownerId}/{fileId}/{safeStoredName}` layout, then
 * return the metadata needed to create the matching `File` row.
 *
 * Returns `null` if the bytes exceed the per-upload limit. The caller
 * counts that as a `failed` file (the surrounding row is still imported
 * without the attachment so the rest of the user's data lands).
 */
async function persistAttachment(
  ownerId: string,
  bytes: Buffer,
  mimeType: string,
  displayName: string | undefined,
  taskId: string | null,
  commentId: string | null,
  nowMs: bigint,
): Promise<{ id: string; sha256: string; originalName: string; storedName: string; storagePath: string; sizeBytes: number } | null> {
  if (bytes.length > MAX_UPLOAD_BYTES) return null;

  const fileId = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  const originalName = (displayName && displayName.length > 0) ? displayName : 'attachment';
  const storedName = sanitizeFilename(originalName);
  const finalPath = resolveStoragePath(ownerId, fileId, storedName);

  // Write the bytes to the temp dir first so we can stream-hash, then move
  // into permanent storage. Buffer.concat with the user-supplied bytes
  // gives us the same on-disk representation as a real multer upload.
  const tempName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  const tempPath = path.join(tempUploadDir(), tempName);
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await (await import('node:fs/promises')).writeFile(tempPath, bytes);
  try {
    const sha256 = await sha256OfFile(tempPath);
    await moveIntoStorage(tempPath, finalPath);
    return {
      id: fileId,
      sha256,
      originalName,
      storedName,
      storagePath: finalPath,
      sizeBytes: bytes.length,
    };
  } catch (err) {
    // Cleanup on failure so we never leak bytes.
    await removeFromStorage(tempPath).catch(() => undefined);
    await removeFromStorage(finalPath).catch(() => undefined);
    throw err;
  }
}

// ── Main handler ────────────────────────────────────────────────────────────

importRouter.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    let body: ImportPayload;
    try {
      body = importPayloadSchema.parse(req.body);
    } catch (err) {
      if (err instanceof z.ZodError) throw err;
      throw new BadRequest('Invalid import payload');
    }

    const ownerId = req.user!.id;
    const currentTs = now();
    const report: ImportReport = {
      projects: { ...ZERO_COUNTS },
      tasks: { ...ZERO_COUNTS },
      taskComments: { ...ZERO_COUNTS },
      documents: { ...ZERO_COUNTS },
      chatThreads: { ...ZERO_COUNTS },
      chatMessages: { ...ZERO_COUNTS },
      agents: { ...ZERO_COUNTS },
      providerConfigs: { ...ZERO_COUNTS },
      quickPrompts: { ...ZERO_COUNTS },
      settings: { ...ZERO_COUNTS },
      taskAIChangeBatches: { ...ZERO_COUNTS },
      files: { uploaded: 0, failed: 0 },
    };

    // ── 1. Projects ──────────────────────────────────────────────────────
    for (const p of body.projects) {
      try {
        const existing = await prisma.project.findFirst({
          where: { id: p.id, ownerId },
          select: { id: true },
        });
        if (existing) {
          report.projects.skipped += 1;
          continue;
        }
        await prisma.project.create({
          data: {
            id: p.id,
            ownerId,
            name: p.name,
            color: p.color,
            createdAt: p.createdAt !== undefined ? BigInt(p.createdAt) : currentTs,
          },
        });
        report.projects.imported += 1;
      } catch {
        report.projects.failed += 1;
      }
    }

    // ── 2. Tasks (depend on projects) ────────────────────────────────────
    // Look up the set of project IDs the user actually owns so we can null
    // out references to projects that weren't imported.
    const ownedProjectIds = new Set(
      (await prisma.project.findMany({ where: { ownerId }, select: { id: true } })).map((r) => r.id),
    );
    for (const t of body.tasks) {
      try {
        const existing = await prisma.task.findFirst({
          where: { id: t.id, ownerId },
          select: { id: true },
        });
        if (existing) {
          report.tasks.skipped += 1;
          continue;
        }
        // Drop references to projects / parents that weren't imported.
        const projectId =
          t.projectId && ownedProjectIds.has(t.projectId) ? t.projectId : null;
        // We resolve parentId after the first pass because a subtask might
        // appear before its parent in the array. Track the IDs we imported
        // in this run and add them on the fly.
        await prisma.task.create({
          data: {
            id: t.id,
            ownerId,
            title: t.title,
            content: t.content,
            status: t.status,
            importance: t.importance,
            date: t.date,
            projectId,
            assignees: t.assignees,
            sourcePath: t.sourcePath ?? null,
            order: t.order ?? 0,
            parentId: null, // patched below once we know which parents landed
            sourceChatMessageId: t.sourceChatMessageId ?? null,
            createdAt: t.createdAt !== undefined ? BigInt(t.createdAt) : currentTs,
            updatedAt: t.updatedAt !== undefined ? BigInt(t.updatedAt) : currentTs,
            deletedAt: t.deletedAt !== undefined && t.deletedAt !== null ? BigInt(t.deletedAt) : null,
          },
        });
        report.tasks.imported += 1;
      } catch {
        report.tasks.failed += 1;
      }
    }
    // Second pass: stitch up parentId links for tasks we just imported. We
    // restrict to parent IDs that landed under the same user.
    const allOwnedTaskIds = new Set(
      (await prisma.task.findMany({ where: { ownerId }, select: { id: true } })).map((r) => r.id),
    );
    for (const t of body.tasks) {
      if (!t.parentId) continue;
      if (!allOwnedTaskIds.has(t.parentId) || !allOwnedTaskIds.has(t.id)) continue;
      try {
        await prisma.task.update({
          where: { id: t.id },
          data: { parentId: t.parentId },
        });
      } catch {
        // Non-fatal: the child task is still in the list, just orphaned.
      }
    }

    // ── 3. Documents ─────────────────────────────────────────────────────
    for (const d of body.documents) {
      try {
        const existing = await prisma.document.findFirst({
          where: { id: d.id, ownerId },
          select: { id: true },
        });
        if (existing) {
          report.documents.skipped += 1;
          continue;
        }
        const created = currentTs;
        await prisma.document.create({
          data: {
            id: d.id,
            ownerId,
            title: d.title,
            content: d.content,
            sourcePath: d.sourcePath ?? null,
            order: d.order ?? 0,
            isDirty: d.isDirty ?? false,
            splitEditorOpen: d.splitEditorOpen ?? false,
            createdAt: d.createdAt !== undefined ? BigInt(d.createdAt) : created,
            updatedAt: d.updatedAt !== undefined ? BigInt(d.updatedAt) : created,
          },
        });
        report.documents.imported += 1;
      } catch {
        report.documents.failed += 1;
      }
    }

    // ── 4. Chat threads ──────────────────────────────────────────────────
    for (const t of body.chatThreads) {
      try {
        const existing = await prisma.chatThread.findFirst({
          where: { id: t.id, ownerId },
          select: { id: true },
        });
        if (existing) {
          report.chatThreads.skipped += 1;
          continue;
        }
        await prisma.chatThread.create({
          data: {
            id: t.id,
            ownerId,
            mode: t.mode,
            title: t.title,
            createdAt: t.createdAt !== undefined ? BigInt(t.createdAt) : currentTs,
            updatedAt: t.updatedAt !== undefined ? BigInt(t.updatedAt) : currentTs,
          },
        });
        report.chatThreads.imported += 1;
      } catch {
        report.chatThreads.skipped += 1;
      }
    }

    // ── 5. Chat messages (depend on threads + agents) ───────────────────
    const ownedThreadIds = new Set(
      (await prisma.chatThread.findMany({ where: { ownerId }, select: { id: true } })).map((r) => r.id),
    );
    const ownedDocumentIds = new Set(
      (await prisma.document.findMany({ where: { ownerId }, select: { id: true } })).map((r) => r.id),
    );
    for (const m of body.chatMessages) {
      try {
        const existing = await prisma.chatMessage.findFirst({
          where: { id: m.id, ownerId },
          select: { id: true },
        });
        if (existing) {
          report.chatMessages.skipped += 1;
          continue;
        }
        if (!ownedThreadIds.has(m.threadId)) {
          report.chatMessages.failed += 1;
          continue;
        }
        // Resolve legacy dataUrl attachments into File rows + the modern
        // `{fileId, name, size, mimeType}` shape before persisting.
        const modernAttachments: Array<{ fileId: string; name: string; size?: string | number; mimeType?: string }> = [];
        if (m.attachments) {
          for (const a of m.attachments) {
            if ('fileId' in a) {
              modernAttachments.push(a);
              continue;
            }
            const decoded = decodeDataUrl(a.dataUrl);
            if (!decoded) {
              report.files.failed += 1;
              continue;
            }
            const stored = await persistAttachment(
              ownerId,
              decoded.bytes,
              a.mimeType ?? decoded.mimeType,
              a.name,
              null, // chat attachments don't link to a task
              m.id,  // the message id becomes the `commentId` for traceability
              currentTs,
            );
            if (!stored) {
              report.files.failed += 1;
              continue;
            }
            try {
              await prisma.file.create({
                data: {
                  id: stored.id,
                  ownerId,
                  taskId: null,
                  commentId: m.id,
                  originalName: stored.originalName,
                  storedName: stored.storedName,
                  storagePath: stored.storagePath,
                  mimeType: a.mimeType ?? decoded.mimeType,
                  sizeBytes: stored.sizeBytes,
                  sha256: stored.sha256,
                  createdAt: currentTs,
                  deletedAt: null,
                },
              });
              modernAttachments.push({
                fileId: stored.id,
                name: stored.originalName,
                size: stored.sizeBytes,
                mimeType: a.mimeType ?? decoded.mimeType,
              });
              report.files.uploaded += 1;
            } catch (err) {
              await removeFromStorage(stored.storagePath).catch(() => undefined);
              report.files.failed += 1;
            }
          }
        }
        await prisma.chatMessage.create({
          data: {
            id: m.id,
            ownerId,
            threadId: m.threadId,
            mode: m.mode,
            documentId:
              m.documentId && ownedDocumentIds.has(m.documentId) ? m.documentId : null,
            taskId: m.taskId && allOwnedTaskIds.has(m.taskId) ? m.taskId : null,
            agentId: m.agentId,
            role: m.role,
            content: m.content,
            selectedText: m.selectedText ?? null,
            selectionFrom: m.selectionFrom ?? null,
            selectionTo: m.selectionTo ?? null,
            suggestedText: m.suggestedText ?? null,
            replyTo: m.replyTo ? (m.replyTo as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            attachments: modernAttachments.length > 0
              ? (modernAttachments as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            taskDraft: m.taskDraft ? (m.taskDraft as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            taskDraftStatus: m.taskDraftStatus ?? null,
            timestamp: m.timestamp !== undefined ? BigInt(m.timestamp) : currentTs,
          },
        });
        report.chatMessages.imported += 1;
      } catch {
        report.chatMessages.failed += 1;
      }
    }

    // ── 6. Task comments (depend on tasks) ──────────────────────────────
    for (const c of body.taskComments) {
      try {
        const existing = await prisma.taskComment.findFirst({
          where: { id: c.id, ownerId },
          select: { id: true },
        });
        if (existing) {
          report.taskComments.skipped += 1;
          continue;
        }
        if (!allOwnedTaskIds.has(c.taskId)) {
          report.taskComments.failed += 1;
          continue;
        }
        let fileId: string | null = c.fileId ?? null;
        let attachmentName: string | null = c.attachmentName ?? null;
        let attachmentSize: string | null = c.attachmentSize ?? null;
        if (c.attachmentDataUrl) {
          const decoded = decodeDataUrl(c.attachmentDataUrl);
          if (decoded) {
            const stored = await persistAttachment(
              ownerId,
              decoded.bytes,
              decoded.mimeType,
              c.attachmentName ?? undefined,
              c.taskId,
              c.id,
              currentTs,
            );
            if (stored) {
              try {
                await prisma.file.create({
                  data: {
                    id: stored.id,
                    ownerId,
                    taskId: c.taskId,
                    commentId: c.id,
                    originalName: stored.originalName,
                    storedName: stored.storedName,
                    storagePath: stored.storagePath,
                    mimeType: decoded.mimeType,
                    sizeBytes: stored.sizeBytes,
                    sha256: stored.sha256,
                    createdAt: currentTs,
                    deletedAt: null,
                  },
                });
                fileId = stored.id;
                attachmentName = stored.originalName;
                attachmentSize = String(stored.sizeBytes);
                report.files.uploaded += 1;
              } catch (err) {
                await removeFromStorage(stored.storagePath).catch(() => undefined);
                report.files.failed += 1;
              }
            } else {
              report.files.failed += 1;
            }
          } else {
            report.files.failed += 1;
          }
        }
        await prisma.taskComment.create({
          data: {
            id: c.id,
            ownerId,
            taskId: c.taskId,
            sender: c.sender ?? null,
            text: c.text,
            fileId,
            attachmentName,
            attachmentSize,
            attachmentPath: null,
            replyTo: c.replyTo ? (c.replyTo as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            createdAt: c.createdAt !== undefined ? BigInt(c.createdAt) : currentTs,
          },
        });
        report.taskComments.imported += 1;
      } catch {
        report.taskComments.failed += 1;
      }
    }

    // ── 7. Agents ────────────────────────────────────────────────────────
    for (const a of body.agents) {
      try {
        const existing = await prisma.agent.findFirst({
          where: { id: a.id, ownerId },
          select: { id: true },
        });
        if (existing) {
          report.agents.skipped += 1;
          continue;
        }
        await prisma.agent.create({
          data: {
            id: a.id,
            ownerId,
            name: a.name,
            avatarUrl: a.avatarUrl,
            systemPrompt: a.systemPrompt,
            isDefault: a.isDefault,
            scope: a.scope,
          },
        });
        report.agents.imported += 1;
      } catch {
        report.agents.failed += 1;
      }
    }

    // ── 8. Provider configs (apiKey is never imported) ───────────────────
    for (const p of body.providerConfigs) {
      try {
        const existing = await prisma.providerConfig.findFirst({
          where: { id: p.id, ownerId },
          select: { id: true },
        });
        if (existing) {
          report.providerConfigs.skipped += 1;
          continue;
        }
        // Always store an empty `apiKey`. The user re-enters the key in
        // Settings → Model Management after import. The legacy field is
        // accepted (so the JSON parses) but never written to the database.
        await prisma.providerConfig.create({
          data: {
            id: p.id,
            ownerId,
            name: p.name,
            provider: p.provider,
            apiKey: encrypt(''),
            selectedModel: p.selectedModel,
            isActive: p.isActive,
            baseUrl: p.baseUrl,
            customModels: p.customModels,
          },
        });
        report.providerConfigs.imported += 1;
      } catch {
        report.providerConfigs.failed += 1;
      }
    }

    // ── 9. Quick prompts ────────────────────────────────────────────────
    for (const q of body.quickPrompts) {
      try {
        const existing = await prisma.quickPrompt.findFirst({
          where: { id: q.id, ownerId },
          select: { id: true },
        });
        if (existing) {
          report.quickPrompts.skipped += 1;
          continue;
        }
        await prisma.quickPrompt.create({
          data: {
            id: q.id,
            ownerId,
            title: q.title,
            prompt: q.prompt,
            scope: q.scope,
            createdAt: q.createdAt !== undefined ? BigInt(q.createdAt) : currentTs,
          },
        });
        report.quickPrompts.imported += 1;
      } catch {
        report.quickPrompts.failed += 1;
      }
    }

    // ── 10. Settings (key/value) ────────────────────────────────────────
    for (const s of body.settings) {
      try {
        await prisma.setting.upsert({
          where: { ownerId_key: { ownerId, key: s.key } },
          create: { ownerId, key: s.key, valueJson: JSON.stringify(s.value ?? null) },
          update: { valueJson: JSON.stringify(s.value ?? null) },
        });
        report.settings.imported += 1;
      } catch {
        report.settings.failed += 1;
      }
    }

    // ── 11. Task AI change batches (depend on tasks) ────────────────────
    for (const b of body.taskAIChangeBatches) {
      try {
        const existing = await prisma.taskAIChangeBatch.findFirst({
          where: { id: b.id, ownerId },
          select: { id: true },
        });
        if (existing) {
          report.taskAIChangeBatches.skipped += 1;
          continue;
        }
        if (!allOwnedTaskIds.has(b.taskId)) {
          report.taskAIChangeBatches.failed += 1;
          continue;
        }
        await prisma.taskAIChangeBatch.create({
          data: {
            id: b.id,
            ownerId,
            taskId: b.taskId,
            summary: b.summary,
            operations: b.operations as unknown as Prisma.InputJsonValue,
            inverseOperations: b.inverseOperations as unknown as Prisma.InputJsonValue,
            createdAt: b.createdAt !== undefined ? BigInt(b.createdAt) : currentTs,
            expiresAt: b.expiresAt !== undefined ? BigInt(b.expiresAt) : currentTs + 7n * 24n * 60n * 60n * 1000n,
            undoneAt: b.undoneAt !== undefined && b.undoneAt !== null ? BigInt(b.undoneAt) : null,
            appliedByMessageId: b.appliedByMessageId ?? null,
          },
        });
        report.taskAIChangeBatches.imported += 1;
      } catch {
        report.taskAIChangeBatches.failed += 1;
      }
    }

    res.json({ report });
  }),
);
