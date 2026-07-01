import { useState } from 'react';
import type { ReactNode } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../../stores/aiStore';
import { SettingsPanels } from './SettingsPanels';
import {
  ModelManagementContent,
  EXA_PROVIDER_ID,
  TAVILY_PROVIDER_ID,
  EMBEDDINGS_GROUP_ID,
  VECTOR_GROUP_ID,
  isSearchProviderId,
  isPlaceholderGroupId,
} from './ModelsContent';

const SEARCH_PROVIDERS = [
  { id: EXA_PROVIDER_ID, labelKey: 'settings.exa' as const },
  { id: TAVILY_PROVIDER_ID, labelKey: 'settings.tavily' as const },
] as const;

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
  const { providerConfigs, searchConfig } = useAIStore();
  const [focusProviderId, setFocusProviderId] = useState<string | null>(
    providerConfigs.find((p) => p.status === 'connected')?.id ?? providerConfigs[0]?.id ?? null,
  );

  const llmItems: ListItem[] = providerConfigs.map((p) => ({
    id: p.id,
    label: p.name,
    connected: p.status === 'connected',
    meta: (p.models ?? []).length,
  }));

  const searchItems: ListItem[] = SEARCH_PROVIDERS.map((p) => ({
    id: p.id,
    label: t(p.labelKey),
    connected: p.id === EXA_PROVIDER_ID
      ? Boolean(searchConfig.exaKey.trim())
      : Boolean(searchConfig.tavilyKey.trim()),
  }));

  const groups: { id: string; label: string; items: ListItem[] }[] = [
    { id: 'llm', label: t('settings.groupLLM'), items: llmItems },
    { id: 'web-search', label: t('settings.groupWebSearch'), items: searchItems },
    { id: EMBEDDINGS_GROUP_ID, label: t('settings.groupEmbeddings'), items: [] },
    { id: VECTOR_GROUP_ID, label: t('settings.groupVector'), items: [] },
  ];

  const renderDot = (connected: boolean) => (
    <span
      className="settings-list-item-meta"
      style={{
        width: 8,
        height: 8,
        borderRadius: 9999,
        flexShrink: 0,
        background: connected ? 'var(--c-success)' : 'var(--c-text-3)',
      }}
      aria-hidden
    />
  );

  const renderEmptyGroup = (groupId: string) => (
    <button
      className={`settings-list-item settings-list-item--placeholder${focusProviderId === groupId ? ' settings-list-item--active' : ''}`}
      onClick={() => setFocusProviderId(groupId)}
    >
      <span className="settings-list-item-title subtle" style={{ fontStyle: 'italic' }}>
        {t('settings.comingSoon')}
      </span>
    </button>
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
              ? renderEmptyGroup(group.id)
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
        title="Use the Connect provider button in the center panel to add a provider"
      >
        <Plus size={14} /> Connect provider
      </button>
    </div>
  );

  const focusedProvider = providerConfigs.find((p) => p.id === focusProviderId);
  const focusedSearchProvider = SEARCH_PROVIDERS.find((p) => p.id === focusProviderId);
  const focusedPlaceholderGroup = groups.find((g) => g.id === focusProviderId && g.items.length === 0);
  const focusedLabel =
    focusedSearchProvider
      ? t(focusedSearchProvider.labelKey)
      : focusedPlaceholderGroup
        ? focusedPlaceholderGroup.label
        : focusedProvider?.name ?? null;

  const centerMain = (
    <div className="flex-1 min-h-0 overflow-h flex-col items-start justify-start">
      <ModelManagementContent isInline focusProviderId={focusProviderId} />
    </div>
  );

  const centerHeader = (
    <div className="settings-list-head">
      <h3>{focusedLabel ?? (isSearchProviderId(focusProviderId) || isPlaceholderGroupId(focusProviderId) ? 'Providers' : 'Models')}</h3>
    </div>
  );

  return (
    <SettingsPanels
      leftHeader={
        <div className="settings-list-head" style={{ justifyContent: 'space-between' }}>
          <h3>Providers</h3>
          <button
            className="btn-icon"
            title="Refresh provider status"
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
