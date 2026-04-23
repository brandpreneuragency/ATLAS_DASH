import { useState } from 'react';
import { X, ChevronRight, ChevronDown, Eye, EyeOff, KeyRound, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../stores/uiStore';
import { useAIStore } from '../../stores/aiStore';
import { PROVIDER_MODELS, BASE_URLS } from '../../services/ai/router';
import type { AIProviderType, ProviderKey } from '../../types';


interface ApiKeyPopupProps {
  provider: AIProviderType;
  existing?: ProviderKey;
  onSave: (pk: ProviderKey) => void | Promise<void>;
  onClose: () => void;
}

function ApiKeyPopup({ provider, existing, onSave, onClose }: ApiKeyPopupProps) {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState(existing?.apiKey ?? '');
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? '');
  const [show, setShow] = useState(false);

  const handleSave = () => {
    if (!apiKey.trim()) return;
    onSave({ provider, apiKey: apiKey.trim(), baseUrl: baseUrl.trim() || undefined });
    onClose();
  };

  return (
    <div className="mx-4 mb-2 p-3 bg-highlight/40 border border-brand/20 rounded-xl space-y-2">
      <div className="text-[10px] font-bold tracking-widest text-text-secondary uppercase">
        {t('models.apiKey', { provider: PROVIDER_MODELS[provider]?.label })}
      </div>
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type={show ? 'text' : 'password'}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder={t('models.pasteKey')}
          className="flex-1 text-xs border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-brand font-mono bg-white"
        />
        <button type="button" onClick={() => setShow((v) => !v)} className="text-text-secondary hover:text-text-primary">
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      <div>
        <div className="text-[10px] font-bold tracking-widest text-text-secondary uppercase mb-1">
          {t('models.baseUrl')} <span className="font-normal normal-case">{t('models.optionalOverride')}</span>
        </div>
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder={BASE_URLS[provider]}
          className="w-full text-xs border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-brand font-mono bg-white"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={!apiKey.trim()}
          className="flex-1 bg-brand text-white rounded-lg py-1.5 text-xs font-semibold hover:bg-brand-dark transition-colors disabled:opacity-40"
        >
          {t('models.saveKey')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 border border-border rounded-lg text-xs text-text-secondary hover:bg-gray-50 transition-colors"
        >
          {t('models.cancel')}
        </button>
      </div>
    </div>
  );
}

interface ProviderRowProps {
  provider: AIProviderType;
}

function ProviderRow({ provider }: ProviderRowProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [keyPopupOpen, setKeyPopupOpen] = useState(false);
  const { hiddenModels, providerKeys, providerConfigs, activeProviderId, toggleHiddenModel, saveProviderKey, setActiveProvider, setActiveModel } = useAIStore();

  const info = PROVIDER_MODELS[provider];
  const existingKey = providerKeys[provider];
  const hasKey = Boolean(existingKey?.apiKey);
  const config = providerConfigs.find((c) => c.provider === provider);
  const activeModelId = config?.id === activeProviderId ? config?.selectedModel : null;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Provider header row */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-white">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? t('models.collapse', { provider: info.label }) : t('models.expand', { provider: info.label })}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {expanded
            ? <ChevronDown size={15} className="text-text-secondary flex-shrink-0" />
            : <ChevronRight size={15} className="text-text-secondary flex-shrink-0" />
          }
          <span className="text-sm font-semibold text-text-primary">{info.label}</span>
          <span className="text-xs text-text-secondary ml-1">
            {t(info.models.length !== 1 ? 'models.modelCount_plural' : 'models.modelCount', { count: info.models.length })}
          </span>
        </button>
        {hasKey && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
            <Check size={10} /> {t('models.keySet')}
          </span>
        )}
        <button
          type="button"
          onClick={() => { setKeyPopupOpen((v) => !v); setExpanded(true); }}
          className="flex items-center gap-1.5 text-xs text-brand font-medium px-2 py-1 rounded-lg border border-brand/30 hover:bg-highlight transition-colors"
        >
          <KeyRound size={12} />
          {t('models.apiKeyLabel')}
        </button>
      </div>

      {/* API Key popup */}
      {keyPopupOpen && (
        <ApiKeyPopup
          provider={provider}
          existing={existingKey}
          onSave={saveProviderKey}
          onClose={() => setKeyPopupOpen(false)}
        />
      )}

      {/* Model sub-rows */}
      {expanded && info.models.length > 0 && (
        <div className="border-t border-border divide-y divide-border bg-surface-muted">
          {info.models.map((modelId) => {
            const key = `${provider}:${modelId}`;
            const hidden = hiddenModels.includes(key);
            const isActive = activeModelId === modelId;
            return (
              <div key={modelId} className={`flex items-center gap-3 px-4 py-2 ${!hidden && hasKey ? 'cursor-pointer hover:bg-gray-50' : ''} ${isActive ? 'bg-highlight/50' : ''}`}
                onClick={() => {
                  if (!hidden && hasKey && config) {
                    setActiveProvider(config.id);
                    setActiveModel(provider, modelId);
                  }
                }}
              >
                {isActive && <Check size={12} className="text-brand flex-shrink-0" />}
                <span className={`flex-1 text-xs font-mono ${hidden ? 'text-text-secondary line-through' : isActive ? 'text-brand font-semibold' : 'text-text-primary'}`}>
                  {modelId}
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleHiddenModel(key); }}
                  title={hidden ? t('models.showInSelector', { model: modelId }) : t('models.hideFromSelector', { model: modelId })}
                  aria-label={hidden ? t('models.showInSelector', { model: modelId }) : t('models.hideFromSelector', { model: modelId })}
                  className={`p-1 rounded transition-colors ${hidden ? 'text-text-secondary hover:text-text-primary' : 'text-brand/40 hover:text-brand'}`}
                >
                  {hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty models state */}
      {expanded && info.models.length === 0 && (
        <div className="px-4 py-3 text-xs text-text-secondary border-t border-border bg-surface-muted">
          {t('models.noModels')}
        </div>
      )}
    </div>
  );
}

export function ModelManagementModal() {
  const { t } = useTranslation();
  const { activeModal, setActiveModal } = useUIStore();

  if (activeModal !== 'modelManagement') return null;

  const providers = Object.keys(PROVIDER_MODELS) as AIProviderType[];

  return (
    <div
      className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="model-management-title"
      onKeyDown={(e) => e.key === 'Escape' && setActiveModal(null)}
      tabIndex={-1}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 id="model-management-title" className="text-base font-semibold text-text-primary">{t('models.title')}</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              {t('models.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveModal(null)}
            aria-label={t('models.close')}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {providers.map((provider) => (
            <ProviderRow key={provider} provider={provider} />
          ))}
        </div>
      </div>
    </div>
  );
}
