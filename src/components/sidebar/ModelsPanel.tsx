import { Layers, Settings2 } from 'lucide-react';
import { useAIStore } from '../../stores/aiStore';
import { useUIStore } from '../../stores/uiStore';
import { PROVIDER_MODELS } from '../../services/ai/router';

export function ModelsPanel() {
  const { providerConfigs, activeProviderId, setActiveProvider, setActiveModel, isModelHidden } = useAIStore();
  const { setActiveModal } = useUIStore();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 rounded-[10px] bg-white">
        <h3 className="text-xs font-semibold text-text-primary">Models</h3>
        <button
          onClick={() => setActiveModal('modelManagement')}
          className="flex items-center gap-1 text-xs text-brand font-medium hover:text-brand-dark transition-colors"
        >
          <Settings2 size={13} /> Manage
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {providerConfigs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-10 h-10 rounded-full bg-highlight flex items-center justify-center mb-3">
              <Layers size={18} className="text-brand" />
            </div>
            <p className="text-sm font-medium text-text-primary mb-1">No models configured</p>
            <p className="text-xs text-text-secondary">Add an API key to start chatting.</p>
            <button
              onClick={() => setActiveModal('modelManagement')}
              className="mt-3 text-xs text-brand font-medium hover:text-brand-dark transition-colors"
            >
              Open Model Management →
            </button>
          </div>
        )}

        {providerConfigs.map((config) => {
          const visibleModels = (PROVIDER_MODELS[config.provider]?.models ?? [])
            .filter((m) => !isModelHidden(config.provider, m));
          if (visibleModels.length === 0) return null;
          return (
            <div key={config.id} className="space-y-0.5">
              <div className="text-[10px] font-bold tracking-widest text-text-secondary uppercase px-2 pt-2 pb-1">
                {PROVIDER_MODELS[config.provider]?.label ?? config.provider}
              </div>
              {visibleModels.map((modelId) => {
                const isActive = config.id === activeProviderId && config.selectedModel === modelId;
                return (
                  <button
                    key={modelId}
                    onClick={() => { setActiveProvider(config.id); setActiveModel(config.provider, modelId); }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                      isActive
                        ? 'bg-highlight text-brand font-semibold'
                        : 'text-text-primary hover:bg-gray-100'
                    }`}
                  >
                    {modelId}
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
