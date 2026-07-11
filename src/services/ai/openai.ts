// OpenAI-compatible streaming. All connected providers are added as
// OpenAI-compatible endpoints (see ConnectProviderPanel), so this is
// the only streamer used by the router.

import type { AIProviderConfig, MessageUsage } from '../../types';
import { runtimeFetch } from '../http';
import { buildReasoningPayload, resolveReasoning } from './reasoning';
import type { ChatMessage, StreamChunk, StreamOptions } from './types';

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
  signal?: AbortSignal,
  options?: StreamOptions
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

  const activeModel = config.models?.find((m) => m.id === config.selectedModel);
  const reasoning = activeModel ? resolveReasoning(activeModel, config.baseUrl) : undefined;
  const reasoningPayload = reasoning
    ? buildReasoningPayload(reasoning, activeModel?.selectedReasoning)
    : {};

  const response = await runtimeFetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.selectedModel || 'gpt-4o',
      messages,
      stream: true,
      stream_options: { include_usage: true },
      ...reasoningPayload,
      // Only include tool params when the caller supplies them, so
      // text-only requests stay byte-identical to the previous behaviour.
      ...(options?.tools && options.tools.length > 0
        ? { tools: options.tools, tool_choice: options.toolChoice ?? 'auto' }
        : {}),
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

  // Tool-call accumulation: keyed by delta index. Each entry collects the
  // streamed id / name / arguments fragments for one tool call.
  type AccumTool = { id: string; name: string; args: string };
  const toolAcc: Record<number, AccumTool> = {};

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
        const choice = json.choices?.[0];
        const delta = choice?.delta;
        const reasoning = delta?.reasoning ?? delta?.reasoning_content ?? '';
        const content = delta?.content ?? '';

        // Accumulate streamed tool calls (OpenAI-compatible `tool_calls[]`).
        const toolCalls = delta?.tool_calls;
        if (Array.isArray(toolCalls)) {
          for (const tc of toolCalls) {
            const idx = tc.index;
            if (idx === undefined || idx === null) continue;
            const entry = (toolAcc[idx] ??= { id: '', name: '', args: '' });
            if (tc.id) entry.id = tc.id;
            if (tc.function?.name) entry.name = tc.function.name;
            if (typeof tc.function?.arguments === 'string') {
              entry.args += tc.function.arguments;
              yield {
                content: '',
                toolCallDelta: { index: idx, argumentsChunk: tc.function.arguments },
              };
            }
          }
        }

        if (reasoning) {
          if (!reasoningStarted) { yield { content: '<think>' }; reasoningStarted = true; }
          yield { content: reasoning };
        }
        if (content) {
          if (reasoningStarted && !reasoningClosed) { yield { content: '</think>' }; reasoningClosed = true; }
          yield { content };
        }

        // Assistant turn finished requesting tool execution.
        const finish = choice?.finish_reason;
        if (finish === 'tool_calls') {
          const calls = Object.values(toolAcc).map((e) => {
            let args: Record<string, unknown> = {};
            try {
              args = e.args.trim() ? JSON.parse(e.args) : {};
            } catch {
              args = {};
            }
            return { id: e.id, name: e.name, args };
          });
          yield { content: '', toolCallReady: { calls } };
        }
      } catch {
        // skip malformed chunks
      }
    }
  }
}
