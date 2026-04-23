import { MessageSquare, Star, Users, Layers } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import type { SidebarTab } from '../../stores/uiStore';

const TABS: { id: SidebarTab; label: string; Icon: React.ElementType }[] = [
  { id: 'chat', label: 'Chat', Icon: MessageSquare },
  { id: 'actions', label: 'Actions', Icon: Star },
  { id: 'characters', label: 'Characters', Icon: Users },
  { id: 'models', label: 'Models', Icon: Layers },
];

export function SidebarNav() {
  const { sidebarTab, setSidebarTab } = useUIStore();

  return (
    <div className="flex-shrink-0 border-t-0 border-transparent [border-image:none] bg-[#f0f0f0] pt-[10px] mb-[10px]">
      <div className="flex h-[30px] items-stretch bg-[#f0f0f0] w-full border-0 border-transparent [border-image:none]">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = sidebarTab === id;
          return (
            <button
              key={id}
              onClick={() => setSidebarTab(id)}
              className={`flex-1 h-[30px] flex flex-row items-center justify-center gap-[4px] py-0 text-[10px] font-semibold transition-colors m-0 rounded-[10px] ${
                isActive
                  ? 'text-brand'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
