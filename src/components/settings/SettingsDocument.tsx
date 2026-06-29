import { Cpu, Zap, Palette, Users } from 'lucide-react';
import { useUIStore, type SettingsSubTab } from '../../stores/uiStore';
import { ModelsSection } from './ModelsSection';
import { ActionsSection } from './ActionsSection';
import { AppearanceSection } from './AppearanceSection';
import { AgentsSection } from './AgentsSection';
import './settings.css';

const SUB_TABS: Array<{ id: SettingsSubTab; label: string; icon: typeof Cpu }> = [
  { id: 'models', label: 'Models', icon: Cpu },
  { id: 'actions', label: 'Actions', icon: Zap },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'agents', label: 'Agents', icon: Users },
];

export function SettingsDocument() {
  const activeSettingsSubTab = useUIStore((s) => s.activeSettingsSubTab);
  const setActiveSettingsSubTab = useUIStore((s) => s.setActiveSettingsSubTab);

  return (
    <div className="settings-document">
      {/* Fixed, non-closable sub-tab strip. */}
      <div className="settings-subtabs" role="tablist" aria-label="Settings sections">
        {SUB_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeSettingsSubTab === id}
            className={`settings-subtab${activeSettingsSubTab === id ? ' settings-subtab--active' : ''}`}
            onClick={() => setActiveSettingsSubTab(id)}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Left + center layout per sub-tab (right panel closed). */}
      <div className="flex-1 min-h-0 overflow-h" style={{ display: 'flex' }}>
        {activeSettingsSubTab === 'models' && <ModelsSection />}
        {activeSettingsSubTab === 'actions' && <ActionsSection />}
        {activeSettingsSubTab === 'appearance' && <AppearanceSection />}
        {activeSettingsSubTab === 'agents' && <AgentsSection />}
      </div>
    </div>
  );
}
