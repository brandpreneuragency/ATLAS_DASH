import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AIProviderConfig, ProviderImportUiState } from '../../../types';
import { ProviderStatusBadge } from '../../modals/modelProvider/ProviderStatusBadge';
import { ProviderTabs, type ProviderTabId } from './ProviderTabs';
import { ProviderConnectionTab } from './ProviderConnectionTab';
import { ProviderModelsTab } from './ProviderModelsTab';
import { ProviderDefaultsTab } from './ProviderDefaultsTab';
import { ProviderUsageTab } from './ProviderUsageTab';
import { ProviderAdvancedTab } from './ProviderAdvancedTab';

interface ProviderDetailPanelProps {
  provider: AIProviderConfig;
  hiddenModels: string[];
  draftKey: string;
  draftBaseUrl: string;
  importState: ProviderImportUiState;
  connectionState: { phase: 'idle' | 'connecting' | 'error'; message?: string };
  testConnectionState: { phase: 'idle' | 'testing' | 'success' | 'error'; message?: string };
  syncState: { phase: 'idle' | 'syncing' | 'success' | 'error'; message?: string };
  onDraftKeyChange: (value: string) => void;
  onDraftBaseUrlChange: (value: string) => void;
  onTestConnection: () => void;
  onSyncModels: () => void;
  onToggleModel: (providerId: string, modelId: string, enabled: boolean) => void;
  onAddCustomModel: (providerId: string, slug: string) => void;
  onDeleteProvider: (id: string) => void;
}

const DEFAULT_TABS: { id: ProviderTabId; labelKey: string }[] = [
  { id: 'connection', labelKey: 'models.tabConnection' },
  { id: 'models', labelKey: 'models.tabModels' },
  { id: 'defaults', labelKey: 'models.tabDefaults' },
  { id: 'usage', labelKey: 'models.tabUsage' },
  { id: 'advanced', labelKey: 'models.tabAdvanced' },
];

export function ProviderDetailPanel({
  provider,
  hiddenModels,
  draftKey,
  draftBaseUrl,
  importState,
  connectionState,
  testConnectionState,
  syncState,
  onDraftKeyChange,
  onDraftBaseUrlChange,
  onTestConnection,
  onSyncModels,
  onToggleModel,
  onAddCustomModel,
  onDeleteProvider,
}: ProviderDetailPanelProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ProviderTabId>('connection');

  const status = provider.status ?? 'not_connected';
  const modelCount = (provider.models ?? []).length;
  const lastImportedAt = provider.lastImportedAt;
  const lastImportedLabel = lastImportedAt
    ? new Date(lastImportedAt).toLocaleString()
    : null;

  const tabs = DEFAULT_TABS.map((tab) => ({
    id: tab.id,
    label: t(tab.labelKey),
  }));

  return (
    <div className="provider-detail-panel col gap-0" style={{ height: '100%' }}>
      {/* Header */}
      <div className="provider-detail-header" style={{ padding: '12px 16px', borderBottom: '1px solid var(--c-border-1)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="row gap-3 min-w-0">
            <span className="semibold" style={{ fontSize: 'var(--fs-base)', color: 'var(--c-text-1)' }}>
              {provider.name}
            </span>
            <ProviderStatusBadge status={status} />
          </div>
          <div className="row gap-2 shrink-0">
            <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
              {t('models.modelCount', { count: modelCount })}
            </span>
            {lastImportedLabel && (
              <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
                · {t('models.lastImportedAt', { time: lastImportedLabel })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <ProviderTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      <div className="provider-detail-content flex-1" style={{ overflowY: 'auto', padding: '0 16px' }}>
        {activeTab === 'connection' && (
          <ProviderConnectionTab
            provider={provider}
            draftKey={draftKey}
            draftBaseUrl={draftBaseUrl}
            importState={importState}
            connectionState={connectionState}
            testConnectionState={testConnectionState}
            syncState={syncState}
            onDraftKeyChange={onDraftKeyChange}
            onDraftBaseUrlChange={onDraftBaseUrlChange}
            onTestConnection={onTestConnection}
            onSyncModels={onSyncModels}
          />
        )}
        {activeTab === 'models' && (
          <ProviderModelsTab
            provider={provider}
            hiddenModels={hiddenModels}
            onToggleModel={onToggleModel}
            onAddCustomModel={onAddCustomModel}
          />
        )}
        {activeTab === 'defaults' && (
          <ProviderDefaultsTab />
        )}
        {activeTab === 'usage' && (
          <ProviderUsageTab />
        )}
        {activeTab === 'advanced' && (
          <ProviderAdvancedTab provider={provider} onDeleteProvider={onDeleteProvider} />
        )}
      </div>
    </div>
  );
}
