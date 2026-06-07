import { useState, useMemo } from 'react';
import { useTaskStore } from '../../stores/taskStore';
import { TaskListItem } from './TaskListItem';
import { QuickCreateInput } from './QuickCreateInput';
import { TaskListHeader } from './TaskListHeader';
import type { ViewTab } from './TaskListHeader';
import { TaskCalendarView } from './TaskCalendarView';
import { TaskProjectView } from './TaskProjectView';

export function TaskListPanel() {
  const { tasks, activeTaskId, setActiveTask } = useTaskStore();
  const [activeTab, setActiveTab] = useState<ViewTab>('list');
  const [prefillText, setPrefillText] = useState<string | null>(null);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => !t.parentId);
  }, [tasks]);

  return (
    <div id="task-list-panel" className="flex-col h-full">
      <TaskListHeader activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'list' && (
        <>
          <div
            id="task-list-card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              flex: 1,
              background: 'var(--left-bg)',
            }}
          >
            <div id="task-list-content" className="ai-scroll flex-1 overflow-y-a left-scrollbar">
              {filteredTasks.length === 0 && (
                <div className="flex-col items-center justify-center py-12 text-center" style={{ padding: '0 16px' }}>
                  <p className="txt-xs subtle">No tasks yet</p>
                  <p className="label mt-1">Type below to create your first task</p>
                </div>
              )}
              {filteredTasks.map((task) => (
                <TaskListItem
                  key={task.id}
                  task={task}
                  isActive={task.id === activeTaskId}
                  onClick={() => setActiveTask(task.id)}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'calendar' && (
        <div id="task-list-card" className="card flex-col overflow-h flex-1">
          <div id="task-list-content" className="ai-scroll flex-1 overflow-y-a left-scrollbar">
            <TaskCalendarView tasks={tasks} onPrefillText={setPrefillText} />
          </div>
        </div>
      )}

      {activeTab === 'projects' && (
        <div id="task-list-card" className="card flex-col overflow-h flex-1">
          <div id="task-list-content" className="ai-scroll flex-1 overflow-y-a left-scrollbar">
            <TaskProjectView tasks={tasks} onPrefillText={setPrefillText} />
          </div>
        </div>
      )}

      <QuickCreateInput prefillText={prefillText} onClearPrefillText={() => setPrefillText(null)} />
    </div>
  );
}
