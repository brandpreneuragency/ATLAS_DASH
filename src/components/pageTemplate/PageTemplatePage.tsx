import { useState } from 'react';
import { ReusablePageTemplate } from './ReusablePageTemplate';
import type { PanelId, PageTemplatePanelConfig } from './types';
import { useUIStore } from '../../stores/uiStore';
import { AISidebar } from '../sidebar/AISidebar';
import { RightPanelSubheader } from '../sidebar/RightPanelSubheader';
import { useTaskStore } from '../../stores/taskStore';
import './pageTemplate.css';

function PanelBar({
  side,
  onToggle,
}: {
  side: 'left' | 'right';
  onToggle: () => void;
}) {
  return (
    <div className="reusable-page-template__preview-bar">
      <span>{side === 'left' ? 'Navigation' : 'Assistant'}</span>
      <button
        type="button"
        className="reusable-page-template__preview-toggle"
        onClick={onToggle}
        aria-label={`Toggle ${side} panel`}
      >
        {side === 'left' ? '◀ Hide' : 'Hide ▶'}
      </button>
    </div>
  );
}

function PreviewSection({
  variant,
  children,
}: {
  variant?: 'orange' | 'orange-strong' | 'center-main' | 'center-footer';
  children: React.ReactNode;
}) {
  const className = [
    'reusable-page-template__preview-section',
    variant ? `reusable-page-template__preview-section--${variant}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return <div className={className}>{children}</div>;
}

export function PageTemplatePage() {
  const { pagePanelOpen, setPagePanelOpen } = useUIStore();
  const uiActiveTaskId = useUIStore((s) => s.activeTaskId);
  const storeActiveTaskId = useTaskStore((s) => s.activeTaskId);
  const effectiveTaskId = uiActiveTaskId ?? storeActiveTaskId;

  const [leftWidthVw, setLeftWidthVw] = useState(22);
  const [rightConfig, setRightConfig] = useState<PageTemplatePanelConfig>({
    open: true,
    widthVw: 28,
    minWidthVw: 22,
    maxWidthVw: 40,
  });

  const handleResize = (panel: PanelId, widthVw: number) => {
    if (panel === 'left') {
      setLeftWidthVw(widthVw);
    }
    if (panel === 'right') {
      setRightConfig((current) => ({ ...current, widthVw }));
    }
  };

  const toggleLeft = () => setPagePanelOpen(!pagePanelOpen);
  const toggleRight = () =>
    setRightConfig((c) => ({ ...c, open: !(c.open ?? c.defaultOpen ?? true) }));

  return (
    <div style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}>
      <ReusablePageTemplate
        left={{
          open: pagePanelOpen,
          widthVw: leftWidthVw,
          minWidthVw: 18,
          maxWidthVw: 34,
        }}
        right={rightConfig}
        onPanelResize={handleResize}
        slots={{
          leftHeader: <PanelBar side="left" onToggle={toggleLeft} />,
          leftMain: (
            <PreviewSection variant="orange">
              <div className="flex-col" style={{ gap: 8, display: 'flex' }}>
                <span className="semibold" style={{ fontSize: 'var(--fs-sm)' }}>Page sections</span>
                <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
                  Reusable 3-panel layout for CRM, Forms, and future modules.
                </span>
              </div>
            </PreviewSection>
          ),
          centerHeader: (
            <span className="reusable-page-template__preview-label">Page Template</span>
          ),
          centerMain: (
            <PreviewSection variant="center-main">
              <div className="flex-col" style={{ gap: 12, display: 'flex', padding: 16 }}>
                <span className="semibold" style={{ fontSize: 'var(--fs-md)' }}>Center workspace</span>
                <span className="subtle" style={{ fontSize: 'var(--fs-sm)', maxWidth: 480 }}>
                  This view demonstrates the shared page shell. Use the Settings button in the sidebar
                  to manage models, actions, appearance, and agents.
                </span>
              </div>
            </PreviewSection>
          ),
          rightHeader: <PanelBar side="right" onToggle={toggleRight} />,
          rightMain: (
            <div
              id="ai-sidebar-panel"
              className="relative flex-col h-full w-full min-w-0 overflow-h"
              style={{ paddingLeft: '0px', paddingRight: '0px' }}
            >
              <RightPanelSubheader />
              <div className="flex-1 min-h-0 overflow-hidden">
                <AISidebar
                  documentId=""
                  taskId={effectiveTaskId}
                  editor={null}
                />
              </div>
            </div>
          ),
        }}
      />
    </div>
  );
}
