// AI store. Server-backed as of Agent 6 (Frontend AI Migration).
//
// The store mirrors the server's `Agent`, `ProviderConfig`, and `Setting`
// (search-config / system-instructions / active-* ids) tables for the
// currently authenticated user. Reads go through `aiRepository`; writes hit
// the corresponding REST endpoints and the local Zustand state is updated
// after a successful response.
//
// Provider API keys are AES-256-GCM encrypted at rest on the server. The
// public list endpoint returns `hasApiKey: boolean` instead of the raw
// value. The store treats `apiKey === ''` as "needs configuration" so the
// existing components and the model-management modal keep working without
// seeing the raw key.
//
// The previous Dexie / Tauri-keychain reads for `searchConfig` and
// `systemInstructions` are gone — those values now live in the
// `Setting` KV table behind `/api/settings/search-config` and
// `/api/settings/system-instructions`.

import { create } from 'zustand';
import type { Agent, AIProviderConfig, SearchConfig } from '../types';
import { ApiError } from '../services/apiClient';
import {
  aiRepository,
  toLegacyProviderConfig,
  type AgentPublic,
  type ProviderConfigPublic,
} from '../repositories/aiRepository';
import { settingsRepository } from '../repositories/settingsRepository';
import { useUIStore } from './uiStore';

const DEFAULT_WRITER_AGENT: Agent = {
  id: 'default_writer',
  name: 'Aaron the Script Writer',
  avatarUrl: '',
  systemPrompt:
    'You are Aaron, a skilled writing assistant. Help the user improve their writing, suggest edits, and provide creative ideas. When suggesting text changes, provide the revised text clearly so it can be applied directly.',
  isDefault: true,
  scope: 'writer',
};

const DEFAULT_TASK_AGENT: Agent = {
  id: 'default_task',
  name: 'Task Manager',
  avatarUrl: '',
  systemPrompt:
    'You are a task management assistant. Produce practical, actionable outputs for task planning, summaries, subtasks, dependencies, and execution tracking.',
  isDefault: true,
  scope: 'task',
};

