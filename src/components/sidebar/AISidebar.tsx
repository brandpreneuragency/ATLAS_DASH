import type { Editor } from '@tiptap/react';
import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ChatThread } from './ChatThread';
import { ChatInput } from './ChatInput';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useChatStore } from '../../stores/chatStore';

interface AISidebarProps {
  documentId: string | null;
  editor: Editor | null;
}

export function AISidebar({ documentId, editor }: AISidebarProps) {
  const { t } = useTranslation();
  const { loadMessages, clearMessages } = useChatStore();
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (documentId) loadMessages(documentId);
  }, [documentId, loadMessages]);

  if (!documentId) return null;

  return (
    <div className="flex flex-col h-full w-full pt-0 pl-0 pr-0 bg-[#f0f0f0]">
      <button
        type="button"
        onClick={() => setConfirmClear(true)}
        className="flex-shrink-0 self-end flex items-center gap-1 px-5 py-1 text-[12px] text-text-secondary hover:text-brand transition-colors"
      >
        <Trash2 size={11} />
        {t('clearChat.label')}
      </button>
      {confirmClear && (
        <ConfirmDialog
          message={t('clearChat.confirmMessage')}
          confirmLabel={t('clearChat.confirmLabel')}
          onConfirm={() => { clearMessages(documentId); setConfirmClear(false); }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
      <ChatThread documentId={documentId} editor={editor} />
      <ChatInput documentId={documentId} />
    </div>
  );
}
