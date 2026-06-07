// Google Gemini streaming. Dormant for the web build — the browser routes
// through `aiRepository.streamChat()`. See AGENTS.md for the Tauri
// isolation strategy.

import type { AIProviderConfig } from '../../types';
import type { ChatMessage } from './types';
import { resolveFetch } from './fetchResolver';

export async function* streamGemini(
  messages: ChatMessage[],
  config: AIProviderConfig,
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  const model = config.selectedModel || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${config.apiKey}`;
  const fetch = await resolveFetch();

  const systemMessages = messages.filter((m) => m.role === 'system');
  const chatMessages = messages.filter((m) => m.role !== 'system');
  const systemInstruction = systemMessages.length
    ? { parts: [{ text: systemMessages.map((m) => m.content).join('\n') }] }
    : undefined;

  const contents = chatMessages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      ...(systemInstruction ? { system_instruction: systemInstruction } : {}),
      generationConfig: { maxOutputTokens: 4096 },
    }),
    signal,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini error ${response.status}: ${err}`);
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
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) yield text;
      } catch {
        // skip malformed chunks
      }
    }
  }
}
