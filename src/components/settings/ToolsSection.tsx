import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../../stores/aiStore';
import { SettingsPanels } from './SettingsPanels';
import {
  ToolsList,
  DEFAULTS_SELECTION_ID,
  ADD_PROVIDER_SELECTION_ID,
} from './tools/ToolsList';
import { SearchToolDetail } from './tools/SearchToolDetail';
import { ModelManagementContent } from './ModelsContent';
import { ConnectProviderPanel } from './modelProviders/ConnectProviderPanel';
import { ProviderDefaultsTab } from './modelProviders/ProviderDefaultsTab';
import type { SearchProvider } from '../../types';

const SEARCH_PROVIDER_IDS: string[] = ['tavily', 'exa', 'firecrawl', 'brave'];

function isStableSelectionId(id: string): boolean {
  return (
    SEARCH_PROVIDER_IDS.includes(id) ||
    id === DEFAULTS_SELECTION_ID ||
    id === ADD_PROVIDER_SELECTION_ID
  );
}

export function ToolsSection() {
  const { t } = useTranslation();
  const providerConfigs = useAIStore((s) => s.providerConfigs);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [customFormKey, setCustomFormKey] = useState(0);

  // If a focused LLM provider was deleted, treat selection as cleared without an effect.
  const activeFocusId = useMemo(() => {
    if (!focusId) return null;
    if (isStableSelectionId(focusId)) return focusId;
    return providerConfigs.some((p) => p.id === focusId) ? focusId : null;
  }, [focusId, providerConfigs]);

  const handleSelect = useCallback((id: string) => {
    if (id === ADD_PROVIDER_SELECTION_ID) {
      setCustomFormKey((k) => k + 1);
    }
    setFocusId(id);
  }, []);

  const handleProviderConnected = useCallback((providerId: string) => {
    setFocusId(providerId);
  }, []);

  const handleCancelAddProvider = useCallback(() => {
    setFocusId(null);
  }, []);

  const handleDeleteProvider = useCallback((id: string) => {
    void useAIStore.getState().deleteCustomProvider(id);
  }, []);

  const isSearchTool = SEARCH_PROVIDER_IDS.includes(activeFocusId ?? '');
  const focusedSearchTool = isSearchTool ? (activeFocusId as SearchProvider) : null;
  const isAddProvider = activeFocusId === ADD_PROVIDER_SELECTION_ID;
  const isDefaults = activeFocusId === DEFAULTS_SELECTION_ID;
  const selectedProvider = !isSearchTool && !isAddProvider && !isDefaults
    ? providerConfigs.find((p) => p.id === activeFocusId)
    : undefined;

  const centerMain = isAddProvider ? (
    <ConnectProviderPanel
      key={customFormKey}
      open={isAddProvider}
      onClose={handleCancelAddProvider}
      onConnected={handleProviderConnected}
    />
  ) : isDefaults ? (
    <div className="settings-detail-body">
      <div style={{ padding: '0 16px', overflowY: 'auto', height: '100%' }}>
        <ProviderDefaultsTab />
      </div>
    </div>
  ) : focusedSearchTool ? (
    <div className="settings-detail-body">
      <SearchToolDetail providerId={focusedSearchTool} />
    </div>
  ) : selectedProvider ? (
    <div className="flex-1 min-h-0 overflow-h flex-col items-start justify-start">
      <ModelManagementContent
        isInline
        selectedProviderId={selectedProvider.id}
        onDeleteProvider={handleDeleteProvider}
      />
    </div>
  ) : (
    <div className="settings-detail-body">
      <div className="settings-empty">
        <p>{t('tools.selectToolHint')}</p>
      </div>
    </div>
  );

  return (
    <SettingsPanels
      leftMain={<ToolsList focusId={activeFocusId} onSelect={handleSelect} />}
      centerMain={centerMain}
    />
  );
}
