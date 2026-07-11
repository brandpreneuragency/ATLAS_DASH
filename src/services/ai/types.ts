import type { AIProviderConfig, MessageUsage } from '../../types';

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | ContentPart[];
  /** OpenAI tool message: id of the tool call this result answers. */
  tool_call_id?: string;
}

export interface StreamChunk {
  content: string;
  usage?: MessageUsage;
  /** Emitted for each streamed `tool_calls[].function.arguments` fragment. */
  toolCallDelta?: ToolCallDelta;
  /** Emitted once when the stream finishes with `finish_reason: 'tool_calls'`. */
  toolCallReady?: ToolCallReady;
}

/** A single streamed fragment of a tool call's arguments. */
export interface ToolCallDelta {
  index: number;
  /** Partial `function.arguments` JSON string fragment. */
  argumentsChunk: string;
}

/** All accumulated tool calls once the assistant turn finishes. */
export interface ToolCallReady {
  calls: ToolCall[];
}

/** A fully accumulated tool call, ready to be dispatched. */
export interface ToolCall {
  id: string;
  name: string;
  /** Parsed arguments object (empty object if JSON.parse failed). */
  args: Record<string, unknown>;
}

/**
 * OpenAI-compatible function/tool definition. Mirrors the subset of the
 * `tools` request schema shared across all four providers.
 */
export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export type StreamChatFn = (
  messages: ChatMessage[],
  config: AIProviderConfig,
  signal?: AbortSignal,
  options?: StreamOptions
) => AsyncGenerator<StreamChunk, void, unknown>;

/** Optional streaming controls (e.g. tool-use). */
export interface StreamOptions {
  tools?: OpenAITool[];
  toolChoice?: 'auto' | 'none';
}
