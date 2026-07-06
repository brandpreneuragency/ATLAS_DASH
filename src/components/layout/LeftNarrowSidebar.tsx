import { ClipboardList, FileText, PanelLeft, Sparkles, Users, Settings as SettingsIcon } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useTheme } from '../../hooks/useTheme';

export function LeftNarrowSidebar() {
  const {
    taskMode,
    setTaskMode,
    fileExplorerOpen,
    setFileExplorerOpen,
    taskListOpen,
    setTaskListOpen,
    crmMode,
    setCrmMode,
    setActiveCRMPage,
    activeView,
    openSettings,
    setActiveView,
  } = useUIStore();
  const { isCyberpunk, toggleTheme } = useTheme();

  const leftPanelOpen = taskMode ? taskListOpen : fileExplorerOpen;

  const toggleLeftPanel = () => {
    if (taskMode) {
      setTaskListOpen(!taskListOpen);
      return;
    }
    setFileExplorerOpen(!fileExplorerOpen);
  };

  return (
    <div id="nav-bar" className="nav-bar">
      <div className="nav-section" style={{ paddingTop: 0, paddingBottom: 0, gap: 0, borderTop: 'none' }}>
        <button
          id="nav-btn-toggle-panel"
          type="button"
          onClick={toggleLeftPanel}
          title={leftPanelOpen ? 'Hide panel' : 'Show panel'}
          className={`nav-btn${leftPanelOpen ? ' nav-btn--on' : ''}`}
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
            if (!fileExplorerOpen) setFileExplorerOpen(true);
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
            setTaskMode(true);
            if (!taskListOpen) setTaskListOpen(true);
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
