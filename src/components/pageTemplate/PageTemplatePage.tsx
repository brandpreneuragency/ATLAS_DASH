import { useState } from 'react';
import { ReusablePageTemplate } from './ReusablePageTemplate';
import type { PanelId, PageTemplatePanelConfig } from './types';
import { useUIStore } from '../../stores/uiStore';
import { Cpu, Zap, Palette, Users } from 'lucide-react';
import { ModelManagementContent } from '../modals/ModelManagementModal';
import { SettingsContent } from '../modals/SettingsModal';
import { ActionsPanel } from '../sidebar/ActionsPanel';
import { CharactersPanel } from '../sidebar/CharactersPanel';
import { AISidebar } from '../sidebar/AISidebar';
import { RightPanelSubheader } from '../sidebar/RightPanelSubheader';
import { useTaskStore } from '../../stores/taskStore';

type SettingsSection = 'models' | 'actions' | 'appearance' | 'agents';

export function PageTemplatePage() {
  const { pagePanelOpen } = useUIStore();
  const uiActiveTaskId = useUIStore((s) => s.activeTaskId);
  const storeActiveTaskId = useTaskStore((s) => s.activeTaskId);
  const effectiveTaskId = uiActiveTaskId ?? storeActiveTaskId;

  const [leftWidthVw, setLeftWidthVw] = useState(22);
  const [activeSection, setActiveSection] = useState<SettingsSection>('models');
  const [actionsScope, setActionsScope] = useState<'writer' | 'task'>('writer');
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

  const getCenterHeader = () => {
    switch (activeSection) {
      case 'models':
        return { title: 'Model Management' };
      case 'actions':
        return { title: 'Actions Management' };
      case 'appearance':
        return { title: 'Appearance Settings' };
      case 'agents':
        return { title: 'Agents Management', subtitle: 'Manage writer and task agents, prompt guidelines, and models' };
    }
  };

  const renderCenterContent = () => {
    switch (activeSection) {
      case 'models':
        return <ModelManagementContent isInline={true} />;
      case 'actions':
        return <ActionsPanel scope={actionsScope} />;
      case 'appearance':
        return <SettingsContent />;
      case 'agents':
        return (
          <div className="flex-col flex-1" style={{ padding: '0px 0px 16px 0px', overflowY: 'auto', display: 'flex', gap: 16 }}>
            <CharactersPanel scopes={['writer', 'task']} />
          </div>
        );
    }
  };

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
          leftMain: (
            <div className="flex-col flex-1" style={{ padding: 8, gap: 8, overflow: 'auto', display: 'flex' }}>
              {/* Models */}
              <button
                type="button"
                onClick={() => setActiveSection('models')}
                className="btn w-full"
                style={{
                  padding: '24px 12px',
                  borderRadius: 8,
                  fontSize: 'var(--fs-sm)',
                  justifyContent: 'flex-start',
                  gap: 10,
                  background: activeSection === 'models' ? 'var(--c-background-4)' : 'transparent',
                  color: activeSection === 'models' ? 'var(--c-accent-center-panel)' : 'var(--c-text-2)',
                  border: 'none',
                  textAlign: 'left',
                  alignItems: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                <Cpu size={14} style={{ color: activeSection === 'models' ? 'var(--c-accent-center-panel)' : 'var(--c-text-2)' }} />
                <div className="flex-col" style={{ gap: 2, flex: 1, minWidth: 0, display: 'flex' }}>
                  <span className="semibold" style={{ fontSize: 'var(--fs-sm)', color: activeSection === 'models' ? 'var(--c-accent-center-panel)' : 'var(--c-text-1)' }}>Models</span>
                  <span className="subtle" style={{ fontSize: 'var(--fs-sm)', opacity: 0.85 }}>AI providers and model selection</span>
                </div>
              </button>

              {/* Actions */}
              <button
                type="button"
                onClick={() => setActiveSection('actions')}
                className="btn w-full"
                style={{
                  padding: '24px 12px',
                  borderRadius: 8,
                  fontSize: 'var(--fs-sm)',
                  justifyContent: 'flex-start',
                  gap: 10,
                  background: activeSection === 'actions' ? 'var(--c-background-4)' : 'transparent',
                  color: activeSection === 'actions' ? 'var(--c-accent-center-panel)' : 'var(--c-text-2)',
                  border: 'none',
                  textAlign: 'left',
                  alignItems: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                <Zap size={14} style={{ color: activeSection === 'actions' ? 'var(--c-accent-center-panel)' : 'var(--c-text-2)' }} />
                <div className="flex-col" style={{ gap: 2, flex: 1, minWidth: 0, display: 'flex' }}>
                  <span className="semibold" style={{ fontSize: 'var(--fs-sm)', color: activeSection === 'actions' ? 'var(--c-accent-center-panel)' : 'var(--c-text-1)' }}>Actions</span>
                  <span className="subtle" style={{ fontSize: 'var(--fs-sm)', opacity: 0.85 }}>Quick prompts and saved actions</span>
                </div>
              </button>

              {/* Appearance */}
              <button
                type="button"
                onClick={() => setActiveSection('appearance')}
                className="btn w-full"
                style={{
                  padding: '24px 12px',
                  borderRadius: 8,
                  fontSize: 'var(--fs-sm)',
                  justifyContent: 'flex-start',
                  gap: 10,
                  background: activeSection === 'appearance' ? 'var(--c-background-4)' : 'transparent',
                  color: activeSection === 'appearance' ? 'var(--c-accent-center-panel)' : 'var(--c-text-2)',
                  border: 'none',
                  textAlign: 'left',
                  alignItems: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                <Palette size={14} style={{ color: activeSection === 'appearance' ? 'var(--c-accent-center-panel)' : 'var(--c-text-2)' }} />
                <div className="flex-col" style={{ gap: 2, flex: 1, minWidth: 0, display: 'flex' }}>
                  <span className="semibold" style={{ fontSize: 'var(--fs-sm)', color: activeSection === 'appearance' ? 'var(--c-accent-center-panel)' : 'var(--c-text-1)' }}>Appearance</span>
                  <span className="subtle" style={{ fontSize: 'var(--fs-sm)', opacity: 0.85 }}>Text size, font, language, theme</span>
                </div>
              </button>

              {/* Agents */}
              <button
                type="button"
                onClick={() => setActiveSection('agents')}
                className="btn w-full"
                style={{
                  padding: '24px 12px',
                  borderRadius: 8,
                  fontSize: 'var(--fs-sm)',
                  justifyContent: 'flex-start',
                  gap: 10,
                  background: activeSection === 'agents' ? 'var(--c-background-4)' : 'transparent',
                  color: activeSection === 'agents' ? 'var(--c-accent-center-panel)' : 'var(--c-text-2)',
                  border: 'none',
                  textAlign: 'left',
                  alignItems: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                <Users size={14} style={{ color: activeSection === 'agents' ? 'var(--c-accent-center-panel)' : 'var(--c-text-2)' }} />
                <div className="flex-col" style={{ gap: 2, flex: 1, minWidth: 0, display: 'flex' }}>
                  <span className="semibold" style={{ fontSize: 'var(--fs-sm)', color: activeSection === 'agents' ? 'var(--c-accent-center-panel)' : 'var(--c-text-1)' }}>Agents</span>
                  <span className="subtle" style={{ fontSize: 'var(--fs-sm)', opacity: 0.85 }}>Manage writer and task agents</span>
                </div>
              </button>
            </div>
          ),
          centerHeader: (
            <div className="reusable-page-template__preview-bar" style={{ borderBottom: '1px solid var(--c-border-1)', display: 'flex', alignItems: 'center', height: '100%', padding: '0 16px' }}>
              <div className="flex-col" style={{ display: 'flex', height: 32, justifyContent: 'center', alignItems: 'flex-start' }}>
                <span className="semibold" style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-text-1)' }}>{getCenterHeader().title}</span>
                {getCenterHeader().subtitle && (
                  <span className="subtle" style={{ fontSize: 'var(--fs-sm)', opacity: 0.8 }}>{getCenterHeader().subtitle}</span>
                )}
              </div>
              {activeSection === 'actions' && (
                <div className="row-xs" style={{ border: 'none', borderRadius: 9999, padding: '0 4px', marginLeft: 'auto', display: 'flex', gap: 0 }}>
                  {(['writer', 'task'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setActionsScope(s)}
                      className="semibold"
                      style={{
                        width: 'fit-content',
                        padding: '0 10px',
                        borderRadius: 9999,
                        fontSize: 'var(--fs-xs)',
                        border: 'none',
                        cursor: 'pointer',
                        background: 'unset',
                        color: actionsScope === s ? 'var(--c-accent-center-panel)' : 'var(--c-text-2)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {s.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ),
          centerMain: (
            <div className="flex-col flex-1" style={{ padding: '20px 24px', height: '100%', overflowY: 'auto', display: 'flex', background: 'var(--c-background-1)' }}>
              {renderCenterContent()}
            </div>
          ),
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
