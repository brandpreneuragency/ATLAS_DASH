// OpenAI-compatible streaming (covers `openai`, `openrouter`, and
// `custom` providers). Used by the dormant Tauri desktop build only —
// the browser web build routes through `aiRepository.streamChat()` which
// hits the server. See AGENTS.md for the Tauri isolation strategy.

import type { AIProviderConfig, MessageUsage } from '../../types';
import { runtimeFetch } from '../http';
import type { ChatMessage, StreamChunk } from './types';

function normalizeUsage(usage: unknown): MessageUsage | undefined {
  if (!usage || typeof usage !== 'object') return undefined;
  const u = usage as Record<string, unknown>;
  const details = (u.prompt_tokens_details as Record<string, number>) || {};
  const result: MessageUsage = {};
  if (typeof u.prompt_tokens === 'number') result.promptTokens = u.prompt_tokens;
  if (typeof u.completion_tokens === 'number') result.completionTokens = u.completion_tokens;
  if (typeof u.total_tokens === 'number') result.totalTokens = u.total_tokens;
  if (typeof details.reasoning_tokens === 'number') result.reasoningTokens = details.reasoning_tokens;
  if (typeof details.cached_tokens === 'number') result.cacheReadTokens = details.cached_tokens;
  if (typeof details.cached_write_tokens === 'number') result.cacheWriteTokens = details.cached_write_tokens;
  return Object.keys(result).length > 0 ? result : undefined;
}

export async function* streamOpenAI(
  messages: ChatMessage[],
  config: AIProviderConfig,
  signal?: AbortSignal
): AsyncGenerator<StreamChunk, void, unknown> {
  const baseUrl = (config.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const apiKey = config.apiKey?.trim();
  if (!apiKey) {
    throw new Error(`No saved API key was found for ${config.name}.`);
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  if (config.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://tabs-editor.app';
    headers['X-Title'] = 'TABS';
  }

  const response = await runtimeFetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.selectedModel || 'gpt-4o',
      messages,
      stream: true,
      stream_options: { include_usage: true },
    }),
    signal,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${err}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let reasoningStarted = false;
  let reasoningClosed = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;
      try {
        const json = JSON.parse(trimmed.slice(6));
        const usage = normalizeUsage(json.usage);
        if (usage) {
          yield { content: '', usage };
          continue;
        }
        const delta = json.choices?.[0]?.delta;
        const reasoning = delta?.reasoning ?? delta?.reasoning_content ?? '';
        const content = delta?.content ?? '';

        if (reasoning) {
          if (!reasoningStarted) { yield { content: '<think>' }; reasoningStarted = true; }
          yield { content: reasoning };
        }
        if (content) {
          if (reasoningStarted && !reasoningClosed) { yield { content: '</think>' }; reasoningClosed = true; }
          yield { content };
        }
      } catch {
        // skip malformed chunks
      }
    }
  }
}
