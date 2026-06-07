import { useLayoutEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDocumentStore } from '../../stores/documentStore';
import { useTaskStore } from '../../stores/taskStore';
import { useUIStore } from '../../stores/uiStore';
import { Tab } from './Tab';
import { TaskTab } from './TaskTab';

export function TabBar() {
  const { t } = useTranslation();
  const { taskMode } = useUIStore();
  const {
    documents,
    activeDocumentId,
    setActiveDocument,
    deleteDocument,
    updateDocument,
    createDocument,
  } = useDocumentStore();
  const { tasks, activeTaskId, setActiveTask, closeTaskTab, openTaskIds } = useTaskStore();

  const tabsRowRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const openTasks = tasks.filter((task) => openTaskIds.includes(task.id));

  // Detect overflow to switch last tab to ellipsis mode
  useLayoutEffect(() => {
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
  }, [documents, openTasks, taskMode]);

  return (
    <div className="tabs-dropdown-bar">
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
          ? openTasks.map((task) => (
              <TaskTab
                key={task.id}
                task={task}
                isActive={task.id === activeTaskId}
                onSelect={() => setActiveTask(task.id)}
                onClose={() => closeTaskTab(task.id)}
                charLimit={24}
              />
            ))
          : documents.map((doc) => (
              <Tab
                key={doc.id}
                doc={doc}
                isActive={doc.id === activeDocumentId}
                onSelect={() => setActiveDocument(doc.id)}
                onClose={() => deleteDocument(doc.id)}
                onRename={(newTitle) => updateDocument(doc.id, { title: newTitle })}
                charLimit={24}
              />
            ))}
        {!taskMode && (
          <button
            type="button"
            className="tbar-btn tabs-new-btn"
            onClick={() => createDocument()}
            title={t('tabs.newTab')}
          >
            <Plus size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
