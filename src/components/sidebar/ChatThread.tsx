import { useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../stores/chatStore';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';

interface ChatThreadProps {
  documentId: string;
  editor: Editor | null;
}

export function ChatThread({ documentId, editor }: ChatThreadProps) {
  const { t } = useTranslation();
  const { getMessages, streamingMessageId, isStreaming } = useChatStore();
  const messages = getMessages(documentId);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 h-full flex items-center justify-center p-0 mx-[10px] my-0 align-middle text-xs">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full bg-highlight flex items-center justify-center mx-auto mb-3">
            <span className="text-brand text-lg">✦</span>
          </div>
          <p className="text-[12px] text-text-secondary">
            {t('chat.startConversation')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.map((msg) => (
        msg.role === 'user' ? (
          <UserMessage key={msg.id} message={msg} />
        ) : (
          <AssistantMessage
            key={msg.id}
            message={msg}
            isStreaming={msg.id === streamingMessageId}
            editor={editor}
          />
        )
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
