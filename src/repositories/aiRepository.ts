// AI repository. The only module (other than `apiClient`) that knows the
// shape and URLs of the AI / agent / provider-config / task-AI endpoints.
//
// Stores call these methods. React components call stores. Components do
// not import this file.
//
// Endpoints (see plan.md § "AI API" and the corresponding server files):
//
//   GET    /api/agents
//   POST   /api/agents
//   PATCH  /api/agents/:id
//   DELETE /api/agents/:id
//
//   GET    /api/provider-configs
//   POST   /api/provider-configs
//   PATCH  /api/provider-configs/:id
//   DELETE /api/provider-configs/:id
//
//   GET    /api/settings              (bulk fetch by key list)
//   PUT    /api/settings              (single key/value)
//   GET    /api/settings/search-config
//   PUT    /api/settings/search-config
//   GET    /api/settings/system-instructions
//   PUT    /api/settings/system-instructions
//
//   POST   /api/ai/stream              (SSE)
//   POST   /api/ai/task-draft          (returns a TaskAIDraft)
//   POST   /api/ai/search              (returns WebSearchResult[])
//
//   POST   /api/task-ai/drafts/:messageId/apply
//   POST   /api/task-ai/batches/:batchId/undo
//   GET    /api/tasks/:taskId/ai-history
//
// The browser never calls provider APIs directly. Provider API keys are
// stored encrypted at rest on the server; the public shape only carries
// `hasApiKey: boolean`. The server-side streaming endpoint decrypts the key
// in-process, calls the provider, and pipes chunks back as SSE.

import type {
  Agent,
  AIProviderConfig,
  SearchConfig,
  TaskAIDraft,
  TaskAIOperation,
  TaskAIChangeBatch,
} from '../types';
import { apiClient, type StreamEvent } from '../services/apiClient';

// ── Public types matching the server's `public*` shape ────────────────────

export interface AgentPublic extends Agent {
  scope: 'writer' | 'task';
}

export interface ProviderConfigPublic {
  id: string;
  name: string;
  provider: string;
  selectedModel: string;
  isActive: boolean;
  baseUrl: string;
  customModels: string[];
  /** True when the user has stored a non-empty apiKey. The raw value is
   *  never returned to the client. */
  hasApiKey: boolean;
}

/** Wire shape for provider-config create/update. `apiKey` is optional on
 *  PATCH (omit to keep the existing key); it is required on POST but may
 *  be an empty string. The server encrypts it at rest. */
export interface ProviderConfigInput {
  id: string;
  name: string;
  provider?: string;
  apiKey?: string;
  selectedModel?: string;
  isActive?: boolean;
  baseUrl?: string;
  customModels?: string[];
}

/** PATCH body for provider-config. Every field is optional. */
export type ProviderConfigUpdateInput = Partial<Omit<ProviderConfigInput, 'id'>>;

// ── Agents ────────────────────────────────────────────────────────────────

