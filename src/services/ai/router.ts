import type { AIProviderConfig } from '../../types';
import type { ChatMessage } from './types';
import { streamOpenAI } from './openai';
import { streamGemini } from './gemini';

export const BASE_URLS: Record<string, string> = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  nvidia: 'https://integrate.api.nvidia.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  mistral: 'https://api.mistral.ai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
};

export async function* streamChat(
  messages: ChatMessage[],
  config: AIProviderConfig,
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  if (config.provider === 'gemini' && !config.baseUrl) {
    yield* streamGemini(messages, config, signal);
    return;
  }
  const baseUrl = config.baseUrl || BASE_URLS[config.provider];
  yield* streamOpenAI(messages, { ...config, baseUrl }, signal);
}

export const PROVIDER_MODELS: Record<string, { label: string; models: string[] }> = {
  gemini: {
    label: 'Gemini API',
    models: [
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
      'gemini-3-flash-preview',
      'gemini-3.1-flash-lite-preview',
      'gemma-4-26b-a4b-it',
      'gemma-4-31b-it',
      'imagen-4.0-fast-generate',
      'imagen-4.0-generate-001',
      'imagen-4.0-ultra-generate',
    ],
  },
  nvidia: {
    label: 'Nvidia NIM',
    models: [
      'z-ai/glm-5.1',
      'z-ai/glm4.7',
      'z-ai/glm5',
      'qwen/qwen2.5-coder-32b-instruct',
      'qwen/qwen3-coder-480b-a35b-instruct',
      'qwen/qwen3-next-80b-a3b-instruct',
      'qwen/qwen3-next-80b-a3b-thinking',
      'qwen/qwen3.5-122b-a10b',
      'qwen/qwen3.5-397b-a17b',
      'deepseek-ai/deepseek-coder-6.7b-instruct',
      'deepseek-ai/deepseek-v3.1-terminus',
      'deepseek-ai/deepseek-v3.2',
      'google/gemma-4-31b-it',
      'meta/llama-3.1-405b-instruct',
      'meta/llama-3.1-70b-instruct',
      'microsoft/phi-3-vision-128k-instruct',
      'minimaxai/minimax-m2.7',
      'mistralai/mistral-large',
      'writer/palmyra-creative-122b',
    ],
  },
  groq: {
    label: 'Groq',
    models: [
      'llama-3.3-70b-versatile',
      'groq/compound',
      'openai/gpt-oss-20b',
      'meta-llama/llama-4-scout-17b-16e-instruct',
      'qwen/qwen3-32b',
      'openai/gpt-oss-120b',
    ],
  },
  mistral: {
    label: 'Mistral',
    models: [
      'mistral-large-2512',
      'devstral-latest',
      'pixtral-large-latest',
      'magistral-medium-latest',
      'magistral-small-latest',
      'codestral-latest',
      'mistral-large-2411',
    ],
  },
  openrouter: {
    label: 'OpenRouter',
    models: [
      'qwen/qwen3-coder:free',
      'nousresearch/hermes-3-llama-3.1-405b:free',
      'arcee-ai/trinity-large-preview:free',
      'qwen/qwen3-next-80b-a3b-instruct:free',
      'openai/gpt-oss-20b:free',
      'minimax/minimax-m2.5:free',
      'nvidia/nemotron-3-super-120b-a12b:free',
      'z-ai/glm-4.5-air:free',
      'nvidia/nemotron-3-nano-30b-a3b:free',
      'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'openai/gpt-oss-120b:free',
      'google/gemma-4-26b-a4b-it:free',
      'google/gemma-4-31b-it:free',
      'nvidia/nemotron-nano-12b-v2-vl:free',
      'nvidia/nemotron-nano-9b-v2:free',
      'openrouter/free',
    ],
  },
};
