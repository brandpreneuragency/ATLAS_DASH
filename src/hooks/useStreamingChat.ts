// Streaming chat hook. Server-backed as of Agent 6 (Frontend AI
// Migration).
//
// The browser web build now goes through the backend for both writer
// mode streaming (`aiRepository.streamChat()`) and task mode draft
// planning (`aiRepository.planTaskDraft()`). The Tauri-only call sites
// (`services/ai/router`, `services/search`, `services/taskAIPlanner`)
// are still importable for the dormant desktop build but the hook
// no longer invokes them in the web build.
//
// Search: the hook calls `aiRepository.searchWeb()` which is a server
// endpoint, so the user's search-config keys are not exposed to the
// browser.
//
// Task-AI flow: the draft is planned server-side, then applied through
// `useTaskAIStore.applyDraft`. Apply / undo are transactional on the
// server.

import { useCallback, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useAIStore } from '../stores/aiStore';
import { useTaskStore } from '../stores/taskStore';
import { useTaskCommentStore } from '../stores/taskCommentStore';
import { useProjectStore } from '../stores/projectStore';
import { aiRepository, type TaskDraftContext, type StreamMessage as AiStreamMessage, type StreamContentPart } from '../repositories/aiRepository';
import { getWriterInstructions, getTaskInstructions } from '../services/instructionFiles';
import { buildTaskAIContext } from '../services/taskAIContext';
import type { ChatMessage as AppChatMessage, Attachment } from '../types';

function shortId() {
  return Math.random().toString(36).slice(2, 10);
}

export function useStreamingChat(
  threadId: string,
  mode: 'writer' | 'task',
  contextDocumentId?: string,
  contextTaskId?: string,
) {
  const {
    addMessage,
    updateMessage,
    setStreamingMessageId,
    setIsStreaming,
    getActiveThreadMessages,
  } = useChatStore();
  const { getActiveAgent, getActiveProvider } = useAIStore();
  const systemInstructions = useAIStore((state) => state.systemInstructions);
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

      const agent = getActiveAgent(mode);

      const userMessage: AppChatMessage = {
        id: shortId(),
        threadId,
        mode,
        documentId: contextDocumentId || undefined,
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
          const { results } = await aiRepository.searchWeb(userText.trim(), 5, abortRef.current?.signal);
          if (results.length > 0) {
            webSearchText = formatServerSearchResultsForAI(results);
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
        threadId,
        mode,
        documentId: contextDocumentId || undefined,
        taskId: contextTaskId || undefined,
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
          const context = buildTaskAIContext(activeTask, subtasks, comments);
          const validProjectIds = Array.from(
            new Set(useProjectStore.getState().projects.map((project) => project.id)),
          );

          const draftContext: TaskDraftContext = {
            task: {
              id: activeTask.id,
              title: activeTask.title,
              status: activeTask.status,
              importance: activeTask.importance,
              date: activeTask.date,
              projectId: activeTask.projectId ?? null,
              assignees: activeTask.assignees ?? [],
              content: activeTask.content ?? '',
              updatedAt: activeTask.updatedAt,
            },
            subtasks: subtasks.map((subtask) => ({
              id: subtask.id,
              title: subtask.title,
              status: subtask.status,
              date: subtask.date,
              updatedAt: subtask.updatedAt,
            })),
            comments: comments.map((comment) => ({
              id: comment.id,
              text: comment.text ?? '',
              createdAt: comment.createdAt,
              attachmentName: comment.attachmentName ?? null,
              attachmentSize: comment.attachmentSize ?? null,
            })),
            baselineUpdatedAt: context.baselineUpdatedAt,
            text: context.text,
          };

          const { draft } = await aiRepository.planTaskDraft({
            providerId: provider.id,
            systemPrompt: parts.join('\n\n'),
            userText,
            context: draftContext,
            validProjectIds,
            searchResultsText: webSearchText,
          });

          await updateMessage(assistantMessage.id, {
            content: draft.assistantMessage,
            taskDraft: draft,
            taskDraftStatus: draft.validation.errors.length > 0 ? 'invalid' : 'draft',
          });
          return;
        }

        const basePrompt = parts.join('\n\n');
        const aiMessages: AiStreamMessage[] = [
          { role: 'system', content: basePrompt },
          ...history.map((message) => {
            if (message.role === 'user' && message.attachments?.length) {
              const messageParts: StreamContentPart[] = [
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

        const stream = aiRepository.streamChat(
          {
            providerId: provider.id,
            systemPrompt: basePrompt,
            messages: aiMessages,
          },
          { signal },
        );

        let fullContent = '';
        for await (const event of stream.events) {
          if (event.type === 'chunk') {
            fullContent += event.chunk;
            await updateMessage(assistantMessage.id, { content: fullContent });
          } else if (event.type === 'error') {
            throw new Error(event.message);
          } else {
            // done
            break;
          }
        }

        let suggestedText: string | undefined;
        if (selectedText) {
          const quoteMatch = fullContent.match(/["“]([^"”]+)["”]/);
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
      getActiveAgent,
      getActiveProvider,
      getActiveThreadMessages,
      isTaskMode,
      systemInstructions,
      updateMessage,
      setIsStreaming,
      setStreamingMessageId,
    ],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { sendMessage, stopStreaming };
}

/** Format the server-side search results into the same text block the
 *  prompt expects. Kept as a private helper so the import surface
 *  doesn't grow. */
function formatServerSearchResultsForAI(
  results: { title: string; url: string; snippet: string }[],
): string {
  if (results.length === 0) return '[No web search results found]';
  return results
    .map((r, i) => `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.snippet}`)
    .join('\n\n');
}
