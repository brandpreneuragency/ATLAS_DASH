import { useCallback, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useAIStore } from '../stores/aiStore';
import { useTaskStore } from '../stores/taskStore';
import { useTaskCommentStore } from '../stores/taskCommentStore';
import { streamChat } from '../services/ai/router';
import type { ChatMessage as AiChatMessage, ContentPart } from '../services/ai/types';
import { getWriterInstructions, getTaskInstructions } from '../services/instructionFiles';
import { buildTaskAIContext } from '../services/taskAIContext';
import type { ChatMessage as AppChatMessage, Attachment, MessageUsage } from '../types';
import { invokeWebSearch, formatSearchResultsAsContext } from '../services/search';
import type { AIProviderConfig } from '../types';
import { secureStorage } from '../services/secureStorage';
import { estimateTokens, estimateMessageTokens } from '../utils/tokens';

function shortId() {
  return Math.random().toString(36).slice(2, 10);
}

export function useStreamingChat(
  threadId: string,
  mode: 'writer' | 'task',
  contextDocumentId?: string,
  contextTaskId?: string,
  contextSettingsTab?: string,
) {
  const {
    addMessage,
    updateMessage,
    setStreamingMessageId,
    setIsStreaming,
    getActiveThreadMessages,
    newChat,
    activeThreadId,
  } = useChatStore();
  const { getActiveAgent, getActiveProvider } = useAIStore();
  const systemInstructions = useAIStore((state) => state.systemInstructions);
  const searchConfig = useAIStore((state) => state.searchConfig);
  const abortRef = useRef<AbortController | null>(null);

  const isTaskMode = mode === 'task';

  const sendMessage = useCallback(
    async (
      userText: string,
      selectedText?: string,
      selectionFrom?: number,
      selectionTo?: number,
      attachments?: Attachment[],
      searchWeb?: boolean,
      replyTo?: { id: string; role: 'user' | 'assistant'; content: string; sender: string },
    ) => {
      const provider = getActiveProvider();
      if (!provider) {
        throw new Error('No AI provider configured. Please add an API key in Settings.');
      }

      // Provider configs never contain the persisted secret. Hydrate it from
      // secure storage and fail before sending an unauthenticated request.
      let storedKey: string | null;
      try {
        storedKey = await secureStorage.secureGet(`providerApiKey_${provider.id}`);
      } catch (error) {
        const detail = error instanceof Error ? ` ${error.message}` : '';
        throw new Error(`Could not read the saved API key for ${provider.name}.${detail}`);
      }

      const apiKey = (provider.apiKey || storedKey || '').trim();
      if (!apiKey) {
        throw new Error(
          `No saved API key was found for ${provider.name}. Open Model Management and connect the provider again.`,
        );
      }
      const resolvedProvider = { ...provider, apiKey };

      const agent = getActiveAgent(mode);

      // Ensure we have an active thread. If the caller passed an empty
      // threadId (e.g. first message in a fresh context), create one now
      // and use its id for all subsequent operations.
      // Always prefer the store's activeThreadId over the prop, since the
      // prop may be stale (captured in the hook's closure before the
      // thread was created).
      let activeThread = useChatStore.getState().activeThreadId ?? threadId;
      if (!activeThread) {
        await newChat({
          mode,
          documentId: contextDocumentId,
          taskId: contextTaskId,
          settingsTab: contextSettingsTab,
        });
        activeThread = useChatStore.getState().activeThreadId ?? '';
        if (!activeThread) {
          throw new Error('Failed to create a chat thread.');
        }
      }

      const userMessage: AppChatMessage = {
        id: shortId(),
        threadId: activeThread,
        mode,
        documentId: contextDocumentId || undefined,
        settingsTab: contextSettingsTab || undefined,
        taskId: contextTaskId || undefined,
        agentId: agent.id,
        role: 'user',
        content: userText,
        selectedText,
        selectionFrom,
        selectionTo,
        replyTo,
        attachments: attachments?.length ? attachments : undefined,
        timestamp: Date.now(),
        usage: { promptTokens: estimateMessageTokens({ content: userText, selectedText, attachments }) },
      };
      await addMessage(userMessage);

      const history = getActiveThreadMessages();
      const fileInstructions = isTaskMode ? await getTaskInstructions() : await getWriterInstructions();
      const parts: string[] = [];
      if (fileInstructions?.trim()) parts.push(fileInstructions.trim());
      if (systemInstructions.trim()) parts.push(systemInstructions.trim());
      parts.push(agent.systemPrompt);

      let webSearchText = '';
      if (searchWeb && userText.trim()) {
        try {
          const results = await invokeWebSearch(userText.trim(), {
            exaKey: searchConfig.exaKey,
            tavilyKey: searchConfig.tavilyKey,
            searchProvider: searchConfig.searchProvider,
          });
          if (results.length > 0) {
            webSearchText = formatSearchResultsAsContext(results);
          }
        } catch (error) {
          console.warn('Web search failed, continuing without results:', error);
        }
      }
      if (webSearchText) {
        parts.push(
          `[WEB SEARCH RESULTS for query: "${userText.trim()}"]\nUse these results when useful and cite sources.\n\n${webSearchText}`,
        );
      }

      const assistantMessage: AppChatMessage = {
        id: shortId(),
        threadId: activeThread,
        mode,
        documentId: contextDocumentId || undefined,
        taskId: contextTaskId || undefined,
        settingsTab: contextSettingsTab || undefined,
        agentId: agent.id,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };
      await addMessage(assistantMessage);
      setStreamingMessageId(assistantMessage.id);
      setIsStreaming(true);
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      try {
        if (isTaskMode && contextTaskId) {
          const taskStore = useTaskStore.getState();
          const activeTask = taskStore.tasks.find((task) => task.id === contextTaskId);
          if (!activeTask) {
            await updateMessage(assistantMessage.id, {
              content: 'The active task could not be found. Please reselect a task and try again.',
            });
            return;
          }

          await useTaskCommentStore.getState().loadComments(contextTaskId);
          const subtasks = taskStore.getSubtasks(contextTaskId);
          const comments = useTaskCommentStore.getState().getComments(contextTaskId);
          void buildTaskAIContext(activeTask, subtasks, comments);

          const basePrompt = parts.join('\n\n');
          const aiMessages: AiChatMessage[] = [
            { role: 'system', content: basePrompt },
            { role: 'user', content: userText },
          ];

          let fullContent = '';
          let finalUsage: MessageUsage | undefined;
          const streamGen = streamChat(
            aiMessages,
            resolvedProvider as AIProviderConfig,
            signal,
          );
          for await (const chunk of streamGen) {
            fullContent += chunk.content;
            if (chunk.usage) {
              finalUsage = chunk.usage;
              continue;
            }
            const estimated = estimateTokens(fullContent);
            await updateMessage(assistantMessage.id, {
              content: fullContent,
              usage: { completionTokens: estimated },
            });
          }

          await updateMessage(assistantMessage.id, {
            content: fullContent,
            ...(finalUsage ? { usage: finalUsage } : {}),
          });
          return;
        }

        const basePrompt = parts.join('\n\n');
        const aiMessages: AiChatMessage[] = [
          { role: 'system', content: basePrompt },
          ...history.map((message) => {
            if (message.role === 'user' && message.attachments?.length) {
              const messageParts: ContentPart[] = [
                {
                  type: 'text',
                  text: message.selectedText
                    ? `[Selected text context]:\n${message.selectedText}\n\n[User message]:\n${message.content}`
                    : message.content,
                },
              ];
              for (const attachment of message.attachments) {
                messageParts.push({ type: 'image_url', image_url: { url: attachment.dataUrl } });
              }
              return { role: message.role as 'user' | 'assistant', content: messageParts };
            }
            return {
              role: message.role as 'user' | 'assistant',
              content:
                message.role === 'user' && message.selectedText
                  ? `[Selected text context]:\n${message.selectedText}\n\n[User message]:\n${message.content}`
                  : message.content,
            };
          }),
        ];

        const streamGen = streamChat(
          aiMessages,
          resolvedProvider as AIProviderConfig,
          signal,
        );

        let fullContent = '';
        let finalUsage: MessageUsage | undefined;
        for await (const chunk of streamGen) {
          fullContent += chunk.content;
          if (chunk.usage) {
            finalUsage = chunk.usage;
            continue;
          }
          const estimated = estimateTokens(fullContent);
          await updateMessage(assistantMessage.id, {
            content: fullContent,
            usage: { completionTokens: estimated },
          });
        }

        let suggestedText: string | undefined;
        if (selectedText) {
          const quoteMatch = fullContent.match(/[""\u201C]([^""\u201D]+)[""\u201D]/);
          const blockMatch = fullContent.match(/```[\s\S]*?```/);
          if (blockMatch) {
            suggestedText = blockMatch[0]
              .replace(/```\w*\n?/, '')
              .replace(/\n?```$/, '');
          } else if (quoteMatch) {
            suggestedText = quoteMatch[1];
          }
        }

        await updateMessage(assistantMessage.id, {
          content: fullContent,
          suggestedText,
          selectionFrom,
          selectionTo,
          ...(finalUsage ? { usage: finalUsage } : {}),
        });
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') return;
        const message = error instanceof Error ? error.message : 'Unknown error';
        await updateMessage(assistantMessage.id, {
          content: `Error: ${message}`,
        });
      } finally {
        setStreamingMessageId(null);
        setIsStreaming(false);
      }
    },
    [
      addMessage,
      threadId,
      mode,
      contextDocumentId,
      contextTaskId,
      contextSettingsTab,
      getActiveAgent,
      getActiveProvider,
      getActiveThreadMessages,
      isTaskMode,
      systemInstructions,
      updateMessage,
      setIsStreaming,
      setStreamingMessageId,
      newChat,
      activeThreadId,
    ],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { sendMessage, stopStreaming };
}
