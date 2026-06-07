// Server-side task AI planner.
//
// Mirrors the previous frontend `planTaskAIDraft` (src/services/taskAIPlanner.ts).
// The plan demands "Browser must not call provider APIs directly", so the
// JSON-parsing + validation step moves here. The frontend now only sends the
// `messages[]` and the active task context; the server returns either a
// `TaskAIDraft` or a scope-confirmation shape.
//
// The implementation preserves the previous behaviour exactly:
//   * "broad scope" requests (e.g. "all tasks", "backlog") short-circuit to a
//     scope-confirmation draft with no operations.
//   * The system prompt is the caller-provided system prompt plus a fixed
//     safety footer that restricts the model to soft_delete (never permanent
//     delete).
//   * The JSON parser strips ```json fences and falls back to finding the
//     outermost `{...}` block.
//   * Operations are normalised and validated; validation errors short-circuit
//     the apply path on the client.

import type { ChatMessage } from './aiTypes.js';
import { collectStream, getStreamerFor, resolveProviderConfig } from './aiProviders.js';
import type { PrismaClient } from '@prisma/client';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BROAD_SCOPE_HINTS = ['all tasks', 'backlog', 'project plan', 'roadmap', 'sprint', 'everything'];

function shortId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type TaskImportance = 'low' | 'medium' | 'high';

export type TaskAIOperation =
  | {
      id: string;
      type: 'create_task';
      title: string;
      parentId?: string;
      status?: TaskStatus;
      importance?: TaskImportance;
      date?: string;
      projectId?: string | null;
      content?: string;
      assignees?: string[];
    }
  | {
      id: string;
      type: 'update_task';
      taskId: string;
      updates: Partial<{
        title: string;
        status: TaskStatus;
        importance: TaskImportance;
        date: string;
        projectId: string | null;
        content: string;
        assignees: string[];
      }>;
    }
  | {
      id: string;
      type: 'soft_delete_task';
      taskId: string;
      reason?: string;
    }
  | {
      id: string;
      type: 'restore_task';
      taskId: string;
    }
  | {
      id: string;
      type: 'add_comment';
      taskId: string;
      text: string;
    }
  | {
      id: string;
      type: 'delete_comment';
      commentId: string;
      taskId: string;
    };

export interface TaskAIDraftValidation {
  errors: string[];
  warnings: string[];
  duplicateSubtasks: string[];
  staleTaskIds: string[];
}

export interface TaskAIDraft {
  id: string;
  taskId: string;
  scope: 'active_task';
  assistantMessage: string;
  summary: string;
  operations: TaskAIOperation[];
  createdAt: number;
  baselineUpdatedAt: Record<string, number>;
  needsScopeConfirmation?: string;
  validation: TaskAIDraftValidation;
}

export interface TaskAIContextPayload {
  task: {
    id: string;
    title: string;
    status: string;
    importance: string;
    date: string;
    projectId: string | null;
    assignees: string[];
    content: string;
    updatedAt: number;
  };
  subtasks: Array<{
    id: string;
    title: string;
    status: string;
    date: string;
    updatedAt: number;
  }>;
  comments: Array<{
    id: string;
    text: string;
    createdAt: number;
    attachmentName?: string | null;
    attachmentSize?: string | null;
  }>;
  baselineUpdatedAt: Record<string, number>;
  text: string;
}

export interface PlannerInput {
  userText: string;
  context: TaskAIContextPayload;
  providerId: string;
  systemPrompt: string;
  validProjectIds: Set<string>;
  searchResultsText?: string;
  signal?: AbortSignal;
}

function hasBroadScopeIntent(text: string): boolean {
  const lowered = text.toLowerCase();
  return BROAD_SCOPE_HINTS.some((hint) => lowered.includes(hint));
}

function extractJson(raw: string): string | null {
  const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) return cleaned;
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return cleaned.slice(start, end + 1);
}

