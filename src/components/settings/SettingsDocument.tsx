import { useUIStore } from '../../stores/uiStore';
import { ModelsSection } from './ModelsSection';
import { ActionsSection } from './ActionsSection';
import { AppearanceSection } from './AppearanceSection';
import { AgentsSection } from './AgentsSection';
import { ToolsSection } from './ToolsSection';
import './settings.css';

export function SettingsDocument() {
  const activeSettingsSubTab = useUIStore((s) => s.activeSettingsSubTab);

  return (
    <div className="settings-document">
      <div className="settings-document-body">
        {activeSettingsSubTab === 'models' && (
          <ModelsSection />
        )}
        {activeSettingsSubTab === 'actions' && (
          <ActionsSection />
        )}
        {activeSettingsSubTab === 'appearance' && (
          <AppearanceSection />
        )}
        {activeSettingsSubTab === 'agents' && (
          <AgentsSection />
        )}
        {activeSettingsSubTab === 'tools' && (
          <ToolsSection />
        )}
      </div>
    </div>
  );
}
