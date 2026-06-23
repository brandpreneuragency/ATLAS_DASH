import type { AIProviderConfig } from '../../types';
import { runtimeFetch } from '../http';
import type { ChatMessage, StreamChunk } from './types';

export async function* streamAnthropic(
  messages: ChatMessage[],
  config: AIProviderConfig,
  signal?: AbortSignal
): AsyncGenerator<StreamChunk, void, unknown> {
  const proxyUrl = config.baseUrl || 'https://api.anthropic.com';
  const systemMessages = messages.filter((m) => m.role === 'system');
  const chatMessages = messages.filter((m) => m.role !== 'system');
  const systemPrompt = systemMessages.map((m) => m.content).join('\n');

  const response = await runtimeFetch(`${proxyUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.selectedModel || 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      system: systemPrompt || undefined,
      messages: chatMessages,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic error ${response.status}: ${err}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      try {
        const json = JSON.parse(trimmed.slice(6));
        if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
          yield { content: json.delta.text };
        }
      } catch {
        // skip malformed chunks
      }
    }
  }
}
