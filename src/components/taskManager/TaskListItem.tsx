import { useState, useCallback } from 'react';
import type { Task } from '../../types';
import { useProjectStore } from '../../stores/projectStore';
import { useLongPress } from '../../hooks/useLongPress';
import { Folder, Calendar } from 'lucide-react';
import { TaskContextMenu } from './TaskContextMenu';

interface TaskListItemProps {
  task: Task;
  isActive: boolean;
  onClick: () => void;
}

const mutedColor = { color: 'var(--c-text-2)', fontSize: 'var(--fs-xs)' } as const;
const activeMutedColor = (lightColor: string) => ({ color: lightColor, fontSize: 'var(--fs-xs)' } as const);

export function TaskListItem({ task, isActive, onClick }: TaskListItemProps) {
  const { getProjectById } = useProjectStore();
  const project = getProjectById(task.projectId);
  const activeColor = 'var(--c-accent-2)';
  const activeLightColor = 'var(--c-accent-2)';

  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const isToday = task.date === new Date().toISOString().slice(0, 10);
  const dateLabel = isToday
    ? 'Today'
    : new Date(task.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const openMenu = useCallback((x: number, y: number) => {
    setMenu({ x, y });
  }, []);

  const longPress = useLongPress({
    onLongPress: (pos) => openMenu(pos.x, pos.y),
    delay: 500,
  });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    openMenu(e.clientX, e.clientY);
  };

  return (
    <>
      <button
        onClick={onClick}
        onContextMenu={handleContextMenu}
        {...longPress}
        className="task-item"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        width: '100%',
        textAlign: 'left',
        // height is owned by src/index.css (auto, fits content)
        border: isActive ? '1px solid var(--c-background-2)' : 'none',
        borderRadius: 8,
        boxShadow: isActive ? '0px 0px 10px 0px rgba(0, 0, 0, 0.05)' : 'none',
        background: isActive ? 'var(--c-background-1)' : 'rgba(0, 0, 0, 0)',
        cursor: 'pointer',
        marginLeft: '0px',
        marginRight: '0px',
        padding: '12px 12px',
        gap: 8,
      }}
    >
      {/* Row 1: Category (left) + Due date (right) */}
      <div className="row-xs justify-between">
        <div className="flex items-center gap-1 min-w-0">
          {project ? (
            <>
              <Folder size={10} className="subtle shrink-0" style={isActive ? activeMutedColor(activeLightColor) : mutedColor} />
              <span className="meta trunc" style={isActive ? activeMutedColor(activeLightColor) : mutedColor}>{project.name}</span>
            </>
          ) : (
            <span className="meta" style={isActive ? activeMutedColor(activeLightColor) : mutedColor}>Uncategorized</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Calendar size={10} className="subtle" style={isActive ? activeMutedColor(activeLightColor) : mutedColor} />
          <span className="meta" style={isActive ? activeMutedColor(activeLightColor) : mutedColor}>{dateLabel}</span>
        </div>
      </div>

      {/* Row 2: Task title */}
      <div className="task-title trunc" style={isActive ? { color: activeColor } : undefined}>{task.title}</div>
    </button>
    {menu && (
      <TaskContextMenu
        taskId={task.id}
        x={menu.x}
        y={menu.y}
        onClose={() => setMenu(null)}
      />
    )}
    </>
  );
}
