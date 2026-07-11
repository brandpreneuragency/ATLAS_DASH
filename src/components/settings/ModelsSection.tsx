import { useState, useCallback, useEffect } from 'react';
import { Plus, RefreshCw, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../../stores/aiStore';
import { SettingsPanels } from './SettingsPanels';
import { ModelManagementContent } from './ModelsContent';
import { ConnectProviderPanel } from './modelProviders/ConnectProviderPanel';
import { ProviderDefaultsTab } from './modelProviders/ProviderDefaultsTab';

const DEFAULTS_SELECTION_ID = '__defaults__';

export function ModelsSection() {
  const { t } = useTranslation();
  const providerConfigs = useAIStore((s) => s.providerConfigs);

  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    () =>
      providerConfigs.find((p) => p.status === 'connected')?.id ??
      providerConfigs[0]?.id ??
      null,
  );
  const [addProviderOpen, setAddProviderOpen] = useState(false);

  // Reconcile only when the selected id was removed — do not auto-fill a cleared (null) selection.
  useEffect(() => {
    if (!selectedProviderId) return;
    if (providerConfigs.some((p) => p.id === selectedProviderId)) return;
    const connected = providerConfigs.find((p) => p.status === 'connected');
    setSelectedProviderId(connected?.id ?? providerConfigs[0]?.id ?? null);
  }, [providerConfigs, selectedProviderId]);

  const handleProviderConnected = useCallback((providerId: string) => {
    setSelectedProviderId(providerId);
    setAddProviderOpen(false);
  }, []);

  const handleCancelAddProvider = useCallback(() => {
    setAddProviderOpen(false);
    setSelectedProviderId(null);
  }, []);

  const handleDeleteProvider = useCallback((id: string) => {
    void useAIStore.getState().deleteCustomProvider(id);
  }, []);

  const selectProvider = useCallback((id: string) => {
    setAddProviderOpen(false);
    setSelectedProviderId(id);
  }, []);

  const leftMain = (
    <div className="settings-list-body">
      <div className="settings-provider-group">
        <div className="settings-provider-group-head">
          <span>{t('settings.groupLLM')}</span>
          <span className="settings-provider-group-count">{providerConfigs.length}</span>
        </div>
        <div className="settings-provider-group-body">
          {providerConfigs.map((p) => {
            const connected = p.status === 'connected';
            const modelCount = (p.models ?? []).length;
            const enabledCount = (p.models ?? []).filter(
              (m) => !useAIStore.getState().isModelHidden(p.id, m.id),
            ).length;
            const isActive = !addProviderOpen && selectedProviderId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                className={`settings-list-item${isActive ? ' settings-list-item--active' : ''}`}
                onClick={() => selectProvider(p.id)}
                aria-current={isActive ? 'true' : undefined}
              >
                <span
                  className={`settings-status-dot ${connected ? 'settings-status-dot--connected' : 'settings-status-dot--disconnected'}`}
                  aria-hidden
                />
                <span className="settings-list-item-title">{p.name}</span>
                <span className="settings-list-item-meta">
                  {enabledCount}/{modelCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        className={`settings-add-btn${addProviderOpen ? ' settings-add-btn--active' : ''}`}
        onClick={() => setAddProviderOpen(true)}
        aria-label={t('settings.addProvider')}
        aria-current={addProviderOpen ? 'true' : undefined}
      >
        <Plus size={14} />
        <span>{t('settings.addProvider')}</span>
      </button>
      {providerConfigs.length > 0 && (
        <button
          type="button"
          className={`settings-list-item settings-defaults-row-btn${!addProviderOpen && selectedProviderId === DEFAULTS_SELECTION_ID ? ' settings-list-item--active' : ''}`}
          onClick={() => selectProvider(DEFAULTS_SELECTION_ID)}
          aria-current={!addProviderOpen && selectedProviderId === DEFAULTS_SELECTION_ID ? 'true' : undefined}
        >
          <Settings2 size={14} />
          <span className="settings-list-item-title">{t('models.tabDefaults')}</span>
        </button>
      )}
    </div>
  );

  const isDefaultsView = !addProviderOpen && selectedProviderId === DEFAULTS_SELECTION_ID;

  const centerMain = addProviderOpen ? (
    <ConnectProviderPanel
      open={addProviderOpen}
      onClose={handleCancelAddProvider}
      onConnected={handleProviderConnected}
    />
  ) : (
    <div className="flex-1 min-h-0 overflow-h flex-col items-start justify-start">
      {isDefaultsView ? (
        <div style={{ padding: '0 16px', overflowY: 'auto', height: '100%' }}>
          <ProviderDefaultsTab />
        </div>
      ) : (
        <ModelManagementContent
          isInline
          selectedProviderId={selectedProviderId}
          onDeleteProvider={handleDeleteProvider}
        />
      )}
    </div>
  );

  const selectedProvider = providerConfigs.find((p) => p.id === selectedProviderId);
  const centerHeader = (
    <div className="settings-list-head">
      <h3>
        {addProviderOpen
          ? t('models.addProvider')
          : isDefaultsView
            ? t('models.tabDefaults')
            : (selectedProvider?.name ?? t('settings.modelsSection'))}
      </h3>
    </div>
  );

  return (
    <SettingsPanels
      leftHeader={
        <div className="settings-list-head" style={{ justifyContent: 'space-between' }}>
          <h3>{t('settings.aiProviders')}</h3>
          <button
            type="button"
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
    />
  );
}
