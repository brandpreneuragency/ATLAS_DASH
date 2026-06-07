import { List, Calendar, Folder } from 'lucide-react';

export type ViewTab = 'list' | 'calendar' | 'projects';

interface TaskListHeaderProps {
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
}

const tabs: { key: ViewTab; icon: typeof List; label: string }[] = [
  { key: 'list', icon: List, label: 'List' },
  { key: 'calendar', icon: Calendar, label: 'Calendar' },
  { key: 'projects', icon: Folder, label: 'Projects' },
];

export function TaskListHeader({ activeTab, onTabChange }: TaskListHeaderProps) {
  return (
    <div
      id="task-list-header"
      style={{
        display: 'flex',
        height: '36px',
        background: 'var(--left-bg)',
        borderBottom: 'none',
        borderImage: 'none',
      }}
    >
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = t.key === activeTab;
        return (
          <button
            key={t.key}
            type="button"
            title={t.label}
            onClick={() => onTabChange(t.key)}
            className={isActive ? 'task-list-header-tab task-list-header-tab--active' : 'task-list-header-tab'}
            style={{
              flex: 1,
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRight: 'none',
              borderImage: 'none',
              borderRadius: 0,
              background: isActive ? 'var(--c-background-2)' : 'var(--c-background-3)',
              cursor: 'pointer',
              fontSize: 'var(--fs-xs)',
            }}
          >
            <Icon size={15} />
          </button>
        );
      })}
    </div>
  );
}
