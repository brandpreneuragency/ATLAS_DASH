import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Sparkles, Check, Settings } from 'lucide-react';
import { useAIStore } from '../../stores/aiStore';
import { useUIStore } from '../../stores/uiStore';
import { PROVIDER_MODELS } from '../../services/ai/router';

export function AIModelSelector() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { providerConfigs, activeProviderId, setActiveProvider, setActiveModel, isModelHidden } = useAIStore();
  const { setActiveModal } = useUIStore();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeConfig = providerConfigs.find((c) => c.id === activeProviderId);
  const providerLabel = activeConfig
    ? `${PROVIDER_MODELS[activeConfig.provider]?.label ?? activeConfig.provider} / ${activeConfig.selectedModel}`
    : 'AI Model';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-brand/30 hover:border-brand/60 hover:bg-highlight transition-colors text-sm font-medium text-text-primary"
      >
        <Sparkles size={14} className="text-brand" />
        <span className="max-w-36 truncate text-xs">{providerLabel}</span>
        <ChevronDown size={13} className="text-text-secondary" />
      </button>

      {open && (
        <div className="dropdown-menu absolute right-0 top-full mt-1 w-72 bg-white border border-border rounded-lg shadow-lg z-50 py-2">
          <div className="px-3 py-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wide">
            Configured Providers
          </div>

          {providerConfigs.length === 0 && (
            <div className="px-4 py-3 text-sm text-text-secondary">
              No providers configured yet.
            </div>
          )}

          {providerConfigs.flatMap((config) => {
            const visibleModels = (PROVIDER_MODELS[config.provider]?.models ?? [])
              .filter((m) => !isModelHidden(config.provider, m));
            return visibleModels.map((modelId) => (
              <button
                key={`${config.id}:${modelId}`}
                onClick={() => {
                  setActiveProvider(config.id);
                  setActiveModel(config.provider, modelId);
                  setOpen(false);
                }}
                className="flex items-center gap-3 w-full px-4 py-2 text-sm text-text-primary hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 text-left">
                  <div className="font-medium text-xs">
                    {PROVIDER_MODELS[config.provider]?.label ?? config.provider}
                  </div>
                  <div className="text-xs text-text-secondary truncate">{modelId}</div>
                </div>
                {config.id === activeProviderId && config.selectedModel === modelId && (
                  <Check size={14} className="text-brand flex-shrink-0" />
                )}
              </button>
            ));
          })}

          <div className="border-t border-border mt-1 pt-1">
            <button
              onClick={() => { setActiveModal('modelManagement'); setOpen(false); }}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-brand hover:bg-highlight transition-colors"
            >
              <Settings size={14} />
              Manage API Keys & Models
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
