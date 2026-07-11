import { useLayoutEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useUIStore } from '../../stores/uiStore';
import { WorkspaceTab } from './WorkspaceTab';
import { CRM_HEADER_TABS, SETTINGS_HEADER_TABS, TASK_HEADER_TABS } from './moduleNav';
import type { CRMHeaderTab } from './moduleNav';
import type { LucideIcon } from 'lucide-react';

function ModuleHeaderTab({
  tabKey,
  label,
  icon: Icon,
  isActive,
  onClick,
}: {
  tabKey: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <div
      id={`tab-module-${isActive ? 'active' : 'passive'}-${tabKey}`}
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={`group relative justify-start min-w-0 pl-3 pr-3 ${isActive ? 'tab-active' : 'tab-passive'}`}
      title={label}
    >
      <Icon size={12} className="mr-1 flex-shrink-0" />
      <span className="txt-xs med trunc">{label}</span>
    </div>
  );
}

export function TabBar() {
  const { t } = useTranslation();
  const {
    taskMode,
    activeView,    activeSettingsSubTab,
    setActiveSettingsSubTab,
    crmMode,
    activeCRMPage,
    setActiveCRMPage,
    activeFormsPage,
    setActiveFormsPage,
    activeTaskPage,
    setActiveTaskPage,
  } = useUIStore();
  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspace,
    deleteWorkspace,
    renameWorkspace,
    createWorkspace,
  } = useWorkspaceStore();

  const tabsRowRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  // Detect overflow to switch last tab to ellipsis mode
  useLayoutEffect(() => {
    const checkOverflow = () => {      const el = tabsRowRef.current;
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
  }, [workspaces, taskMode, crmMode, activeCRMPage, activeFormsPage, activeTaskPage, activeView, activeSettingsSubTab]);

  if (!taskMode && !crmMode && activeView === 'settings') {
    return (
      <div ref={tabsRowRef} className="tabs-row" data-overflowing={isOverflowing ? 'true' : 'false'}>
        {SETTINGS_HEADER_TABS.map((item) => (
          <ModuleHeaderTab
            key={item.key}
            tabKey={item.key}
            label={item.label}
            icon={item.icon}
            isActive={item.key === activeSettingsSubTab}
            onClick={() => setActiveSettingsSubTab(item.key)}
          />
        ))}
      </div>
    );
  }

  if (taskMode) {
    return (
      <div ref={tabsRowRef} className="tabs-row" data-overflowing={isOverflowing ? 'true' : 'false'}>
        {TASK_HEADER_TABS.map((item) => (
          <ModuleHeaderTab
            key={item.key}
            tabKey={item.key}
            label={item.label}
            icon={item.icon}
            isActive={item.key === activeTaskPage}
            onClick={() => setActiveTaskPage(item.key)}
          />
        ))}
      </div>
    );
  }

  if (crmMode) {
    const isTabActive = (item: CRMHeaderTab) =>
      item.formsPage
        ? activeCRMPage === 'forms' &&
          (activeFormsPage === item.formsPage ||
            (item.alsoActiveFor?.includes(activeFormsPage) ?? false))
        : activeCRMPage === item.crmPage;
    const handleTabClick = (item: CRMHeaderTab): (() => void) => {
      if (item.formsPage) {
        const fp = item.formsPage;
        return () => {
          setActiveCRMPage('forms');
          setActiveFormsPage(fp);
        };
      }
      const cp = item.crmPage;
      return () => setActiveCRMPage(cp);
    };

    return (
      <div ref={tabsRowRef} className="tabs-row" data-overflowing={isOverflowing ? 'true' : 'false'}>
        {CRM_HEADER_TABS.map((item) => (
          <ModuleHeaderTab
            key={item.key}
            tabKey={item.key}
            label={item.label}
            icon={item.icon}
            isActive={isTabActive(item)}
            onClick={handleTabClick(item)}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={tabsRowRef}
      className="tabs-row"
      data-overflowing={isOverflowing ? 'true' : 'false'}
    >
      {workspaces.map((ws) => (
        <WorkspaceTab
          key={ws.id}
          workspace={ws}
          isActive={ws.id === activeWorkspaceId}
          onSelect={() => setActiveWorkspace(ws.id)}
          onClose={() => deleteWorkspace(ws.id)}
          onRename={(newName) => renameWorkspace(ws.id, newName)}
          charLimit={24}
          colorIndex={ws.colorIndex ?? 0}
        />
      ))}
      <button
        id="tab-plus-button"
        type="button"
        title={t('tabs.newDocument') ?? 'New workspace'}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={() => createWorkspace()}
      >
        <Plus size={12} />
      </button>
    </div>
  );
}
