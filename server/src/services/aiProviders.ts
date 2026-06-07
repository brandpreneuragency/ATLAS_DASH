// AI provider streaming service.
//
// Centralises the wire shapes for the three providers the app supports:
// OpenAI-compatible (custom providers, OpenRouter, OpenAI itself), Anthropic,
// and Google Gemini. The browser never sees provider API keys or hits these
// endpoints directly — every chat request goes through `/api/ai/stream`,
// which decrypts the user's stored API key, calls the provider, and pipes
// the chunks back as Server-Sent Events.
//
// We rely on the global `fetch` (Node 22 ships an undici-based fetch). All
// streaming parses are best-effort: malformed JSON chunks are skipped, the
// reader just keeps going.

import { decrypt } from '../encryption.js';
import type { AIProviderType, ChatMessage, ContentPart } from './aiTypes.js';

export interface AIProviderConfigPublic {
  id: string;
  name: string;
  provider: AIProviderType;
  selectedModel: string;
  isActive: boolean;
  baseUrl: string;
  customModels: string[];
  /** True when the user has stored a non-empty apiKey. The raw value is
   *  never returned to the client. */
  hasApiKey: boolean;
}

export interface ResolvedProviderConfig {
  id: string;
  name: string;
  provider: AIProviderType;
  selectedModel: string;
  isActive: boolean;
  baseUrl: string;
  customModels: string[];
  apiKey: string;
}

export interface StreamContext {
  signal?: AbortSignal;
}

// ── Provider: OpenAI-compatible (custom, OpenAI, OpenRouter) ────────────────

const OPENAI_COMPATIBLE_DEFAULT_BASE = 'https://api.openai.com/v1';

interface OpenAIChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
      reasoning?: string | null;
      reasoning_content?: string | null;
    };
  }>;
}

async function* streamOpenAICompatible(
  cfg: ResolvedProviderConfig,
  messages: ChatMessage[],
  ctx: StreamContext,
): AsyncGenerator<string, void, unknown> {
  const baseUrl = cfg.baseUrl || OPENAI_COMPATIBLE_DEFAULT_BASE;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cfg.apiKey}`,
  };
  if (cfg.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://tabs-editor.app';
    headers['X-Title'] = 'TABS';
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: cfg.selectedModel,
      messages,
      stream: true,
    }),
    signal: ctx.signal,
  });

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => '');
    throw new Error(`OpenAI-compatible error ${response.status}: ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let reasoningStarted = false;
  let reasoningClosed = false;

  try {
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
        let parsed: OpenAIChunk;
        try {
          parsed = JSON.parse(trimmed.slice(6)) as OpenAIChunk;
        } catch {
          continue;
        }
        const delta = parsed.choices?.[0]?.delta;
        const reasoning = delta?.reasoning ?? delta?.reasoning_content ?? '';
        const content = delta?.content ?? '';
        if (reasoning) {
          if (!reasoningStarted) {
            yield '<think>';
            reasoningStarted = true;
          }
          yield reasoning;
        }
        if (content) {
          if (reasoningStarted && !reasoningClosed) {
            yield '</think>';
            reasoningClosed = true;
          }
          yield content;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Provider: Anthropic Messages ────────────────────────────────────────────

interface AnthropicEvent {
  type: string;
  delta?: { type?: string; text?: string };
}

async function* streamAnthropic(
  cfg: ResolvedProviderConfig,
  messages: ChatMessage[],
  ctx: StreamContext,
): AsyncGenerator<string, void, unknown> {
  const baseUrl = cfg.baseUrl || 'https://api.anthropic.com';
  const systemMessages = messages.filter((m) => m.role === 'system');
  const chatMessages = messages.filter((m) => m.role !== 'system');
  const systemPrompt = systemMessages
    .map((m) => (typeof m.content === 'string' ? m.content : ''))
    .join('\n');

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: cfg.selectedModel,
      max_tokens: 4096,
      system: systemPrompt || undefined,
      messages: chatMessages,
      stream: true,
    }),
    signal: ctx.signal,
  });

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Anthropic error ${response.status}: ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        let parsed: AnthropicEvent;
        try {
          parsed = JSON.parse(trimmed.slice(6)) as AnthropicEvent;
        } catch {
          continue;
        }
        if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta' && parsed.delta.text) {
          yield parsed.delta.text;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Provider: Google Gemini ──────────────────────────────────────────────────

