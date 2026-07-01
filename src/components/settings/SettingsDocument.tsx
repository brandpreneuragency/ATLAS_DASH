import { useUIStore } from '../../stores/uiStore';
import { ModelsSection } from './ModelsSection';
import { ActionsSection } from './ActionsSection';
import { AppearanceSection } from './AppearanceSection';
import { AgentsSection } from './AgentsSection';
import { ToolsSection } from './ToolsSection';
import { SettingsAISidebar } from './SettingsAISidebar';
import './settings.css';

export function SettingsDocument() {
  const activeSettingsSubTab = useUIStore((s) => s.activeSettingsSubTab);

  return (
    <div className="settings-document">
      <div className="settings-document-body">
        {activeSettingsSubTab === 'models' && (
          <ModelsSection
            rightHeader={<SettingsAISidebar.Header tab="models" />}
            rightMain={<SettingsAISidebar.Body tab="models" />}
            rightFooter={<SettingsAISidebar.Footer tab="models" />}
          />
        )}
        {activeSettingsSubTab === 'actions' && (
          <ActionsSection
            rightHeader={<SettingsAISidebar.Header tab="actions" />}
            rightMain={<SettingsAISidebar.Body tab="actions" />}
            rightFooter={<SettingsAISidebar.Footer tab="actions" />}
          />
        )}
        {activeSettingsSubTab === 'appearance' && (
          <AppearanceSection
            rightHeader={<SettingsAISidebar.Header tab="appearance" />}
            rightMain={<SettingsAISidebar.Body tab="appearance" />}
            rightFooter={<SettingsAISidebar.Footer tab="appearance" />}
          />
        )}
        {activeSettingsSubTab === 'agents' && (
          <AgentsSection
            rightHeader={<SettingsAISidebar.Header tab="agents" />}
            rightMain={<SettingsAISidebar.Body tab="agents" />}
            rightFooter={<SettingsAISidebar.Footer tab="agents" />}
          />
        )}
        {activeSettingsSubTab === 'tools' && (
          <ToolsSection
            rightHeader={<SettingsAISidebar.Header tab="tools" />}
            rightMain={<SettingsAISidebar.Body tab="tools" />}
            rightFooter={<SettingsAISidebar.Footer tab="tools" />}
          />
        )}
      </div>
    </div>
  );
}
