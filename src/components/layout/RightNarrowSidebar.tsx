import { Bot } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

export function RightNarrowSidebar() {
  const { sidebarOpen, setSidebarOpen } = useUIStore();

  return (
    <div id="right-nav-bar" className="flex-col items-center shrink-0 overflow-h h-screen" style={{ gap: 0, width: 0, padding: 0 }}>
      {/* Section 1: Empty top */}
      <div className="flex-col items-center flex-1" />

      {/* Section 2: AI chat toggle */}
      <div className="flex-col items-center justify-center flex-1">
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
      <div className="flex-col items-center justify-end flex-1" style={{ paddingBottom: 12 }} />
    </div>
  );
}
