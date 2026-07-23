import { Bot, FileText, Users, CalendarCheck, FolderOpen, Settings as SettingsIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AREA_DEFS, areaFromPathname, type Area } from '../../types/areas';

const AREA_ICONS: Record<Area, LucideIcon> = {
  agent: Bot,
  work: FileText,
  clients: Users,
  today: CalendarCheck,
  files: FolderOpen,
  settings: SettingsIcon,
};

/**
 * The persistent six-area switcher (M2 map "Header shell"): Agent, Work,
 * Clients, Today, Files, Settings — exactly six, no seventh destination.
 * The active area is derived from the URL so the switcher and the browser's
 * back/forward history always agree.
 */
export function AreaSwitcher() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeArea = areaFromPathname(location.pathname);

  return (
    <nav aria-label="Areas" className="area-switcher">
      {AREA_DEFS.map(({ key, label, path }) => {
        const Icon = AREA_ICONS[key];
        const isActive = key === activeArea;
        return (
          <button
            key={key}
            type="button"
            id={`area-switch-${key}`}
            aria-current={isActive ? 'page' : undefined}
            className={`area-switch-btn${isActive ? ' area-switch-btn--active' : ''}`}
            onClick={() => navigate(path)}
            title={label}
          >
            <Icon size={14} aria-hidden />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
