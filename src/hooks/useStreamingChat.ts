import { useCallback, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useAIStore } from '../stores/aiStore';
import { streamChat } from '../services/ai/router';
import type { ChatMessage as AppChatMessage, Attachment } from '../types';
import type { ChatMessage as AIChatMessage, ContentPart } from '../services/ai/types';

function shortId() {
  return Math.random().toString(36).slice(2, 10);
}

export function useStreamingChat(documentId: string) {
  const { addMessage, updateMessage, setStreamingMessageId, setIsStreaming, getMessages } =
    useChatStore();
  const { getActiveAgent, getActiveProvider } = useAIStore();
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (
      userText: string,
      selectedText?: string,
      selectionFrom?: number,
      selectionTo?: number,
      attachments?: Attachment[]
    ) => {
      const provider = getActiveProvider();
      if (!provider) {
        throw new Error('No AI provider configured. Please add an API key in Settings.');
      }

      const agent = getActiveAgent();

      const userMsg: AppChatMessage = {
        id: shortId(),
        documentId,
        agentId: agent.id,
        role: 'user',
        content: userText,
        selectedText,
        selectionFrom,
        selectionTo,
        attachments: attachments?.length ? attachments : undefined,
        timestamp: Date.now(),
      };
      await addMessage(userMsg);

      const history = getMessages(documentId);
      const aiMessages: AIChatMessage[] = [
        { role: 'system', content: agent.systemPrompt },
        ...history.map((m) => {
          if (m.role === 'user' && m.attachments?.length) {
            const parts: ContentPart[] = [{ type: 'text', text: m.selectedText
              ? `[Selected text context]:\n${m.selectedText}\n\n[User message]:\n${m.content}`
              : m.content
            }];
            for (const att of m.attachments) {
              parts.push({ type: 'image_url', image_url: { url: att.dataUrl } });
            }
            return { role: m.role as 'user' | 'assistant', content: parts };
          }
          return {
            role: m.role as 'user' | 'assistant',
            content:
              m.role === 'user' && m.selectedText
                ? `[Selected text context]:\n${m.selectedText}\n\n[User message]:\n${m.content}`
                : m.content,
          };
        }),
      ];

      const assistantMsg: AppChatMessage = {
        id: shortId(),
        documentId,
        agentId: agent.id,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };
      await addMessage(assistantMsg);
      setStreamingMessageId(assistantMsg.id);
      setIsStreaming(true);

      abortRef.current = new AbortController();
      let fullContent = '';

      try {
        for await (const chunk of streamChat(aiMessages, provider, abortRef.current.signal)) {
          fullContent += chunk;
          await updateMessage(assistantMsg.id, { content: fullContent });
        }

        let suggestedText: string | undefined;
        if (selectedText) {
          const quoteMatch = fullContent.match(/[""]([^""]+)[""]/);
          const blockMatch = fullContent.match(/```[\s\S]*?```/);
          if (blockMatch) {
            suggestedText = blockMatch[0].replace(/```\w*\n?/, '').replace(/\n?```$/, '');
          } else if (quoteMatch) {
            suggestedText = quoteMatch[1];
          }
        }

        await updateMessage(assistantMsg.id, {
          content: fullContent,
          suggestedText,
          selectionFrom,
          selectionTo,
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        await updateMessage(assistantMsg.id, {
          content: `Error: ${errMsg}`,
        });
      } finally {
        setStreamingMessageId(null);
        setIsStreaming(false);
      }
    },
    [documentId, addMessage, updateMessage, setStreamingMessageId, setIsStreaming, getMessages, getActiveAgent, getActiveProvider]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { sendMessage, stopStreaming };
}
