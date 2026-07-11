// AI provider router. Providers are only ever added as OpenAI-compatible
// endpoints (see ConnectProviderPanel), so every config routes through
// the OpenAI-compatible streamer.

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
