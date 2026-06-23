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
  colorIndex?: number; // 0-5 for rainbow colors
}

export interface Attachment {
  name: string;
  dataUrl: string;
  mimeType: string;
}

export interface ChatThreadMeta {
  id: string;
  mode: 'writer' | 'task';
  documentId?: string;
  taskId?: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface MessageUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
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
  usage?: MessageUsage;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type TaskImportance = 'low' | 'medium' | 'high';

/** Maximum character count allowed for task titles. */
export const TASK_TITLE_MAX_LENGTH = 80;

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

export interface TaskComment {
  id: string;
  taskId: string;
  sender?: string;         // display name of the commenter (e.g., "You"). UI falls back to "You".
  text: string;
  /**
   * For local-first: data URL of attached file (if any).
   * For server: this field is unused; files are handled via fileId/File.
   */
  attachmentDataUrl?: string;
  attachmentName?: string;
  attachmentMimeType?: string;
  attachmentSizeBytes?: number;
  attachmentPreviewDataUrl?: string;
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

export type ProviderStatus = 'connected' | 'not_connected' | 'needs_setup';

export interface ModelCapability {
  vision: boolean;
  toolCalling: boolean;
  contextLength: string;
  speed: 'Slow' | 'Medium' | 'Fast' | 'Unknown';
  cost: 'Free' | 'Limited' | 'Paid' | 'External' | 'Unknown';
  reasoning: 'Low' | 'Medium' | 'High' | 'Unknown';
  endpointType: 'Native' | 'OpenRouter' | 'Custom' | 'Unknown';
  lastSynced?: string;
}

export interface ModelItem {
  id: string;
  name: string;
  enabled: boolean;
  description?: string;
  capabilities: ModelCapability;
  custom?: boolean;
}

export interface AIProviderConfig {
  id: string;
  name: string;
  provider: string;
  apiKey: string;
  selectedModel: string;
  isActive: boolean;
  baseUrl: string;
  customModels: string[];
  status?: ProviderStatus;
  models?: ModelItem[];
  lastImportedAt?: number;
}

/** Connection-form draft kept per provider inside the model management modal. */
export interface ProviderConnectionDraft {
  baseUrl: string;
  apiKey: string;
}

/** Per-drawer import state surfaced to the UI. */
export type ProviderImportPhase =
  | 'idle'
  | 'importing'
  | 'error'
  | 'success';

export interface ProviderImportUiState {
  phase: ProviderImportPhase;
  message?: string;
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
