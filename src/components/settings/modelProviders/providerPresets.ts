// Presentation + seed metadata for built-in LLM presets.
// No network or persistence logic lives here.

export interface ProviderPreset {
  /** Stable id used as AIProviderConfig.id and secure-storage key suffix. */
  id: string;
  /** English display name stored on the config (UI may still translate via labelKey). */
  name: string;
  /** i18n key for the display label. */
  labelKey: string;
  /** Default base URL for the preset (already normalized, no trailing path). */
  defaultBaseUrl: string;
  /** Whether this preset is known to work with the current OpenAI-compatible importer. */
  verified: boolean;
  /** i18n key for a short description. */
  descriptionKey?: string;
}

/**
 * Built-in providers always shown in Settings → Tools → LLM.
 * Order here is the left-panel order.
 */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    labelKey: 'models.presetOpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    verified: true,
    descriptionKey: 'models.presetOpenAIDesc',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    labelKey: 'models.presetAnthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    verified: true,
    descriptionKey: 'models.presetAnthropicDesc',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    labelKey: 'models.presetGemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    verified: true,
    descriptionKey: 'models.presetGeminiDesc',
  },
  {
    id: 'opencode-go',
    name: 'OpenCode Go',
    labelKey: 'models.presetOpenCodeGo',
    defaultBaseUrl: 'https://opencode.ai/zen/go/v1',
    verified: true,
    descriptionKey: 'models.presetOpenCodeGoDesc',
  },
  {
    id: 'opencode-zen',
    name: 'OpenCode Zen',
    labelKey: 'models.presetOpenCodeZen',
    defaultBaseUrl: 'https://opencode.ai/zen/v1',
    verified: true,
    descriptionKey: 'models.presetOpenCodeZenDesc',
  },
  {
    id: 'nvidia',
    name: 'NVIDIA Build',
    labelKey: 'models.presetNvidia',
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    verified: true,
    descriptionKey: 'models.presetNvidiaDesc',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    labelKey: 'models.presetOpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    verified: true,
    descriptionKey: 'models.presetOpenRouterDesc',
  },
];

export const PRESET_PROVIDER_IDS = new Set(PROVIDER_PRESETS.map((p) => p.id));

export function isPresetProviderId(id: string | null | undefined): boolean {
  return Boolean(id && PRESET_PROVIDER_IDS.has(id));
}

export function getPresetById(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id);
}

export function createPresetProviderConfig(preset: ProviderPreset): import('../../../types').AIProviderConfig {
  return {
    id: preset.id,
    name: preset.name,
    provider: preset.id,
    apiKey: '',
    selectedModel: '',
    isActive: false,
    baseUrl: preset.defaultBaseUrl,
    customModels: [],
    status: 'needs_key',
    models: [],
  };
}
