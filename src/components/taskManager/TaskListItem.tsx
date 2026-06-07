import type { Task } from '../../types';
import { useProjectStore } from '../../stores/projectStore';
import { Folder, Calendar } from 'lucide-react';

interface TaskListItemProps {
  task: Task;
  isActive: boolean;
  onClick: () => void;
}

const mutedColor = { color: 'var(--c-text-2)', fontSize: 'var(--font-fluid-12)' } as const;

export function TaskListItem({ task, isActive, onClick }: TaskListItemProps) {
  const { getProjectById } = useProjectStore();
  const project = getProjectById(task.projectId);

  const isToday = task.date === new Date().toISOString().slice(0, 10);
  const dateLabel = isToday
    ? 'Today'
    : new Date(task.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        width: '100%',
        textAlign: 'left',
        height: 'fit-content',
        border: isActive ? '1px solid var(--c-accent-center-panel)' : '1px solid var(--c-background-1)',
        borderImage: 'none',
        borderRadius: 10,
        background: isActive ? 'var(--center-bg)' : 'var(--c-background-1)',
        cursor: 'pointer',
        padding: '12px',
        gap: 6,
      }}
    >
      {/* Row 1: Category (left) + Due date (right) */}
      <div className="row-xs justify-between">
        <div className="flex items-center gap-1 min-w-0">
          {project ? (
            <>
              <Folder size={10} className="subtle shrink-0" style={mutedColor} />
              <span className="meta trunc" style={mutedColor}>{project.name}</span>
            </>
          ) : (
            <span className="meta" style={mutedColor}>Uncategorized</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Calendar size={10} className="subtle" style={mutedColor} />
          <span className="meta" style={mutedColor}>{dateLabel}</span>
        </div>
      </div>

      {/* Row 2: Task title */}
      <div className="task-title trunc">{task.title}</div>
    </button>
  );
}
