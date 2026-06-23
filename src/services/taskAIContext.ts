import type { Task, TaskComment } from '../types';

export interface TaskAIContextPayload {
  task: Task;
  subtasks: Task[];
  comments: TaskComment[];
  baselineUpdatedAt: Record<string, number>;
  text: string;
}

function formatComment(comment: TaskComment): string {
  const timestamp = new Date(comment.createdAt).toISOString();
  const attachmentMeta = comment.attachmentDataUrl
    ? ' | attachment: [local file]'
    : '';
  return `- [${timestamp}] ${comment.text || '(no text)'}${attachmentMeta}`;
}

export function buildTaskAIContext(task: Task, subtasks: Task[], comments: TaskComment[]): TaskAIContextPayload {
  const baselineUpdatedAt: Record<string, number> = {
    [task.id]: task.updatedAt,
  };
  for (const subtask of subtasks) {
    baselineUpdatedAt[subtask.id] = subtask.updatedAt;
  }

  const lines: string[] = [
    'ACTIVE TASK',
    `id: ${task.id}`,
    `title: ${task.title}`,
    `status: ${task.status}`,
    `importance: ${task.importance}`,
    `date: ${task.date}`,
    `projectId: ${task.projectId ?? 'null'}`,
    `assignees: ${task.assignees.join(', ') || '(none)'}`,
    `updatedAt: ${task.updatedAt}`,
    '',
    'NOTES',
    task.content?.trim() ? task.content : '(empty)',
    '',
    'SUBTASKS',
  ];

  if (subtasks.length === 0) {
    lines.push('- (none)');
  } else {
    for (const subtask of subtasks) {
      lines.push(
        `- ${subtask.id} | ${subtask.title} | status=${subtask.status} | date=${subtask.date} | updatedAt=${subtask.updatedAt}`
      );
    }
  }

  lines.push('', 'COMMENTS');
  if (comments.length === 0) {
    lines.push('- (none)');
  } else {
    for (const comment of comments) {
      lines.push(formatComment(comment));
    }
  }

  return {
    task,
    subtasks,
    comments,
    baselineUpdatedAt,
    text: lines.join('\n'),
  };
}
