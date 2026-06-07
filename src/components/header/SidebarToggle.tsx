import { Sparkles } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

export function SidebarToggle() {
  const { sidebarOpen, setSidebarOpen } = useUIStore();

  return (
    <button
      type="button"
      onClick={() => setSidebarOpen(!sidebarOpen)}
      title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
      className={`header-toggle${sidebarOpen ? ' header-toggle--on' : ''}`}
    >
      <Sparkles size={15} />
    </button>
  );
}
