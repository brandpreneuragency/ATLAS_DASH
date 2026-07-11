import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AIProviderConfig, ModelReasoning, ProviderImportUiState } from '../../../types';
import { ProviderStatusBadge } from '../../modals/modelProvider/ProviderStatusBadge';
import { ProviderTabs, type ProviderTabId } from './ProviderTabs';
import { ProviderConnectionTab } from './ProviderConnectionTab';
import { ProviderModelsTab } from './ProviderModelsTab';

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
  onToggleModelTools: (providerId: string, modelId: string, supportsTools: boolean) => void;
  onSetModelReasoningDescriptor: (providerId: string, modelId: string, reasoning: ModelReasoning | undefined) => void;
  onAddCustomModel: (providerId: string, slug: string) => void;
  onDeleteProvider: (id: string) => void;
  onSaveProviderBaseUrl?: (id: string, baseUrl: string) => void;
}

const DEFAULT_TABS: { id: ProviderTabId; labelKey: string }[] = [
  { id: 'connection', labelKey: 'models.tabConnection' },
  { id: 'models', labelKey: 'models.tabModels' },
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
  onToggleModelTools,
  onSetModelReasoningDescriptor,
  onAddCustomModel,
  onDeleteProvider,
}: ProviderDetailPanelProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ProviderTabId>('connection');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const status = provider.status ?? 'not_connected';
  const modelCount = (provider.models ?? []).length;
  const enabledCount = (provider.models ?? []).filter(
    (m) => !hiddenModels.includes(`${provider.id}:${m.id}`),
  ).length;
  const lastImportedAt = provider.lastImportedAt;
  const lastImportedLabel = lastImportedAt
    ? new Date(lastImportedAt).toLocaleString()
    : null;

  const tabs = DEFAULT_TABS.map((tab) => ({
    id: tab.id,
    label: t(tab.labelKey),
  }));

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDeleteProvider(provider.id);
    setConfirmDelete(false);
  };

  return (
    <div className="provider-detail-panel col gap-0" style={{ height: '100%' }}>
      {/* Header */}
      <div className="provider-detail-header settings-provider-detail-head">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="row gap-3 min-w-0">
            <span className="semibold" style={{ fontSize: 'var(--fs-base)', color: 'var(--c-text-1)' }}>
              {provider.name}
            </span>
            <ProviderStatusBadge status={status} />
            <span className="subtle settings-provider-detail-head-meta">
              {enabledCount}/{modelCount} {t('models.tabModels')}
            </span>
            {lastImportedLabel && (
              <span className="subtle settings-provider-detail-head-meta">
                · {t('models.lastImportedAt', { time: lastImportedLabel })}
              </span>
            )}
          </div>
          <div className="row gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDelete}
              onBlur={() => setConfirmDelete(false)}
              className={`btn-icon${confirmDelete ? ' settings-delete-confirm' : ''}`}
              title={confirmDelete ? t('models.confirmDelete') : t('models.deleteProvider')}
              aria-label={confirmDelete ? t('models.confirmDelete') : t('models.deleteProvider')}
              style={{ color: confirmDelete ? 'var(--c-danger, #dc2626)' : undefined }}
            >
              <Trash2 size={14} />
            </button>
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
            onToggleModelTools={onToggleModelTools}
            onSetModelReasoningDescriptor={onSetModelReasoningDescriptor}
            onAddCustomModel={onAddCustomModel}
            onSyncModels={onSyncModels}
          />
        )}

      </div>
    </div>
  );
}
