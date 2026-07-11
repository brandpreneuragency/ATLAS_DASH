// Agent loop for the AI tools feature (Phase 2 of the embedded terminal +
// AI tools spec). Drives a multi-turn conversation where the assistant may
// emit OpenAI-compatible `tool_calls`; each call is dispatched through a
// `ToolDispatcher`, the result is appended as a `role: 'tool'` message, and
// the conversation is re-streamed until the model stops or the iteration cap
// is hit.
//
// UI (Ask & Approve bubbles, permission segmented control) lands in Phase 4;
// this hook is UI-agnostic and accepts the permission mode as a parameter.

import { useCallback } from 'react';
import type { AIProviderConfig } from '../types';
import type { ChatMessage, OpenAITool, StreamChunk, ToolCall } from '../services/ai/types';
import { streamOpenAI } from '../services/ai/openai';

/** Result of executing a single tool call. */
export interface ToolResult {
  toolCallId: string;
  /** String content returned to the model as the `role: 'tool'` message. */
  content: string;
  /** When true, the tool call was rejected/errored and should halt the loop. */
  isError?: boolean;
}

/**
 * Dispatches a single accumulated tool call. Implemented by the AI tools
 * service (Phase 4). In Ask & Approve mode the dispatcher is expected to
 * surface UI and await user input; in Bypass mode it executes immediately.
 */
export type ToolDispatcher = (
  call: ToolCall,
  mode: AgentPermissionMode
) => Promise<ToolResult>;

export type AgentPermissionMode = 'ask' | 'bypass';

/** Hard cap on agent-loop iterations to prevent runaway agents. */
export const AGENT_LOOP_MAX_ITERATIONS = 25;

export interface AgentLoopOptions {
  tools?: OpenAITool[];
  toolChoice?: 'auto' | 'none';
  permissionMode?: AgentPermissionMode;
  /** Override the streamer (mainly for tests). */
  streamer?: typeof streamOpenAI;
  /** Called on every streamed chunk so the UI can render progressively. */
  onChunk?: (chunk: StreamChunk) => void;
  signal?: AbortSignal;
}

export interface AgentLoopResult {
  /** Full message history including tool results, ready to persist. */
  messages: ChatMessage[];
  /** Final assistant text content (last assistant turn). */
  finalContent: string;
  /** True if the iteration cap was reached. */
  hitCap: boolean;
}

/**
 * Returns a function that runs the agent loop for a given thread.
 * The loop is intentionally not a hook itself — it's a plain async function
 * so it can be awaited from the chat send handler.
 */
export function useAgentLoop() {
  const run = useCallback(
    async (
      initialMessages: ChatMessage[],
      config: AIProviderConfig,
      dispatch: ToolDispatcher,
      options: AgentLoopOptions = {}
    ): Promise<AgentLoopResult> => {
      const streamer = options.streamer ?? streamOpenAI;
      const permissionMode = options.permissionMode ?? 'bypass';
      const messages: ChatMessage[] = [...initialMessages];
      let finalContent = '';
      let hitCap = false;

      for (let iteration = 0; iteration < AGENT_LOOP_MAX_ITERATIONS; iteration += 1) {
        if (options.signal?.aborted) break;

        let assistantContent = '';
        const pendingCalls: ToolCall[] = [];

        const stream = streamer(
          messages,
          config,
          options.signal,
          options.tools && options.tools.length > 0
            ? { tools: options.tools, toolChoice: options.toolChoice ?? 'auto' }
            : undefined
        );

        for await (const chunk of stream) {
          if (options.signal?.aborted) break;
          options.onChunk?.(chunk);
          if (chunk.content) assistantContent += chunk.content;
          if (chunk.toolCallReady) pendingCalls.push(...chunk.toolCallReady.calls);
        }

        if (options.signal?.aborted) break;

        finalContent = assistantContent;

        // No tool calls → assistant is done.
        if (pendingCalls.length === 0) break;

        // Record the assistant message (with tool_calls) for the next turn.
        messages.push({
          role: 'assistant',
          content: assistantContent,
        } as ChatMessage);

        // Dispatch each tool call and collect results.
        for (const call of pendingCalls) {
          const result = await dispatch(call, permissionMode);
          messages.push({
            role: 'tool',
            content: result.content,
            // OpenAI requires the tool_call_id on tool messages; we stash it
            // on the content envelope via a custom field the service reads.
            ...({ toolCallId: result.toolCallId } as object),
          } as ChatMessage);
          if (result.isError) {
            // Halt the loop on a rejected/errored tool call.
            hitCap = iteration + 1 >= AGENT_LOOP_MAX_ITERATIONS;
            return { messages, finalContent, hitCap };
          }
        }
      }

      if (
        messages.filter((m) => m.role === 'assistant').length >=
        AGENT_LOOP_MAX_ITERATIONS
      ) {
        hitCap = true;
      }

      return { messages, finalContent, hitCap };
    },
    []
  );

  return { runAgentLoop: run };
}
