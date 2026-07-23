import { ArrowLeftRight, PanelLeft, PanelRight } from 'lucide-react';
import { TabBar } from './TabBar';
import { AreaSwitcher } from './AreaSwitcher';
import { KillSwitch } from './KillSwitch';
import { selectCanSwapWrappers, useUIStore } from '../../stores/uiStore';

export function Header() {
  const assistantOpen = useUIStore((s) => s.assistantWrapperOpen);
  const toggleAssistantWrapper = useUIStore((s) => s.toggleAssistantWrapper);
  const wrappersSwapped = useUIStore((s) => s.wrappersSwapped);
  const toggleWrappersSwapped = useUIStore((s) => s.toggleWrappersSwapped);
  const canSwapWrappers = useUIStore(selectCanSwapWrappers);
  const primaryWrapperOpen = useUIStore((s) => s.primaryWrapperOpen);
  const togglePrimaryWrapper = useUIStore((s) => s.togglePrimaryWrapper);

  const workspaceLabel = primaryWrapperOpen ? 'Hide workspace' : 'Show workspace';
  const assistantLabel = assistantOpen ? 'Hide assistant' : 'Show assistant';
  const swapLabel = wrappersSwapped
    ? 'Restore workspace and assistant order'
    : 'Swap workspace and assistant';

  const handlePrimaryToggle = () => {
    const primaryEl = document.getElementById('primary-workspace-wrapper');
    const focusInside = Boolean(
      primaryWrapperOpen && primaryEl?.contains(document.activeElement),
    );
    togglePrimaryWrapper();
    if (focusInside) {
      requestAnimationFrame(() => {
        document.getElementById('header-btn-workspace')?.focus();
      });
    }
  };

  const handleAssistantToggle = () => {
    const assistantEl = document.getElementById('assistant-wrapper');
    const focusInside = Boolean(
      assistantOpen && assistantEl?.contains(document.activeElement),
    );
    toggleAssistantWrapper();
    if (focusInside) {
      requestAnimationFrame(() => {
        document.getElementById('header-btn-assistant')?.focus();
      });
    }
  };

  return (
    <div id="header-bar" className="header-bar">
      <AreaSwitcher />
      <TabBar />
      <div className="ai-toggle-col">
        <KillSwitch />
        <button
          id="header-btn-workspace"
          type="button"
          title={workspaceLabel}
          aria-label={workspaceLabel}
          aria-pressed={primaryWrapperOpen}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={handlePrimaryToggle}
          className={`ai-toggle-btn${primaryWrapperOpen ? ' ai-toggle-btn--on' : ''}`}
        >
          <PanelLeft size={16} />
        </button>
        <button
          id="header-btn-swap"
          type="button"
          title={canSwapWrappers ? swapLabel : 'Swap requires both workspace and assistant open'}
          aria-label={swapLabel}
          aria-pressed={wrappersSwapped}
          disabled={!canSwapWrappers}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => toggleWrappersSwapped()}
          className={`ai-toggle-btn${wrappersSwapped && canSwapWrappers ? ' ai-toggle-btn--on' : ''}`}
        >
          <ArrowLeftRight size={16} />
        </button>
        <button
          id="header-btn-assistant"
          type="button"
          title={assistantLabel}
          aria-label={assistantLabel}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={handleAssistantToggle}
          aria-pressed={assistantOpen}
          className={`ai-toggle-btn${assistantOpen ? ' ai-toggle-btn--on' : ''}`}
        >
          <PanelRight size={16} />
        </button>
      </div>
    </div>
  );
}
