import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Sparkles, Check, Settings } from 'lucide-react';
import { useAIStore } from '../../stores/aiStore';
import { useUIStore } from '../../stores/uiStore';

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
    ? `${activeConfig.name} / ${activeConfig.selectedModel}`
    : 'AI Model';

  return (
    <div ref={ref} className="relative header-dropdown-wrap">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="header-dropdown-button w-full row med"
      >
        <Sparkles size={14} style={{ color: 'var(--c-accent-center-panel)' }} />
        <span className="trunc header-dropdown-label-text">{providerLabel}</span>
        <ChevronDown size={13} className="subtle" />
      </button>

      {open && (
        <div className="drop header-dropdown-menu header-dropdown-menu--right header-dropdown-menu--wide">
          <div className="header-dropdown-label">
            Configured Providers
          </div>

          {providerConfigs.length === 0 && (
            <div className="header-dropdown-empty">
              No providers configured yet.
            </div>
          )}

          {providerConfigs.flatMap((config) => {
            const visibleModels = config.customModels
              .filter((m) => !isModelHidden(config.id, m));
            return visibleModels.map((modelId) => (
              <button
                key={`${config.id}:${modelId}`}
                onClick={() => {
                  setActiveProvider(config.id);
                  setActiveModel(config.id, modelId);
                  setOpen(false);
                }}
                className="drop-item header-dropdown-item--spacious"
              >
                <div className="flex-1" style={{ textAlign: 'left' }}>
                  <div className="med" style={{ fontSize: 'var(--fs-xs)' }}>
                    {config.name}
                  </div>
                  <div className="subtle trunc" style={{ fontSize: 'var(--fs-xs)' }}>{modelId}</div>
                </div>
                {config.id === activeProviderId && config.selectedModel === modelId && (
                  <Check size={14} className="shrink-0" style={{ color: 'var(--c-accent-center-panel)' }} />
                )}
              </button>
            ));
          })}

          <div className="header-dropdown-separator">
            <button
              type="button"
              onClick={() => { setActiveModal('modelManagement'); setOpen(false); }}
              className="drop-item drop-item--brand"
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
