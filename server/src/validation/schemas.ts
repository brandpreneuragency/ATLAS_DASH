// Shared Zod validation schemas for project, task, and task-comment routes.
// These are the single source of truth for client-provided fields. Server
// always overrides `ownerId`, `createdAt`, `updatedAt`, and `order` from
// `req.user.id` and `Date.now()` — those fields are not part of the input
// shapes defined here.

import { z } from 'zod';

// ── Common helpers ─────────────────────────────────────────────────────────

const idSchema = z
  .string()
  .min(1, 'id is required')
  .max(64, 'id must be 64 characters or fewer');

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'date must be ISO format YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'date is not a valid calendar date' });

const taskStatusSchema = z.enum(['pending', 'in_progress', 'completed']);
const taskImportanceSchema = z.enum(['low', 'medium', 'high']);

// ── Project ────────────────────────────────────────────────────────────────

export const projectCreateSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(80),
  // Color is a free-form string — the client picks a Tailwind class name.
  // We just bound its length so the DB column can't be abused.
  color: z.string().min(1).max(80),
});

export const projectUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    color: z.string().min(1).max(80).optional(),
  })
  .refine((v) => v.name !== undefined || v.color !== undefined, {
    message: 'At least one field must be provided',
  });

// ── Task ───────────────────────────────────────────────────────────────────

export const taskCreateSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1).max(200),
  content: z.string().max(200_000).default(''),
  status: taskStatusSchema.default('pending'),
  importance: taskImportanceSchema.default('medium'),
  date: isoDateSchema.default(''),
  projectId: z.string().max(64).nullable().default(null),
  assignees: z.array(z.string().max(80)).max(50).default([]),
  sourcePath: z.string().max(2000).nullable().optional(),
  parentId: z.string().max(64).nullable().optional(),
  sourceChatMessageId: z.string().max(64).nullable().optional(),
});

export const taskUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    content: z.string().max(200_000).optional(),
    status: taskStatusSchema.optional(),
    importance: taskImportanceSchema.optional(),
    date: isoDateSchema.optional(),
    projectId: z.string().max(64).nullable().optional(),
    assignees: z.array(z.string().max(80)).max(50).optional(),
    sourcePath: z.string().max(2000).nullable().optional(),
    parentId: z.string().max(64).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });

// ── Task comment ───────────────────────────────────────────────────────────

const replyToSchema = z.object({
  id: z.string().min(1).max(64),
  text: z.string().max(2000).default(''),
  sender: z.string().max(80).default(''),
});

export { replyToSchema };

export const commentCreateSchema = z.object({
  id: idSchema,
  text: z.string().max(20_000).default(''),
  // Sender is a display name; the UI falls back to "You" when missing.
  sender: z.string().max(80).nullable().optional(),
  // fileId is accepted but ignored on the JSON path. The File service
  // (Agent 3) creates File rows through the multipart variant of this
  // endpoint and sets `fileId` server-side.
  fileId: z.string().max(64).nullable().optional(),
  replyTo: replyToSchema.nullable().optional(),
  // Legacy attachment fields are accepted (and ignored) so the existing
  // client can keep building requests with the same shape during migration.
  attachmentName: z.string().max(200).nullable().optional(),
  attachmentSize: z.string().max(40).nullable().optional(),
  attachmentPath: z.string().max(2000).nullable().optional(),
});

// ── Task comment (multipart) ───────────────────────────────────────────────
//
// When the client posts `multipart/form-data`, every non-file field arrives
// as a string (or array of strings). We parse `replyTo` separately as JSON
// in the route handler before running it through `commentCreateSchema`. This
// schema is exported for documentation only — the route does the conversion
// inline so error messages stay close to the call site.

export const commentMultipartTextFieldsSchema = z.object({
  id: idSchema,
  text: z.string().max(20_000).default(''),
  sender: z.string().max(80).optional(),
  // replyTo, when present in multipart, is the JSON-encoded form of
  // { id, text, sender }. The route parses it before this schema runs.
  replyTo: z.string().max(4000).optional(),
});

export const commentUpdateSchema = z
  .object({
    text: z.string().max(20_000).optional(),
  })
  .refine((v) => v.text !== undefined, { message: 'text is required' });

// ── Query params ───────────────────────────────────────────────────────────

export const includeDeletedQuerySchema = z
  .union([z.literal('true'), z.literal('false'), z.undefined()])
  .transform((v) => v === 'true');

// ── AI config (agents, provider configs, settings, search) ─────────────────

export const agentScopeSchema = z.enum(['writer', 'task']);

export const agentCreateSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(120),
  avatarUrl: z.string().max(2000).default(''),
  systemPrompt: z.string().max(20_000).default(''),
  isDefault: z.boolean().default(false),
  scope: agentScopeSchema,
});