interface GeminiPart {
  text?: string;
}
interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
}
interface GeminiChunk {
  candidates?: GeminiCandidate[];
}

async function* streamGemini(
  cfg: ResolvedProviderConfig,
  messages: ChatMessage[],
  ctx: StreamContext,
): AsyncGenerator<string, void, unknown> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    cfg.selectedModel,
  )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(cfg.apiKey)}`;

  const systemMessages = messages.filter((m) => m.role === 'system');
  const chatMessages = messages.filter((m) => m.role !== 'system');
  const systemInstruction = systemMessages.length
    ? {
        parts: systemMessages.map((m) => ({ text: typeof m.content === 'string' ? m.content : '' })),
      }
    : undefined;
  const contents = chatMessages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: typeof m.content === 'string' ? m.content : '' }],
  }));

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      ...(systemInstruction ? { system_instruction: systemInstruction } : {}),
      generationConfig: { maxOutputTokens: 4096 },
    }),
    signal: ctx.signal,
  });

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Gemini error ${response.status}: ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        let parsed: GeminiChunk;
        try {
          parsed = JSON.parse(trimmed.slice(6)) as GeminiChunk;
        } catch {
          continue;
        }
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) yield text;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Drain a provider stream into a single string. Used by the task-AI planner
 * (which does not stream) and by tests.
 */
export async function collectStream(
  stream: AsyncGenerator<string, void, unknown>,
): Promise<string> {
  let out = '';
  for await (const chunk of stream) {
    out += chunk;
  }
  return out;
}

// ── Top-level dispatcher ────────────────────────────────────────────────────

export type ProviderStream = (
  cfg: ResolvedProviderConfig,
  messages: ChatMessage[],
  ctx: StreamContext,
) => AsyncGenerator<string, void, unknown>;

export function getStreamerFor(provider: AIProviderType): ProviderStream {
  // Treat 'custom', 'openai', 'openrouter', and anything that the
  // OpenAI-compatible adapter supports as the same shape.
  switch (provider) {
    case 'anthropic':
    case 'claude':
      return streamAnthropic;
    case 'gemini':
    case 'google':
      return streamGemini;
    default:
      return streamOpenAICompatible;
  }
}

// ── Resolving a config from the DB ──────────────────────────────────────────

export function resolveProviderConfig(row: {
  id: string;
  name: string;
  provider: string;
  apiKey: string;
  selectedModel: string;
  isActive: boolean;
  baseUrl: string;
  customModels: string[];
}): ResolvedProviderConfig {
  const apiKey = row.apiKey ? decrypt(row.apiKey) : '';
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    selectedModel: row.selectedModel,
    isActive: row.isActive,
    baseUrl: row.baseUrl,
    customModels: row.customModels,
    apiKey,
  };
}

/** Strip the API key before returning the row to the client. */
export function publicProviderConfig(row: {
  id: string;
  name: string;
  provider: string;
  apiKey: string;
  selectedModel: string;
  isActive: boolean;
  baseUrl: string;
  customModels: string[];
}): AIProviderConfigPublic {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    selectedModel: row.selectedModel,
    isActive: row.isActive,
    baseUrl: row.baseUrl,
    customModels: row.customModels,
    hasApiKey: typeof row.apiKey === 'string' && row.apiKey.length > 0,
  };
}

// ── Content helpers ─────────────────────────────────────────────────────────

export function flattenContent(content: string | ContentPart[]): string {
  if (typeof content === 'string') return content;
  return content
    .map((part) => {
      if (part.type === 'text') return part.text;
      // image_url is intentionally omitted from the text we send to the
      // provider when the provider does not support vision. The frontend
      // already drops image_url from non-vision flows.
      return '';
    })
    .join('\n');
}
