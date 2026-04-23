import { useTranslation } from 'react-i18next';
import type { ChatMessage } from '../../types';
import { formatRelativeTime } from '../../utils/timeFormat';

interface UserMessageProps {
  message: ChatMessage;
}

export function UserMessage({ message }: UserMessageProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1">
      {message.selectedText && (
        <div className="text-xs text-brand bg-brand/10 rounded-md px-3 py-2 border border-brand/20">
          <span className="font-semibold">{t('chat.context')} </span>
          <span className="italic line-clamp-2 text-text-secondary">{message.selectedText}</span>
        </div>
      )}
      {message.attachments && message.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {message.attachments.map((att, i) => (
            <img
              key={i}
              src={att.dataUrl}
              alt={att.name}
              className="h-20 max-w-full rounded-lg object-cover border border-white/20"
            />
          ))}
        </div>
      )}
      <div className="bg-brand rounded-2xl rounded-tr-sm px-4 py-3 text-[12px] text-white shadow-sm break-words overflow-hidden">
        {message.content}
      </div>
      <div className="text-[10px] text-text-secondary text-right pr-1">
        {formatRelativeTime(message.timestamp)}
      </div>
    </div>
  );
}