export const agentUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    avatarUrl: z.string().max(2000).optional(),
    systemPrompt: z.string().max(20_000).optional(),
    isDefault: z.boolean().optional(),
    scope: agentScopeSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });

export const providerConfigCreateSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(120),
  provider: z.string().min(1).max(40).default('custom'),
  apiKey: z.string().max(2000).default(''),
  selectedModel: z.string().max(200).default(''),
  isActive: z.boolean().default(true),
  baseUrl: z.string().max(2000).default(''),
  customModels: z.array(z.string().min(1).max(200)).max(200).default([]),
});

export const providerConfigUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    provider: z.string().min(1).max(40).optional(),
    apiKey: z.string().max(2000).optional(),
    selectedModel: z.string().max(200).optional(),
    isActive: z.boolean().optional(),
    baseUrl: z.string().max(2000).optional(),
    customModels: z.array(z.string().min(1).max(200)).max(200).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });

// Settings rows store arbitrary JSON. The key is bounded so we don't allow
// arbitrary keys (the user-visible setting keys are a closed set).
export const settingKeySchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/u, 'setting key must be alphanumeric / dash / underscore');

// Express query params arrive as strings. The client sends `?keys=a,b,c` for
// bulk settings reads; allow either a single comma-separated string or a
// (string|undefined) and normalise to a string[].
export const settingsKeysSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    const list = Array.isArray(value) ? value : value.split(',');
    return list
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  });

export const settingPutSchema = z.object({
  key: settingKeySchema,
  // `unknown` is what we want — the value is a JSON-serialisable primitive.
  value: z.unknown(),
});

export const searchProviderSchema = z.enum(['tavily', 'firecrawl', 'brave', 'exa']);

export const searchConfigSchema = z.object({
  exaKey: z.string().max(2000).default(''),
  tavilyKey: z.string().max(2000).default(''),
  firecrawlKey: z.string().max(2000).default(''),
  braveKey: z.string().max(2000).default(''),
  enabled: z.boolean().default(false),
  searchProvider: searchProviderSchema.default('tavily'),
});

// ── AI chat (stream) ────────────────────────────────────────────────────────

const aiMessageContentPartSchema = z.union([
  z.object({ type: z.literal('text'), text: z.string().max(20_000) }),
  z.object({
    type: z.literal('image_url'),
    image_url: z.object({ url: z.string().max(2_000_000) }),
  }),
]);

export const aiMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.union([z.string().max(20_000), z.array(aiMessageContentPartSchema).max(20)]),
});

export const aiStreamRequestSchema = z.object({
  providerId: idSchema,
  messages: z.array(aiMessageSchema).min(1).max(200),
  // systemPrompt is the caller-supplied system context (the agent prompt +
  // the user's system instructions). The server appends its own safety
  // footer for the task-draft path; the plain stream endpoint does not.
  systemPrompt: z.string().max(40_000).default(''),
});

// ── Task AI draft / apply / undo ────────────────────────────────────────────

export const taskAIDraftRequestSchema = z.object({
  providerId: idSchema,
  systemPrompt: z.string().max(40_000).default(''),
  userText: z.string().min(1).max(20_000),
  context: z.object({
    task: z.object({
      id: idSchema,
      title: z.string().max(200),
      status: z.string().max(40),
      importance: z.string().max(40),
      date: z.string().max(40),
      projectId: z.string().max(64).nullable(),
      assignees: z.array(z.string().max(80)).max(50),
      content: z.string().max(200_000),
      updatedAt: z.number().int().nonnegative(),
    }),
    subtasks: z
      .array(
        z.object({
          id: idSchema,
          title: z.string().max(200),
          status: z.string().max(40),
          date: z.string().max(40),
          updatedAt: z.number().int().nonnegative(),
        }),
      )
      .max(500),
    comments: z
      .array(
        z.object({
          id: idSchema,
          text: z.string().max(20_000),
          createdAt: z.number().int().nonnegative(),
          attachmentName: z.string().max(200).nullable().optional(),
          attachmentSize: z.string().max(40).nullable().optional(),
        }),
      )
      .max(2000),
    baselineUpdatedAt: z.record(z.string(), z.number().int().nonnegative()),
    text: z.string().max(40_000),
  }),
  validProjectIds: z.array(idSchema).max(2000).default([]),
  searchResultsText: z.string().max(40_000).optional(),
});

// `messageId` is the chat message the draft was attached to. The apply path
// records this on the change batch as `appliedByMessageId` for audit / undo
// purposes.
export const taskAIApplyRequestSchema = z.object({
  messageId: idSchema.optional(),
  baselineUpdatedAt: z.record(z.string(), z.number().int().nonnegative()).default({}),
  summary: z.string().trim().min(1).max(500),
  operations: z.array(z.unknown()).min(1).max(200),
});

