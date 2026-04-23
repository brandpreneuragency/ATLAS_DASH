import type { AIProviderConfig } from '../../types';

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentPart[];
}

export type StreamChatFn = (
  messages: ChatMessage[],
  config: AIProviderConfig,
  signal?: AbortSignal
) => AsyncGenerator<string, void, unknown>;
