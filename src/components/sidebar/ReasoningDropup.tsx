import { useEffect, useRef, useState } from 'react';
import { Brain } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../../stores/aiStore';
import { resolveReasoning, selectedOption } from '../../services/ai/reasoning';

/** Effort dropup shown only for the active reasoning-capable model. */
export function ReasoningDropup() {
  const { t } = useTranslation();
  const accentColor = 'var(--c-accent-2)';
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { providerConfigs, activeProviderId, setModelReasoning } = useAIStore();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const config = providerConfigs.find((c) => c.id === activeProviderId);
  const model = config?.models?.find((m) => m.id === config.selectedModel);
  const reasoning = model ? resolveReasoning(model, config?.baseUrl) : undefined;
  if (!config || !model || !reasoning) return null;

  const current = selectedOption(reasoning, model.selectedReasoning);

  return (
    <div ref={ref} className="chat-input-bottom-col chat-input-bottom-col--model">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="chat-input-dropup-btn"
        data-active="true"
        style={{ color: accentColor }}
        aria-label={t('chat.thinkingEffort')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Brain size={12} className="chat-input-dropup-icon" />
        <span className="trunc med chat-input-dropup-label">{current.label}</span>
      </button>
      {open && (
        <div className="drop" style={{ left: 0, bottom: '100%', marginBottom: 4, minWidth: 140 }}>
          {reasoning.options.map((opt) => (
            <button
              type="button"
              key={opt.value || 'off'}
              onClick={() => { setModelReasoning(config.id, model.id, opt.value); setOpen(false); }}
              className={`drop-item${opt.value === current.value ? ' header-dropdown-item--active' : ''}`}
              style={{ fontSize: 'var(--fs-xs)' }}
            >
              <span className="med">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
