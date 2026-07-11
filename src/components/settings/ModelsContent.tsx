// ModelManagementContent extracted from the (now removed) ModelManagementModal
// so it can be reused inline inside Settings → Models and by PageTemplatePage.
// Uses `selectedProviderId` to show a specific provider's detail panel.

import { useState, useEffect, useRef, useCallback } from 'react';

import { X, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../stores/uiStore';
import { useAIStore } from '../../stores/aiStore';
import { secureStorage } from '../../services/secureStorage';
import type { AIProviderConfig, ModelItem, ModelReasoning, ProviderImportPhase } from '../../types';
import { ProviderDetailPanel } from './modelProviders/ProviderDetailPanel';


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

function hasDraftKey(draftKeys: Record<string, string>, providerId: string): boolean {
  return Object.prototype.hasOwnProperty.call(draftKeys, providerId);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

interface PersistDraftOptions {
  includeKeys?: boolean;
}

async function verifySavedProviderKey(
  providerId: string,
  providerName: string,
  expectedKey: string,
): Promise<void> {
  const account = providerApiKeyName(providerId);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const storedKey = await secureStorage.secureGet(account);
    if ((storedKey ?? '') === expectedKey) {
      return;
    }

    if (attempt < 3) {
      await delay(120 * (attempt + 1));
    }
  }

  throw new Error(`Could not verify the saved API key for ${providerName}.`);
}

interface ModelManagementContentProps {
  isInline?: boolean;
  onClose?: () => void;
  /** Provider id to show in the detail panel. */
  selectedProviderId?: string | null;
  /** Callback when a provider should be deleted. */
  onDeleteProvider?: (id: string) => void;
}

export function ModelManagementContent({ isInline = false, onClose, selectedProviderId, onDeleteProvider }: ModelManagementContentProps) {
  const { t } = useTranslation();
  const { activeModal, setActiveModal } = useUIStore();
  const {
    providerConfigs,
    hiddenModels,
    saveProviderConfig,
    setHiddenModels,
  } = useAIStore();

  const isOpen = isInline || activeModal === 'modelManagement';
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const initialFocusDone = useRef(false);

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
  const [importState] = useState<Record<string, { phase: ProviderImportPhase; message?: string }>>({});
  const [connectionState, setConnectionState] = useState<Record<string, { phase: 'idle' | 'connecting' | 'error'; message?: string }>>({});
  const [testConnectionState, setTestConnectionState] = useState<Record<string, { phase: 'idle' | 'testing' | 'success' | 'error'; message?: string }>>({});
  const [syncState, setSyncState] = useState<Record<string, { phase: 'idle' | 'syncing' | 'success' | 'error'; message?: string }>>({});

  const [draftsReady, setDraftsReady] = useState(false);


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

  useEffect(() => {
    if (isOpen && !initialFocusDone.current && closeBtnRef.current) {
      initialFocusDone.current = true;
      closeBtnRef.current.focus();
    }
  }, [isOpen]);

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
  const hasNonCredentialChanges = providersChanged || baseUrlsChanged || hiddenChanged;

  const persistDrafts = useCallback(async ({ includeKeys = false }: PersistDraftOptions = {}) => {
    for (const provider of draftProviders) {
      const baseUrl = (draftBaseUrls[provider.id] ?? provider.baseUrl).trim();

      if (includeKeys && hasDraftKey(draftKeys, provider.id)) {
        const key = draftKeys[provider.id].trim();
        const initialKey = (initialDraftKeys[provider.id] ?? '').trim();
        if (key !== initialKey) {
          if (key) {
            await secureStorage.secureSet(providerApiKeyName(provider.id), key);
          } else {
            await secureStorage.secureDelete(providerApiKeyName(provider.id));
          }

          await verifySavedProviderKey(provider.id, provider.name, key);
        }
      }

      await saveProviderConfig(
        { ...providerWithoutStatus(provider), baseUrl },
        { refreshStatus: includeKeys },
      );
    }

    setHiddenModels(draftHiddenModels);
    if (includeKeys) {
      await useAIStore.getState().refreshAllProviderStatuses();
    }

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
    initialDraftKeys,
    draftBaseUrls,
    draftHiddenModels,
    saveProviderConfig,
    setHiddenModels,
  ]);

  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const closingRef = useRef(false);
  const handleSave = useCallback(({ includeKeys = false }: PersistDraftOptions = {}) => {
    const save = async () => {
      await persistDrafts({ includeKeys });
      if (includeKeys) {
        setInitialDraftKeys({ ...draftKeys });
      }
      setInitialDraftBaseUrls({ ...draftBaseUrls });
    };
    saveQueueRef.current = saveQueueRef.current.then(save, save);
    return saveQueueRef.current;
  }, [persistDrafts, draftKeys, draftBaseUrls]);

  useEffect(() => {
    if (!isOpen || !draftsReady || !hasNonCredentialChanges) return;
    const timer = setTimeout(() => {
      void handleSave({ includeKeys: false }).catch((err) => {
        const message = err instanceof Error ? err.message : t('settings.failedToSaveModelSettings');
        useUIStore.getState().showToast(message, 'error');
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [
    isOpen,
    draftsReady,
    hasNonCredentialChanges,
    draftProviders,
    draftBaseUrls,
    draftHiddenModels,
    draftKeys,
    handleSave,
    t,
  ]);

  const handleClose = useCallback(async () => {
    closingRef.current = true;
    try {
      if (draftsReady && hasNonCredentialChanges) {
        await handleSave({ includeKeys: false });
      }
      await saveQueueRef.current;
    } catch (err) {
      closingRef.current = false;
      const message = err instanceof Error ? err.message : t('settings.failedToSaveModelSettings');
      useUIStore.getState().showToast(message, 'error');
      return;
    }
    if (onClose) onClose();
    else setActiveModal(null);
  }, [draftsReady, hasNonCredentialChanges, handleSave, onClose, setActiveModal, t]);

  const latestPersistRef = useRef(persistDrafts);
  const shouldPersistOnUnmountRef = useRef(false);
  useEffect(() => {
    latestPersistRef.current = persistDrafts;
    shouldPersistOnUnmountRef.current = draftsReady && hasNonCredentialChanges;
  }, [persistDrafts, draftsReady, hasNonCredentialChanges]);
  useEffect(() => () => {
    if (!closingRef.current && shouldPersistOnUnmountRef.current) {
      void latestPersistRef.current({ includeKeys: false });
    }
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

  const toggleModel = (providerId: string, modelId: string, enabled: boolean) => {
    const key = modelKey(providerId, modelId);
    setDraftHiddenModels((prev) => {
      const next = new Set(prev);
      if (enabled) next.delete(key);
      else next.add(key);
      return Array.from(next);
    });
  };

  const toggleModelTools = (providerId: string, modelId: string, supportsTools: boolean) => {
    useAIStore.getState().setModelSupportsTools(providerId, modelId, supportsTools);
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

  const setModelReasoningDescriptor = (
    providerId: string,
    modelId: string,
    reasoning: ModelReasoning | undefined,
  ) => {
    setDraftProviders((prev) =>
      prev.map((provider) => {
        if (provider.id !== providerId) return provider;
        return {
          ...provider,
          models: (provider.models ?? []).map((model) =>
            model.id === modelId ? { ...model, reasoning } : model,
          ),
        };
      }),
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
  };

  const handleDraftBaseUrlChange = (providerId: string, baseUrl: string) => {
    setDraftBaseUrls((prev) => ({ ...prev, [providerId]: baseUrl }));
    setDraftProviders((prev) =>
      prev.map((p) =>
        p.id === providerId ? { ...p, baseUrl, status: 'not_connected' } : p
      )
    );
    setConnectionState((prev) => ({ ...prev, [providerId]: { phase: 'idle' } }));
  };

  const handleTestConnection = async (providerId: string) => {
    const baseUrl = draftBaseUrls[providerId] ?? '';
    const apiKey = draftKeys[providerId] ?? '';
    setTestConnectionState((prev) => ({ ...prev, [providerId]: { phase: 'testing' } }));

    try {
      const result = await useAIStore
        .getState()
        .importProviderModels(providerId, baseUrl, apiKey);

      if (result.ok) {
        setTestConnectionState((prev) => ({ ...prev, [providerId]: { phase: 'success' } }));
        const updated = useAIStore
          .getState()
          .providerConfigs.find((p) => p.id === providerId);
        if (updated) {
          setDraftProviders((prev) =>
            prev.map((p) => (p.id === providerId ? updated : p))
          );
        }
        setTimeout(() => {
          setTestConnectionState((prev) => {
            const current = prev[providerId];
            if (current?.phase === 'success') {
              return { ...prev, [providerId]: { phase: 'idle' } };
            }
            return prev;
          });
        }, 2000);
      } else {
        setTestConnectionState((prev) => ({
          ...prev,
          [providerId]: { phase: 'error', message: result.error },
        }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('models.testFailed');
      setTestConnectionState((prev) => ({
        ...prev,
        [providerId]: { phase: 'error', message },
      }));
    }
  };

  const handleSyncModels = async (providerId: string) => {
    const baseUrl = draftBaseUrls[providerId] ?? '';
    const apiKey = draftKeys[providerId] ?? '';
    setSyncState((prev) => ({ ...prev, [providerId]: { phase: 'syncing' } }));

    try {
      const result = await useAIStore
        .getState()
        .importProviderModels(providerId, baseUrl, apiKey);

      if (result.ok) {
        setSyncState((prev) => ({ ...prev, [providerId]: { phase: 'success' } }));
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
        setTimeout(() => {
          setSyncState((prev) => {
            const current = prev[providerId];
            if (current?.phase === 'success') {
              return { ...prev, [providerId]: { phase: 'idle' } };
            }
            return prev;
          });
        }, 2000);
      } else {
        setSyncState((prev) => ({
          ...prev,
          [providerId]: { phase: 'error', message: result.error },
        }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('models.syncFailed');
      setSyncState((prev) => ({
        ...prev,
        [providerId]: { phase: 'error', message },
      }));
    }
  };

  const handleRefresh = async () => {
    await useAIStore.getState().refreshAllProviderStatuses();
  };

  const selectedProvider =
    selectedProviderId
      ? draftProviders.find((p) => p.id === selectedProviderId) ?? null
      : null;

  const providerDetailPanel = selectedProvider ? (
    <ProviderDetailPanel
      provider={selectedProvider}
      hiddenModels={draftHiddenModels}
      draftKey={draftKeys[selectedProvider.id] ?? ''}
      draftBaseUrl={draftBaseUrls[selectedProvider.id] ?? selectedProvider.baseUrl}
      importState={importState[selectedProvider.id] ?? { phase: 'idle' }}
      connectionState={connectionState[selectedProvider.id] ?? { phase: 'idle' }}
      testConnectionState={testConnectionState[selectedProvider.id] ?? { phase: 'idle' }}
      syncState={syncState[selectedProvider.id] ?? { phase: 'idle' }}
      onDraftKeyChange={(v) => handleDraftKeyChange(selectedProvider.id, v)}
      onDraftBaseUrlChange={(v) => handleDraftBaseUrlChange(selectedProvider.id, v)}
      onTestConnection={() => handleTestConnection(selectedProvider.id)}
      onSyncModels={() => handleSyncModels(selectedProvider.id)}
      onToggleModel={toggleModel}
      onToggleModelTools={toggleModelTools}
      onSetModelReasoningDescriptor={setModelReasoningDescriptor}
      onAddCustomModel={addCustomModel}
      onDeleteProvider={(id) => {
        if (onDeleteProvider) {
          onDeleteProvider(id);
        } else {
          void useAIStore.getState().deleteCustomProvider(id);
        }
      }}
      onSaveProviderBaseUrl={(id, baseUrl) => {
        void useAIStore.getState().saveProviderConfig({ id, baseUrl });
      }}
    />
  ) : (
    <div className="col settings-empty-provider">
      <p className="med" style={{ fontSize: 'var(--fs-base)', color: 'var(--c-text-1)', marginBottom: 4 }}>
        {t('models.noCustomProviders')}
      </p>
      <p className="subtle" style={{ fontSize: 'var(--fs-base)', marginBottom: 16 }}>
        {t('models.noCustomProvidersHint')}
      </p>
    </div>
  );

  if (isInline) {
    return (
      <div
        ref={modalRef}
        className="flex-col h-full w-full settings-models-inline"
        id="model-management-inline"
      >
        <div className="settings-models-toolbar row gap-2 settings-models-inline-toolbar">
          <span className="subtle" style={{ fontSize: 'var(--fs-base)' }}>{t('models.subtitle')}</span>
          <button
            type="button"
            onClick={handleRefresh}
            aria-label={t('settings.refreshProviderStatus')}
            className="btn-icon"
            title={t('settings.refreshProviderStatus')}
          >
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="model-provider-body flex-1 col gap-2 settings-models-inline-body">
          {providerDetailPanel}
        </div>
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
        <div className="modal-head shrink-0" style={{ padding: '16px 20px' }}>
          <div>
            <h2 id="model-management-title" style={{ margin: 0, fontSize: 'var(--fs-base)', fontWeight: 600 }}>
              {t('models.title')}
            </h2>
            <p className="subtle" style={{ fontSize: 'var(--fs-base)', marginTop: 2, marginBottom: 0 }}>
              {t('models.subtitle')}
            </p>
          </div>
          <div className="row gap-1">
            <button
              type="button"
              onClick={handleRefresh}
              aria-label={t('settings.refreshProviderStatus')}
              className="modal-close settings-modal-icon-btn"
            >
              <RefreshCw size={16} />
            </button>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={handleClose}
              aria-label={t('models.close')}
              className="modal-close settings-modal-icon-btn"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="model-provider-body flex-1 col gap-2 settings-models-inline-body--modal">
          {providerDetailPanel}
        </div>
      </div>
    </div>
  );
}
