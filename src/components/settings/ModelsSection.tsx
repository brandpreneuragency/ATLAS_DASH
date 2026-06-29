import { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useAIStore } from '../../stores/aiStore';
import { SettingsPanels } from './SettingsPanels';
import { ModelManagementContent } from './ModelsContent';

export function ModelsSection() {
  const { providerConfigs } = useAIStore();
  const [focusProviderId, setFocusProviderId] = useState<string | null>(
    providerConfigs.find((p) => p.status === 'connected')?.id ?? providerConfigs[0]?.id ?? null,
  );

  const leftMain = (
    <div className="settings-list-body">
      {providerConfigs.length === 0 && (
        <div className="settings-empty">No providers yet. Use “Connect provider” to add one.</div>
      )}
      {providerConfigs.map((p) => (
        <button
          key={p.id}
          className={`settings-list-item${focusProviderId === p.id ? ' settings-list-item--active' : ''}`}
          onClick={() => setFocusProviderId(p.id)}
        >
          <span
            className="settings-list-item-meta"
            style={{
              width: 8,
              height: 8,
              borderRadius: 9999,
              flexShrink: 0,
              background: p.status === 'connected' ? 'var(--c-success)' : 'var(--c-text-3)',
            }}
            aria-hidden
          />
          <span className="settings-list-item-title">{p.name}</span>
          <span className="settings-list-item-meta">{(p.models ?? []).length}</span>
        </button>
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

  const centerHeader = (
    <div className="settings-list-head" style={{ justifyContent: 'space-between' }}>
      <h3>Providers & Models</h3>
      <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>API keys, base URLs & model list</span>
    </div>
  );

  const centerMain = (
    <div className="flex-1 min-h-0 overflow-h flex-col" style={{ display: 'flex' }}>
      <ModelManagementContent isInline focusProviderId={focusProviderId} />
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
    />
  );
}
