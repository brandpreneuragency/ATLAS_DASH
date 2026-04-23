export interface Document {
  id: string;
  title: string;
  content: string; // TipTap JSON serialized
  createdAt: number;
  updatedAt: number;
  order: number;
  sourcePath?: string;
}

export interface Attachment {
  name: string;
  dataUrl: string;
  mimeType: string;
}

export interface ChatMessage {
  id: string;
  documentId: string;
  agentId: string;
  role: 'user' | 'assistant';
  content: string;
  selectedText?: string;
  selectionFrom?: number;
  selectionTo?: number;
  suggestedText?: string;
  attachments?: Attachment[];
  timestamp: number;
}

export interface Agent {
  id: string;
  name: string;
  avatarUrl: string;
  systemPrompt: string;
  isDefault: boolean;
}

export type AIProviderType = 'gemini' | 'nvidia' | 'opencode' | 'groq' | 'mistral' | 'openrouter';

export interface AIProviderConfig {
  id: string;
  provider: AIProviderType;
  apiKey: string;
  selectedModel: string;
  isActive: boolean;
  baseUrl?: string;
}

// One API key entry per provider type
export interface ProviderKey {
  provider: AIProviderType;
  apiKey: string;
  baseUrl?: string;
}

export interface AppSettings {
  key: string;
  value: string | number | boolean;
}

export interface QuickPrompt {
  id: string;
  title: string;
  prompt: string;
  createdAt: number;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface ChatPayload {
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
  config: AIProviderConfig;
}
