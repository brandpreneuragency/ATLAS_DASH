import { Bot } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

export function RightNarrowSidebar() {
  const { sidebarOpen, setSidebarOpen } = useUIStore();

  return (
    <div id="right-nav-bar" className="nav-bar" style={{ background: 'var(--right-bg)', display: 'none' }}>
      {/* Section 1: Empty top */}
      <div className="nav-section" />

      {/* Section 2: AI chat toggle */}
      <div className="nav-section" style={{ justifyContent: 'center' }}>
        <button
          id="nav-btn-ai"
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title="AI Sidebar"
          className={`nav-btn${sidebarOpen ? ' nav-btn--on' : ''}`}
        >
          <Bot size={15} />
        </button>
      </div>

      {/* Section 3: Empty bottom */}
      <div className="nav-section" style={{ justifyContent: 'flex-end', paddingBottom: 12 }} />
    </div>
  );
}
