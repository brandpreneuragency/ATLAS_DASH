import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { Task } from '../../types';
import { useProjectStore } from '../../stores/projectStore';
import { HeaderDropdown } from '../ui/HeaderDropdown';

interface TaskCalendarViewProps {
  tasks: Task[];
  onPrefillText: (text: string) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDaysInMonth(year: number, month: number): { day: number; weekday: string; dateStr: string }[] {
  const days: { day: number; weekday: string; dateStr: string }[] = [];
  const lastDay = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(year, month, d);
    const dateStr = date.toISOString().slice(0, 10);
    days.push({ day: d, weekday: WEEKDAYS[date.getDay()], dateStr });
  }
  return days;
}

export function TaskCalendarView({ tasks, onPrefillText }: TaskCalendarViewProps) {
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [filterProjectId, setFilterProjectId] = useState<string | null>(null);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const monthLabel = currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const days = useMemo(() => getDaysInMonth(year, month), [year, month]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (t.parentId) continue;
      if (filterProjectId && t.projectId !== filterProjectId) continue;
      if (!t.date) continue;
      const d = new Date(t.date);
      if (d.getMonth() !== month || d.getFullYear() !== year) continue;
      map[t.date] = map[t.date] ?? [];
      map[t.date].push(t);
    }
    return map;
  }, [tasks, filterProjectId, month, year]);

  const { projects } = useProjectStore();

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const importanceDot = (imp: string) => {
    const cls = imp === 'high' ? 'task-dot-high' : imp === 'medium' ? 'task-dot-medium' : 'task-dot-low';
    return <span className={cls} />;
  };

  return (
    <div>
      <div className="calendar-month-nav">
        <button type="button" className="calendar-month-btn" onClick={prevMonth}><ChevronLeft size={14} /></button>
        <span className="calendar-month-label">{monthLabel}</span>
        <button type="button" className="calendar-month-btn" onClick={nextMonth}><ChevronRight size={14} /></button>
      </div>

      <div className="project-filter-bar">
        <HeaderDropdown
          value={filterProjectId ?? ''}
          onChange={(next) => setFilterProjectId(next || null)}
          wrapperClassName="flex-1 min-w-0"
          options={[
            { value: '', label: 'All projects' },
            ...projects.map((p) => ({ value: p.id, label: p.name })),
          ]}
          menuClassName="header-dropdown-menu--match"
        />
      </div>

      {days.map(({ day, weekday, dateStr }) => {
        const dayTasks = tasksByDate[dateStr] ?? [];
        return (
          <div key={dateStr} className="calendar-day-card">
            <div className="calendar-day-header">
              <span className="calendar-day-title">{day} {weekday}</span>
              <button
                type="button"
                className="calendar-day-btn"
                onClick={() => onPrefillText('due:' + dateStr + ' ')}
                title="Add task on this day"
              >
                <Plus size={12} />
              </button>
            </div>
            {dayTasks.length === 0 && (
              <div className="calendar-task-row" style={{ cursor: 'default', color: 'var(--c-text-2)', fontStyle: 'italic' }}>
                No tasks
              </div>
            )}
            {dayTasks.map((t) => {
              const project = projects.find((p) => p.id === t.projectId);
              return (
                <button
                  key={t.id}
                  type="button"
                  className="calendar-task-row"
                >
                  {importanceDot(t.importance)}
                  <span className="trunc">{t.title}</span>
                  {project && <span className="calendar-task-project">{project.name}</span>}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
