// AI store. Local-first using Dexie and Tauri secure storage (Tauri desktop).
// Agent and provider config data stored in IndexedDB.
// API keys stored securely in Tauri keychain via secureStorage.ts.

import { create } from 'zustand';
import type { Agent, AIProviderConfig, ModelItem, ProviderStatus, SearchConfig, SearchProvider } from '../types';
import { db } from '../services/db';
import { secureStorage } from '../services/secureStorage';
import {
  importProviderModels as fetchProviderModels,
  normalizeProviderBaseUrl,
  ProviderImportError,
} from '../services/ai/importProviderModels';
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
  const msg = err instanceof Error ? err.message : fallback;
  useUIStore.getState().showToast(msg, 'error');
}

// ---------------------------------------------------------------------------
// Provider helpers
// ---------------------------------------------------------------------------

function modelKey(configId: string, modelId: string): string {
  return `${configId}:${modelId}`;
}

function providerApiKeyName(providerId: string): string {
  return `providerApiKey_${providerId}`;
}

let providerIdCounter = 0;
function generateProviderId(): string {
  providerIdCounter += 1;
  return `provider-${Date.now()}-${providerIdCounter}`;
}

function deriveProviderStatus(input: {
  hasBaseUrl: boolean;
  hasKey: boolean;
  modelCount: number;
  selectedModel?: string;
  lastError?: string;
  currentStatus?: ProviderStatus;
}): ProviderStatus {
  if (input.lastError) return 'connection_failed';
  if (!input.hasBaseUrl) return 'needs_setup';
  if (!input.hasKey) return 'needs_key';
  if (input.modelCount <= 0) return 'sync_needed';
  if (!input.selectedModel) return 'sync_needed';
  return 'connected';
}

function refreshStatus(
  hasKey: boolean,
  hasBaseUrl: boolean,
  modelCount: number,
  selectedModel: string,
  currentStatus?: ProviderStatus,
): ProviderStatus {
  if (currentStatus === 'connection_failed') return 'connection_failed';
  return deriveProviderStatus({
    hasBaseUrl,
    hasKey,
    modelCount,
    selectedModel,
    currentStatus,
  });
}

