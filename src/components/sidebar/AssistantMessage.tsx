import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatMessage } from '../../types';
import type { Editor } from '@tiptap/react';
import { formatRelativeTime } from '../../utils/timeFormat';

interface AssistantMessageProps {
  message: ChatMessage;
  isStreaming?: boolean;
  editor: Editor | null;
}

export function AssistantMessage({ message, isStreaming, editor }: AssistantMessageProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyChange = () => {
    if (!editor || !message.suggestedText) return;
    const from = message.selectionFrom;
    const to = message.selectionTo;
    if (from !== undefined && to !== undefined) {
      editor.chain().focus().setTextSelection({ from, to }).insertContent(message.suggestedText).run();
    } else {
      editor.chain().focus().insertContent(message.suggestedText).run();
    }
  };

  const renderContent = () => {
    const content = message.content;
    if (!content) return null;

    const parts: { type: 'text' | 'suggestion'; content: string }[] = [];
    const quoteRegex = /[""]([^""]+)[""]/g;
    let lastIndex = 0;
    let match;

    while ((match = quoteRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
      }
      parts.push({ type: 'suggestion', content: match[1] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) {
      parts.push({ type: 'text', content: content.slice(lastIndex) });
    }

    if (parts.length === 1 && parts[0].type === 'text') {
      return (
        <p className={`text-[12px] text-text-primary leading-relaxed whitespace-pre-wrap break-words ${isStreaming ? 'streaming-cursor' : ''}`}>
          {content}
        </p>
      );
    }

    return (
      <div className="space-y-2">
        {parts.map((part, i) =>
          part.type === 'suggestion' ? (
            <div key={i} className="border-l-4 border-[#d4441a] pl-3 py-1 bg-[#5c1805]/30 rounded-r-md">
              <div className="text-[9px] font-bold tracking-widest text-[#f97316] uppercase mb-1">{t('assistant.revisedVersion')}</div>
              <p className="text-[12px] text-text-primary italic leading-relaxed">{part.content}</p>
            </div>
          ) : (
            <p key={i} className="text-[12px] text-text-primary leading-relaxed whitespace-pre-wrap break-words">
              {part.content}
            </p>
          )
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* Content card */}
      <div className="bg-white border border-border rounded-xl px-4 py-3 shadow-sm break-words overflow-hidden">
        {renderContent()}

        {/* Suggestion block if suggestedText is extracted */}
        {message.suggestedText && !isStreaming && (
          <div className="mt-3 border-l-4 border-[#d4441a] pl-3 py-2 bg-[#5c1805]/30 rounded-r-md">
            <div className="text-[9px] font-bold tracking-widest text-[#f97316] uppercase mb-1">{t('assistant.revisedVersion')}</div>
            <p className="text-[12px] text-text-primary italic leading-relaxed">
              {message.suggestedText}
            </p>
          </div>
        )}

        {/* Action buttons */}
        {!isStreaming && message.content && (
          <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border/50">
            {message.suggestedText && (
              <button
                onClick={handleApplyChange}
                className="text-xs font-bold text-orange-500 uppercase tracking-wide hover:text-orange-600 transition-colors"
              >
                {t('assistant.applyChange')}
              </button>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs font-bold text-brand uppercase tracking-wide hover:text-brand-dark transition-colors"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? t('assistant.copied') : t('assistant.copy')}
            </button>
          </div>
        )}
      </div>

      <div className="text-[10px] text-text-secondary pl-1">
        {formatRelativeTime(message.timestamp)}
      </div>
    </div>
  );
}