export const aiRepository = {
  // ── Agents ──────────────────────────────────────────────────────────────

  listAgents(signal?: AbortSignal): Promise<{ agents: AgentPublic[] }> {
    return apiClient.get<{ agents: AgentPublic[] }>('/agents', { signal });
  },

  createAgent(input: Agent): Promise<{ agent: AgentPublic }> {
    return apiClient.post<{ agent: AgentPublic }>('/agents', input);
  },

  updateAgent(id: string, updates: Partial<Omit<Agent, 'id'>>): Promise<{ agent: AgentPublic }> {
    return apiClient.patch<{ agent: AgentPublic }>(`/agents/${encodeURIComponent(id)}`, updates);
  },

  deleteAgent(id: string): Promise<{ ok: true }> {
    return apiClient.delete<{ ok: true }>(`/agents/${encodeURIComponent(id)}`);
  },

  // ── Provider configs ───────────────────────────────────────────────────

  listProviderConfigs(signal?: AbortSignal): Promise<{ providerConfigs: ProviderConfigPublic[] }> {
    return apiClient.get<{ providerConfigs: ProviderConfigPublic[] }>('/provider-configs', { signal });
  },

  createProviderConfig(input: ProviderConfigInput): Promise<{ providerConfig: ProviderConfigPublic }> {
    return apiClient.post<{ providerConfig: ProviderConfigPublic }>('/provider-configs', input);
  },

  updateProviderConfig(
    id: string,
    updates: ProviderConfigUpdateInput,
  ): Promise<{ providerConfig: ProviderConfigPublic }> {
    return apiClient.patch<{ providerConfig: ProviderConfigPublic }>(
      `/provider-configs/${encodeURIComponent(id)}`,
      updates,
    );
  },

  deleteProviderConfig(id: string): Promise<{ ok: true }> {
    return apiClient.delete<{ ok: true }>(`/provider-configs/${encodeURIComponent(id)}`);
  },

  // ── Settings (search-config / system-instructions / generic) ───────────

  getSearchConfig(signal?: AbortSignal): Promise<{ searchConfig: SearchConfig }> {
    return apiClient.get<{ searchConfig: SearchConfig }>('/settings/search-config', { signal });
  },

  putSearchConfig(config: SearchConfig): Promise<{ searchConfig: SearchConfig }> {
    return apiClient.put<{ searchConfig: SearchConfig }>('/settings/search-config', config);
  },

  getSystemInstructions(signal?: AbortSignal): Promise<{ systemInstructions: string }> {
    return apiClient.get<{ systemInstructions: string }>('/settings/system-instructions', { signal });
  },

  putSystemInstructions(text: string): Promise<{ systemInstructions: string }> {
    return apiClient.put<{ systemInstructions: string }>('/settings/system-instructions', {
      systemInstructions: text,
    });
  },

  /**
   * Generic key-value settings get/put. Used by the store for
   * `activeAgentId`, `activeTaskAgentId`, `activeProviderId`,
   * `appManagementProviderId`, and `hiddenModels`.
   */
  getSettings(keys: string[]): Promise<{ settings: Record<string, unknown> }> {
    return apiClient.get<{ settings: Record<string, unknown> }>('/settings', { query: { keys } });
  },

  putSetting(key: string, value: unknown): Promise<{ ok: true }> {
    return apiClient.put<{ ok: true }>('/settings', { key, value });
  },

  // ── AI chat stream ─────────────────────────────────────────────────────

  /**
   * Open a streaming chat completion. The server emits SSE chunks
   * (`data: { "chunk": "..." }`) and a final `data: { "done": true }`.
   * The returned `events` is an async iterable of typed `StreamEvent`s
   * (chunk | done | error). The `cancel` function aborts the in-flight
   * request so bytes stop streaming.
   */
  streamChat(
    input: StreamChatInput,
    options: { signal?: AbortSignal } = {},
  ): { events: AsyncGenerator<StreamEvent>; cancel: () => void } {
    return apiClient.stream('/ai/stream', input, options);
  },

  // ── Task AI draft / apply / undo / history ─────────────────────────────

  planTaskDraft(input: TaskDraftInput): Promise<{ draft: TaskAIDraft; provider: string }> {
    return apiClient.post<{ draft: TaskAIDraft; provider: string }>('/ai/task-draft', input);
  },

  applyTaskDraft(
    messageId: string,
    input: ApplyTaskDraftInput,
  ): Promise<{ batch: TaskAIChangeBatch }> {
    return apiClient.post<{ batch: TaskAIChangeBatch }>(
      `/task-ai/drafts/${encodeURIComponent(messageId)}/apply`,
      input,
    );
  },

  undoTaskBatch(batchId: string): Promise<{ batchId: string; undoneAt: number }> {
    return apiClient.post<{ batchId: string; undoneAt: number }>(
      `/task-ai/batches/${encodeURIComponent(batchId)}/undo`,
    );
  },

  getTaskAiHistory(taskId: string, signal?: AbortSignal): Promise<{ history: TaskAIChangeBatch[] }> {
    return apiClient.get<{ history: TaskAIChangeBatch[] }>(
      `/tasks/${encodeURIComponent(taskId)}/ai-history`,
      { signal },
    );
  },

  // ── Web search ────────────────────────────────────────────────────────

  /**
   * Run a web search through the server, which uses the user's stored
   * `searchConfig` setting. The browser never sees the upstream API
   * keys. The wire shape matches the legacy `services/search.ts`.
   */
  searchWeb(
    query: string,
    maxResults = 5,
    signal?: AbortSignal,
  ): Promise<{ results: WebSearchResultPublic[] }> {
    return apiClient.post<{ results: WebSearchResultPublic[] }>(
      '/ai/search',
      { query, maxResults },
      { signal },
    );
  },
};

export interface WebSearchResultPublic {
  title: string;
  url: string;
  snippet: string;
  score?: number;
}

// ── Stream input shape ───────────────────────────────────────────────────

export interface StreamChatInput {
  providerId: string;
  /** Plain system context (the agent prompt + the user's system
   *  instructions). The server prepends this to the messages list. */
  systemPrompt: string;
  messages: StreamMessage[];
}

export type StreamMessageContent = string | StreamContentPart[];

export interface StreamMessage {
  role: 'user' | 'assistant' | 'system';
  content: StreamMessageContent;
}

export type StreamContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

// ── Task draft input shape ───────────────────────────────────────────────

export interface TaskDraftInput {
  providerId: string;
  systemPrompt: string;
  userText: string;
  context: TaskDraftContext;
  validProjectIds: string[];
  searchResultsText?: string;
}

export interface TaskDraftContext {
  task: TaskDraftTaskContext;
  subtasks: TaskDraftSubtaskContext[];
  comments: TaskDraftCommentContext[];
  baselineUpdatedAt: Record<string, number>;
  text: string;
}

export interface TaskDraftTaskContext {
  id: string;
  title: string;
  status: string;
  importance: string;
  date: string;
  projectId: string | null;
  assignees: string[];
  content: string;
  updatedAt: number;
}

export interface TaskDraftSubtaskContext {
  id: string;
  title: string;
  status: string;
  date: string;
  updatedAt: number;
}

export interface TaskDraftCommentContext {
  id: string;
  text: string;
  createdAt: number;
  attachmentName?: string | null;
  attachmentSize?: string | null;
}

export interface ApplyTaskDraftInput {
  messageId?: string;
  baselineUpdatedAt: Record<string, number>;
  summary: string;
  operations: TaskAIOperation[];
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Convert a public provider config into the legacy `AIProviderConfig` shape
 *  the store and components consume. `apiKey` is empty (the server never
 *  exposes it); the store treats `apiKey === ''` as "needs configuration". */
export function toLegacyProviderConfig(p: ProviderConfigPublic): AIProviderConfig {
  return {
    id: p.id,
    name: p.name,
    provider: p.provider,
    apiKey: '',
    selectedModel: p.selectedModel,
    isActive: p.isActive,
    baseUrl: p.baseUrl,
    customModels: p.customModels,
  };
}
