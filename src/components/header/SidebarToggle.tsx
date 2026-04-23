import { Sparkles } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

export function SidebarToggle() {
  const { sidebarOpen, setSidebarOpen } = useUIStore();

  return (
    <button
      type="button"
      onClick={() => setSidebarOpen(!sidebarOpen)}
      title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
      className={`
        flex items-center justify-center
        w-[36px] h-[36px] flex-shrink-0 rounded-[10px]
        border border-solid border-[#cfcfcf] transition-all duration-100
        ${sidebarOpen
          ? 'bg-[#EEF2FF] text-brand'
          : 'bg-white text-text-secondary hover:text-brand hover:bg-highlight/30'
        }
      `}
    >
      <Sparkles size={15} />
    </button>
  );
}
