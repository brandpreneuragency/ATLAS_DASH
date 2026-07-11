import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatMessage } from '../../types';
import { formatRelativeTime } from '../../utils/timeFormat';
import { ChatBubbleContextMenu } from './ChatBubbleContextMenu';
import { useChatStore } from '../../stores/chatStore';

interface UserMessageProps {
  message: ChatMessage;
  onReplyMessage?: (msg: ChatMessage) => void;
}

export function UserMessage({ message, onReplyMessage }: UserMessageProps) {
  const { t } = useTranslation();
  const deleteMessage = useChatStore((s) => s.deleteMessage);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleDelete = () => {
    deleteMessage(message.id);
  };

  const scrollToMessage = (id: string) => {
    const el = document.querySelector(`[data-message-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div data-message-id={message.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
      {message.replyTo && (
        <div
          onClick={() => scrollToMessage(message.replyTo!.id)}
          style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: 8,
            background: 'var(--c-background-4)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 'var(--fs-base)',
            border: '1px solid var(--c-border-1)',
            maxWidth: '80%',
            cursor: 'pointer',
          }}
        >
          <div style={{ width: 3, borderRadius: 2, background: 'var(--c-accent-center-panel)', flexShrink: 0 }} />
          <div style={{ overflow: 'hidden', minWidth: 0 }}>
            <div className="semibold" style={{ fontSize: 'var(--fs-base)', color: 'var(--c-accent-center-panel)', marginBottom: 2 }}>
              {message.replyTo.sender}
            </div>
            <div className="subtle trunc" style={{ fontSize: 'var(--fs-base)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {message.replyTo.content}
            </div>
          </div>
        </div>
      )}
      {message.selectedText && (
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--c-text-2)', background: 'var(--c-background-4)', borderRadius: 6, padding: '8px 12px', border: '1px solid var(--c-border-1)' }}>
          <span className="semibold">{t('chat.context')} </span>
          <span className="italic subtle" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{message.selectedText}</span>
        </div>
      )}
      {message.attachments && message.attachments.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {message.attachments.map((att, i) => (
            <img
              key={i}
              src={att.dataUrl}
              alt={att.name}
              style={{ height: 80, maxWidth: '100%', borderRadius: 8, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)' }}
            />
          ))}
        </div>
      )}
      <div
        className="user-message-bubble"
        onContextMenu={handleContextMenu}
        style={{
          border: '1px solid var(--layout-border)',
          background: 'var(--c-background-2)',
          borderRadius: 8,
          padding: '12px 16px',
          fontSize: 'var(--fs-base)',
          wordBreak: 'break-word',
          overflow: 'hidden',
          cursor: 'context-menu',
          alignSelf: 'flex-end',
          maxWidth: '85%',
        }}
      >
        {message.content}
      </div>
      <div className="subtle" style={{ fontSize: 'var(--fs-base)', textAlign: 'right', paddingRight: 4 }}>
        {formatRelativeTime(message.timestamp)}
      </div>

      {contextMenu && (
        <ChatBubbleContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onReply={() => onReplyMessage?.(message)}
          onDelete={handleDelete}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
