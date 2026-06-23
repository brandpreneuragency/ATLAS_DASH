// AI provider router. Used by the dormant Tauri desktop build. The
// browser web build routes through `aiRepository.streamChat()` which
// hits the server, so this file is unused at runtime in the web build
// but its API is kept stable for the desktop re-merge.

import type { AIProviderConfig } from '../../types';
import type { ChatMessage, StreamChunk } from './types';
import { streamOpenAI } from './openai';

export async function completeChat(
  messages: ChatMessage[],
  config: AIProviderConfig,
  signal?: AbortSignal
): Promise<string> {
  let full = '';
  for await (const chunk of streamChat(messages, config, signal)) {
    full += chunk.content;
  }
  return full;
}

export async function* streamChat(
  messages: ChatMessage[],
  config: AIProviderConfig,
  signal?: AbortSignal
): AsyncGenerator<StreamChunk, void, unknown> {
  // All providers (custom) use OpenAI-compatible streaming
  yield* streamOpenAI(messages, { ...config, baseUrl: config.baseUrl }, signal);
}
