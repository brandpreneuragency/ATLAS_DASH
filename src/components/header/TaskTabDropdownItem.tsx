import { CheckCircle2, Circle, Clock, X } from 'lucide-react';
import type { Task, TaskStatus } from '../../types';

const STATUS_ICONS: Record<TaskStatus, typeof Circle> = {
  pending: Circle,
  in_progress: Clock,
  completed: CheckCircle2,
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: 'var(--c-text-2)',
  in_progress: 'var(--c-info)',
  completed: 'var(--c-success)',
};

interface TaskTabDropdownItemProps {
  task: Task;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

export function TaskTabDropdownItem({
  task,
  isActive,
  onSelect,
  onClose,
}: TaskTabDropdownItemProps) {
  const StatusIcon = STATUS_ICONS[task.status];

  return (
    <div
      id={`tab-${task.id}`}
      onClick={onSelect}
      className={`tabs-dropdown-item${isActive ? ' tabs-dropdown-item--active' : ''}`}
    >
      <StatusIcon size={12} style={{ color: STATUS_COLORS[task.status] }} />
      <span className="trunc med">{task.title}</span>

      <button
        type="button"
        className="tabs-dropdown-close"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}
