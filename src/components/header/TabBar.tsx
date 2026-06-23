import { useLayoutEffect, useRef, useState } from 'react';
import { LayoutTemplate, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDocumentStore } from '../../stores/documentStore';
import { useTaskStore } from '../../stores/taskStore';
import { useUIStore } from '../../stores/uiStore';
import { Tab } from './Tab';
import { TaskTab } from './TaskTab';

export function TabBar() {
  const { t } = useTranslation();
  const { taskMode, pageMode } = useUIStore();
  const {
    documents,
    activeDocumentId,
    setActiveDocument,
    deleteDocument,
    updateDocument,
    createDocument,
  } = useDocumentStore();
  const { tasks, setActiveTab, closeTaskTab, createEmptyTab, openTaskIds, openTabs, activeTabId } = useTaskStore();

  const tabsRowRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  // openTasks derived from openTabs in store; keep for compatibility
  const openTasks = tasks.filter((task) => openTaskIds.includes(task.id));

  // Detect overflow to switch last tab to ellipsis mode
  useLayoutEffect(() => {
    if (pageMode) return;
    const checkOverflow = () => {
      const el = tabsRowRef.current;
      if (!el) return;
      setIsOverflowing(el.scrollWidth > el.clientWidth + 1);
    };
    checkOverflow();
    const ro = new ResizeObserver(checkOverflow);
    if (tabsRowRef.current) ro.observe(tabsRowRef.current);
    window.addEventListener('resize', checkOverflow);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', checkOverflow);
    };
  }, [documents, openTasks, taskMode, pageMode]);

  if (pageMode) {
    return (
      <div
        ref={tabsRowRef}
        className="tabs-row"
        data-overflowing="false"
        style={{ gap: 8, alignItems: 'center', paddingLeft: 10, paddingRight: 10 }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 32,
            padding: '0 12px',
            borderRadius: 8,
            background: 'var(--c-background-4)',
            color: 'var(--c-accent-center-panel)',
            fontSize: 'var(--fs-sm)',
            fontWeight: 600,
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
          }}
        >
          <LayoutTemplate size={12} />
          <span>Page Template</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Tabs row — left/center fill, horizontally scrollable.
          The "+" new-tab button is the last child and uses
          `position: sticky; right: 0;` so it sits right after the last
          tab when scrolled to the end, and stays pinned to the wrapper's
          right edge while the user scrolls left. */}
      <div
        ref={tabsRowRef}
        className="tabs-row"
        data-overflowing={isOverflowing ? 'true' : 'false'}
      >
        {taskMode
          ? openTabs.map((tab) => {
              const task = tab.taskId ? tasks.find((t) => t.id === tab.taskId) ?? null : null;
              return (
                <TaskTab
                  key={tab.tabId}
                  task={task}
                  isActive={tab.tabId === activeTabId}
                  onSelect={() => setActiveTab(tab.tabId)}
                  onClose={() => closeTaskTab(tab.tabId)}
                  charLimit={24}
                  colorIndex={tab.colorIndex ?? 0}
                />
              );
            })
          : documents.map((doc) => (
              <Tab
                key={doc.id}
                doc={doc}
                isActive={doc.id === activeDocumentId}
                onSelect={() => setActiveDocument(doc.id)}
                onClose={() => deleteDocument(doc.id)}
                onRename={(newTitle) => updateDocument(doc.id, { title: newTitle })}
                charLimit={24}
                colorIndex={doc.colorIndex ?? 0}
              />
            ))}
        {taskMode && (
          <button
            id="tab-plus-button-task"
            title={t('tabs.newTab') ?? 'New tab'}
            onClick={() => createEmptyTab()}
          >
            <Plus size={12} />
          </button>
        )}
        {!taskMode && (
          <button
            id="tab-plus-button"
            title={t('tabs.newDocument') ?? 'New document'}
            onClick={() => createDocument()}
          >
            <Plus size={12} />
          </button>
        )}
      </div>
    </>
  );
}
