export interface Document {
  id: string;
  title: string;
  content: string; // TipTap JSON serialized
  createdAt: number;
  updatedAt: number;
  order: number;
  sourcePath?: string;
  isDirty?: boolean;
  splitEditorOpen?: boolean;
}

export interface Attachment {
  name: string;
  dataUrl: string;
  mimeType: string;
}

export interface ChatThreadMeta {
  id: string;
  mode: 'writer' | 'task';
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  mode: 'writer' | 'task';
  documentId?: string;
  taskId?: string;
  agentId: string;
  role: 'user' | 'assistant';
  content: string;
  selectedText?: string;
  selectionFrom?: number;
  selectionTo?: number;
  suggestedText?: string;
  replyTo?: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sender: string;
  };
  attachments?: Attachment[];
  taskDraft?: TaskAIDraft;
  taskDraftStatus?: 'draft' | 'applied' | 'rejected' | 'invalid';
  timestamp: number;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type TaskImportance = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  content: string; // TipTap JSON serialized
  status: TaskStatus;
  importance: TaskImportance;
  date: string; // ISO date, e.g. "2026-04-28"
  projectId: string | null;
  assignees: string[];
  createdAt: number;
  updatedAt: number;
  sourcePath?: string;
  order: number;
  parentId?: string;              // references parent task id
  sourceChatMessageId?: string;   // optional audit trail
  deletedAt?: number;             // soft-delete timestamp
}

export interface TaskCommentFile {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface TaskComment {
  id: string;
  taskId: string;
  sender?: string;         // display name of the commenter (e.g., "You"). UI falls back to "You".
  text: string;
  /**
   * Server-set reference to the uploaded file. Always `null` when the
   * comment was created without an attachment. The server never stores
   * `attachmentDataUrl` — files are streamed through
   * `/api/files/:fileId/content`.
   */
  fileId?: string | null;
  /** Populated by the comment repository after a successful upload. */
  file?: TaskCommentFile | null;
  /** Display-only fields. Populated by the store from `file` for components
   *  that haven't been migrated to read `comment.file` directly. */
  attachmentName?: string;
  attachmentSize?: string;
  /** @deprecated Always undefined in the web build. The server does not
   *  store a `dataUrl` for attachments. Use `comment.file.id` and
   *  `/api/files/:fileId/content` instead. Kept in the type for backward
   *  compatibility with the legacy local-Dexie import path. */
  attachmentDataUrl?: string;
  /** @deprecated Always undefined in the web build. Files are streamed
   *  through the backend; the local filesystem path is never exposed. */
  attachmentPath?: string;
  replyTo?: {
    id: string;
    text: string;
    sender: string;
  };
  createdAt: number;
}

export interface Agent {
  id: string;
  name: string;
  avatarUrl: string;
  systemPrompt: string;
  isDefault: boolean;
  scope: 'writer' | 'task';
}

export type AIProviderType = string;

export interface AIProviderConfig {
  id: string;
  name: string;
  provider: string;
  apiKey: string;
  selectedModel: string;
  isActive: boolean;
  baseUrl: string;
  customModels: string[];
}

export interface AppSettings {
  key: string;
  value: string | number | boolean;
}

export interface QuickPrompt {
  id: string;
  title: string;
  prompt: string;
  scope: 'writer' | 'task';
  createdAt: number;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface ChatPayload {
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
  config: AIProviderConfig;
}

export interface FileViewerItem {
  name: string;
  dataUrl?: string;
  path?: string;
  mimeType?: string;
  size?: string;
  source: 'task-comment' | 'filesystem' | 'chat-attachment';
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export type SearchProvider = 'tavily' | 'firecrawl' | 'brave' | 'exa';

export interface SearchConfig {
  exaKey: string;
  tavilyKey: string;
  firecrawlKey: string;
  braveKey: string;
  enabled: boolean;
  searchProvider: SearchProvider;
}

export type TaskAIContextScope = 'active_task';

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
      updates: Partial<Pick<Task, 'title' | 'status' | 'importance' | 'date' | 'projectId' | 'content' | 'assignees'>>;
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
  scope: TaskAIContextScope;
  assistantMessage: string;
  summary: string;
  operations: TaskAIOperation[];
  createdAt: number;
  baselineUpdatedAt: Record<string, number>;
  needsScopeConfirmation?: string;
  validation: TaskAIDraftValidation;
}

export interface TaskAIChangeBatch {
  id: string;
  taskId: string;
  summary: string;
  operations: TaskAIOperation[];
  inverseOperations: TaskAIOperation[];
  createdAt: number;
  expiresAt: number;
  undoneAt?: number;
  appliedByMessageId?: string;
}