function generateId(): string {
  return `cp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultSearchConfig(): SearchConfig {
  return {
    exaKey: '',
    tavilyKey: '',
    firecrawlKey: '',
    braveKey: '',
    enabled: false,
    searchProvider: 'tavily',
  };
}

function showError(err: unknown, fallback: string): void {
  const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : fallback;
  useUIStore.getState().showToast(msg, 'error');
}

function toAgent(publicAgent: AgentPublic): Agent {
  return {
    id: publicAgent.id,
    name: publicAgent.name,
    avatarUrl: publicAgent.avatarUrl,
    systemPrompt: publicAgent.systemPrompt,
    isDefault: publicAgent.isDefault,
    scope: publicAgent.scope === 'task' ? 'task' : 'writer',
  };
}

interface AIStore {
  agents: Agent[];
  activeAgentId: string;
  activeTaskAgentId: string;
  providerConfigs: AIProviderConfig[];
  activeProviderId: string | null;
  appManagementProviderId: string | null;
  isLoaded: boolean;
  hiddenModels: string[]; // "configId:modelSlug" strings

  loadAISettings: () => Promise<void>;
  saveAgent: (agent: Agent) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  setActiveAgent: (id: string, scope?: 'writer' | 'task') => void;
  getActiveAgent: (scope?: 'writer' | 'task') => Agent;
  getAgentsByScope: (scope: 'writer' | 'task') => Agent[];
  getActiveProvider: () => AIProviderConfig | null;
  getAppManagementProvider: () => AIProviderConfig | null;
  setAppManagementProvider: (id: string | null) => Promise<void>;

  saveCustomProvider: (config: AIProviderConfig) => Promise<void>;
  deleteCustomProvider: (id: string) => Promise<void>;
  setActiveProvider: (id: string) => void;
  setActiveModel: (configId: string, modelSlug: string) => void;
  addModelToProvider: (configId: string, modelSlug: string) => void;
  removeModelFromProvider: (configId: string, modelSlug: string) => void;
  toggleHiddenModel: (key: string) => void;
  isModelHidden: (configId: string, modelSlug: string) => boolean;

  searchConfig: SearchConfig;
  saveSearchConfig: (config: SearchConfig) => Promise<void>;
  systemInstructions: string;
  saveSystemInstructions: (text: string) => Promise<void>;
}

export const useAIStore = create<AIStore>((set, get) => ({
  agents: [DEFAULT_WRITER_AGENT, DEFAULT_TASK_AGENT],
  activeAgentId: DEFAULT_WRITER_AGENT.id,
  activeTaskAgentId: DEFAULT_TASK_AGENT.id,
  providerConfigs: [],
  activeProviderId: null,
  appManagementProviderId: null,
  isLoaded: false,
  hiddenModels: [],
  searchConfig: defaultSearchConfig(),
  systemInstructions: '',

  loadAISettings: async () => {
    try {
      // Parallel fetch: agents, provider-configs, settings, search-config,
      // system-instructions. Each is owner-scoped server-side.
      const [
        { agents: publicAgents },
        { providerConfigs: publicConfigs },
        settings,
        searchConfig,
        systemInstructions,
      ] = await Promise.all([
        aiRepository.listAgents(),
        aiRepository.listProviderConfigs(),
        settingsRepository.getMany([
          'activeAgentId',
          'activeTaskAgentId',
          'appManagementProviderId',
          'activeProviderId',
          'hiddenModels',
        ]),
        settingsRepository.getSearchConfig(),
        settingsRepository.getSystemInstructions(),
      ]);

      const agents = publicAgents.map(toAgent);
      const providerConfigs = publicConfigs.map(toLegacyProviderConfig);

      let hiddenModels: string[] = [];
      const hiddenRaw = settings['hiddenModels'];
      if (typeof hiddenRaw === 'string' && hiddenRaw.length > 0) {
        try {
          const parsed = JSON.parse(hiddenRaw);
          if (Array.isArray(parsed)) hiddenModels = parsed.filter((v): v is string => typeof v === 'string');
        } catch {
          hiddenModels = [];
        }
      }

      const activeWriterId =
        (settings['activeAgentId'] as string | undefined) ??
        agents.find((agent) => agent.scope === 'writer')?.id ??
        DEFAULT_WRITER_AGENT.id;
      const activeTaskId =
        (settings['activeTaskAgentId'] as string | undefined) ??
        agents.find((agent) => agent.scope === 'task')?.id ??
        DEFAULT_TASK_AGENT.id;
      const activeProviderId =
        (settings['activeProviderId'] as string | undefined) ??
        providerConfigs[0]?.id ??
        null;
      const appManagementProviderId =
        (settings['appManagementProviderId'] as string | null | undefined) ?? null;

      set({
        agents,
        providerConfigs,
        activeAgentId: activeWriterId,
        activeTaskAgentId: activeTaskId,
        activeProviderId,
        appManagementProviderId,
        isLoaded: true,
        hiddenModels,
        searchConfig,
        systemInstructions,
      });
    } catch (err) {
      set({ isLoaded: true });
      showError(err, 'Failed to load AI settings.');
    }
  },

  saveAgent: async (agent) => {
    const normalized: Agent = {
      ...agent,
      scope: agent.scope === 'task' ? 'task' : 'writer',
    };
    const existing = get().agents.find((candidate) => candidate.id === normalized.id);
    try {
      if (existing) {
        const { agent: saved } = await aiRepository.updateAgent(normalized.id, normalized);
        set((state) => ({
          agents: state.agents.map((candidate) => (candidate.id === normalized.id ? toAgent(saved) : candidate)),
        }));
      } else {
        const { agent: saved } = await aiRepository.createAgent(normalized);
        set((state) => ({ agents: [...state.agents, toAgent(saved)] }));
      }
    } catch (err) {
      showError(err, 'Failed to save agent.');
    }
  },

  deleteAgent: async (id) => {
    const target = get().agents.find((agent) => agent.id === id);
    if (!target || target.isDefault) return;
    try {
      await aiRepository.deleteAgent(id);
      set((state) => {
        const agents = state.agents.filter((agent) => agent.id !== id);
        const nextWriterId =
          state.activeAgentId === id
            ? agents.find((agent) => agent.scope === 'writer')?.id ?? DEFAULT_WRITER_AGENT.id
            : state.activeAgentId;
        const nextTaskId =
          state.activeTaskAgentId === id
            ? agents.find((agent) => agent.scope === 'task')?.id ?? DEFAULT_TASK_AGENT.id
            : state.activeTaskAgentId;
        return {
          agents,
          activeAgentId: nextWriterId,
          activeTaskAgentId: nextTaskId,
        };
      });
    } catch (err) {
      showError(err, 'Failed to delete agent.');
    }
  },

  setActiveAgent: (id, scope = 'writer') => {
    if (scope === 'task') {
      set({ activeTaskAgentId: id });
      void settingsRepository.put('activeTaskAgentId', id).catch(() => undefined);
      return;
    }
    set({ activeAgentId: id });
    void settingsRepository.put('activeAgentId', id).catch(() => undefined);
  },

  getActiveAgent: (scope = 'writer') => {
    const { agents, activeAgentId, activeTaskAgentId } = get();
    const targetId = scope === 'task' ? activeTaskAgentId : activeAgentId;
    const fallback = scope === 'task' ? DEFAULT_TASK_AGENT : DEFAULT_WRITER_AGENT;
    return agents.find((agent) => agent.id === targetId && agent.scope === scope) ?? fallback;
  },

  getAgentsByScope: (scope) => get().agents.filter((agent) => agent.scope === scope),

  saveCustomProvider: async (config) => {
    const id = config.id || generateId();
    const normalized: AIProviderConfig = { ...config, id, provider: 'custom' };
    try {
      // PATCH or POST depending on whether the config already exists.
      const existing = get().providerConfigs.find((candidate) => candidate.id === id);
      if (existing) {
        // Send the apiKey only when the user actually provided one; sending
        // an empty string would clobber the stored (encrypted) value with
        // an empty value.
        const updates: Parameters<typeof aiRepository.updateProviderConfig>[1] = {
          name: normalized.name,
          provider: normalized.provider,
          selectedModel: normalized.selectedModel,
          isActive: normalized.isActive,
          baseUrl: normalized.baseUrl,
          customModels: normalized.customModels,
        };
        if (normalized.apiKey && normalized.apiKey.length > 0) updates.apiKey = normalized.apiKey;
        const { providerConfig: saved } = await aiRepository.updateProviderConfig(id, updates);
        set((state) => ({
          providerConfigs: state.providerConfigs.map((candidate) =>
            candidate.id === id ? mergePublicConfig(candidate, saved) : candidate,
          ),
          activeProviderId: state.activeProviderId ?? id,
        }));
      } else {
        const { providerConfig: saved } = await aiRepository.createProviderConfig({
          id,
          name: normalized.name,
          provider: 'custom',
          apiKey: normalized.apiKey,
          selectedModel: normalized.selectedModel,
          isActive: normalized.isActive,
          baseUrl: normalized.baseUrl,
          customModels: normalized.customModels,
        });
        set((state) => {
          const exists = state.providerConfigs.some((candidate) => candidate.id === id);
          const providerConfigs = exists
            ? state.providerConfigs.map((candidate) => (candidate.id === id ? mergePublicConfig(candidate, saved) : candidate))
            : [...state.providerConfigs, mergePublicConfig(normalized, saved)];
          return {
            providerConfigs,
            activeProviderId: state.activeProviderId ?? id,
          };
        });
      }
    } catch (err) {
      showError(err, 'Failed to save provider config.');
    }
  },

  deleteCustomProvider: async (id) => {
    try {
      await aiRepository.deleteProviderConfig(id);
      set((state) => {
        const providerConfigs = state.providerConfigs.filter((candidate) => candidate.id !== id);
        return {
          providerConfigs,
          activeProviderId:
            state.activeProviderId === id
              ? providerConfigs[0]?.id ?? null
              : state.activeProviderId,
        };
      });
    } catch (err) {
      showError(err, 'Failed to delete provider config.');
    }
  },

  setActiveProvider: (id) => {
    set({ activeProviderId: id });
    void settingsRepository.put('activeProviderId', id).catch(() => undefined);
  },

  getActiveProvider: () => {
    const { providerConfigs, activeProviderId } = get();
    return providerConfigs.find((config) => config.id === activeProviderId) ?? null;
  },

  getAppManagementProvider: () => {
    const { providerConfigs, appManagementProviderId } = get();
    if (appManagementProviderId) {
      const config = providerConfigs.find((candidate) => candidate.id === appManagementProviderId);
      if (config) return config;
    }
    return get().getActiveProvider();
  },

  setAppManagementProvider: async (id) => {
    set({ appManagementProviderId: id });
    try {
      await settingsRepository.put('appManagementProviderId', id ?? '');
    } catch (err) {
      showError(err, 'Failed to save app management provider.');
    }
  },

  setActiveModel: (configId, modelSlug) => {
    const providerConfigs = get().providerConfigs.map((config) =>
      config.id === configId ? { ...config, selectedModel: modelSlug } : config
    );
    set({ providerConfigs });
    void aiRepository
      .updateProviderConfig(configId, { selectedModel: modelSlug })
      .catch(() => undefined);
  },

  addModelToProvider: (configId, modelSlug) => {
    const slug = modelSlug.trim();
    if (!slug) return;
    const current = get().providerConfigs.find((config) => config.id === configId);
    if (!current) return;
    if (current.customModels.includes(slug)) return;
    const next = [...current.customModels, slug];
    set((state) => ({
      providerConfigs: state.providerConfigs.map((config) =>
        config.id === configId ? { ...config, customModels: next } : config
      ),
    }));
    void aiRepository.updateProviderConfig(configId, { customModels: next }).catch(() => undefined);
  },

  removeModelFromProvider: (configId, modelSlug) => {
    const current = get().providerConfigs.find((config) => config.id === configId);
    if (!current) return;
    const customModels = current.customModels.filter((model) => model !== modelSlug);
    const selectedModel =
      current.selectedModel === modelSlug ? (customModels[0] ?? '') : current.selectedModel;
    set((state) => ({
      providerConfigs: state.providerConfigs.map((config) =>
        config.id === configId ? { ...config, customModels, selectedModel } : config
      ),
    }));
    void aiRepository
      .updateProviderConfig(configId, { customModels, selectedModel })
      .catch(() => undefined);
  },

  toggleHiddenModel: (key) => {
    const current = get().hiddenModels;
    const hiddenModels = current.includes(key)
      ? current.filter((candidate) => candidate !== key)
      : [...current, key];
    set({ hiddenModels });
    void settingsRepository.put('hiddenModels', JSON.stringify(hiddenModels)).catch(() => undefined);
  },

  isModelHidden: (configId, modelSlug) => get().hiddenModels.includes(`${configId}:${modelSlug}`),

  saveSearchConfig: async (config) => {
    set({ searchConfig: config });
    try {
      const saved = await settingsRepository.putSearchConfig(config);
      set({ searchConfig: saved });
    } catch (err) {
      showError(err, 'Failed to save search config.');
    }
  },

  saveSystemInstructions: async (text) => {
    set({ systemInstructions: text });
    try {
      const saved = await settingsRepository.putSystemInstructions(text);
      set({ systemInstructions: saved });
    } catch (err) {
      showError(err, 'Failed to save system instructions.');
    }
  },
}));

/** Merge a public provider config into the legacy `AIProviderConfig` shape.
 *  Keeps the locally-cached `apiKey` when the public response doesn't carry
 *  a new one (the server never returns the raw key). */
function mergePublicConfig(
  existing: AIProviderConfig,
  publicConfig: ProviderConfigPublic,
): AIProviderConfig {
  return {
    ...existing,
    id: publicConfig.id,
    name: publicConfig.name,
    provider: publicConfig.provider,
    selectedModel: publicConfig.selectedModel,
    isActive: publicConfig.isActive,
    baseUrl: publicConfig.baseUrl,
    customModels: publicConfig.customModels,
  };
}
