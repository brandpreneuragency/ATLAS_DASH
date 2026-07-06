import { useState } from 'react';
import type { ReactNode } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../../stores/aiStore';
import { SettingsPanels } from './SettingsPanels';
import { ModelManagementContent } from './ModelsContent';
import {
  EMBEDDINGS_GROUP_ID,
  IMAGE_GROUP_ID,
  VECTOR_GROUP_ID,
} from './modelProviderGroups';

interface ListItem {
  id: string;
  label: string;
  connected: boolean;
  meta?: number;
}

interface ModelsSectionProps {
  rightHeader?: ReactNode;
  rightMain?: ReactNode;
  rightFooter?: ReactNode;
}

export function ModelsSection({ rightHeader, rightMain, rightFooter }: ModelsSectionProps = {}) {
  const { t } = useTranslation();
  const { providerConfigs } = useAIStore();
  const [focusProviderId, setFocusProviderId] = useState<string | null>(
    providerConfigs.find((p) => p.status === 'connected')?.id ?? providerConfigs[0]?.id ?? null,
  );

  const llmItems: ListItem[] = providerConfigs.map((p) => ({
    id: p.id,
    label: p.name,
    connected: p.status === 'connected',
    meta: (p.models ?? []).length,
  }));

  const groups: { id: string; label: string; items: ListItem[] }[] = [
    { id: 'llm', label: t('settings.groupLLM'), items: llmItems },
    { id: EMBEDDINGS_GROUP_ID, label: t('settings.groupEmbeddings'), items: [] },
    { id: VECTOR_GROUP_ID, label: t('settings.groupVector'), items: [] },
    { id: IMAGE_GROUP_ID, label: t('settings.groupImageModels'), items: [] },
  ];

  const renderDot = (connected: boolean) => (
    <span
      className={`settings-status-dot ${connected ? 'settings-status-dot--connected' : 'settings-status-dot--disconnected'}`}
      aria-hidden
    />
  );

  const renderEmptyGroup = () => (
    <span className="settings-list-item--empty">
      {t('settings.comingSoon')}
    </span>
  );

  const leftMain = (
    <div className="settings-list-body">
      {groups.map((group) => (
        <div key={group.id} className="settings-provider-group">
          <div className="settings-provider-group-head">
            <span>{group.label}</span>
            <span className="settings-provider-group-count">{group.items.length}</span>
          </div>
          <div className="settings-provider-group-body">
            {group.items.length === 0
              ? renderEmptyGroup()
              : group.items.map((item) => (
                  <button
                    key={item.id}
                    className={`settings-list-item${focusProviderId === item.id ? ' settings-list-item--active' : ''}`}
                    onClick={() => setFocusProviderId(item.id)}
                  >
                    {renderDot(item.connected)}
                    <span className="settings-list-item-title">{item.label}</span>
                    {item.meta != null && <span className="settings-list-item-meta">{item.meta}</span>}
                  </button>
                ))}
          </div>
        </div>
      ))}
      <button
        className="settings-add-btn"
        onClick={() => setFocusProviderId(null)}
      >
        <Plus size={14} /> {t('settings.addProvider')}
      </button>
    </div>
  );

  const focusedProvider = providerConfigs.find((p) => p.id === focusProviderId);
  const focusedPlaceholderGroup = groups.find((g) => g.id === focusProviderId && g.items.length === 0);
  const focusedLabel = focusedPlaceholderGroup
    ? focusedPlaceholderGroup.label
    : focusedProvider?.name ?? null;

  const centerMain = (
    <div className="flex-1 min-h-0 overflow-h flex-col items-start justify-start">
      <ModelManagementContent isInline focusProviderId={focusProviderId} />
    </div>
  );

  const centerHeader = (
    <div className="settings-list-head">
      <h3>{focusedLabel ?? t('settings.modelsSection')}</h3>
    </div>
  );

  return (
    <SettingsPanels
      leftHeader={
        <div className="settings-list-head" style={{ justifyContent: 'space-between' }}>
          <h3>{t('settings.aiProviders')}</h3>
          <button
            className="btn-icon"
            title={t('settings.refreshProviderStatus')}
            onClick={() => void useAIStore.getState().refreshAllProviderStatuses()}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      }
      leftMain={leftMain}
      centerHeader={centerHeader}
      centerMain={centerMain}
      rightHeader={rightHeader}
      rightMain={rightMain}
      rightFooter={rightFooter}
    />
  );
}
