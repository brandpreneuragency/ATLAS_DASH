import { Clock, Plus, X, ArrowLeftRight } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useUIStore, selectCanSwapPanels } from '../../stores/uiStore';
import { useDocumentStore } from '../../stores/documentStore';
import { ContextWindowPanel, ContextWindowSummaryTooltip, ContextWindowRing } from '../contextWindow';

interface RightPanelSubheaderProps {
  /**
   * Optional override for the chat mode. When `undefined`, the subheader
   * derives the mode from the global UI store (task mode -> 'task',
   * otherwise 'writer'). Settings sub-tabs should pass `mode: 'writer'`.
   */
  mode?: 'writer' | 'task';
  /** Optional override for the document context (when not in task mode). */
  documentId?: string | null;
  /** Optional override for the task context (task mode). */
  taskId?: string | null;
  /** Optional Settings sub-tab id — when set, threads are scoped per tab. */
  settingsTab?: string | null;
  /**
   * Hide the "Move AI panel" swap button. Defaults to false. Settings
   * sub-tabs pass `true` because the chat lives inside a fixed 3-column
   * page template, not the main-row swap container.
   */
  hideSwapButton?: boolean;
}

export function RightPanelSubheader({
  mode: modeOverride,
  documentId: documentIdOverride,
  taskId: taskIdOverride,
  settingsTab,
  hideSwapButton = false,
}: RightPanelSubheaderProps = {}) {
  const { threads, newChat, selectThread, deleteThread, activeThreadId } = useChatStore();
  const {
    taskMode,
    activeTaskId,
    panelsSwapped,
    setPanelsSwapped,
    aiSidebarOpen,
    contextWindowOpen,
    setContextWindowOpen,
  } = useUIStore();
  const canSwapPanels = useUIStore(selectCanSwapPanels);
  const layoutSwapped = canSwapPanels && panelsSwapped && !settingsTab;
  const { activeDocumentId } = useDocumentStore();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [contextSummaryOpen, setContextSummaryOpen] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const contextWindowRef = useRef<HTMLDivElement>(null);

  // Resolve the active chat context. Props take precedence so this
  // subheader can be mounted under a Settings sub-tab without the global
  // uiStore knowing about the settings context.
  const mode: 'writer' | 'task' = modeOverride ?? (taskMode ? 'task' : 'writer');
  const contextDocId = taskIdOverride
    ? null
    : documentIdOverride !== undefined
    ? documentIdOverride
    : taskMode
    ? null
    : activeDocumentId;
  const contextTaskId = taskIdOverride !== undefined
    ? taskIdOverride
    : taskMode
    ? activeTaskId
    : null;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setHistoryOpen(false);
      }
      if (contextWindowRef.current && !contextWindowRef.current.contains(e.target as Node)) {
        setContextSummaryOpen(false);
        setContextWindowOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [setContextWindowOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setHistoryOpen(false);
        setContextSummaryOpen(false);
        setContextWindowOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [setContextWindowOpen]);

  const handleNewChat = async () => {
    await newChat({
      mode,
      documentId: contextDocId || undefined,
      taskId: contextTaskId || undefined,
      settingsTab: settingsTab || undefined,
    });
    setHistoryOpen(false);
  };

  const handleSelectThread = async (threadId: string) => {
    await selectThread(threadId);
    setHistoryOpen(false);
  };

  const toggleContextWindow = () => {
    setHistoryOpen(false);
    setContextSummaryOpen(false);
    setContextWindowOpen(!contextWindowOpen);
  };

  const renderContextButton = (align: 'left' | 'right') => (
    <div
      ref={contextWindowRef}
      className="context-window-trigger"
      data-align={align}
      onMouseEnter={() => {
        if (!contextWindowOpen) {
          setContextSummaryOpen(true);
        }
      }}
      onMouseLeave={() => setContextSummaryOpen(false)}
    >
      <button
        type="button"
        className={`tbar-btn ${contextWindowOpen ? 'tbar-btn--on' : ''}`}
        onClick={toggleContextWindow}
        title="Context window"
        aria-label="Context window"
        aria-haspopup="dialog"
        aria-expanded={contextWindowOpen ? 'true' : 'false'}
      >
        <ContextWindowRing size={18} />
      </button>
      {contextSummaryOpen && !contextWindowOpen && <ContextWindowSummaryTooltip />}
      {contextWindowOpen && (
        <div className="context-window-dropdown" role="dialog" aria-label="Context window">
          <ContextWindowPanel />
        </div>
      )}
    </div>
  );

  const renderHistoryControls = () => (
    <div
      ref={historyRef}
      className="right-panel-subheader-actions"
      data-align={layoutSwapped ? 'left' : 'right'}
    >
      <button
        type="button"
        className="tbar-btn"
        onClick={() => {
          setContextSummaryOpen(false);
          setContextWindowOpen(false);
          setHistoryOpen((v) => !v);
        }}
        title="Chat history"
      >
        <Clock size={12} />
      </button>
      <button
        type="button"
        className="tbar-btn"
        onClick={handleNewChat}
        title="New chat"
      >
        <Plus size={12} />
      </button>
      {historyOpen && (
        <div className="chat-history-dropdown">
          {threads.length === 0 && (
            <div className="chat-history-empty subtle">No chats yet</div>
          )}
          {threads.map((thread) => (
            <div
              key={thread.id}
              className={`chat-history-item ${thread.id === activeThreadId ? 'active' : ''}`}
              onClick={() => handleSelectThread(thread.id)}
            >
              <span className="trunc">{thread.title}</span>
              <button
                type="button"
                className="chat-history-delete"
                title="Delete chat"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteThread(thread.id);
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div id="right-panel-subheader" className="right-panel-subheader">
      {!layoutSwapped ? (
        // Normal: AI sidebar on right panel
        <>
          <div className="editor-topbar-col justify-start">
            {canSwapPanels && aiSidebarOpen && !hideSwapButton && (
              <button
                type="button"
                className="tbar-btn"
                onClick={() => setPanelsSwapped(true)}
                title="Move AI panel to center"
                aria-label="Move AI panel to center"
              >
                <ArrowLeftRight size={12} />
              </button>
            )}
            {renderContextButton('left')}
          </div>
          <div className="editor-topbar-col justify-end">
            {renderHistoryControls()}
          </div>
        </>
      ) : (
        // Swapped: AI sidebar on center panel (left side) — doc mode only
        <>
          <div className="editor-topbar-col justify-start">
            {renderHistoryControls()}
          </div>
          <div className="editor-topbar-col justify-end">
            {renderContextButton('right')}
            {aiSidebarOpen && !hideSwapButton && (
              <button
                type="button"
                className="tbar-btn"
                onClick={() => setPanelsSwapped(false)}
                title="Move AI panel to right"
                aria-label="Move AI panel to right"
              >
                <ArrowLeftRight size={12} />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