async function hasSecureKey(providerId: string): Promise<boolean> {
  try {
    const value = await secureStorage.secureGet(providerApiKeyName(providerId));
    return Boolean(value && value.length > 0);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface AIStore {
  agents: Agent[];
  activeAgentId: string;
  activeTaskAgentId: string;
  providerConfigs: AIProviderConfig[];
  activeProviderId: string | null;
  appManagementProviderId: string | null;
  isLoaded: boolean;
  hiddenModels: string[]; // "configId:modelId" strings

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
  addProvider: (name: string, baseUrl: string, apiKey: string) => Promise<AIProviderConfig | null>;
  setActiveProvider: (id: string) => void;
  setActiveModel: (configId: string, modelSlug: string) => void;
  addModelToProvider: (configId: string, modelSlug: string) => void;
  removeModelFromProvider: (configId: string, modelSlug: string) => void;
  toggleHiddenModel: (key: string) => void;
  setHiddenModels: (keys: string[]) => void;
  isModelHidden: (configId: string, modelSlug: string) => boolean;

  refreshProviderStatus: (id: string) => Promise<void>;
  refreshAllProviderStatuses: () => Promise<void>;
  saveProviderApiKey: (id: string, key: string) => Promise<void>;
  deleteProviderApiKey: (id: string) => Promise<void>;
  setProviderStatus: (id: string, status: ProviderStatus) => void;
  saveProviderConfig: (
    config: Partial<AIProviderConfig> & { id: string },
    options?: { refreshStatus?: boolean },
  ) => Promise<void>;
  connectProvider: (id: string, baseUrl: string, apiKey: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  importProviderModels: (id: string, baseUrl: string, apiKey: string) => Promise<{ ok: true } | { ok: false; error: string; code: string }>;
  getEnabledModels: (providerId: string) => ModelItem[];
  getAllEnabledModels: () => { provider: AIProviderConfig; model: ModelItem }[];

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
      // Load agents from Dexie
      const agentsFromDb = await db.agents.toArray();
      const agents = agentsFromDb.length > 0
        ? agentsFromDb
        : [DEFAULT_WRITER_AGENT, DEFAULT_TASK_AGENT];

      // Load provider configs from Dexie
      const providerConfigsFromDb = await db.providerConfigs.toArray();

      // Load settings from Dexie
      const settingsRows = await db.settings.toArray();
      const settings: Record<string, string | number | boolean> = {};
      settingsRows.forEach(row => {
        settings[row.key] = row.value;
      });

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

      // Build default provider registry and merge saved state
      // Load user-added providers directly from the database. No built-in
      // providers are pre-populated — users add their own via the
      // "Connect Provider" button in the model management UI.
      // Filter out any previously-persisted built-in provider entries so
      // they don't reappear after the migration to user-added providers.
      const LEGACY_BUILTIN_IDS = new Set([
        'openai',
        'gemini',
        'openrouter',
        'nvidia',
        'mistral',
        'groq',
        'custom-endpoint',
        'opencode-go',
      ]);
      const providerConfigs: AIProviderConfig[] = providerConfigsFromDb.filter(
        (p) => !LEGACY_BUILTIN_IDS.has(p.id)
      );

      // Delete legacy entries from the database so they don't come back
      for (const legacy of providerConfigsFromDb) {
        if (LEGACY_BUILTIN_IDS.has(legacy.id)) {
          await db.providerConfigs.delete(legacy.id).catch(() => undefined);
          await secureStorage.secureDelete(providerApiKeyName(legacy.id)).catch(() => undefined);
        }
      }

      // Refresh connection status from secure storage
      await Promise.all(
        providerConfigs.map(async (config) => {
          const hasKey = config.apiKey
            ? Boolean(config.apiKey)
            : await hasSecureKey(config.id);
          const modelCount = (config.models ?? []).filter(
            (m) => !hiddenModels.includes(`${config.id}:${m.id}`),
          ).length;
          config.status = refreshStatus(
            hasKey,
            Boolean(config.baseUrl),
            modelCount,
            config.selectedModel,
            config.status,
          );
        })
      );

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
        providerConfigs.find((p) => p.status === 'connected')?.id ??
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
        searchConfig: {
          exaKey: String(settings['exaKey'] ?? ''),
          tavilyKey: String(settings['tavilyKey'] ?? ''),
          firecrawlKey: String(settings['firecrawlKey'] ?? ''),
          braveKey: String(settings['braveKey'] ?? ''),
          enabled: Boolean(settings['enabled'] ?? false),
          searchProvider: (settings['searchProvider'] as SearchProvider) ?? 'tavily',
        },
        systemInstructions: String(settings['systemInstructions'] ?? ''),
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
    try {
      await db.agents.put(normalized);
      set((state) => {
        const agents = state.agents.map((candidate) =>
          candidate.id === normalized.id ? normalized : candidate
        );
        return { agents };
      });
    } catch (err) {
      showError(err, 'Failed to save agent.');
    }
  },

  deleteAgent: async (id) => {
    const target = get().agents.find((agent) => agent.id === id);
    if (!target || target.isDefault) return;
    try {
      await db.agents.delete(id);
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
      void secureStorage.secureSet('activeTaskAgentId', id).catch(() => undefined);
      return;
    }
    set({ activeAgentId: id });
    void secureStorage.secureSet('activeAgentId', id).catch(() => undefined);
  },

  getActiveAgent: (scope = 'writer') => {
    const { agents, activeAgentId, activeTaskAgentId } = get();
    const targetId = scope === 'task' ? activeTaskAgentId : activeAgentId;
    const fallback = scope === 'task' ? DEFAULT_TASK_AGENT : DEFAULT_WRITER_AGENT;
    return agents.find((agent) => agent.id === targetId && agent.scope === scope) ?? fallback;
  },

  getAgentsByScope: (scope) => get().agents.filter((agent) => agent.scope === scope),

  saveCustomProvider: async (config) => {
    const id = config.id || generateProviderId();
    const normalized: AIProviderConfig = { ...config, id, provider: 'custom' };
    try {
      await db.providerConfigs.put(normalized);

      if (normalized.apiKey && normalized.apiKey.length > 0) {
        await secureStorage.secureSet(providerApiKeyName(id), normalized.apiKey);
      }

      set((state) => {
        const providerConfigs = state.providerConfigs.map((candidate) =>
          candidate.id === id ? normalized : candidate
        );
        return {
          providerConfigs,
          activeProviderId: state.activeProviderId ?? id,
        };
      });
    } catch (err) {
      showError(err, 'Failed to save provider config.');
    }
  },

  deleteCustomProvider: async (id) => {
    try {
      await db.providerConfigs.delete(id);
      await secureStorage.secureDelete(providerApiKeyName(id)).catch(() => undefined);

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
      showError(err, 'Failed to delete provider.');
    }
  },

  addProvider: async (name, baseUrl, apiKey) => {
    const trimmedName = name.trim();
    const trimmedBaseUrl = normalizeProviderBaseUrl(baseUrl);
    const trimmedKey = apiKey.trim();
    if (!trimmedName || !trimmedBaseUrl) {
      showError(new Error('Name and Base URL are required.'), 'Failed to add provider.');
      return null;
    }
    const id = generateProviderId();
    const newConfig: AIProviderConfig = {
      id,
      name: trimmedName,
      provider: 'custom',
      apiKey: '',
      selectedModel: '',
      isActive: true,
      baseUrl: trimmedBaseUrl,
      customModels: [],
      status: deriveProviderStatus({
        hasBaseUrl: Boolean(trimmedBaseUrl),
        hasKey: Boolean(trimmedKey),
        modelCount: 0,
      }),
      models: [],
    };
    try {
      await db.providerConfigs.put(newConfig);
      if (trimmedKey) {
        await secureStorage.secureSet(providerApiKeyName(id), trimmedKey);
      }
      set((state) => ({
        providerConfigs: [...state.providerConfigs, newConfig],
        activeProviderId: state.activeProviderId ?? id,
      }));
      return newConfig;
    } catch (err) {
      showError(err, 'Failed to add provider.');
      return null;
    }
  },

  setActiveProvider: (id) => {
    set({ activeProviderId: id });
    void secureStorage.secureSet('activeProviderId', id).catch(() => undefined);
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
      await secureStorage.secureSet('appManagementProviderId', id ?? '');
    } catch (err) {
      showError(err, 'Failed to save app management provider.');
    }
  },

  setActiveModel: (configId, modelSlug) => {
    const providerConfigs = get().providerConfigs.map((config) =>
      config.id === configId ? { ...config, selectedModel: modelSlug } : config
    );
    set({ providerConfigs });
    void db.providerConfigs.update(configId, { selectedModel: modelSlug }).catch(() => undefined);
  },

  addModelToProvider: (configId, modelSlug) => {
    const slug = modelSlug.trim();
    if (!slug) return;
    const current = get().providerConfigs.find((config) => config.id === configId);
    if (!current) return;
    if (current.customModels.includes(slug)) return;
    const next = [...current.customModels, slug];
    const newModel: ModelItem = {
      id: slug,
      name: slug,
      enabled: true,
      custom: true,
      capabilities: {
        vision: false,
        toolCalling: true,
        contextLength: 'Unknown',
        speed: 'Medium',
        cost: 'External',
        reasoning: 'Unknown',
        endpointType: current.provider === 'custom' ? 'Custom' : 'Native',
        lastSynced: 'Unknown',
      },
    };
    const models = [...(current.models ?? []), newModel];
    set((state) => ({
      providerConfigs: state.providerConfigs.map((config) =>
        config.id === configId ? { ...config, customModels: next, models } : config
      ),
    }));
    void db.providerConfigs.update(configId, { customModels: next, models }).catch(() => undefined);
  },

  removeModelFromProvider: (configId, modelSlug) => {
    const current = get().providerConfigs.find((config) => config.id === configId);
    if (!current) return;
    const customModels = current.customModels.filter((model) => model !== modelSlug);
    const models = (current.models ?? []).filter((m) => m.id !== modelSlug);
    const selectedModel =
      current.selectedModel === modelSlug ? (models[0]?.id ?? '') : current.selectedModel;
    set((state) => ({
      providerConfigs: state.providerConfigs.map((config) =>
        config.id === configId ? { ...config, customModels, models, selectedModel } : config
      ),
    }));
    void db.providerConfigs.update(configId, { customModels, models, selectedModel }).catch(() => undefined);
  },

  toggleHiddenModel: (key) => {
    const current = get().hiddenModels;
    const hiddenModels = current.includes(key)
      ? current.filter((candidate) => candidate !== key)
      : [...current, key];
    set({ hiddenModels });
    void secureStorage.secureSet('hiddenModels', JSON.stringify(hiddenModels)).catch(() => undefined);
  },

  setHiddenModels: (keys) => {
    const hiddenModels = Array.from(new Set(keys));
    set({ hiddenModels });
    void secureStorage.secureSet('hiddenModels', JSON.stringify(hiddenModels)).catch(() => undefined);
  },

  isModelHidden: (configId, modelSlug) => get().hiddenModels.includes(modelKey(configId, modelSlug)),

  refreshProviderStatus: async (id) => {
    const config = get().providerConfigs.find((p) => p.id === id);
    if (!config) return;

    const hasKey = await hasSecureKey(id);
    const modelCount = (config.models ?? []).filter(
      (m) => !get().isModelHidden(id, m.id),
    ).length;
    const nextStatus = refreshStatus(
      hasKey,
      Boolean(config.baseUrl),
      modelCount,
      config.selectedModel,
      config.status,
    );

    set((state) => ({
      providerConfigs: state.providerConfigs.map((p) =>
        p.id === id ? { ...p, status: nextStatus } : p
      ),
    }));
  },

  refreshAllProviderStatuses: async () => {
    const { providerConfigs, hiddenModels } = get();
    const updates = await Promise.all(
      providerConfigs.map(async (config) => {
        const hasKey = await hasSecureKey(config.id);
        const modelCount = (config.models ?? []).filter(
          (m) => !hiddenModels.includes(`${config.id}:${m.id}`),
        ).length;
        return {
          id: config.id,
          status: refreshStatus(
            hasKey,
            Boolean(config.baseUrl),
            modelCount,
            config.selectedModel,
            config.status,
          ),
        };
      })
    );

    set((state) => ({
      providerConfigs: state.providerConfigs.map((p) => {
        const update = updates.find((u) => u.id === p.id);
        return update ? { ...p, status: update.status } : p;
      }),
    }));
  },

  saveProviderApiKey: async (id, key) => {
    try {
      if (key.trim().length > 0) {
        await secureStorage.secureSet(providerApiKeyName(id), key.trim());
      } else {
        await secureStorage.secureDelete(providerApiKeyName(id)).catch(() => undefined);
      }
      await get().refreshProviderStatus(id);
    } catch (err) {
      showError(err, 'Failed to save API key.');
    }
  },

  deleteProviderApiKey: async (id) => {
    try {
      await secureStorage.secureDelete(providerApiKeyName(id)).catch(() => undefined);
      await get().refreshProviderStatus(id);
    } catch (err) {
      showError(err, 'Failed to remove API key.');
    }
  },

  setProviderStatus: (id, status) => {
    set((state) => ({
      providerConfigs: state.providerConfigs.map((p) =>
        p.id === id ? { ...p, status } : p
      ),
    }));
  },

  saveProviderConfig: async (updates, options) => {
    const { id } = updates;
    const current = get().providerConfigs.find((p) => p.id === id);
    if (!current) return;
    const refreshStatus = options?.refreshStatus ?? true;

    const normalized: AIProviderConfig = { ...current, ...updates };
    try {
      await db.providerConfigs.put(normalized);
      set((state) => ({
        providerConfigs: state.providerConfigs.map((p) =>
          p.id === id ? normalized : p
        ),
      }));
      if (refreshStatus) {
        await get().refreshProviderStatus(id);
      }
    } catch (err) {
      showError(err, 'Failed to save provider config.');
    }
  },

  connectProvider: async (id, baseUrl, apiKey) => {
    const current = get().providerConfigs.find((provider) => provider.id === id);
    if (!current) return { ok: false, error: 'Provider not found.' };

    const normalizedBaseUrl = normalizeProviderBaseUrl(baseUrl);
    const trimmedKey = apiKey.trim();
    if (!normalizedBaseUrl || !trimmedKey) {
      return { ok: false, error: 'Base URL and API key are required.' };
    }

    try {
      const parsed = new URL(normalizedBaseUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { ok: false, error: 'Base URL must use http or https.' };
      }
    } catch {
      return { ok: false, error: 'Base URL is not a valid URL.' };
    }

    const availableModels = (current.models ?? []).filter(
      (model) => !get().isModelHidden(id, model.id),
    );
    if (availableModels.length === 0) {
      return { ok: false, error: 'Import and enable at least one model before connecting.' };
    }

    try {
      const selectedModel = availableModels.some((model) => model.id === current.selectedModel)
        ? current.selectedModel
        : availableModels[0].id;
      const connected: AIProviderConfig = {
        ...current,
        baseUrl: normalizedBaseUrl,
        selectedModel,
        status: 'connected',
        isActive: true,
      };

      await secureStorage.secureSet(providerApiKeyName(id), trimmedKey);
      const savedKey = await secureStorage.secureGet(providerApiKeyName(id));
      if (savedKey !== trimmedKey) {
        throw new Error(`Could not verify the saved API key for ${current.name}.`);
      }
      await db.providerConfigs.put(connected);
      await secureStorage.secureSet('activeProviderId', id);
      set((state) => ({
        activeProviderId: id,
        providerConfigs: state.providerConfigs.map((provider) =>
          provider.id === id ? connected : provider
        ),
      }));
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect provider.';
      return { ok: false, error: message };
    }
  },

  importProviderModels: async (id, baseUrl, apiKey) => {
    const current = get().providerConfigs.find((p) => p.id === id);
    if (!current) {
      return { ok: false, error: 'Provider not found.', code: 'unknown' };
    }

    const trimmedBaseUrl = normalizeProviderBaseUrl(baseUrl);
    const trimmedKey = apiKey.trim();

    try {
      // Persist the base URL + key up front so the connection survives reloads
      // even if the network call fails.
      const persisted: AIProviderConfig = {
        ...current,
        baseUrl: trimmedBaseUrl,
        apiKey: current.apiKey,
        status: current.status ?? 'not_connected',
      };
      await db.providerConfigs.put(persisted);
      set((state) => ({
        providerConfigs: state.providerConfigs.map((p) =>
          p.id === id ? persisted : p
        ),
      }));

      if (trimmedKey) {
        await secureStorage.secureSet(providerApiKeyName(id), trimmedKey);
      } else {
        await secureStorage.secureDelete(providerApiKeyName(id));
      }

      const imported = await fetchProviderModels({
        providerId: id,
        baseUrl: trimmedBaseUrl,
        apiKey: trimmedKey,
      });

      // Preserve user-added custom models across re-imports.
      const customModels = current.customModels ?? [];
      const customIds = new Set(customModels);
      const customItems: ModelItem[] = imported
        .filter((m) => customIds.has(m.id))
        .map((m) => ({ ...m, custom: true }));
      // Also keep any custom models that weren't in the imported list.
      const importedIds = new Set(imported.map((m) => m.id));
      const orphanCustoms: ModelItem[] = customModels
        .filter((slug) => !importedIds.has(slug))
        .map((slug) => ({
          id: slug,
          name: slug,
          enabled: true,
          custom: true,
          capabilities: {
            vision: false,
            toolCalling: true,
            contextLength: 'Unknown',
            speed: 'Unknown',
            cost: 'Unknown',
            reasoning: 'Unknown',
            endpointType: 'Custom',
            lastSynced: 'Unknown',
          },
        }));
      const models: ModelItem[] = [...imported, ...customItems, ...orphanCustoms];

      // Keep the existing selection when possible; otherwise fall back to the
      // first imported model.
      const stillExists = current.selectedModel
        ? models.some((m) => m.id === current.selectedModel)
        : false;
      const nextSelected = stillExists
        ? current.selectedModel
        : imported[0]?.id ?? current.selectedModel;

      const nextConfig: AIProviderConfig = {
        ...persisted,
        models,
        selectedModel: nextSelected,
        lastImportedAt: Date.now(),
        status: deriveProviderStatus({
          hasBaseUrl: Boolean(trimmedBaseUrl),
          hasKey: Boolean(trimmedKey),
          modelCount: models.length,
          selectedModel: nextSelected,
        }),
      };
      await db.providerConfigs.put(nextConfig);
      set((state) => ({
        providerConfigs: state.providerConfigs.map((p) =>
          p.id === id ? nextConfig : p
        ),
      }));

      // If the active provider is this one, ensure the selected model
      // still points at something that exists.
      if (get().activeProviderId === id) {
        get().setActiveModel(id, nextConfig.selectedModel);
      }

      return { ok: true };
    } catch (err) {
      if (err instanceof ProviderImportError) {
        // Persist a "connection_failed" status so the UI reflects the failure
        // even when the saved baseUrl/key are still present.
        const currentAfter = get().providerConfigs.find((p) => p.id === id);
        if (currentAfter) {
          const failed: AIProviderConfig = {
            ...currentAfter,
            status: 'connection_failed',
          };
          await db.providerConfigs.put(failed).catch(() => undefined);
          set((state) => ({
            providerConfigs: state.providerConfigs.map((p) =>
              p.id === id ? failed : p
            ),
          }));
        }
        return { ok: false, error: err.message, code: err.code };
      }
      const message = err instanceof Error ? err.message : 'Failed to import models.';
      return { ok: false, error: message, code: 'unknown' };
    }
  },

  getEnabledModels: (providerId) => {
    const config = get().providerConfigs.find((p) => p.id === providerId);
    if (!config || config.status !== 'connected') return [];
    return (config.models ?? []).filter((m) => !get().isModelHidden(config.id, m.id));
  },

  getAllEnabledModels: () => {
    const result: { provider: AIProviderConfig; model: ModelItem }[] = [];
    for (const provider of get().providerConfigs) {
      for (const model of get().getEnabledModels(provider.id)) {
        result.push({ provider, model });
      }
    }
    return result;
  },

  saveSearchConfig: async (config) => {
    set({ searchConfig: config });
    try {
      await db.settings.put({ key: 'exaKey', value: config.exaKey });
      await db.settings.put({ key: 'tavilyKey', value: config.tavilyKey });
      await db.settings.put({ key: 'firecrawlKey', value: config.firecrawlKey });
      await db.settings.put({ key: 'braveKey', value: config.braveKey });
      await db.settings.put({ key: 'enabled', value: config.enabled });
      await db.settings.put({ key: 'searchProvider', value: config.searchProvider });
    } catch (err) {
      showError(err, 'Failed to save search config.');
    }
  },

  saveSystemInstructions: async (text) => {
    set({ systemInstructions: text });
    try {
      await db.settings.put({ key: 'systemInstructions', value: text });
    } catch (err) {
      showError(err, 'Failed to save system instructions.');
    }
  },
}));
