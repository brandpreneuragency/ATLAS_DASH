import type { Editor } from '@tiptap/react';
import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ChatThread } from './ChatThread';
import { ChatInput } from './ChatInput';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useChatStore } from '../../stores/chatStore';
import type { ChatMessage } from '../../types';

interface AISidebarProps {
  documentId: string | null;
  taskId?: string | null;
  editor: Editor | null;
}

export function AISidebar({ documentId, taskId, editor }: AISidebarProps) {
  const { t } = useTranslation();
  const {
    activeThreadId,
    setActiveContext,
    getActiveThreadMessages,
  } = useChatStore();
  const [confirmClear, setConfirmClear] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<ChatMessage | null>(null);

  const isTaskMode = Boolean(taskId);
  const mode = isTaskMode ? 'task' : 'writer';
  const hasContext = Boolean(documentId || taskId);

  // Auto-swap on context change: when documentId/taskId changes, load threads for that context
  useEffect(() => {
    const context = taskId
      ? { taskId }
      : documentId
      ? { documentId }
      : null;
    if (context) {
      setActiveContext(context);
    }
  }, [documentId, taskId, setActiveContext]);

  // Empty state: no active thread or thread has no messages
  const activeMessages = getActiveThreadMessages();
  const showEmptyState = !activeThreadId || activeMessages.length === 0;

  return (
    <div
      id="ai-sidebar"
      className="panel flex flex-col h-full w-full overflow-h"
      style={{
        background: 'rgba(233, 233, 233, 0)',
        borderStyle: 'none',
        borderWidth: '0px',
        borderColor: 'rgba(0, 0, 0, 0)',
        borderImage: 'none',
      }}
    >
      {confirmClear && (
        <ConfirmDialog
          message={t('clearChat.confirmMessage')}
          confirmLabel={t('clearChat.confirmLabel')}
          onConfirm={() => {
            setConfirmClear(false);
          }}
          onCancel={() => setConfirmClear(false)}
        />
      )}

      {!hasContext ? (
        <div id="chat-empty-state" className="panel-body empty-state chat-empty-state">
          <div className="chat-empty-state-icon">
            <Clock size={32} />
          </div>
          <p className="chat-empty-state-title">AI sidebar is ready</p>
          <p className="chat-empty-state-subtitle subtle">
            Open a document or task to start a contextual chat.
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="panel-body ai-scroll-host flex-1 min-h-0" style={{ paddingLeft: 18, paddingRight: 18 }}>
            {showEmptyState ? (
              <div id="chat-empty-state" className="panel-body empty-state chat-empty-state h-full">
                <div className="chat-empty-state-icon">
                  <Clock size={32} />
                </div>
                <p className="chat-empty-state-title">Start a conversation</p>
                <p className="chat-empty-state-subtitle subtle">
                  Send a message to begin chatting about this {isTaskMode ? 'task' : 'document'}.
                </p>
              </div>
            ) : (
              <ChatThread
                documentId={documentId}
                taskId={taskId}
                editor={editor}
                onReplyMessage={setReplyToMessage}
              />
            )}
          </div>
        </div>
      )}

      {hasContext && (
        <div className="ai-sidebar-composer panel-footer">
          <ChatInput
            mode={mode}
            threadId={activeThreadId ?? ''}
            documentId={documentId}
            taskId={taskId}
            replyToMessage={replyToMessage}
            onClearReply={() => setReplyToMessage(null)}
          />
        </div>
      )}
    </div>
  );
}
