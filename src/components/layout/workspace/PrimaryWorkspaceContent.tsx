import { useRef, type CSSProperties, type ReactNode } from 'react';
import type { WorkspaceMode } from '../../../stores/uiLayoutState';
import { ContextualPanel } from './ContextualPanel';
import { ContextResizeHandle } from './ContextResizeHandle';
import { CenterContentPanel } from './CenterContentPanel';

interface PrimaryWorkspaceContentProps {
  mode: WorkspaceMode;
  contextPanel?: ReactNode | null;
  centerPanel: ReactNode;
  contextPanelAvailable: boolean;
  contextPanelOpen: boolean;
  contextPanelWidthVw: number;
  contextPanelId?: string;
  contextPanelClassName?: string;
  contextPanelStyle?: CSSProperties;
  subtasksBar?: ReactNode;
  showSubtasksBar?: boolean;
  leadingControls?: ReactNode;
}

/**
 * Internal primary layout: optional contextual panel + context handle + center.
 * Contextual panel and center move together when the primary wrapper is swapped.
 */
export function PrimaryWorkspaceContent({
  mode,
  contextPanel,
  centerPanel,
  contextPanelAvailable,
  contextPanelOpen,
  contextPanelWidthVw,
  contextPanelId,
  contextPanelClassName,
  contextPanelStyle,
  subtasksBar,
  showSubtasksBar,
  leadingControls,
}: PrimaryWorkspaceContentProps) {
  const contextRef = useRef<HTMLDivElement>(null);
  const primaryContentRef = useRef<HTMLDivElement>(null);
  const showContext = contextPanelAvailable && contextPanelOpen && contextPanel != null;

  return (
    <div ref={primaryContentRef} className="primary-workspace-content">
      {showContext && (
        <ContextualPanel
          ref={contextRef}
          mode={mode}
          widthVw={contextPanelWidthVw}
          panelId={contextPanelId}
          className={contextPanelClassName}
          style={contextPanelStyle}
        >
          {contextPanel}
        </ContextualPanel>
      )}
      {showContext && (
        <ContextResizeHandle
          contextRef={contextRef}
          primaryContentRef={primaryContentRef}
        />
      )}
      <CenterContentPanel
        subtasksBar={subtasksBar}
        showSubtasksBar={showSubtasksBar}
        leadingControls={leadingControls}
      >
        {centerPanel}
      </CenterContentPanel>
    </div>
  );
}
