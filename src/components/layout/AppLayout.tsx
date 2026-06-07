import { useEffect } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { ResizableHandle } from './ResizableHandle';
import { LeftResizableHandle } from './LeftResizableHandle';
import { NarrowSidebar } from './NarrowSidebar';
import { RightNarrowSidebar } from './RightNarrowSidebar';
import { FileViewerPanel } from '../fileViewer/FileViewerPanel';
import { SettingsPanel } from '../settings/SettingsPanel';
import type { ReactNode } from 'react';

interface AppLayoutProps {
  header: ReactNode;
  editor: ReactNode;
  sidebar: ReactNode;
  leftPanel: ReactNode;
  taskListPanel: ReactNode;
  modals: ReactNode;
  subtasksBar?: ReactNode;
}

export function AppLayout({ header, editor, sidebar, leftPanel, taskListPanel, modals, subtasksBar }: AppLayoutProps) {
  const { sidebarOpen, sidebarWidth, fileExplorerOpen, fileExplorerWidth, settingsPanelOpen, taskMode, taskListOpen, fileViewerOpen, editorFontSize } = useUIStore();

  useEffect(() => {
    if (editorFontSize === 14) {
      document.documentElement.setAttribute('data-text-size', '14');
    } else if (editorFontSize === 16) {
      document.documentElement.setAttribute('data-text-size', '16');
    } else {
      document.documentElement.removeAttribute('data-text-size');
    }
  }, [editorFontSize]);

  return (
    <div className="flex h-screen overflow-h">
      <NarrowSidebar />

      {settingsPanelOpen && (
        <div
          id="settings-panel-column"
          className="relative shrink-0 overflow-h flex-col h-full min-w-0"
          style={{ width: `${fileExplorerWidth}vw`, minWidth: '15vw', maxWidth: '40vw' }}
        >
          <SettingsPanel />
        </div>
      )}

      {!settingsPanelOpen && fileExplorerOpen && !taskMode && (
        <div
          id="file-tree-panel"
          className="relative shrink-0 overflow-h flex-col h-full min-w-0"
          style={{ width: `${fileExplorerWidth}vw` }}
        >
          {leftPanel}
        </div>
      )}
      {!settingsPanelOpen && taskMode && taskListOpen && (
        <div
          id="task-list-column"
          className="relative shrink-0 overflow-h flex-col h-full"
          style={{ width: `${fileExplorerWidth}vw`, minWidth: '15vw', maxWidth: '40vw' }}
        >
          {taskListPanel}
        </div>
      )}

      {!settingsPanelOpen && ((fileExplorerOpen && !taskMode) || (taskMode && taskListOpen)) && <LeftResizableHandle />}

      <div id="main-columns" className="flex flex-1 h-full overflow-h min-w-0">
        <div id="center-panel" className="flex-1 h-full overflow-h flex-col min-w-0" style={{ minWidth: 260 }}>
          {header}
          {subtasksBar}
          <div id="center-panel-body" className="flex-1 h-full overflow-h">
            {editor}
          </div>
        </div>

        {(sidebarOpen || fileViewerOpen) && (
          <div
            id={fileViewerOpen ? 'file-viewer-panel' : 'ai-sidebar-panel'}
            className="relative shrink-0 overflow-h flex-col h-full min-w-0"
            style={{ width: `${sidebarWidth}vw`, maxWidth: '40vw' }}
          >
            <ResizableHandle />
            {fileViewerOpen ? <FileViewerPanel /> : sidebar}
          </div>
        )}

        {modals}
      </div>

      <RightNarrowSidebar />
    </div>
  );
}
