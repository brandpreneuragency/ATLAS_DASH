import { useState, useRef, useEffect } from 'react';
import { X, ChevronRight, ChevronDown, Eye, EyeOff, KeyRound, Check, Globe, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../stores/uiStore';
import { useAIStore } from '../../stores/aiStore';
import type { AIProviderConfig } from '../../types';

function emptyCustomProvider(): AIProviderConfig {
  return {
    id: '',
    name: '',
    provider: 'custom',
    apiKey: '',
    selectedModel: '',
    isActive: true,
    baseUrl: '',
    customModels: [],
  };
}

// ---------------------------------------------------------------------------
// Custom Provider Row
// ---------------------------------------------------------------------------
function CustomProviderRow({ config }: { config: AIProviderConfig }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [keyPopupOpen, setKeyPopupOpen] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [newModelSlug, setNewModelSlug] = useState('');
  const newModelRef = useRef<HTMLInputElement>(null);

  const { hiddenModels, activeProviderId, toggleHiddenModel, setActiveProvider, setActiveModel, addModelToProvider, removeModelFromProvider, deleteCustomProvider, saveCustomProvider } = useAIStore();

  const hasKey = Boolean(config.apiKey);
  const isActiveProvider = config.id === activeProviderId;
  const modelCount = config.customModels.length;

  const handleAddModel = () => {
    const slug = newModelSlug.trim();
    if (!slug) return;
    setNewModelSlug('');
    addModelToProvider(config.id, slug);
    // Re-focus input after store update triggers re-render
    requestAnimationFrame(() => newModelRef.current?.focus());
  };

  const handleKeySave = () => {
    saveCustomProvider(config);
    setKeyPopupOpen(false);
  };

  return (
    <div style={{ border: '1px solid var(--c-border-1)', borderRadius: 12, overflow: 'hidden' }}>
      {/* Provider header row */}
      <div className="row gap-2" style={{ padding: '10px 12px', background: 'var(--c-background-3)' }}>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? t('models.collapse', { provider: config.name }) : t('models.expand', { provider: config.name })}
          className="row gap-2 flex-1"
          style={{ textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
        >
          {expanded
            ? <ChevronDown size={15} className="subtle shrink-0" />
            : <ChevronRight size={15} className="subtle shrink-0" />
          }
          <span className="semibold" style={{ fontSize: 'var(--fs-sm)' }}>{config.name}</span>
          <span className="subtle" style={{ fontSize: 'var(--fs-xs)', marginLeft: 4 }}>
            {t(modelCount !== 1 ? 'models.modelCount_plural' : 'models.modelCount', { count: modelCount })}
          </span>
        </button>
        {hasKey && (
          <span className="row-xs" style={{ fontSize: 'var(--fs-10)', fontWeight: 500, color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '2px 6px', borderRadius: 9999 }}>
            <Check size={10} /> {t('models.keySet')}
          </span>
        )}
        <button
          type="button"
          onClick={() => { setKeyPopupOpen((v) => !v); setExpanded(true); }}
          className="row-xs"
          style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--c-accent-center-panel)',
            fontWeight: 500,
            padding: '4px 8px',
            borderRadius: 8,
            border: '1px solid rgba(34,197,94,0.3)',
            background: 'transparent',
            cursor: 'pointer',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-background-4)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <KeyRound size={12} />
          {t('models.apiKeyLabel')}
        </button>
        <button
          type="button"
          onClick={() => deleteCustomProvider(config.id)}
          className="btn-icon"
          title={t('models.deleteProvider')}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--c-danger)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--c-text-2)')}
          style={{ color: 'var(--c-text-2)', padding: 4 }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* API Key popup */}
      {keyPopupOpen && (
        <div
          className="col"
          style={{
            margin: '0 16px 8px',
            padding: 12,
            background: 'rgba(34,197,94,0.05)',
            border: '1px solid rgba(34,197,94,0.15)',
            borderRadius: 12,
          }}
        >
          <div className="label-sm">
            {t('models.apiKey', { provider: config.name })}
          </div>
          <div className="row gap-2">
            <input
              autoFocus
              type={showKey ? 'text' : 'password'}
              value={config.apiKey}
              onChange={(e) => saveCustomProvider({ ...config, apiKey: e.target.value })}
              placeholder={t('models.pasteKey')}
              className="ctrl ctrl--mono flex-1"
            />
            <button type="button" onClick={() => setShowKey((v) => !v)} className="btn-icon">
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div>
            <div className="label-sm" style={{ marginBottom: 4 }}>
              {t('models.baseUrl')}
            </div>
            <input
              type="text"
              value={config.baseUrl}
              onChange={(e) => saveCustomProvider({ ...config, baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className="ctrl ctrl--mono w-full"
            />
          </div>
          <div className="row gap-2" style={{ paddingTop: 4 }}>
            <button
              type="button"
              onClick={handleKeySave}
              className="btn-brand flex-1"
            >
              {t('models.saveKey')}
            </button>
            <button
              type="button"
              onClick={() => setKeyPopupOpen(false)}
              className="btn"
            >
              {t('models.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Model slugs list (expanded) */}
      {expanded && (
        <div className="split-t">
          {config.customModels.length > 0 ? (
            config.customModels.map((modelSlug) => {
              const key = `${config.id}:${modelSlug}`;
              const hidden = hiddenModels.includes(key);
              const isActive = isActiveProvider && config.selectedModel === modelSlug;
              return (
                <div
                  key={modelSlug}
                  className="row gap-3"
                  style={{
                    padding: '8px 16px',
                    background: isActive ? 'rgba(34,197,94,0.05)' : 'var(--c-background-4)',
                    borderBottom: '1px solid var(--c-border-1)',
                    cursor: !hidden ? 'pointer' : 'default',
                  }}
                  onClick={() => {
                    if (!hidden) {
                      setActiveProvider(config.id);
                      setActiveModel(config.id, modelSlug);
                    }
                  }}
                >
                  {isActive && <Check size={12} style={{ color: 'var(--c-accent-center-panel)', flexShrink: 0 }} />}
                  <span
                    className="flex-1 ctrl--mono"
                    style={{
                      fontSize: 'var(--fs-xs)',
                      color: hidden ? 'var(--c-text-2)' : isActive ? 'var(--c-accent-center-panel)' : 'var(--c-text-1)',
                      textDecoration: hidden ? 'line-through' : undefined,
                      fontWeight: isActive ? 600 : undefined,
                    }}
                  >
                    {modelSlug}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleHiddenModel(key); }}
                    title={hidden ? t('models.showInSelector', { model: modelSlug }) : t('models.hideFromSelector', { model: modelSlug })}
                    aria-label={hidden ? t('models.showInSelector', { model: modelSlug }) : t('models.hideFromSelector', { model: modelSlug })}
                    className="btn-icon"
                    style={{ color: hidden ? 'var(--c-text-2)' : 'rgba(34,197,94,0.4)', padding: 4, borderRadius: 4 }}
                  >
                    {hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeModelFromProvider(config.id, modelSlug); }}
                    className="btn-icon"
                    title={t('models.removeModel')}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--c-danger)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--c-text-2)')}
                    style={{ color: 'var(--c-text-2)', padding: 4, borderRadius: 4 }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          ) : (
            <div className="subtle" style={{ padding: '12px 16px', fontSize: 'var(--fs-xs)', background: 'var(--c-background-4)' }}>
              {t('models.noModels')}
            </div>
          )}

          {/* Add model slug input (subtasks pattern) */}
          <div className="row gap-2" style={{ padding: '8px 16px', background: 'var(--c-background-4)' }}>
            <input
              ref={newModelRef}
              value={newModelSlug}
              onChange={(e) => setNewModelSlug(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleAddModel(); }
              }}
              placeholder={t('models.addModelPlaceholder')}
              className="ctrl ctrl--mono flex-1"
              style={{ fontSize: 'var(--fs-xs)' }}
            />
            {newModelSlug.trim() && (
              <button
                type="button"
                onClick={handleAddModel}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-accent-center-panel)', padding: 4 }}
                title={t('models.addModel')}
              >
                <Check size={16} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Provider Form
// ---------------------------------------------------------------------------
function AddProviderForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { saveCustomProvider } = useAIStore();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedUrl = baseUrl.trim();
    if (!trimmedName || !trimmedUrl) return;
    await saveCustomProvider(emptyCustomProvider());
    // Get the last saved config's ID — actually, let's just create a new one directly
    const id = `cp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await saveCustomProvider({
      id,
      name: trimmedName,
      provider: 'custom',
      apiKey: apiKey.trim(),
      selectedModel: '',
      isActive: true,
      baseUrl: trimmedUrl,
      customModels: [],
    });
    onDone();
  };

  return (
    <div
      className="col gap-2"
      style={{
        padding: 16,
        marginBottom: 8,
        background: 'rgba(34,197,94,0.03)',
        border: '1px solid rgba(34,197,94,0.15)',
        borderRadius: 12,
      }}
    >
      <div>
        <div className="label-sm" style={{ marginBottom: 4 }}>{t('models.providerName')}</div>
        <input
          ref={nameRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder={t('models.providerNamePlaceholder')}
          className="ctrl w-full"
        />
      </div>
      <div>
        <div className="label-sm" style={{ marginBottom: 4 }}>{t('models.baseUrl')}</div>
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="https://api.openai.com/v1"
          className="ctrl ctrl--mono w-full"
        />
      </div>
      <div>
        <div className="label-sm" style={{ marginBottom: 4 }}>{t('models.apiKeyLabel')}</div>
        <div className="row gap-2">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder={t('models.pasteKey')}
            className="ctrl ctrl--mono flex-1"
          />
          <button type="button" onClick={() => setShowKey((v) => !v)} className="btn-icon">
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>
      <div className="row gap-2" style={{ paddingTop: 4 }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!name.trim() || !baseUrl.trim()}
          className="btn-brand flex-1"
          style={{ opacity: !name.trim() || !baseUrl.trim() ? 0.4 : 1 }}
        >
          <Plus size={14} /> {t('models.addProvider')}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="btn"
        >
          {t('models.cancel')}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Modal
// ---------------------------------------------------------------------------
export function ModelManagementModal() {
  const { t } = useTranslation();
  const { activeModal, setActiveModal } = useUIStore();
  const providerConfigs = useAIStore((s) => s.providerConfigs);
  const searchConfig = useAIStore((s) => s.searchConfig);
  const saveSearchConfig = useAIStore((s) => s.saveSearchConfig);

  const [showAddForm, setShowAddForm] = useState(false);
  const [exaKey, setExaKey] = useState(searchConfig.exaKey);
  const [tavilyKey, setTavilyKey] = useState(searchConfig.tavilyKey);
  const [showExaKey, setShowExaKey] = useState(false);
  const [showTavilyKey, setShowTavilyKey] = useState(false);
  const [searchSaved, setSearchSaved] = useState(false);

  const handleSaveSearchKeys = async () => {
    await saveSearchConfig({
      ...searchConfig,
      exaKey: exaKey.trim(),
      tavilyKey: tavilyKey.trim(),
    });
    setSearchSaved(true);
    setTimeout(() => setSearchSaved(false), 2000);
  };

  if (activeModal !== 'modelManagement') return null;

  return (
    <div
      className="overlay"
      id="model-management-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="model-management-title"
      onKeyDown={(e) => e.key === 'Escape' && setActiveModal(null)}
      tabIndex={-1}
    >
      <div className="modal modal--lg flex-col" id="model-management-modal">
        {/* Header */}
        <div className="modal-head shrink-0" style={{ padding: '16px 20px' }}>
          <div className="row gap-3">
            <button
              id="model-management-back-btn"
              type="button"
              onClick={() => setActiveModal('settings')}
              aria-label={t('models.back')}
              className="modal-close"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 id="model-management-title">{t('models.title')}</h2>
              <p className="subtle" style={{ fontSize: 'var(--fs-xs)', marginTop: 2 }}>
                {t('models.subtitle')}
              </p>
            </div>
          </div>
          <button
            id="model-management-close-btn"
            type="button"
            onClick={() => setActiveModal(null)}
            aria-label={t('models.close')}
            className="modal-close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div
          className="flex-1 col gap-1"
          id="model-management-body"
          style={{ padding: '16px 20px' }}
        >
          {/* Add Provider button / form */}
          {!showAddForm ? (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="row gap-2 w-full"
              style={{
                padding: '12px 16px',
                fontSize: 'var(--fs-sm)',
                fontWeight: 500,
                color: 'var(--c-accent-center-panel)',
                background: 'rgba(34,197,94,0.05)',
                border: '1px dashed rgba(34,197,94,0.3)',
                borderRadius: 12,
                cursor: 'pointer',
                justifyContent: 'center',
              }}
            >
              <Plus size={16} /> {t('models.addProvider')}
            </button>
          ) : (
            <AddProviderForm onDone={() => setShowAddForm(false)} />
          )}

          {/* Custom providers list */}
          {providerConfigs.length === 0 && !showAddForm && (
            <div className="flex flex-col" style={{ alignItems: 'center', justifyContent: 'center', padding: '48px 0', textAlign: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--c-background-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Globe size={18} style={{ color: 'var(--c-accent-center-panel)' }} />
              </div>
              <p className="med" style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-text-1)', marginBottom: 4 }}>{t('models.noCustomProviders')}</p>
              <p className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>{t('models.noCustomProvidersHint')}</p>
            </div>
          )}

          {providerConfigs.map((config) => (
            <CustomProviderRow key={config.id} config={config} />
          ))}

          {/* Web Search */}
          <div id="web-search-section" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--c-border-1)' }}>
            <div className="row gap-2" style={{ padding: '8px 16px' }}>
              <Globe size={14} style={{ color: 'var(--c-accent-center-panel)' }} />
              <span className="label-sm">
                Web Search
              </span>
            </div>
            <div
              className="col gap-3"
              style={{
                margin: '0 16px 8px',
                padding: 12,
                background: 'rgba(34,197,94,0.05)',
                border: '1px solid rgba(34,197,94,0.15)',
                borderRadius: 12,
              }}
            >
              <p style={{ fontSize: 'var(--fs-10)', color: 'var(--c-text-2)' }}>
                Add an Exa key (primary, 1000 free/month at{' '}
                <span className="ctrl--mono">exa.ai</span>) and/or a Tavily key (fallback,
                1000 free/month at <span className="ctrl--mono">tavily.com</span>). Toggle
                search on/off with the Globe button in chat.
              </p>

              {/* Exa Key */}
              <div className="col gap-1">
                <div className="label-sm">
                  Exa API Key <span style={{ fontWeight: 400, textTransform: 'none' }}>(Primary)</span>
                </div>
                <div className="row gap-2">
                  <input
                    id="exa-api-key-input"
                    type={showExaKey ? 'text' : 'password'}
                    value={exaKey}
                    onChange={(e) => setExaKey(e.target.value)}
                    placeholder="exa_..."
                    className="ctrl ctrl--mono flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setShowExaKey((v) => !v)}
                    className="btn-icon"
                  >
                    {showExaKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Tavily Key */}
              <div className="col gap-1">
                <div className="label-sm">
                  Tavily API Key <span style={{ fontWeight: 400, textTransform: 'none' }}>(Fallback)</span>
                </div>
                <div className="row gap-2">
                  <input
                    id="tavily-api-key-input"
                    type={showTavilyKey ? 'text' : 'password'}
                    value={tavilyKey}
                    onChange={(e) => setTavilyKey(e.target.value)}
                    placeholder="tvly-..."
                    className="ctrl ctrl--mono flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTavilyKey((v) => !v)}
                    className="btn-icon"
                  >
                    {showTavilyKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <button
                id="save-search-keys-btn"
                type="button"
                onClick={handleSaveSearchKeys}
                className="btn-brand"
              >
                {searchSaved ? <Check size={12} /> : <KeyRound size={12} />}
                {searchSaved ? 'Saved' : 'Save Keys'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
