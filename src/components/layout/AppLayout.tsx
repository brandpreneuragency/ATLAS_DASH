import { useEffect } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { ResizableHandle } from './ResizableHandle';
import { LeftResizableHandle } from './LeftResizableHandle';
import { LeftSidebarToggleHandle } from './LeftSidebarToggleHandle';
import { RightSidebarToggleHandle } from './RightSidebarToggleHandle';
import type { ReactNode } from 'react';

interface AppLayoutProps {
  header: ReactNode;
  editor: ReactNode;
  sidebar: ReactNode;
  leftPanel: ReactNode;
  modals: ReactNode;
}

export function AppLayout({ header, editor, sidebar, leftPanel, modals }: AppLayoutProps) {
  const { sidebarOpen, sidebarWidth, fileExplorerOpen, fileExplorerWidth, isDarkMode } = useUIStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const editorWidth =
    100 -
    (sidebarOpen ? sidebarWidth : 0) -
    (fileExplorerOpen ? fileExplorerWidth : 0);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[rgba(240,240,240,1)]">
      {/* Header */}
      <div className="flex-shrink-0 h-[50px] border-b border-border mt-0 mb-[10px] mr-[100px]">
        {header}
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden bg-[rgba(240,240,240,1)]">
        {/* Left file explorer panel */}
        {fileExplorerOpen && (
          // eslint-disable-next-line @typescript-eslint/no-inline-styles
          <div
            className="relative flex-shrink-0 overflow-hidden flex flex-col pl-[14px] pr-[20px] pt-[10px] pb-[10px] bg-[#f0f0f0] h-full min-w-0"
            style={{ width: `${fileExplorerWidth}%` }}
          >
            {leftPanel}
            {/* Resize handle on the right border of the file explorer */}
            <LeftResizableHandle />
          </div>
        )}
        {/* Static left‑edge toggle handle */}
        <LeftSidebarToggleHandle />

        {/* Editor column (includes sticky toolbar inside) */}
        <div
          className="flex-1 overflow-hidden min-w-0 flex flex-col"
          style={{ width: `${editorWidth}%` }}
        >
          {editor}
        </div>

        {/* AI Sidebar panel */}
        {sidebarOpen && (
          // eslint-disable-next-line @typescript-eslint/no-inline-styles
          <div
            className="relative flex-shrink-0 overflow-hidden flex flex-col mx-0 pl-[5px] pr-[20px] pt-0 pb-0 rounded-none bg-[#f0f0f0] h-full min-w-0 border-none border-l-0 border-l-transparent [border-style:none] [border-image:none]"
            style={{ width: `${sidebarWidth}%` }}
          >
            {/* Resize handle on the left border of the AI sidebar */}
            <ResizableHandle />
            {sidebar}
          </div>
        )}
        {/* Static right‑edge toggle handle */}
        <RightSidebarToggleHandle />
      </div>

      {modals}
    </div>
  );
}
