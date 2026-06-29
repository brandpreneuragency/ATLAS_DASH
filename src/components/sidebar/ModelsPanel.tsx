import { Layers, Settings2 } from 'lucide-react';
import { useAIStore } from '../../stores/aiStore';
import { useUIStore } from '../../stores/uiStore';

export function ModelsPanel() {
  const { providerConfigs, activeProviderId, setActiveProvider, setActiveModel, isModelHidden } = useAIStore();
  const { openSettings } = useUIStore();

  return (
    <div className="flex-1 flex flex-col overflow-h">
      <div className="shrink-0 bg-panel row" style={{ justifyContent: 'space-between', padding: '8px 12px', height: 36, borderRadius: 10 }}>
        <h3 className="semibold" style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-1)' }}>Models</h3>
        <button
          onClick={() => openSettings('models')}
          className="row gap-1" style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-accent-center-panel)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <Settings2 size={13} /> Manage
        </button>
      </div>

      <div className="flex-1 overflow-y-a" style={{ padding: '12px' }}>
        {providerConfigs.length === 0 && (
          <div className="flex flex-col" style={{ alignItems: 'center', justifyContent: 'center', padding: '48px 0', textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--c-background-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Layers size={18} style={{ color: 'var(--c-accent-center-panel)' }} />
            </div>
            <p className="med" style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-text-1)', marginBottom: 4 }}>No models configured</p>
            <p className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>Add a custom provider to start chatting.</p>
            <button
              onClick={() => openSettings('models')}
              style={{ marginTop: 12, fontSize: 'var(--fs-xs)', color: 'var(--c-accent-center-panel)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Open Model Management →
            </button>
          </div>
        )}

        {providerConfigs.map((config) => {
          const visibleModels = (config.models ?? [])
            .filter((m) => !isModelHidden(config.id, m.id));
          if (visibleModels.length === 0) return null;
          return (
            <div key={config.id} style={{ marginBottom: 2 }}>
              <div className="label-sm" style={{ padding: '8px 8px 4px 8px' }}>
                {config.name}
              </div>
              {visibleModels.map((model) => {
                const isActive = config.id === activeProviderId && config.selectedModel === model.id;
                return (
                  <button
                    key={model.id}
                    onClick={() => { setActiveProvider(config.id); setActiveModel(config.id, model.id); }}
                    className="w-full trans-color"
                    style={{
                      textAlign: 'left',
                      padding: '6px 12px',
                      borderRadius: 8,
                      fontSize: 'var(--fs-xs)',
                      fontFamily: 'var(--c-font-1)',
                      border: 'none',
                      background: isActive ? 'var(--c-background-4)' : 'transparent',
                      color: isActive ? 'var(--c-accent-center-panel)' : 'var(--c-text-1)',
                      fontWeight: isActive ? 600 : 400,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--c-background-4)'; }}
                    onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {model.name}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
