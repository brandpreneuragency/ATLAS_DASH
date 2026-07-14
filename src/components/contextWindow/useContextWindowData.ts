import { useMemo } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useAIStore } from '../../stores/aiStore';
import { estimateTokens, parseContextLength } from '../../utils/tokens';
import type { ChatMessage } from '../../types';

export interface ContextWindowStats {
  userMessages: number;
  assistantMessages: number;
  totalMessages: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  userTokens: number;
  assistantTokens: number;
  toolCallsTokens: number;
  otherTokens: number;
  hasProviderUsage: boolean;
}

export function formatContextNumber(n: number): string {
  return n.toLocaleString();
}

export function aggregateContextMessages(messages: ChatMessage[]): ContextWindowStats {
  let userTokens = 0;
  let assistantTokens = 0;
  const toolCallsTokens = 0;
  let otherTokens = 0;

  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let reasoningTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;

  let userMessages = 0;
  let assistantMessages = 0;
  let hasProviderUsage = false;

  for (const message of messages) {
    if (message.role === 'user') {
      userMessages += 1;
      const estimated = message.usage?.promptTokens ?? estimateTokens(message.content);
      userTokens += estimated;
      if (message.usage?.promptTokens) {
        promptTokens += message.usage.promptTokens;
      }
    } else {
      assistantMessages += 1;
      const estimated = message.usage?.completionTokens ?? estimateTokens(message.content);
      assistantTokens += estimated;
      if (message.usage) {
        if (message.usage.promptTokens) promptTokens += message.usage.promptTokens;
        if (message.usage.completionTokens) completionTokens += message.usage.completionTokens;
        if (message.usage.totalTokens) totalTokens += message.usage.totalTokens;
        if (message.usage.reasoningTokens) reasoningTokens += message.usage.reasoningTokens;
        if (message.usage.cacheReadTokens) cacheReadTokens += message.usage.cacheReadTokens;
        if (message.usage.cacheWriteTokens) cacheWriteTokens += message.usage.cacheWriteTokens;
        if (
          message.usage.promptTokens != null ||
          message.usage.completionTokens != null ||
          message.usage.totalTokens != null
        ) {
          hasProviderUsage = true;
        }
      }
    }
  }

  otherTokens = reasoningTokens + cacheReadTokens + cacheWriteTokens;

  if (!hasProviderUsage) {
    promptTokens = userTokens;
    completionTokens = assistantTokens;
  }

  const computedTotal = hasProviderUsage
    ? totalTokens || promptTokens + completionTokens + otherTokens
    : userTokens + assistantTokens + otherTokens;

  return {
    userMessages,
    assistantMessages,
    totalMessages: messages.length,
    promptTokens,
    completionTokens,
    totalTokens: computedTotal,
    reasoningTokens,
    cacheReadTokens,
    cacheWriteTokens,
    userTokens,
    assistantTokens,
    toolCallsTokens,
    otherTokens,
    hasProviderUsage,
  };
}

export function useContextWindowData() {
  const { threads, activeThreadId, messagesByThread } = useChatStore();
  const provider = useAIStore((state) => state.getActiveProvider());

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [threads, activeThreadId],
  );
  const messages = useMemo(
    () => messagesByThread[activeThreadId ?? ''] ?? [],
    [messagesByThread, activeThreadId],
  );
  const stats = useMemo(() => aggregateContextMessages(messages), [messages]);

  const activeModel = provider?.models?.find((model) => model.id === provider.selectedModel);
  const contextLimit = parseContextLength(activeModel?.capabilities?.contextLength);
  const usagePercent =
    contextLimit && contextLimit > 0
      ? Math.min(100, Math.round((stats.totalTokens / contextLimit) * 100))
      : null;

  return {
    activeModel,
    activeThread,
    contextLimit,
    provider,
    stats,
    usagePercent,
  };
}