// ── Local Dexie import (Agent 7) ────────────────────────────────────────────
//
// The Dexie store holds a row per table, with client-generated primary keys
// (mostly nanoid(8) strings). The import endpoint accepts a single payload
// shaped like a Dexie export and idempotently upserts every row under the
// current user's `ownerId`.
//
// We bound each table's row count and each text field so a malicious or
// malformed payload can't OOM the server. The handler is itself resilient:
// it never aborts the whole import when a single row fails — it counts
// `imported / skipped / failed` per table and returns a structured report.

const rowIdSchema = z.string().min(1).max(64);

// Data-URL helper. The Dexie `attachmentDataUrl` field is a base64-encoded
// string in the form `data:<mime>;base64,<bytes>`. We extract the mime and
// the bytes; the bytes are decoded by the handler. Length is bounded so the
// JSON body can't carry gigabytes of data through the validator.
export const dataUrlSchema = z
  .string()
  .max(80_000_000) // ~60 MB base64; well under the 200 MB JSON body cap
  .regex(/^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,[a-zA-Z0-9+/=]+$/u, 'invalid data URL')
  .refine((s) => s.length > 23, { message: 'data URL payload is too small' });

const importProjectSchema = z.object({
  id: rowIdSchema,
  name: z.string().trim().min(1).max(80),
  color: z.string().min(1).max(80),
  createdAt: z.number().int().nonnegative().optional(),
});

const importTaskSchema = z.object({
  id: rowIdSchema,
  title: z.string().trim().min(1).max(200),
  content: z.string().max(200_000).default(''),
  status: z.enum(['pending', 'in_progress', 'completed']).default('pending'),
  importance: z.enum(['low', 'medium', 'high']).default('medium'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, 'date must be ISO YYYY-MM-DD')
    .default(''),
  projectId: z.string().max(64).nullable().optional(),
  assignees: z.array(z.string().max(80)).max(50).default([]),
  createdAt: z.number().int().nonnegative().optional(),
  updatedAt: z.number().int().nonnegative().optional(),
  sourcePath: z.string().max(2000).nullable().optional(),
  order: z.number().int().nonnegative().optional(),
  parentId: z.string().max(64).nullable().optional(),
  sourceChatMessageId: z.string().max(64).nullable().optional(),
  deletedAt: z.number().int().nonnegative().nullable().optional(),
});

const importTaskCommentSchema = z.object({
  id: rowIdSchema,
  taskId: rowIdSchema,
  sender: z.string().max(80).nullable().optional(),
  text: z.string().max(20_000).default(''),
  // Legacy field — server extracts the bytes, uploads them through the file
  // service, and stores the resulting `fileId` instead.
  attachmentDataUrl: dataUrlSchema.optional(),
  attachmentName: z.string().max(200).nullable().optional(),
  attachmentSize: z.string().max(40).nullable().optional(),
  // Server-side import path: a pre-uploaded file id (e.g. from a prior
  // partial import run) is accepted as-is.
  fileId: z.string().max(64).nullable().optional(),
  replyTo: z
    .object({
      id: z.string().min(1).max(64),
      text: z.string().max(2000).default(''),
      sender: z.string().max(80).default(''),
    })
    .nullable()
    .optional(),
  createdAt: z.number().int().nonnegative().optional(),
});

const importDocumentSchema = z.object({
  id: rowIdSchema,
  title: z.string().trim().max(200).default('Untitled'),
  content: z.string().max(2_000_000).default(''),
  createdAt: z.number().int().nonnegative().optional(),
  updatedAt: z.number().int().nonnegative().optional(),
  order: z.number().int().nonnegative().optional(),
  sourcePath: z.string().max(2000).nullable().optional(),
  isDirty: z.boolean().optional(),
  splitEditorOpen: z.boolean().optional(),
});

const importChatThreadSchema = z.object({
  id: rowIdSchema,
  mode: z.enum(['writer', 'task']),
  title: z.string().trim().max(200).default('New Chat'),
  createdAt: z.number().int().nonnegative().optional(),
  updatedAt: z.number().int().nonnegative().optional(),
});

// Import-only legacy attachment shape: Dexie chat messages used
// `Attachment = { name, dataUrl, mimeType }`. The server converts each
// `dataUrl` into a real file upload and substitutes `{ fileId, name, size,
// mimeType }` before persisting.
const legacyAttachmentSchema = z.object({
  name: z.string().min(1).max(200),
  dataUrl: dataUrlSchema,
  mimeType: z.string().min(1).max(200).optional(),
});

