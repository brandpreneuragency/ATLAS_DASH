import { FileText, ClipboardList, Settings } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

export function NarrowSidebar() {
  const { taskMode, setTaskMode, fileExplorerOpen, setFileExplorerOpen, taskListOpen, setTaskListOpen, settingsPanelOpen, setSettingsPanelOpen } = useUIStore();

  const leftPanelOpen = taskMode ? taskListOpen : fileExplorerOpen;
  const toggleLeftPanel = () => taskMode ? setTaskListOpen(!taskListOpen) : setFileExplorerOpen(!fileExplorerOpen);

  return (
    <div id="nav-bar" className="flex-col items-center shrink-0 overflow-h h-screen" style={{ gap: 0, width: 32, padding: 0, justifyContent: 'flex-start', backgroundColor: 'var(--c-background-3)' }}>
      {/* Section 1: Mode buttons */}
      <div className="flex-col items-center flex-1" style={{ gap: 4, paddingTop: 0 }}>
        <button
          id="nav-btn-documents"
          type="button"
          onClick={() => {
            setTaskMode(false);
            if (!fileExplorerOpen) setFileExplorerOpen(true);
          }}
          title="Documents"
          className={`nav-btn${!taskMode ? ' nav-btn--on' : ''}`}
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
          className={`nav-btn${taskMode ? ' nav-btn--on' : ''}`}
        >
          <ClipboardList size={15} />
        </button>
      </div>

      {/* Section 2: Toggle left panel */}
      <div className="flex-col items-center justify-center flex-1">
        <button
          id="nav-btn-toggle-panel"
          type="button"
          onClick={toggleLeftPanel}
          title={leftPanelOpen ? 'Hide panel' : 'Show panel'}
          className={`nav-btn${leftPanelOpen ? ' nav-btn--on' : ''}`}
        >
          <div
            style={{
              width: 3,
              height: 20,
              backgroundColor: 'currentColor',
              borderRadius: 2,
            }}
          />
        </button>
      </div>

      {/* Section 3: Settings */}
      <div className="flex-col items-center justify-end flex-1" style={{ paddingBottom: 12 }}>
        <button
          id="nav-btn-settings"
          type="button"
          onClick={() => setSettingsPanelOpen(!settingsPanelOpen)}
          title="Settings"
          className={`nav-btn${settingsPanelOpen ? ' nav-btn--on' : ''}`}
        >
          <Settings size={15} />
        </button>
      </div>
    </div>
  );
}
