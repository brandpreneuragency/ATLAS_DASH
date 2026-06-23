import { useState, useEffect, useRef, useCallback } from 'react';
import { X, RefreshCw, Globe, Eye, EyeOff, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../stores/uiStore';
import { useAIStore } from '../../stores/aiStore';
import { secureStorage } from '../../services/secureStorage';
import type { AIProviderConfig, ModelItem, ProviderImportPhase } from '../../types';
import { ProviderAccordionItem } from './modelProvider/ProviderAccordionItem';
import { ConnectProviderDrawer } from './modelProvider/ConnectProviderDrawer';

function providerApiKeyName(providerId: string): string {
  return `providerApiKey_${providerId}`;
}

function modelKey(providerId: string, modelId: string): string {
  return `${providerId}:${modelId}`;
}

function providerWithoutStatus(provider: AIProviderConfig): Omit<AIProviderConfig, 'status'> {
  const next = { ...provider };
  delete (next as Partial<AIProviderConfig>).status;
  return next;
}

interface ModelManagementContentProps {
  isInline?: boolean;
  onClose?: () => void;
}

export function ModelManagementContent({ isInline = false, onClose }: ModelManagementContentProps) {
  const { t } = useTranslation();
  const { activeModal, setActiveModal } = useUIStore();
  const {
    providerConfigs,
    hiddenModels,
    searchConfig,
    saveSearchConfig,
    saveProviderConfig,
    saveProviderApiKey,
    deleteProviderApiKey,
    setHiddenModels,
  } = useAIStore();

  const isOpen = isInline || activeModal === 'modelManagement';
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const initialFocusDone = useRef(false);

  // Draft state initialized from the store when the modal mounts
  const [draftProviders, setDraftProviders] = useState<AIProviderConfig[]>(providerConfigs);
  const [draftHiddenModels, setDraftHiddenModels] = useState<string[]>(hiddenModels);
  const [draftKeys, setDraftKeys] = useState<Record<string, string>>({});
  const [initialDraftKeys, setInitialDraftKeys] = useState<Record<string, string>>({});
  const [draftBaseUrls, setDraftBaseUrls] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const p of providerConfigs) out[p.id] = p.baseUrl ?? '';
    return out;
  });
  const [initialDraftBaseUrls, setInitialDraftBaseUrls] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const p of providerConfigs) out[p.id] = p.baseUrl ?? '';
    return out;
  });
  const [importState, setImportState] = useState<Record<string, { phase: ProviderImportPhase; message?: string }>>({});
  const [connectionState, setConnectionState] = useState<Record<string, { phase: 'idle' | 'connecting' | 'error'; message?: string }>>({});
  const [expandedIds, setExpandedIds] = useState(() => {
    const firstConnected = providerConfigs.find((p) => p.status === 'connected');
    return new Set(firstConnected ? [firstConnected.id] : []);
  });
  const [searchDraft, setSearchDraft] = useState({
    exaKey: searchConfig.exaKey,
    tavilyKey: searchConfig.tavilyKey,
  });
  const [showExaKey, setShowExaKey] = useState(false);
  const [showTavilyKey, setShowTavilyKey] = useState(false);

  const [connectDrawerOpen, setConnectDrawerOpen] = useState(false);
  const [draftsReady, setDraftsReady] = useState(false);

  // Async load of API key drafts from secure storage
  useEffect(() => {
    if (!isOpen) {
      initialFocusDone.current = false;
      return;
    }

    let cancelled = false;

    const loadKeys = async () => {
      const keys: Record<string, string> = {};
      for (const provider of providerConfigs) {
        try {
          const value = await secureStorage.secureGet(providerApiKeyName(provider.id));
          keys[provider.id] = value ?? '';
        } catch {
          keys[provider.id] = '';
        }
      }
      if (cancelled) return;
      setDraftKeys(keys);
      setInitialDraftKeys(keys);
      setDraftsReady(true);
    };

    void loadKeys();
    void useAIStore.getState().refreshAllProviderStatuses();
    return () => {
      cancelled = true;
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus management
  useEffect(() => {
    if (isOpen && !initialFocusDone.current && closeBtnRef.current) {
      initialFocusDone.current = true;
      closeBtnRef.current.focus();
    }
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || isInline) return;

    const modal = modalRef.current;
    if (!modal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const elements = Array.from(focusable).filter((el) => {
        const disabled = (el as HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).disabled;
        return !disabled && el.offsetParent !== null;
      });
      if (elements.length === 0) return;

      const first = elements[0];
      const last = elements[elements.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    modal.addEventListener('keydown', handleKeyDown);
    return () => modal.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isInline]);

  // Detect changes compared to persisted state (for auto-save)
  const providersChanged = (() => {
    if (draftProviders.length !== providerConfigs.length) return true;
    for (const draft of draftProviders) {
      const persisted = providerConfigs.find((p) => p.id === draft.id);
      if (!persisted) return true;
      if (JSON.stringify(providerWithoutStatus(draft)) !== JSON.stringify(providerWithoutStatus(persisted))) return true;
    }
    return false;
  })();
  const baseUrlsChanged = (() => {
    const keys = Object.keys({ ...initialDraftBaseUrls, ...draftBaseUrls });
    for (const id of keys) {
      if ((draftBaseUrls[id] ?? '') !== (initialDraftBaseUrls[id] ?? '')) return true;
    }
    return false;
  })();
  const hiddenChanged = JSON.stringify(draftHiddenModels) !== JSON.stringify(hiddenModels);
  const searchChanged =
    searchDraft.exaKey !== searchConfig.exaKey || searchDraft.tavilyKey !== searchConfig.tavilyKey;
  const keysChanged = JSON.stringify(draftKeys) !== JSON.stringify(initialDraftKeys);
  const hasChanges = providersChanged || baseUrlsChanged || hiddenChanged || searchChanged || keysChanged;

  const persistDrafts = useCallback(async () => {
    for (const provider of draftProviders) {
      const key = draftKeys[provider.id] ?? '';
      const baseUrl = (draftBaseUrls[provider.id] ?? provider.baseUrl).trim();

      if (key.trim()) {
        await saveProviderApiKey(provider.id, key.trim());
      } else {
        await deleteProviderApiKey(provider.id);
      }

      await saveProviderConfig({ ...provider, baseUrl });
    }

    setHiddenModels(draftHiddenModels);
    await saveSearchConfig({
      ...searchConfig,
      exaKey: searchDraft.exaKey.trim(),
      tavilyKey: searchDraft.tavilyKey.trim(),
    });
    await useAIStore.getState().refreshAllProviderStatuses();

    const state = useAIStore.getState();
    const active = state.getActiveProvider();
    if (active) {
      const enabled = (active.models ?? []).filter((model) =>
        !state.isModelHidden(active.id, model.id)
      );
      if (enabled.length > 0 && !enabled.some((model) => model.id === active.selectedModel)) {
        state.setActiveModel(active.id, enabled[0].id);
      }
    }
  }, [
    draftProviders,
    draftKeys,
    draftBaseUrls,
    draftHiddenModels,
    searchDraft,
    searchConfig,
    saveProviderApiKey,
    deleteProviderApiKey,
    saveProviderConfig,
    setHiddenModels,
    saveSearchConfig,
  ]);

  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const handleSave = useCallback(() => {
    const save = async () => {
      try {
        await persistDrafts();
        setInitialDraftKeys({ ...draftKeys });
        setInitialDraftBaseUrls({ ...draftBaseUrls });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save model settings.';
        useUIStore.getState().showToast(message, 'error');
      }
    };
    saveQueueRef.current = saveQueueRef.current.then(save, save);
    return saveQueueRef.current;
  }, [persistDrafts, draftKeys, draftBaseUrls]);

  useEffect(() => {
    if (!isOpen || !draftsReady || !hasChanges) return;
    const timer = setTimeout(() => {
      void handleSave();
    }, 250);
    return () => clearTimeout(timer);
  }, [
    isOpen,
    draftsReady,
    hasChanges,
    draftProviders,
    draftBaseUrls,
    draftHiddenModels,
    draftKeys,
    searchDraft,
    handleSave,
  ]);

  // Close handler — auto-save runs on changes so closing is always safe
  const handleClose = useCallback(async () => {
    if (draftsReady && hasChanges) await handleSave();
    if (onClose) onClose();
    else setActiveModal(null);
  }, [draftsReady, hasChanges, handleSave, onClose, setActiveModal]);

  const latestPersistRef = useRef(persistDrafts);
  const shouldPersistOnUnmountRef = useRef(false);
  useEffect(() => {
    latestPersistRef.current = persistDrafts;
    shouldPersistOnUnmountRef.current = draftsReady && hasChanges;
  }, [persistDrafts, draftsReady, hasChanges]);
  useEffect(() => () => {
    if (shouldPersistOnUnmountRef.current) void latestPersistRef.current();
  }, []);

  useEffect(() => {
    if (!isOpen || isInline) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        void handleClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, isInline, handleClose]);

  if (!isOpen) return null;

  // Actions
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      if (prev.has(id)) return new Set<string>();
      return new Set([id]);
    });
  };

  const toggleModel = (providerId: string, modelId: string, enabled: boolean) => {
    const key = modelKey(providerId, modelId);
    setDraftHiddenModels((prev) => {
      const next = new Set(prev);
      if (enabled) next.delete(key);
      else next.add(key);
      return Array.from(next);
    });
  };

  const addCustomModel = (providerId: string, slug: string) => {
    setDraftProviders((prev) =>
      prev.map((p) => {
        if (p.id !== providerId) return p;
        if (p.customModels.includes(slug)) return p;
        const newModel: ModelItem = {
          id: slug,
          name: slug,
          enabled: true,
          custom: true,
          capabilities: {
            vision: false,
            toolCalling: true,
            contextLength: 'Unknown',
            speed: 'Medium',
            cost: 'External',
            reasoning: 'Unknown',
            endpointType: 'Custom',
            lastSynced: 'Unknown',
          },
        };
        return {
          ...p,
          customModels: [...p.customModels, slug],
          models: [...(p.models ?? []), newModel],
        };
      })
    );
  };

  const handleDraftKeyChange = (providerId: string, key: string) => {
    setDraftKeys((prev) => ({ ...prev, [providerId]: key }));
    setDraftProviders((prev) =>
      prev.map((provider) =>
        provider.id === providerId ? { ...provider, status: 'not_connected' } : provider
      )
    );
    setConnectionState((prev) => ({ ...prev, [providerId]: { phase: 'idle' } }));
    useAIStore.getState().setProviderStatus(providerId, 'not_connected');
  };

  const handleDraftBaseUrlChange = (providerId: string, baseUrl: string) => {
    setDraftBaseUrls((prev) => ({ ...prev, [providerId]: baseUrl }));
    setDraftProviders((prev) =>
      prev.map((p) =>
        p.id === providerId ? { ...p, baseUrl, status: 'not_connected' } : p
      )
    );
    setConnectionState((prev) => ({ ...prev, [providerId]: { phase: 'idle' } }));
    useAIStore.getState().setProviderStatus(providerId, 'not_connected');
  };

  const handleConnect = async (providerId: string) => {
    const baseUrl = draftBaseUrls[providerId] ?? '';
    const apiKey = draftKeys[providerId] ?? '';
    setConnectionState((prev) => ({ ...prev, [providerId]: { phase: 'connecting' } }));

    const result = await useAIStore.getState().connectProvider(providerId, baseUrl, apiKey);
    if (!result.ok) {
      setConnectionState((prev) => ({
        ...prev,
        [providerId]: { phase: 'error', message: result.error },
      }));
      useUIStore.getState().showToast(result.error, 'error');
      return;
    }

    const connected = useAIStore
      .getState()
      .providerConfigs.find((provider) => provider.id === providerId);
    if (connected) {
      setDraftProviders((prev) =>
        prev.map((provider) => (provider.id === providerId ? connected : provider))
      );
      setDraftBaseUrls((prev) => ({ ...prev, [providerId]: connected.baseUrl }));
      setInitialDraftBaseUrls((prev) => ({ ...prev, [providerId]: connected.baseUrl }));
      setInitialDraftKeys((prev) => ({ ...prev, [providerId]: apiKey.trim() }));
    }
    setConnectionState((prev) => ({ ...prev, [providerId]: { phase: 'idle' } }));
    useUIStore.getState().showToast(t('models.providerConnected'), 'info');
  };

  const handleImport = async (providerId: string) => {
    const baseUrl = draftBaseUrls[providerId] ?? '';
    const apiKey = draftKeys[providerId] ?? '';

    setImportState((prev) => ({ ...prev, [providerId]: { phase: 'importing' } }));
    const result = await useAIStore
      .getState()
      .importProviderModels(providerId, baseUrl, apiKey);

    if (result.ok) {
      setImportState((prev) => ({
        ...prev,
        [providerId]: { phase: 'success' },
      }));
      // Sync local drafts with the freshly-persisted store state.
      const updated = useAIStore
        .getState()
        .providerConfigs.find((p) => p.id === providerId);
      if (updated) {
        setDraftProviders((prev) =>
          prev.map((p) => (p.id === providerId ? updated : p))
        );
        setDraftBaseUrls((prev) => ({ ...prev, [providerId]: updated.baseUrl }));
        setInitialDraftBaseUrls((prev) => ({ ...prev, [providerId]: updated.baseUrl }));
      }
      useUIStore.getState().showToast(t('models.imported'), 'info');
      // Clear the success phase after a short delay so the UI returns to
      // its idle header state while still reflecting the connection.
      setTimeout(() => {
        setImportState((prev) => {
          const current = prev[providerId];
          if (current?.phase === 'success') {
            return { ...prev, [providerId]: { phase: 'idle' } };
          }
          return prev;
        });
      }, 2000);
      return;
    }

    setImportState((prev) => ({
      ...prev,
      [providerId]: { phase: 'error', message: result.error },
    }));
    useUIStore.getState().showToast(result.error, 'error');
  };

  const handleRefresh = async () => {
    await useAIStore.getState().refreshAllProviderStatuses();
  };

  const providerAccordionList = (
    <>
      {draftProviders.length > 0 && (
        <div className="provider-accordion-list">
          {draftProviders.map((provider) => (
            <ProviderAccordionItem
              key={provider.id}
              provider={{
                ...provider,
                status:
                  providerConfigs.find((candidate) => candidate.id === provider.id)?.status
                  ?? provider.status,
              }}
              expanded={expandedIds.has(provider.id)}
              hiddenModels={draftHiddenModels}
              draftKey={draftKeys[provider.id] ?? ''}
              draftBaseUrl={draftBaseUrls[provider.id] ?? provider.baseUrl}
              importState={importState[provider.id] ?? { phase: 'idle' }}
              connectionState={connectionState[provider.id] ?? { phase: 'idle' }}
              onToggleExpand={() => toggleExpand(provider.id)}
              onToggleModel={toggleModel}
              onAddCustomModel={addCustomModel}
              onDraftKeyChange={(v) => handleDraftKeyChange(provider.id, v)}
              onDraftBaseUrlChange={(v) => handleDraftBaseUrlChange(provider.id, v)}
              onImport={() => handleImport(provider.id)}
              onConnect={() => handleConnect(provider.id)}
            />
          ))}
        </div>
      )}

      {draftProviders.length === 0 && (
        <div
          className="col"
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 16px',
            textAlign: 'center',
            border: '1px solid var(--c-border-1)',
            borderRadius: 14,
            background: 'var(--c-background-1)',
          }}
        >
          <p className="med" style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-text-1)', marginBottom: 4 }}>
            {t('models.noCustomProviders')}
          </p>
          <p className="subtle" style={{ fontSize: 'var(--fs-xs)', marginBottom: 16 }}>
            {t('models.noCustomProvidersHint')}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setConnectDrawerOpen(true)}
        className="connect-provider-btn"
      >
        <Plus size={16} />
        {t('models.connectProvider')}
      </button>
    </>
  );

  const handleProviderConnected = (providerId: string) => {
    // Sync local drafts with the freshly-persisted store state
    const updated = useAIStore.getState().providerConfigs.find((p) => p.id === providerId);
    if (updated) {
      setDraftProviders((prev) => [...prev, updated]);
      setDraftBaseUrls((prev) => ({ ...prev, [providerId]: updated.baseUrl }));
      setInitialDraftBaseUrls((prev) => ({ ...prev, [providerId]: updated.baseUrl }));
      setExpandedIds(new Set([providerId]));
    }
  };

  if (isInline) {
    return (
      <div
        ref={modalRef}
        className="flex-col h-full w-full"
        id="model-management-inline"
        style={{ background: 'var(--c-background-1)', overflow: 'hidden', display: 'flex', borderRadius: 8 }}
      >
        {/* Body */}
        <div className="model-provider-body flex-1 col gap-2" style={{ padding: '0px 0px 16px 0px', overflowY: 'auto' }}>
          {providerAccordionList}

          {/* Web Search */}
          <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--c-border-1)' }}>
            <div className="row gap-2" style={{ padding: '0 4px 8px' }}>
              <Globe size={14} style={{ color: 'var(--c-accent-center-panel)' }} />
              <span className="label-sm">{t('settings.webSearch')}</span>
            </div>
            <div
              className="col gap-3"
              style={{
                padding: 12,
                borderRadius: 12,
              }}
            >
              <p className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
                {t('settings.tavilyKeyHint')}
              </p>

              <div className="col gap-1">
                <div className="label-sm">
                  Exa API Key <span style={{ fontWeight: 400, textTransform: 'none' }}>(Primary)</span>
                </div>
                <div className="row gap-2">
                  <input
                    type={showExaKey ? 'text' : 'password'}
                    value={searchDraft.exaKey}
                    onChange={(e) => { setSearchDraft((s) => ({ ...s, exaKey: e.target.value })); }}
                    placeholder="exa_..."
                    className="ctrl ctrl--mono flex-1"
                    style={{ fontSize: 'var(--fs-xs)', backgroundColor: 'rgba(194, 194, 194, 0)' }}
                  />
                  <button type="button" onClick={() => setShowExaKey((v) => !v)} className="btn-icon">
                    {showExaKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="col gap-1">
                <div className="label-sm">
                  Tavily API Key <span style={{ fontWeight: 400, textTransform: 'none' }}>(Fallback)</span>
                </div>
                <div className="row gap-2">
                  <input
                    type={showTavilyKey ? 'text' : 'password'}
                    value={searchDraft.tavilyKey}
                    onChange={(e) => { setSearchDraft((s) => ({ ...s, tavilyKey: e.target.value })); }}
                    placeholder="tvly-..."
                    className="ctrl ctrl--mono flex-1"
                    style={{ fontSize: 'var(--fs-xs)', backgroundColor: 'rgba(194, 194, 194, 0)' }}
                  />
                  <button type="button" onClick={() => setShowTavilyKey((v) => !v)} className="btn-icon">
                    {showTavilyKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <ConnectProviderDrawer
          open={connectDrawerOpen}
          onClose={() => setConnectDrawerOpen(false)}
          onConnected={handleProviderConnected}
        />
      </div>
    );
  }

  return (
    <div
      className="overlay"
      id="model-management-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="model-management-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        ref={modalRef}
        className="modal model-provider-modal flex-col"
        id="model-management-modal"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="modal-head shrink-0" style={{ padding: '16px 20px' }}>
          <div>
            <h2 id="model-management-title" style={{ margin: 0, fontSize: 'var(--fs-base)', fontWeight: 600 }}>
              {t('models.title')}
            </h2>
            <p className="subtle" style={{ fontSize: 'var(--fs-xs)', marginTop: 2, marginBottom: 0 }}>
              {t('models.subtitle')}
            </p>
          </div>
          <div className="row gap-1">
            <button
              type="button"
              onClick={handleRefresh}
              aria-label="Refresh provider status"
              className="modal-close"
              style={{ width: 'var(--control-height-sm)', height: 'var(--control-height-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <RefreshCw size={16} />
            </button>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={handleClose}
              aria-label={t('models.close')}
              className="modal-close"
              style={{ width: 'var(--control-height-sm)', height: 'var(--control-height-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="model-provider-body flex-1 col gap-2" style={{ padding: '16px 20px' }}>
          {providerAccordionList}

          {/* Web Search */}
          <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--c-border-1)' }}>
            <div className="row gap-2" style={{ padding: '0 4px 8px' }}>
              <Globe size={14} style={{ color: 'var(--c-accent-center-panel)' }} />
              <span className="label-sm">{t('settings.webSearch')}</span>
            </div>
            <div
              className="col gap-3"
              style={{
                padding: 12,
                background: 'rgba(34,197,94,0.05)',
                border: '1px solid rgba(34,197,94,0.15)',
                borderRadius: 12,
              }}
            >
              <p className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
                {t('settings.tavilyKeyHint')}
              </p>

              <div className="col gap-1">
                <div className="label-sm">
                  Exa API Key <span style={{ fontWeight: 400, textTransform: 'none' }}>(Primary)</span>
                </div>
                <div className="row gap-2">
                  <input
                    type={showExaKey ? 'text' : 'password'}
                    value={searchDraft.exaKey}
                    onChange={(e) => { setSearchDraft((s) => ({ ...s, exaKey: e.target.value })); }}
                    placeholder="exa_..."
                    className="ctrl ctrl--mono flex-1"
                    style={{ fontSize: 'var(--fs-xs)' }}
                  />
                  <button type="button" onClick={() => setShowExaKey((v) => !v)} className="btn-icon">
                    {showExaKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="col gap-1">
                <div className="label-sm">
                  Tavily API Key <span style={{ fontWeight: 400, textTransform: 'none' }}>(Fallback)</span>
                </div>
                <div className="row gap-2">
                  <input
                    type={showTavilyKey ? 'text' : 'password'}
                    value={searchDraft.tavilyKey}
                    onChange={(e) => { setSearchDraft((s) => ({ ...s, tavilyKey: e.target.value })); }}
                    placeholder="tvly-..."
                    className="ctrl ctrl--mono flex-1"
                    style={{ fontSize: 'var(--fs-xs)' }}
                  />
                  <button type="button" onClick={() => setShowTavilyKey((v) => !v)} className="btn-icon">
                    {showTavilyKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <ConnectProviderDrawer
          open={connectDrawerOpen}
          onClose={() => setConnectDrawerOpen(false)}
          onConnected={handleProviderConnected}
        />
      </div>
    </div>
  );
}

export function ModelManagementModal() {
  const { activeModal, setActiveModal } = useUIStore();
  if (activeModal !== 'modelManagement') return null;
  return <ModelManagementContent isInline={false} onClose={() => setActiveModal(null)} />;
}
