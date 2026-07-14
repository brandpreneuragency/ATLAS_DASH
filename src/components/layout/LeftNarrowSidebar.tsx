import { ClipboardList, FileText, PanelLeft, Sparkles, Users, Settings as SettingsIcon } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useTheme } from '../../hooks/useTheme';

export function LeftNarrowSidebar() {
  const taskMode = useUIStore((s) => s.taskMode);
  const setTaskMode = useUIStore((s) => s.setTaskMode);
  const contextPanelOpenByMode = useUIStore((s) => s.contextPanelOpenByMode);
  const setContextPanelOpen = useUIStore((s) => s.setContextPanelOpen);
  const crmMode = useUIStore((s) => s.crmMode);
  const setCrmMode = useUIStore((s) => s.setCrmMode);
  const setActiveCRMPage = useUIStore((s) => s.setActiveCRMPage);
  const activeView = useUIStore((s) => s.activeView);
  const openSettings = useUIStore((s) => s.openSettings);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const primaryWrapperOpen = useUIStore((s) => s.primaryWrapperOpen);
  const togglePrimaryWrapper = useUIStore((s) => s.togglePrimaryWrapper);
  const { isCyberpunk, toggleTheme } = useTheme();

  const workspaceLabel = primaryWrapperOpen ? 'Hide workspace' : 'Show workspace';

  const handlePrimaryToggle = () => {
    const primaryEl = document.getElementById('primary-workspace-wrapper');
    const focusInside = Boolean(
      primaryWrapperOpen && primaryEl?.contains(document.activeElement),
    );
    togglePrimaryWrapper();
    if (focusInside) {
      requestAnimationFrame(() => {
        document.getElementById('nav-btn-toggle-panel')?.focus();
      });
    }
  };

  return (
    <div id="nav-bar" className="nav-bar">
      <div className="nav-section" style={{ paddingTop: 0, paddingBottom: 0, gap: 0, borderTop: 'none' }}>
        <button
          id="nav-btn-toggle-panel"
          type="button"
          onClick={handlePrimaryToggle}
          title={workspaceLabel}
          aria-label={workspaceLabel}
          aria-pressed={primaryWrapperOpen}
          className={`nav-btn${primaryWrapperOpen ? ' nav-btn--on' : ''}`}
        >
          <PanelLeft size={15} />
        </button>
      </div>

      <div className="nav-section" style={{ width: 'fit-content', gap: 6, paddingTop: 10, paddingBottom: 10, borderTop: 'none' }}>
        <button
          id="nav-btn-documents"
          type="button"
          onClick={() => {
            setTaskMode(false);
            setCrmMode(false);
            setActiveView('document');
            // Mode entry: primary is ensured by setActiveView; open file tree if closed (UX).
            if (!contextPanelOpenByMode.documents) {
              setContextPanelOpen('documents', true);
            }
          }}
          title="Documents"
          className={`mode-btn${!taskMode && !crmMode && activeView !== 'settings' ? ' mode-btn--on' : ''}`}
        >
          <FileText size={15} />
        </button>

        <button
          id="nav-btn-tasks"
          type="button"
          onClick={() => {
            // setTaskMode ensures primaryWrapperOpen; open task list if closed (UX).
            setTaskMode(true);
            if (!contextPanelOpenByMode.tasks) {
              setContextPanelOpen('tasks', true);
            }
          }}
          title="Tasks"
          className={`mode-btn${taskMode ? ' mode-btn--on' : ''}`}
        >
          <ClipboardList size={15} />
        </button>

        <button
          id="nav-btn-crm"
          type="button"
          onClick={() => {
            setActiveCRMPage('leads');
            // setCrmMode ensures primaryWrapperOpen; preserves assistant/swap/widths.
            setCrmMode(true);
          }}
          title="CRM"
          className={`mode-btn${crmMode ? ' mode-btn--on' : ''}`}
        >
          <Users size={15} />
        </button>

        <button
          id="nav-btn-settings"
          type="button"
          onClick={() => {
            setTaskMode(false);
            setCrmMode(false);
            if (!taskMode && !crmMode && activeView === 'settings') {
              setActiveView('document');
            } else {
              // openSettings ensures primaryWrapperOpen.
              openSettings();
            }
          }}
          title="Settings"
          className={`mode-btn${!taskMode && !crmMode && activeView === 'settings' ? ' mode-btn--on' : ''}`}
        >
          <SettingsIcon size={15} />
        </button>
      </div>

      <div className="nav-section" style={{ justifyContent: 'flex-end', paddingBottom: 0, gap: 8 }}>
        <button
          id="nav-btn-theme"
          type="button"
          onClick={toggleTheme}
          title={isCyberpunk ? 'Switch to Default theme' : 'Switch to Cyberpunk theme'}
          className={`nav-btn${isCyberpunk ? ' theme-btn--cyberpunk' : ''}`}
        >
          <Sparkles size={15} />
        </button>
      </div>
    </div>
  );
}
