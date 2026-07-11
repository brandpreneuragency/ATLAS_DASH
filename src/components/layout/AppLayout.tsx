import { useEffect } from 'react';
import { useUIStore, selectIsMainRowSwapped } from '../../stores/uiStore';
import { CenterResizableHandle } from './CenterResizableHandle';
import { LeftResizableHandle } from './LeftResizableHandle';
import { LeftNarrowSidebar } from './LeftNarrowSidebar';
import { RightNarrowSidebar } from './RightNarrowSidebar';
import { FileViewerPanel } from '../fileViewer/FileViewerPanel';
import { RightPanelSubheader } from '../sidebar/RightPanelSubheader';
import { TerminalPanel } from '../terminal/TerminalPanel';
import type { ReactNode } from 'react';

interface AppLayoutProps {
  editor: ReactNode;
  sidebar: ReactNode;
  leftPanel: ReactNode;
  taskListPanel: ReactNode;
  modals: ReactNode;
  subtasksBar?: ReactNode;
}

export function AppLayout({ editor, sidebar, leftPanel, taskListPanel, modals, subtasksBar }: AppLayoutProps) {
  const { sidebarWidth, fileExplorerOpen, fileExplorerWidth, taskMode, taskListOpen, fileViewerOpen, editorFontSize, aiSidebarOpen, centerPanelOpen, crmMode, activeView, activeCRMPage, activeTaskPage } = useUIStore();
  const mainRowSwapped = useUIStore(selectIsMainRowSwapped);

  useEffect(() => {
    if (editorFontSize === 14) {
      document.documentElement.setAttribute('data-text-size', '14');
    } else if (editorFontSize === 16) {
      document.documentElement.setAttribute('data-text-size', '16');
    } else {
      document.documentElement.removeAttribute('data-text-size');
    }
  }, [editorFontSize]);

  // CRM module (now hosting the merged Forms sub-module) always renders the full 3-panel layout.
  // The Settings doc owns the whole center area (its own left+center layout),
  // so hide the outer file explorer / task list / CRM list / AI sidebar — only
  // in doc mode (not task/crm).
  const settingsActive = !crmMode && !taskMode && activeView === 'settings';

  const showFileExplorer = !settingsActive && !crmMode && (fileExplorerOpen && !taskMode);
  // Task mode "Projects" tab renders a full-width kanban board in Panel 2,
  // so the left task list panel (and its resize handle) are hidden, mirroring
  // how the CRM pipeline page hides the CRM list panel.
  const taskProjectsOnly = taskMode && activeTaskPage === 'projects';
  const showTaskList = !settingsActive && !crmMode && taskMode && taskListOpen && !taskProjectsOnly;
  const crmPipelineOnly = crmMode && activeCRMPage === 'pipeline';
  const showCrmFormsList = !settingsActive && crmMode && !crmPipelineOnly;
  const showLeftResizableHandle = !settingsActive && ((crmMode && !crmPipelineOnly) || (fileExplorerOpen && !taskMode) || (taskMode && taskListOpen && !taskProjectsOnly));
  const showSidebarPanel = !settingsActive && (aiSidebarOpen || fileViewerOpen);
  const showCenterPanel = !mainRowSwapped || centerPanelOpen;
  const singlePanelMainRow =
    (!mainRowSwapped && !showSidebarPanel) ||
    (mainRowSwapped && showSidebarPanel && !centerPanelOpen);
  const rightPanelWidth = `clamp(320px, ${sidebarWidth}vw, calc(100vw - var(--sidebar-width) - 6px))`;

  const showSubtasksBar = !settingsActive && taskMode && activeTaskPage !== 'projects' && subtasksBar;
  const centerPanel = showCenterPanel && (
    <div id="center-panel" className="panel flex-1 h-full overflow-h flex-col min-w-0" style={{ minWidth: 140 }}>
      {showSubtasksBar && <div className='subtasks-bar-wrapper' style={{ paddingTop: '12px', paddingBottom: '12px', paddingLeft: '12px', paddingRight: '12px' }}>{subtasksBar}</div>}
      <div id="center-panel-body" className="panel-body flex-1 min-h-0 overflow-h">
        {editor}
      </div>
    </div>
  );

  return (
    <div className="workspace">
      <div className="sidebar-panel">
        <LeftNarrowSidebar />
      </div>

      <div id="workspace-panels" className="workspace-panels flex flex-1 min-w-0 min-h-0 overflow-h">
        <div id="workspace-content" className="workspace-content flex flex-1 min-w-0 min-h-0 overflow-h">
        {showFileExplorer && (
          <div
            id="file-tree-panel"
            className="task-list-panel relative shrink-0 overflow-h flex-col h-full min-w-0"
            style={{ width: `clamp(260px, ${fileExplorerWidth}vw, 420px)`, paddingLeft: 12, paddingRight: 0 }}
          >
            {leftPanel}
          </div>
        )}
        {showTaskList && (
          <div
            id="task-list-column"
            className="task-list-panel relative shrink-0 overflow-h flex-col h-full"
            style={{ width: `clamp(260px, ${fileExplorerWidth}vw, 420px)`, paddingTop: '0px', paddingBottom: '0px', backgroundColor: 'var(--c-background-2)' }}
          >
            {taskListPanel}
          </div>
        )}
        {showCrmFormsList && (
          <div
            id="crm-forms-list-column"
            className="task-list-panel relative shrink-0 overflow-h flex-col h-full"
            style={{ width: `clamp(260px, ${fileExplorerWidth}vw, 420px)`, paddingTop: '0px', paddingBottom: '0px', backgroundColor: 'var(--c-background-1)' }}
          >
            {leftPanel}
          </div>
        )}

        {showLeftResizableHandle && <LeftResizableHandle />}

        <div id="main-columns" className="main-panel flex flex-col flex-1 overflow-h min-w-0">
        {/* Center + Right panels. `#main-row` is a 2-col grid
         *  (centre | .detail-panel wrapper) defined in layout.css. */}
        <div
          id="main-row"
          className={`flex flex-1 h-full overflow-h min-w-0${mainRowSwapped ? ' main-row--swapped' : ''}${singlePanelMainRow ? ' main-row--single-panel' : ''}`}
        >
          {mainRowSwapped ? (
            <>
              {/* Swapped: AI sidebar on the left, centre on the right.
                  .detail-panel wraps (panel, handle) so the handle
                  stays adjacent to its panel. */}
              {showSidebarPanel && (
                <div className="detail-panel">
                  <div
                    id={fileViewerOpen ? 'file-viewer-panel' : 'ai-sidebar-panel'}
                    className="relative shrink-0 overflow-h flex-col h-full min-w-0"
                    style={singlePanelMainRow ? undefined : { paddingLeft: '0px', paddingRight: '0px', width: rightPanelWidth }}
                  >
                    {/* Subheader always stays visible */}
                    {(aiSidebarOpen) && !fileViewerOpen && <RightPanelSubheader />}
                    {/* Content body */}
                    <div className="flex-1 min-h-0 overflow-hidden">
                      {fileViewerOpen ? <FileViewerPanel /> : sidebar}
                    </div>
                  </div>
                  {showCenterPanel && <CenterResizableHandle />}
                </div>
              )}

              {centerPanel}
            </>
          ) : (
            <>
              {centerPanel}

              {/* Normal order: centre | (handle, panel). */}
              {showSidebarPanel && (
                <div className="detail-panel">
                  {showCenterPanel && <CenterResizableHandle />}
                  <div
                    id={fileViewerOpen ? 'file-viewer-panel' : 'ai-sidebar-panel'}
                    className="relative shrink-0 overflow-h flex-col h-full min-w-0"
                    style={singlePanelMainRow ? undefined : { paddingLeft: '0px', paddingRight: '0px', width: rightPanelWidth }}
                  >
                    {/* Subheader always stays visible */}
                    {(aiSidebarOpen) && !fileViewerOpen && <RightPanelSubheader />}
                    {/* Content body */}
                    <div className="flex-1 min-h-0 overflow-hidden">
                      {fileViewerOpen ? <FileViewerPanel /> : sidebar}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {modals}
        </div>
        </div>
      </div>

      <TerminalPanel />

      <RightNarrowSidebar />
    </div>
  );
}
