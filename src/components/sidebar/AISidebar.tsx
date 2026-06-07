import type { Editor } from '@tiptap/react';
import { useState, useEffect, useRef } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ChatThread } from './ChatThread';
import { ChatInput } from './ChatInput';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useChatStore } from '../../stores/chatStore';
import { useAIStore } from '../../stores/aiStore';
import { useUIStore } from '../../stores/uiStore';
import type { ChatMessage } from '../../types';

interface AISidebarProps {
  documentId: string | null;
  taskId?: string | null;
  editor: Editor | null;
}

export function AISidebar({ documentId, taskId, editor }: AISidebarProps) {
  const { t } = useTranslation();
  const { threads, loadThreads, newChat, selectThread, activeThreadId } = useChatStore();
  const [confirmClear, setConfirmClear] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<ChatMessage | null>(null);
  const [historyDropdownOpen, setHistoryDropdownOpen] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  const isTaskMode = Boolean(taskId);
  const mode = isTaskMode ? 'task' : 'writer';

  // Model and agent dropdowns
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const modelRef = useRef<HTMLDivElement>(null);
  const agentRef = useRef<HTMLDivElement>(null);

  const {
    getAgentsByScope,
    activeAgentId,
    activeTaskAgentId,
    setActiveAgent,
    getActiveAgent,
    providerConfigs,
    activeProviderId,
    setActiveProvider,
  } = useAIStore();
  const { setActiveModal } = useUIStore();

  const scopedAgents = getAgentsByScope(mode);
  const activeScopedId = mode === 'task' ? activeTaskAgentId : activeAgentId;
  const activeProfile = getActiveAgent(mode);
  const activeConfig = providerConfigs.find((config) => config.id === activeProviderId);
  const modelLabel = activeConfig ? activeConfig.selectedModel : t('sidebar.noModel');

  useEffect(() => {
    loadThreads(mode);
  }, [mode, loadThreads]);

  // Load the first thread if none is active
  useEffect(() => {
    if (!activeThreadId && threads.length > 0) {
      selectThread(threads[0].id);
    }
  }, [activeThreadId, threads, selectThread]);

  // Outside-click dismissal
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) setHistoryDropdownOpen(false);
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setModelDropdownOpen(false);
      if (agentRef.current && !agentRef.current.contains(e.target as Node)) setAgentDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleNewChat = async () => {
    await newChat(mode);
    setHistoryDropdownOpen(false);
  };

  const handleSelectThread = async (threadId: string) => {
    await selectThread(threadId);
    setHistoryDropdownOpen(false);
  };

  if (!documentId && !taskId) return null;

  return (
    <div
      id="ai-sidebar"
      className="flex flex-col h-full w-full"
      style={{
        background: 'var(--c-background-1)',
        borderStyle: 'none',
        borderWidth: '0px',
        borderColor: 'rgba(0, 0, 0, 0)',
        borderImage: 'none',
      }}
    >
      {/* Top Row: New Chat + Chat History */}
      <div
        style={{
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          background: 'var(--right-bg)',
          padding: 0,
          border: 'none',
          borderBottom: 'none',
          borderImage: 'none',
        }}
      >
        <button
          type="button"
          onClick={handleNewChat}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            width: '42px',
            height: '100%',
            padding: 0,
            border: 'none',
            borderRight: '1px solid var(--c-border-1)',
            borderRadius: 0,
            background: 'var(--c-background-2)',
            color: 'var(--c-text-1)',
            fontSize: 'var(--fs-xs)',
            cursor: 'pointer',
          }}
        >
          <Plus size={14} />
        </button>

        <div ref={historyRef} style={{ flex: 1, position: 'relative', height: '100%' }}>
          <button
            type="button"
            aria-label="Chat history"
            onClick={() => setHistoryDropdownOpen((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              height: '100%',
              padding: '0 14px',
              borderRadius: 0,
              backgroundColor: 'var(--c-background-2)',
              borderStyle: 'none',
              borderWidth: '0px',
              borderColor: 'rgba(0, 0, 0, 0)',
              borderRightColor: 'var(--c-background-2)',
              borderImage: 'none',
              color: 'var(--c-text-2)',
              fontSize: 'var(--fs-xs)',
              cursor: 'pointer',
            }}
          >
            <span className="trunc">
              {threads.find((t) => t.id === activeThreadId)?.title ?? 'Chat'}
            </span>
            <ChevronDown size={12} />
          </button>
          {historyDropdownOpen && (
            <div className="drop" style={{ left: 0, top: '100%', minWidth: 200, maxHeight: 300, overflowY: 'auto', zIndex: 50 }}>
              {threads.length === 0 && (
                <div className="subtle" style={{ padding: '8px 12px', fontSize: 'var(--fs-xs)' }}>No conversations yet</div>
              )}
              {threads.map((thread) => (
                <button
                  type="button"
                  key={thread.id}
                  onClick={() => handleSelectThread(thread.id)}
                  className={`drop-item${thread.id === activeThreadId ? ' header-dropdown-item--active' : ''}`}
                  style={{ fontSize: 'var(--fs-xs)' }}
                >
                  <span className="trunc">{thread.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

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

      <ChatThread
        documentId={documentId}
        taskId={taskId}
        editor={editor}
        onReplyMessage={setReplyToMessage}
      />

      <ChatInput
        mode={mode}
        threadId={activeThreadId ?? ''}
        documentId={documentId}
        taskId={taskId}
        replyToMessage={replyToMessage}
        onClearReply={() => setReplyToMessage(null)}
      />

      {/* Bottom Controls: Model + Agent */}
      <div
        style={{
          height: '32px',
          borderTop: '1px solid var(--layout-border)',
          display: 'flex',
          alignItems: 'center',
          background: 'transparent',
        }}
      >
        <div ref={modelRef} style={{ flex: 1, position: 'relative', height: '100%', display: 'flex', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => { setModelDropdownOpen((v) => !v); setAgentDropdownOpen(false); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              height: '100%',
              padding: '0 12px',
              border: 'none',
              borderRight: '1px solid var(--layout-border)',
              borderRadius: 0,
              background: 'transparent',
              color: 'var(--c-text-2)',
              fontSize: 'var(--fs-10)',
              cursor: 'pointer',
            }}
          >
            <span className="trunc">{modelLabel}</span>
            <ChevronDown size={10} />
          </button>
          {modelDropdownOpen && (
            <div className="drop" style={{ left: 0, bottom: '100%', marginBottom: 4, minWidth: 180, zIndex: 50 }}>
              {providerConfigs.length === 0 && (
                <div className="subtle" style={{ padding: '8px 12px', fontSize: 'var(--fs-xs)' }}>{t('sidebar.noProviders')}</div>
              )}
              {providerConfigs.map((config) => (
                <button
                  type="button"
                  key={config.id}
                  onClick={() => { setActiveProvider(config.id); setModelDropdownOpen(false); }}
                  className={`drop-item${config.id === activeProviderId ? ' header-dropdown-item--active' : ''}`}
                  style={{ fontSize: 'var(--fs-xs)' }}
                >
                  <span className="med">{config.selectedModel}</span>
                </button>
              ))}
              <div style={{ borderTop: '1px solid var(--c-border-1)', marginTop: 4, paddingTop: 4 }}>
                <button
                  type="button"
                  onClick={() => { setActiveModal('modelManagement'); setModelDropdownOpen(false); }}
                  className="drop-item drop-item--brand"
                >
                  {t('sidebar.manageModels')}
                </button>
              </div>
            </div>
          )}
        </div>

        <div ref={agentRef} style={{ flex: 1, position: 'relative', height: '100%', display: 'flex', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => { setAgentDropdownOpen((v) => !v); setModelDropdownOpen(false); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              height: '100%',
              padding: '0 12px',
              border: 'none',
              borderRadius: 0,
              background: 'transparent',
              color: 'var(--c-text-2)',
              fontSize: 'var(--fs-10)',
              cursor: 'pointer',
            }}
          >
            <span className="trunc">{activeProfile.name}</span>
            <ChevronDown size={10} />
          </button>
          {agentDropdownOpen && (
            <div className="drop" style={{ right: 0, bottom: '100%', marginBottom: 4, minWidth: 180, zIndex: 50 }}>
              {scopedAgents.map((agent) => (
                <button
                  type="button"
                  key={agent.id}
                  onClick={() => { setActiveAgent(agent.id, mode); setAgentDropdownOpen(false); }}
                  className={`drop-item${agent.id === activeScopedId ? ' header-dropdown-item--active' : ''}`}
                  style={{ fontSize: 'var(--fs-xs)' }}
                >
                  <span className="trunc med">{agent.name}</span>
                </button>
              ))}
              <div style={{ borderTop: '1px solid var(--c-border-1)', marginTop: 4, paddingTop: 4 }}>
                <button
                  type="button"
                  onClick={() => { setActiveModal(mode === 'task' ? 'taskProfilesManager' : 'writersManager'); setAgentDropdownOpen(false); }}
                  className="drop-item drop-item--brand"
                >
                  {mode === 'task' ? '+ Manage Task Profiles' : t('sidebar.manageWriters')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
