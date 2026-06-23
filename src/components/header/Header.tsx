import { PanelRight } from 'lucide-react';
import { TabBar } from './TabBar';
import { useUIStore } from '../../stores/uiStore';

export function Header() {
  const { aiSidebarOpen, setAiSidebarOpen, pageMode } = useUIStore();

  return (
    <div id="header-bar" className="header-bar">
      <TabBar />
      <div className="ai-toggle-col">
        {!pageMode && (
          <button
            type="button"
            title={aiSidebarOpen ? 'Hide AI Sidebar' : 'Show AI Sidebar'}
            onClick={() => setAiSidebarOpen(!aiSidebarOpen)}
            aria-pressed={aiSidebarOpen}
            className={`ai-toggle-btn${aiSidebarOpen ? ' ai-toggle-btn--on' : ''}`}
          >
            <PanelRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
