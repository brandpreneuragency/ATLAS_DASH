import { useEffect } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { CenterResizableHandle } from './CenterResizableHandle';
import { LeftResizableHandle } from './LeftResizableHandle';
import { LeftNarrowSidebar } from './LeftNarrowSidebar';
import { RightNarrowSidebar } from './RightNarrowSidebar';
import { FileViewerPanel } from '../fileViewer/FileViewerPanel';
import { RightPanelSubheader } from '../sidebar/RightPanelSubheader';
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
  const { sidebarWidth, fileExplorerOpen, fileExplorerWidth, taskMode, pageMode, taskListOpen, fileViewerOpen, editorFontSize, panelsSwapped, aiSidebarOpen, crmMode, formsMode, activeView } = useUIStore();

  useEffect(() => {
    if (editorFontSize === 14) {
      document.documentElement.setAttribute('data-text-size', '14');
    } else if (editorFontSize === 16) {
      document.documentElement.setAttribute('data-text-size', '16');
    } else {
      document.documentElement.removeAttribute('data-text-size');
    }
  }, [editorFontSize]);

  // CRM/Forms modules always render the full 3-panel layout.
  const crmOrForms = crmMode || formsMode;
  // The Settings doc owns the whole center area (its own left+center layout),
  // so hide the outer file explorer / task list / CRM list / AI sidebar — like
  // page mode, but only in doc mode (not task/page/crm/forms).
  const settingsActive = !pageMode && !crmOrForms && !taskMode && activeView === 'settings';

  const showFileExplorer = !pageMode && !settingsActive && !crmOrForms && (fileExplorerOpen && !taskMode);
  const showTaskList = !pageMode && !settingsActive && !crmOrForms && taskMode && taskListOpen;
  const showCrmFormsList = !pageMode && !settingsActive && crmOrForms;
  const showLeftResizableHandle = !pageMode && !settingsActive && (crmOrForms || (fileExplorerOpen && !taskMode) || (taskMode && taskListOpen));
  const showSidebarPanel = !pageMode && !settingsActive && (aiSidebarOpen || fileViewerOpen || crmOrForms);
  const mainRowSwapped = panelsSwapped && showSidebarPanel;
  const rightPanelWidth = `clamp(320px, ${sidebarWidth}vw, calc(100vw - var(--sidebar-width) - 6px))`;
  const detailPanelWidth = `calc(6px + ${rightPanelWidth})`;

  return (
    <div className="workspace">
      <div className="sidebar-panel">
        <LeftNarrowSidebar />
      </div>

      {showFileExplorer && (
        <div
          id="file-tree-panel"
          className="task-list-panel relative shrink-0 overflow-h flex-col h-full min-w-0"
          style={{ width: `clamp(260px, ${fileExplorerWidth}vw, 420px)`, paddingLeft: 10, paddingRight: 10 }}
        >
          {leftPanel}
        </div>
      )}
      {showTaskList && (
        <div
          id="task-list-column"
          className="task-list-panel relative shrink-0 overflow-h flex-col h-full"
          style={{ width: `clamp(260px, ${fileExplorerWidth}vw, 420px)`, paddingTop: '0px', paddingBottom: '0px', backgroundColor: 'var(--c-background-1)' }}
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
          className={`flex flex-1 h-full overflow-h min-w-0${mainRowSwapped ? ' main-row--swapped' : ''}`}
        >
          {mainRowSwapped ? (
            <>
              {/* Swapped: AI sidebar on the left, centre on the right.
                  .detail-panel wraps (panel, handle) so the handle
                  stays adjacent to its panel. */}
              {showSidebarPanel && (
                <div className="detail-panel" style={{ width: detailPanelWidth }}>
                  <div
                    id={fileViewerOpen ? 'file-viewer-panel' : 'ai-sidebar-panel'}
                    className="relative shrink-0 overflow-h flex-col h-full min-w-0"
                    style={{ paddingLeft: '0px', paddingRight: '0px', width: rightPanelWidth }}
                  >
                    {/* Subheader always stays visible */}
                    {(aiSidebarOpen || crmOrForms) && !fileViewerOpen && <RightPanelSubheader />}
                    {/* Content body */}
                    <div className="flex-1 min-h-0 overflow-hidden">
                      {fileViewerOpen ? <FileViewerPanel /> : sidebar}
                    </div>
                  </div>
                  <CenterResizableHandle />
                </div>
              )}

              <div id="center-panel" className="panel flex-1 h-full overflow-h flex-col min-w-0" style={{ minWidth: 260 }}>
                {subtasksBar}
                <div id="center-panel-body" className="panel-body flex-1 h-full overflow-h">
                  {editor}
                </div>
              </div>
            </>
          ) : (
            <>
              <div id="center-panel" className="panel flex-1 h-full overflow-h flex-col min-w-0" style={{ minWidth: 260 }}>
                {subtasksBar}
                <div id="center-panel-body" className="panel-body flex-1 h-full overflow-h">
                  {editor}
                </div>
              </div>

              {/* Normal order: centre | (handle, panel). */}
              {showSidebarPanel && (
                <div className="detail-panel" style={{ width: detailPanelWidth }}>
                  <CenterResizableHandle />
                  <div
                    id={fileViewerOpen ? 'file-viewer-panel' : 'ai-sidebar-panel'}
                    className="relative shrink-0 overflow-h flex-col h-full min-w-0"
                    style={{ paddingLeft: '0px', paddingRight: '0px', width: rightPanelWidth }}
                  >
                    {/* Subheader always stays visible */}
                    {(aiSidebarOpen || crmOrForms) && !fileViewerOpen && <RightPanelSubheader />}
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

      <RightNarrowSidebar />
    </div>
  );
}
