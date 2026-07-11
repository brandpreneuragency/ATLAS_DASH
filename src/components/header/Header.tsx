import { PanelRight, TerminalSquare } from 'lucide-react';
import { TabBar } from './TabBar';
import { selectIsRightPanelOpen, useUIStore } from '../../stores/uiStore';

export function Header() {
  const rightPanelOpen = useUIStore(selectIsRightPanelOpen);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);
  const terminalPanelOpen = useUIStore((s) => s.terminalPanelOpen);
  const setTerminalPanelOpen = useUIStore((s) => s.setTerminalPanelOpen);

  return (
    <div id="header-bar" className="header-bar">
      <TabBar />
      <div className="ai-toggle-col">
        <button
          type="button"
          title={terminalPanelOpen ? 'Hide terminal (Ctrl+J)' : 'Show terminal (Ctrl+J)'}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => setTerminalPanelOpen(!terminalPanelOpen)}
          aria-pressed={terminalPanelOpen}
          className={`ai-toggle-btn${terminalPanelOpen ? ' ai-toggle-btn--on' : ''}`}
        >
          <TerminalSquare size={16} />
        </button>
        <button
          type="button"
          title={rightPanelOpen ? 'Hide right panel' : 'Show right panel'}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => toggleRightPanel()}
          aria-pressed={rightPanelOpen}
          className={`ai-toggle-btn${rightPanelOpen ? ' ai-toggle-btn--on' : ''}`}
        >
          <PanelRight size={16} />
        </button>
      </div>
    </div>
  );
}