function normalizeOperation(op: any): TaskAIOperation | null {
  const id = typeof op?.id === 'string' ? op.id : shortId('op');
  if (op?.type === 'create_task' && typeof op?.title === 'string') {
    const status = op.status as TaskStatus | undefined;
    const importance = op.importance as TaskImportance | undefined;
    return {
      id,
      type: 'create_task',
      title: op.title.trim(),
      parentId: typeof op.parentId === 'string' ? op.parentId : undefined,
      status,
      importance,
      date: typeof op.date === 'string' ? op.date : undefined,
      projectId:
        op.projectId === null || typeof op.projectId === 'string' ? op.projectId : undefined,
      content: typeof op.content === 'string' ? op.content : undefined,
      assignees: Array.isArray(op.assignees)
        ? op.assignees.filter((value: unknown): value is string => typeof value === 'string')
        : undefined,
    };
  }
  if (op?.type === 'update_task' && typeof op?.taskId === 'string' && op?.updates) {
    return {
      id,
      type: 'update_task',
      taskId: op.taskId,
      updates: op.updates,
    };
  }
  if (op?.type === 'soft_delete_task' && typeof op?.taskId === 'string') {
    return {
      id,
      type: 'soft_delete_task',
      taskId: op.taskId,
      reason: typeof op.reason === 'string' ? op.reason : undefined,
    };
  }
  if (op?.type === 'restore_task' && typeof op?.taskId === 'string') {
    return {
      id,
      type: 'restore_task',
      taskId: op.taskId,
    };
  }
  if (op?.type === 'add_comment' && typeof op?.taskId === 'string' && typeof op?.text === 'string') {
    return {
      id,
      type: 'add_comment',
      taskId: op.taskId,
      text: op.text.trim(),
    };
  }
  if (op?.type === 'delete_comment' && typeof op?.commentId === 'string' && typeof op?.taskId === 'string') {
    return {
      id,
      type: 'delete_comment',
      commentId: op.commentId,
      taskId: op.taskId,
    };
  }
  return null;
}

function validateOperations(
  context: TaskAIContextPayload,
  operations: TaskAIOperation[],
  validProjectIds: Set<string>,
): TaskAIDraftValidation {
  const knownTaskIds = new Set([
    context.task.id,
    ...context.subtasks.map((subtask) => subtask.id),
  ]);
  const existingSubtaskTitles = new Set(
    context.subtasks.map((subtask) => subtask.title.trim().toLowerCase()),
  );
  const errors: string[] = [];
  const warnings: string[] = [];
  const duplicateSubtasks: string[] = [];

  for (const operation of operations) {
    if (operation.type === 'create_task') {
      if (!operation.title.trim()) {
        errors.push('Create task operation is missing a title.');
      }
      if (operation.date && !ISO_DATE_RE.test(operation.date)) {
        errors.push(`Create task operation "${operation.title}" has invalid date format.`);
      }
      if (
        typeof operation.projectId === 'string' &&
        operation.projectId.trim() &&
        !validProjectIds.has(operation.projectId)
      ) {
        errors.push(`Create task operation "${operation.title}" uses an unknown project.`);
      }
      if (operation.parentId === context.task.id) {
        const normalized = operation.title.trim().toLowerCase();
        if (existingSubtaskTitles.has(normalized)) {
          duplicateSubtasks.push(operation.title.trim());
        }
      }
      continue;
    }
    if (operation.type === 'update_task') {
      if (!knownTaskIds.has(operation.taskId)) {
        errors.push(`Update operation references unknown task id "${operation.taskId}".`);
        continue;
      }
      if (typeof operation.updates.date === 'string' && !ISO_DATE_RE.test(operation.updates.date)) {
        errors.push(`Update operation for "${operation.taskId}" has invalid date format.`);
      }
      if (
        typeof operation.updates.projectId === 'string' &&
        operation.updates.projectId.trim() &&
        !validProjectIds.has(operation.updates.projectId)
      ) {
        errors.push(`Update operation for "${operation.taskId}" uses an unknown project.`);
      }
      continue;
    }
    if (operation.type === 'soft_delete_task' || operation.type === 'restore_task') {
      if (!knownTaskIds.has(operation.taskId)) {
        errors.push(`${operation.type === 'soft_delete_task' ? 'Soft delete' : 'Restore'} operation references unknown task id "${operation.taskId}".`);
      }
      continue;
    }
    if (operation.type === 'add_comment') {
      if (!knownTaskIds.has(operation.taskId)) {
        errors.push(`Add comment operation references unknown task id "${operation.taskId}".`);
      }
      if (!operation.text.trim()) {
        errors.push('Add comment operation cannot be empty.');
      }
    }
  }

  if (duplicateSubtasks.length > 0) {
    warnings.push('Potential duplicate subtasks were detected in the draft.');
  }

  return { errors, warnings, duplicateSubtasks, staleTaskIds: [] };
}

function scopeConfirmationDraft(context: TaskAIContextPayload, userText: string): TaskAIDraft {
  return {
    id: shortId('draft'),
    taskId: context.task.id,
    scope: 'active_task',
    assistantMessage:
      'This request sounds broader than the active task. Reply with "include visible tasks" or "include all tasks" if you want a broader planning pass.',
    summary: 'Scope confirmation required',
    operations: [],
    createdAt: Date.now(),
    baselineUpdatedAt: context.baselineUpdatedAt,
    needsScopeConfirmation:
      'This request appears to require broader context than the active task. Confirm broader scope to continue.',
    validation: { errors: [], warnings: [], duplicateSubtasks: [], staleTaskIds: [] },
  };
}