const importChatMessageSchema = z.object({
  id: rowIdSchema,
  threadId: rowIdSchema,
  mode: z.enum(['writer', 'task']),
  documentId: z.string().max(64).nullable().optional(),
  taskId: z.string().max(64).nullable().optional(),
  agentId: z.string().min(1).max(64),
  role: z.enum(['user', 'assistant']),
  content: z.string().max(200_000).default(''),
  selectedText: z.string().max(40_000).nullable().optional(),
  selectionFrom: z.number().int().nonnegative().nullable().optional(),
  selectionTo: z.number().int().nonnegative().nullable().optional(),
  suggestedText: z.string().max(200_000).nullable().optional(),
  replyTo: z
    .object({
      id: z.string().min(1).max(64),
      role: z.enum(['user', 'assistant']),
      content: z.string().max(20_000).default(''),
      sender: z.string().max(80).default(''),
    })
    .nullable()
    .optional(),
  // Either modern (`{fileId,name,size,mimeType}`) or legacy
  // (`{name,dataUrl,mimeType}`) attachments are accepted.
  attachments: z
    .array(z.union([
      z.object({
        fileId: z.string().min(1).max(64),
        name: z.string().min(1).max(200),
        size: z.union([z.string().max(40), z.number().int().nonnegative()]).optional(),
        mimeType: z.string().min(1).max(200).optional(),
      }),
      legacyAttachmentSchema,
    ]))
    .max(20)
    .optional(),
  taskDraft: z.unknown().optional(),
  taskDraftStatus: z.enum(['draft', 'applied', 'rejected', 'invalid']).optional(),
  timestamp: z.number().int().nonnegative().optional(),
});

const importAgentSchema = z.object({
  id: rowIdSchema,
  name: z.string().trim().min(1).max(120),
  avatarUrl: z.string().max(2000).default(''),
  systemPrompt: z.string().max(20_000).default(''),
  isDefault: z.boolean().default(false),
  scope: z.enum(['writer', 'task']),
});

const importProviderConfigSchema = z.object({
  id: rowIdSchema,
  name: z.string().trim().min(1).max(120),
  provider: z.string().min(1).max(40).default('custom'),
  // The legacy local-Dexie shape stored the raw key in the row. In v1 the
  // server only stores an encrypted copy; the user re-enters the key after
  // import. We accept the field so the JSON parses but we never persist it
  // to the database — see `routes/import.ts`.
  apiKey: z.string().max(2000).default(''),
  selectedModel: z.string().max(200).default(''),
  isActive: z.boolean().default(true),
  baseUrl: z.string().max(2000).default(''),
  customModels: z.array(z.string().min(1).max(200)).max(200).default([]),
});

const importQuickPromptSchema = z.object({
  id: rowIdSchema,
  title: z.string().trim().min(1).max(120),
  prompt: z.string().max(20_000).default(''),
  scope: z.enum(['writer', 'task']),
  createdAt: z.number().int().nonnegative().optional(),
});

const importSettingSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-zA-Z0-9_-]+$/u, 'setting key must be alphanumeric / dash / underscore'),
  value: z.unknown(),
});

const importTaskAIChangeBatchSchema = z.object({
  id: rowIdSchema,
  taskId: rowIdSchema,
  summary: z.string().min(1).max(500),
  operations: z.array(z.unknown()).max(200),
  inverseOperations: z.array(z.unknown()).max(200),
  createdAt: z.number().int().nonnegative().optional(),
  expiresAt: z.number().int().nonnegative().optional(),
  undoneAt: z.number().int().nonnegative().nullable().optional(),
  appliedByMessageId: z.string().max(64).nullable().optional(),
});

export const importPayloadSchema = z.object({
  projects: z.array(importProjectSchema).max(2_000).default([]),
  tasks: z.array(importTaskSchema).max(10_000).default([]),
  taskComments: z.array(importTaskCommentSchema).max(50_000).default([]),
  documents: z.array(importDocumentSchema).max(5_000).default([]),
  chatThreads: z.array(importChatThreadSchema).max(2_000).default([]),
  chatMessages: z.array(importChatMessageSchema).max(50_000).default([]),
  agents: z.array(importAgentSchema).max(500).default([]),
  providerConfigs: z.array(importProviderConfigSchema).max(100).default([]),
  quickPrompts: z.array(importQuickPromptSchema).max(500).default([]),
  settings: z.array(importSettingSchema).max(500).default([]),
  taskAIChangeBatches: z.array(importTaskAIChangeBatchSchema).max(500).default([]),
});

/** Inferred TypeScript type for the full import payload. */
export type ImportPayload = z.infer<typeof importPayloadSchema>;

