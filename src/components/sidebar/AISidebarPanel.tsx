import './aiSidebar.css';
import { ResizableHandle } from '../layout/ResizableHandle';
import { RightPanelSubheader } from './RightPanelSubheader';
import { AISidebar } from './AISidebar';
import type { Editor } from '@tiptap/react';

interface AISidebarPanelProps {
  workspaceId: string | null;
  taskId?: string | null;
  editor: Editor | null;
  width?: string;
}

export function AISidebarPanel({
  workspaceId,
  taskId,
  editor,
  width = 'var(--right-panel-width)',
}: AISidebarPanelProps) {
  if (!workspaceId && !taskId) return null;

  return (
    <div
      id="ai-sidebar-panel"
      className="relative shrink-0 overflow-h flex-col h-full min-w-0"
      style={{ width, paddingRight: '12px', paddingLeft: '12px', paddingTop: '6px' } as React.CSSProperties}
    >
      <div
        id="right-resize-handle"
        className="resize-handle absolute"
        style={{
          top: 0,
          left: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        } as React.CSSProperties}
      >
        <ResizableHandle />
      </div>

      <RightPanelSubheader />

      <div
        id="ai-sidebar"
        className="flex flex-col h-full w-full"
        style={{
          background: 'rgba(233, 233, 233, 0)',
          border: '0px rgba(0, 0, 0, 0)',
        } as React.CSSProperties}
      >
        <AISidebar workspaceId={workspaceId} taskId={taskId} editor={editor} />
      </div>
    </div>
  );
}