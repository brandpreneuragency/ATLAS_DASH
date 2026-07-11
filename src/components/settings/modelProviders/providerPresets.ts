// Presentation-only preset metadata for the Connect Provider drawer.
// No network or persistence logic lives here.

export interface ProviderPreset {
  /** Stable identifier used in forms and analytics. */
  id: string;
  /** i18n key for the display label. */
  labelKey: string;
  /** Default base URL for the preset (already normalized, no trailing path). */
  defaultBaseUrl: string;
  /** Whether this preset is known to work with the current OpenAI-compatible importer. */
  verified: boolean;
  /** i18n key for a short description shown under the preset. */
  descriptionKey?: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    labelKey: 'models.presetOpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    verified: true,
    descriptionKey: 'models.presetOpenAIDesc',
  },
  {
    id: 'ollama',
    labelKey: 'models.presetOllama',
    defaultBaseUrl: 'http://localhost:11434/v1',
    verified: true,
    descriptionKey: 'models.presetOllamaDesc',
  },
  {
    id: 'lmstudio',
    labelKey: 'models.presetLMStudio',
    defaultBaseUrl: 'http://localhost:1234/v1',
    verified: true,
    descriptionKey: 'models.presetLMStudioDesc',
  },
  {
    id: 'vllm',
    labelKey: 'models.presetVllm',
    defaultBaseUrl: 'http://localhost:8000/v1',
    verified: true,
    descriptionKey: 'models.presetVllmDesc',
  },
  {
    id: 'custom',
    labelKey: 'models.presetCustom',
    defaultBaseUrl: '',
    verified: false,
    descriptionKey: 'models.presetCustomDesc',
  },
];

export function getPresetById(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id);
}
