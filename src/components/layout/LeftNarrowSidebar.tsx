import { ClipboardList, FileText, LayoutTemplate, PanelLeft, Sparkles, Users, SquarePen } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useTheme } from '../../hooks/useTheme';

export function LeftNarrowSidebar() {
  const {
    taskMode,
    pageMode,
    pagePanelOpen,
    setTaskMode,
    setPageMode,
    setPagePanelOpen,
    fileExplorerOpen,
    setFileExplorerOpen,
    taskListOpen,
    setTaskListOpen,
    crmMode,
    formsMode,
    setCrmMode,
    setFormsMode,
    setActiveCRMPage,
    setActiveFormsPage,
  } = useUIStore();
  const { isCyberpunk, toggleTheme } = useTheme();

  const leftPanelOpen = pageMode ? pagePanelOpen : (taskMode ? taskListOpen : fileExplorerOpen);

  const toggleLeftPanel = () => {
    if (pageMode) {
      setPagePanelOpen(!pagePanelOpen);
      return;
    }
    if (taskMode) {
      setTaskListOpen(!taskListOpen);
      return;
    }
    setFileExplorerOpen(!fileExplorerOpen);
  };

  return (
    <div id="nav-bar" className="nav-bar">
      <div className="nav-section" style={{ paddingTop: 0, gap: 8, borderTop: 'none' }}>
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

      <div className="nav-section" style={{ width: 'fit-content', gap: 12, paddingTop: 12, paddingBottom: 12 }}>
        <button
          id="nav-btn-documents"
          type="button"
          onClick={() => {
            setPagePanelOpen(true);
            setTaskMode(false);
            if (!fileExplorerOpen) setFileExplorerOpen(true);
          }}
          title="Documents"
          className={`mode-btn${!taskMode && !pageMode && !crmMode && !formsMode ? ' mode-btn--on' : ''}`}
        >
          <FileText size={15} />
        </button>

        <button
          id="nav-btn-tasks"
          type="button"
          onClick={() => {
            setPagePanelOpen(true);
            setTaskMode(true);
            if (!taskListOpen) setTaskListOpen(true);
          }}
          title="Tasks"
          className={`mode-btn${taskMode ? ' mode-btn--on' : ''}`}
        >
          <ClipboardList size={15} />
        </button>

        <button
          id="nav-btn-page"
          type="button"
          onClick={() => {
            setPagePanelOpen(true);
            setPageMode(true);
          }}
          title="Page Template"
          className={`mode-btn${pageMode ? ' mode-btn--on' : ''}`}
        >
          <LayoutTemplate size={15} />
        </button>

        <button
          id="nav-btn-crm"
          type="button"
          onClick={() => {
            setActiveCRMPage('dashboard');
            setCrmMode(true);
          }}
          title="CRM"
          className={`mode-btn${crmMode ? ' mode-btn--on' : ''}`}
        >
          <Users size={15} />
        </button>

        <button
          id="nav-btn-forms"
          type="button"
          onClick={() => {
            setActiveFormsPage('dashboard');
            setFormsMode(true);
          }}
          title="Forms"
          className={`mode-btn${formsMode ? ' mode-btn--on' : ''}`}
        >
          <SquarePen size={15} />
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
