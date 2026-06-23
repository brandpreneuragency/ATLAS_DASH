import { useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../stores/chatStore';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';
import type { ChatMessage } from '../../types';

interface ChatThreadProps {
  documentId: string | null;
  taskId?: string | null;
  editor: Editor | null;
  onReplyMessage?: (msg: ChatMessage) => void;
}

export function ChatThread({ taskId, editor, onReplyMessage }: ChatThreadProps) {
  const { t } = useTranslation();
  const { getActiveThreadMessages, streamingMessageId, isStreaming } = useChatStore();
  const messages = getActiveThreadMessages();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollRef.current || !bottomRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, isStreaming]);

  if (messages.length === 0) {
    return (
      <div
        id="chat-empty-state"
        className="flex flex-1 h-full"
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 15px',
          verticalAlign: 'middle',
          fontSize: 'var(--fs-xs)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--c-background-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <span style={{ color: 'var(--c-accent-center-panel)', fontSize: 'var(--font-fluid-12)' }}>✦</span>
          </div>
          <p className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
            {taskId ? 'Ask about this task...' : t('chat.startConversation')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="scroll-ai" ref={scrollRef} className="ai-scroll flex-1 overflow-y-a flex flex-col" style={{ gap: 16 }}>
      {messages.map((msg) => (
        msg.role === 'user' ? (
          <UserMessage key={msg.id} message={msg} onReplyMessage={onReplyMessage} />
        ) : (
          <AssistantMessage
            key={msg.id}
            message={msg}
            isStreaming={msg.id === streamingMessageId}
            editor={editor}
            onReplyMessage={onReplyMessage}
          />
        )
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
