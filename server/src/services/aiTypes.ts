// Wire types shared by the AI service, the AI routes, and the AI
// repository. The frontend carries matching types in `src/services/ai/types.ts`
// — keep them in sync.

export type AIProviderType = string;

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentPart[];
}
