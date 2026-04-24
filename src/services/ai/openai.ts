import type { AIProviderConfig } from '../../types';
import type { ChatMessage } from './types';

export async function* streamOpenAI(
  messages: ChatMessage[],
  config: AIProviderConfig,
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
  };
  if (config.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://tabs-editor.app';
    headers['X-Title'] = 'TABS';
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.selectedModel || 'gpt-4o',
      messages,
      stream: true,
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
        const delta = json.choices?.[0]?.delta;
        const reasoning = delta?.reasoning ?? delta?.reasoning_content ?? '';
        const content = delta?.content ?? '';

        if (reasoning) {
          if (!reasoningStarted) { yield '<think>'; reasoningStarted = true; }
          yield reasoning;
        }
        if (content) {
          if (reasoningStarted && !reasoningClosed) { yield '</think>'; reasoningClosed = true; }
          yield content;
        }
      } catch {
        // skip malformed chunks
      }
    }
  }
}
