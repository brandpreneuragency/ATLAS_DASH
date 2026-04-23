import { create } from 'zustand';
import { PROVIDER_MODELS } from '../services/ai/router';
import type { Agent, AIProviderConfig, ProviderKey } from '../types';
import { db } from '../services/db';

const DEFAULT_AGENT: Agent = {
  id: 'default',
  name: 'Aaron the Script Writer',
  avatarUrl: '',
  systemPrompt:
    'You are Aaron, a skilled writing assistant. Help the user improve their writing, suggest edits, and provide creative ideas. When suggesting text changes, provide the revised text clearly so it can be applied directly.',
  isDefault: true,
};

interface AIStore {
  agents: Agent[];
  activeAgentId: string;
  providerConfigs: AIProviderConfig[];
  activeProviderId: string | null;
  isLoaded: boolean;
  hiddenModels: string[];           // "provider:modelId" strings
  providerKeys: Record<string, ProviderKey>; // keyed by provider type

  loadAISettings: () => Promise<void>;
  saveAgent: (agent: Agent) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  setActiveAgent: (id: string) => void;
  saveProviderConfig: (config: AIProviderConfig) => Promise<void>;
  deleteProviderConfig: (id: string) => Promise<void>;
  setActiveProvider: (id: string) => void;
  getActiveAgent: () => Agent;
  getActiveProvider: () => AIProviderConfig | null;
  toggleHiddenModel: (key: string) => void;  // key = "provider:modelId"
  saveProviderKey: (pk: ProviderKey) => Promise<void>;
  isModelHidden: (provider: string, modelId: string) => boolean;
  setActiveModel: (provider: string, modelId: string) => void;
}

export const useAIStore = create<AIStore>((set, get) => ({
  agents: [DEFAULT_AGENT],
  activeAgentId: 'default',
  providerConfigs: [],
  activeProviderId: null,
  isLoaded: false,
  hiddenModels: [],
  providerKeys: {},

  loadAISettings: async () => {
    const agents = await db.agents.toArray();
    const configs = await db.providerConfigs.toArray();
    const activeAgentSetting = await db.settings.get('activeAgentId');
    const activeProviderSetting = await db.settings.get('activeProviderId');
    const hiddenModelsRow = await db.settings.get('hiddenModels');
    const providerKeysRow = await db.settings.get('providerKeys');

    const allAgents = agents.length > 0 ? agents : [DEFAULT_AGENT];
    if (agents.length === 0) {
      await db.agents.put(DEFAULT_AGENT);
    }

    let hiddenModels: string[] = [];
    if (hiddenModelsRow?.value) {
      try { hiddenModels = JSON.parse(String(hiddenModelsRow.value)); } catch { hiddenModels = []; }
    }

    let providerKeys: Record<string, ProviderKey> = {};
    if (providerKeysRow?.value) {
      try { providerKeys = JSON.parse(String(providerKeysRow.value)); } catch { providerKeys = {}; }
    }

    set({
      agents: allAgents,
      providerConfigs: configs,
      activeAgentId: (activeAgentSetting?.value as string) ?? 'default',
      activeProviderId: (activeProviderSetting?.value as string) ?? configs[0]?.id ?? null,
      isLoaded: true,
      hiddenModels,
      providerKeys,
    });
  },

  saveAgent: async (agent) => {
    await db.agents.put(agent);
    set((s) => {
      const exists = s.agents.find((a) => a.id === agent.id);
      return {
        agents: exists
          ? s.agents.map((a) => (a.id === agent.id ? agent : a))
          : [...s.agents, agent],
      };
    });
  },

  deleteAgent: async (id) => {
    if (id === 'default') return;
    await db.agents.delete(id);
    set((s) => {
      const agents = s.agents.filter((a) => a.id !== id);
      return {
        agents,
        activeAgentId: s.activeAgentId === id ? 'default' : s.activeAgentId,
      };
    });
  },

  setActiveAgent: (id) => {
    set({ activeAgentId: id });
    db.settings.put({ key: 'activeAgentId', value: id });
  },

  saveProviderConfig: async (config) => {
    await db.providerConfigs.put(config);
    set((s) => {
      const exists = s.providerConfigs.find((c) => c.id === config.id);
      const configs = exists
        ? s.providerConfigs.map((c) => (c.id === config.id ? config : c))
        : [...s.providerConfigs, config];
      return {
        providerConfigs: configs,
        activeProviderId: s.activeProviderId ?? config.id,
      };
    });
  },

  deleteProviderConfig: async (id) => {
    await db.providerConfigs.delete(id);
    set((s) => {
      const configs = s.providerConfigs.filter((c) => c.id !== id);
      return {
        providerConfigs: configs,
        activeProviderId: s.activeProviderId === id ? (configs[0]?.id ?? null) : s.activeProviderId,
      };
    });
  },

  setActiveProvider: (id) => {
    set({ activeProviderId: id });
    db.settings.put({ key: 'activeProviderId', value: id });
  },

  getActiveAgent: () => {
    const { agents, activeAgentId } = get();
    return agents.find((a) => a.id === activeAgentId) ?? DEFAULT_AGENT;
  },

  getActiveProvider: () => {
    const { providerConfigs, activeProviderId } = get();
    return providerConfigs.find((c) => c.id === activeProviderId) ?? null;
  },

  toggleHiddenModel: (key) => {
    const current = get().hiddenModels;
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];
    set({ hiddenModels: next });
    db.settings.put({ key: 'hiddenModels', value: JSON.stringify(next) });
  },

  saveProviderKey: async (pk) => {
    const existing = get().providerConfigs.find((c) => c.id === pk.provider);
    const next = { ...get().providerKeys, [pk.provider]: pk };
    // Keep providerConfigs in sync so existing streaming code still works.
    // One config per provider, id = provider string.
    const config: AIProviderConfig = {
      id: pk.provider,
      provider: pk.provider,
      apiKey: pk.apiKey,
      selectedModel: existing?.selectedModel ?? PROVIDER_MODELS[pk.provider]?.models[0] ?? '',
      isActive: true,
      baseUrl: pk.baseUrl,
    };
    await db.providerConfigs.put(config);
    db.settings.put({ key: 'providerKeys', value: JSON.stringify(next) });
    set((s) => {
      const alreadyExists = s.providerConfigs.find((c) => c.id === pk.provider);
      const configs = alreadyExists
        ? s.providerConfigs.map((c) => (c.id === pk.provider ? config : c))
        : [...s.providerConfigs, config];
      return {
        providerKeys: next,
        providerConfigs: configs,
        activeProviderId: s.activeProviderId ?? pk.provider,
      };
    });
  },

  isModelHidden: (provider, modelId) =>
    get().hiddenModels.includes(`${provider}:${modelId}`),

  setActiveModel: (provider, modelId) => {
    const configs = get().providerConfigs.map((c) =>
      c.provider === provider ? { ...c, selectedModel: modelId } : c
    );
    set({ providerConfigs: configs });
    db.providerConfigs.bulkPut(configs);
  },
}));