function fallbackDraft(
  context: TaskAIContextPayload,
  raw: string,
  errorMessage: string,
): TaskAIDraft {
  return {
    id: shortId('draft'),
    taskId: context.task.id,
    scope: 'active_task',
    assistantMessage: raw.trim() || 'I could not produce a structured draft. Please rephrase the request.',
    summary: 'No structured draft generated',
    operations: [],
    createdAt: Date.now(),
    baselineUpdatedAt: context.baselineUpdatedAt,
    validation: { errors: [errorMessage], warnings: [], duplicateSubtasks: [], staleTaskIds: [] },
  };
}

export async function planTaskAIDraft(
  prisma: PrismaClient,
  input: PlannerInput,
): Promise<{ draft: TaskAIDraft; provider: { id: string; name: string; model: string } }> {
  const { userText, context, systemPrompt, validProjectIds, searchResultsText, signal } = input;

  if (hasBroadScopeIntent(userText)) {
    return {
      draft: scopeConfirmationDraft(context, userText),
      provider: { id: input.providerId, name: '', model: '' },
    };
  }

  const providerRow = await prisma.providerConfig.findUnique({
    where: { id: input.providerId },
  });
  if (!providerRow || !providerRow.isActive) {
    throw new Error('Selected AI provider is not available.');
  }
  const provider = resolveProviderConfig({
    id: providerRow.id,
    name: providerRow.name,
    provider: providerRow.provider,
    apiKey: providerRow.apiKey,
    selectedModel: providerRow.selectedModel,
    isActive: providerRow.isActive,
    baseUrl: providerRow.baseUrl,
    customModels: providerRow.customModels,
  });
  if (!provider.apiKey) {
    throw new Error('Selected AI provider has no API key configured.');
  }

  const schemaDescription = `Return ONLY JSON object with this shape:
{
  "assistantMessage": "string",
  "summary": "short summary",
  "operations": [
    { "type": "create_task", "title": "string", "parentId": "optional task id", "status": "pending|in_progress|completed", "importance": "low|medium|high", "date": "YYYY-MM-DD", "projectId": "string|null", "content": "optional notes", "assignees": ["name"] },
    { "type": "update_task", "taskId": "string", "updates": { "title": "string", "status": "pending|in_progress|completed", "importance": "low|medium|high", "date": "YYYY-MM-DD", "projectId": "string|null", "content": "string", "assignees": ["name"] } },
    { "type": "soft_delete_task", "taskId": "string", "reason": "optional" },
    { "type": "add_comment", "taskId": "string", "text": "string" }
  ]
}
Do not include markdown.`;

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `${systemPrompt}

You are in task mode with ACTIVE TASK context only. Propose safe operations.
Never propose permanent delete. Use soft_delete_task only when explicitly requested.
If uncertain, keep operations empty and explain in assistantMessage.
${schemaDescription}`,
    },
    {
      role: 'user',
      content: `User request:
${userText}

Task context:
${context.text}
${searchResultsText ? `\n\nWeb search context:\n${searchResultsText}` : ''}`,
    },
  ];

  // Use the same chat-completion helper as the stream endpoint. The model
  // returns a single string we can JSON-parse.
  const stream = getStreamerFor(provider.provider)(provider, messages, { signal });
  const raw = await collectStream(stream);

  const parsedJson = extractJson(raw);
  if (!parsedJson) {
    return {
      draft: fallbackDraft(context, raw, 'The model did not return valid JSON.'),
      provider: { id: provider.id, name: provider.name, model: provider.selectedModel },
    };
  }

  try {
    const parsed = JSON.parse(parsedJson);
    const operations = Array.isArray(parsed.operations)
      ? parsed.operations
          .map((op: unknown) => normalizeOperation(op))
          .filter((op: TaskAIOperation | null): op is TaskAIOperation => Boolean(op))
      : [];
    const validation = validateOperations(context, operations, validProjectIds);
    return {
      draft: {
        id: shortId('draft'),
        taskId: context.task.id,
        scope: 'active_task',
        assistantMessage:
          typeof parsed.assistantMessage === 'string'
            ? parsed.assistantMessage
            : 'Draft generated. Review the proposed operations below.',
        summary: typeof parsed.summary === 'string' ? parsed.summary : 'Task AI draft',
        operations,
        createdAt: Date.now(),
        baselineUpdatedAt: context.baselineUpdatedAt,
        validation,
      },
      provider: { id: provider.id, name: provider.name, model: provider.selectedModel },
    };
  } catch {
    return {
      draft: fallbackDraft(context, raw, 'Failed to parse the model JSON output.'),
      provider: { id: provider.id, name: provider.name, model: provider.selectedModel },
    };
  }
}
