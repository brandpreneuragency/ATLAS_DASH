// ModelManagementContent extracted from the (now removed) ModelManagementModal
// so it can be reused inline inside Settings → Models and by PageTemplatePage.
// Added an optional `focusProviderId` so a left-rail provider list can expand a
// specific provider's accordion (master-detail feel) without rebuilding state.

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { X, RefreshCw, Plus, Layers, Database, Image } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../stores/uiStore';
import { useAIStore } from '../../stores/aiStore';
import { secureStorage } from '../../services/secureStorage';
import type { AIProviderConfig, ModelItem, ProviderImportPhase } from '../../types';
import { ProviderDetailPanel } from './modelProviders/ProviderDetailPanel';
import { ConnectProviderDrawer } from '../modals/modelProvider/ConnectProviderDrawer';
import { ModalFooter } from '../modals/modelProvider/ModalFooter';

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

function renderComingSoonSection({
  icon,
  title,
  hint,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <div className="col gap-3">
      <div className="row gap-2" style={{ padding: '0 4px 8px' }}>
        {icon}
        <span className="label-sm">{title}</span>
      </div>
      <div
        className="col"
        style={{
          padding: 24,
          borderRadius: 12,
          border: '1px dashed var(--c-border-2)',
          background: 'var(--c-background-1)',
          alignItems: 'center',
          textAlign: 'center',
          gap: 8,
        }}
      >
        <span className="label-sm" style={{ color: 'var(--c-text-2)' }}>Coming soon</span>
        <p className="subtle" style={{ fontSize: 'var(--fs-sm)', maxWidth: 420, margin: 0 }}>
          {hint}
        </p>
      </div>
    </div>
  );
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

/** Virtual group ids for placeholder provider groups (no backend yet). */
export const EMBEDDINGS_GROUP_ID = 'embeddings';
export const VECTOR_GROUP_ID = 'vector';
export const IMAGE_GROUP_ID = 'imageModels';

export function isPlaceholderGroupId(id: string | null | undefined): boolean {
  return id === EMBEDDINGS_GROUP_ID || id === VECTOR_GROUP_ID || id === IMAGE_GROUP_ID;
}

interface ModelManagementContentProps {
  isInline?: boolean;
  onClose?: () => void;
  /** Provider id to expand in the accordion (master-detail focus). */
  focusProviderId?: string | null;
}

export function ModelManagementContent({ isInline = false, onClose, focusProviderId }: ModelManagementContentProps) {
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
  const [importState, setImportState] = useState<Record<string, { phase: ProviderImportPhase; message?: string }>>({});
  const [connectionState, setConnectionState] = useState<Record<string, { phase: 'idle' | 'connecting' | 'error'; message?: string }>>({});

  const [connectDrawerOpen, setConnectDrawerOpen] = useState(false);
  const [draftsReady, setDraftsReady] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualSaved, setManualSaved] = useState(false);

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
  const keysChanged = JSON.stringify(draftKeys) !== JSON.stringify(initialDraftKeys);
  const hasNonCredentialChanges = providersChanged || baseUrlsChanged || hiddenChanged;
  const hasChanges = hasNonCredentialChanges || keysChanged;

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
        const message = err instanceof Error ? err.message : 'Failed to save model settings.';
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
      const message = err instanceof Error ? err.message : 'Failed to save model settings.';
      useUIStore.getState().showToast(message, 'error');
      return;
    }
    if (onClose) onClose();
    else setActiveModal(null);
  }, [draftsReady, hasNonCredentialChanges, handleSave, onClose, setActiveModal]);

  const handleManualSave = useCallback(async () => {
    setManualSaving(true);
    setManualSaved(false);
    try {
      await handleSave({ includeKeys: true });
      setManualSaved(true);
      useUIStore.getState().showToast('Model settings saved.', 'info');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save model settings.';
      useUIStore.getState().showToast(message, 'error');
    } finally {
      setManualSaving(false);
    }
  }, [handleSave]);

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

  const handleConnect = async (providerId: string) => {
    const baseUrl = draftBaseUrls[providerId] ?? '';
    const apiKey = draftKeys[providerId] ?? '';
    setConnectionState((prev) => ({ ...prev, [providerId]: { phase: 'connecting' } }));

    try {
      if (draftsReady && hasNonCredentialChanges) {
        await handleSave({ includeKeys: false });
      }
      await saveQueueRef.current;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save model settings.';
      setConnectionState((prev) => ({
        ...prev,
        [providerId]: { phase: 'error', message },
      }));
      useUIStore.getState().showToast(message, 'error');
      return;
    }

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

  const focusedProviders =
    focusProviderId && !isPlaceholderGroupId(focusProviderId)
      ? draftProviders.filter((p) => p.id === focusProviderId)
      : draftProviders;

  const selectedProvider = focusedProviders.length > 0 ? focusedProviders[0] : null;

  const providerDetailPanel = selectedProvider ? (
    <ProviderDetailPanel
      provider={selectedProvider}
      hiddenModels={draftHiddenModels}
      draftKey={draftKeys[selectedProvider.id] ?? ''}
      draftBaseUrl={draftBaseUrls[selectedProvider.id] ?? selectedProvider.baseUrl}
      importState={importState[selectedProvider.id] ?? { phase: 'idle' }}
      connectionState={connectionState[selectedProvider.id] ?? { phase: 'idle' }}
      onDraftKeyChange={(v) => handleDraftKeyChange(selectedProvider.id, v)}
      onDraftBaseUrlChange={(v) => handleDraftBaseUrlChange(selectedProvider.id, v)}
      onImport={() => handleImport(selectedProvider.id)}
      onConnect={() => handleConnect(selectedProvider.id)}
      onToggleModel={toggleModel}
      onAddCustomModel={addCustomModel}
      onDeleteProvider={(id) => {
        void useAIStore.getState().deleteCustomProvider(id);
      }}
    />
  ) : (
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
        height: '100%',
      }}
    >
      <p className="med" style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-text-1)', marginBottom: 4 }}>
        {t('models.noCustomProviders')}
      </p>
      <p className="subtle" style={{ fontSize: 'var(--fs-xs)', marginBottom: 16 }}>
        {t('models.noCustomProvidersHint')}
      </p>
      <button
        type="button"
        onClick={() => setConnectDrawerOpen(true)}
        className="connect-provider-btn"
      >
        <Plus size={16} />
        {t('models.connectProvider')}
      </button>
    </div>
  );

  const handleProviderConnected = (providerId: string, apiKey: string) => {
    const updated = useAIStore.getState().providerConfigs.find((p) => p.id === providerId);
    if (updated) {
      const persistedKey = apiKey.trim();
      setDraftProviders((prev) => [
        ...prev.filter((provider) => provider.id !== providerId),
        updated,
      ]);
      setDraftKeys((prev) => ({ ...prev, [providerId]: persistedKey }));
      setInitialDraftKeys((prev) => ({ ...prev, [providerId]: persistedKey }));
      setDraftBaseUrls((prev) => ({ ...prev, [providerId]: updated.baseUrl }));
      setInitialDraftBaseUrls((prev) => ({ ...prev, [providerId]: updated.baseUrl }));
    }
  };


  const placeholderGroupSection =
    focusProviderId === EMBEDDINGS_GROUP_ID
      ? renderComingSoonSection({
          icon: <Layers size={14} style={{ color: 'var(--c-accent-center-panel)' }} />,
          title: t('settings.groupEmbeddings'),
          hint: t('settings.embeddingsHint'),
        })
      : focusProviderId === VECTOR_GROUP_ID
        ? renderComingSoonSection({
            icon: <Database size={14} style={{ color: 'var(--c-accent-center-panel)' }} />,
            title: t('settings.groupVector'),
            hint: t('settings.vectorHint'),
          })
        : focusProviderId === IMAGE_GROUP_ID
          ? renderComingSoonSection({
              icon: <Image size={14} style={{ color: 'var(--c-accent-center-panel)' }} />,
              title: t('settings.groupImageModels'),
              hint: t('settings.comingSoon'),
            })
          : null;

  if (isInline) {
    return (
      <div
        ref={modalRef}
        className="flex-col h-full w-full"
        id="model-management-inline"
        style={{ background: 'var(--c-background-1)', overflow: 'hidden', display: 'flex', borderRadius: 8 }}
      >
        <div className="settings-models-toolbar row gap-2" style={{ padding: '8px 12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>{t('models.subtitle')}</span>
          <button
            type="button"
            onClick={handleRefresh}
            aria-label="Refresh provider status"
            className="btn-icon"
            title="Refresh provider status"
          >
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="model-provider-body flex-1 col gap-2" style={{ padding: '0px 12px 16px 12px', overflowY: 'auto' }}>
          {placeholderGroupSection ?? providerDetailPanel}
        </div>

        <ModalFooter
          hasChanges={hasChanges}
          ready={draftsReady}
          saving={manualSaving}
          saved={manualSaved}
          onSave={() => { void handleManualSave(); }}
        />

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

        <div className="model-provider-body flex-1 col gap-2" style={{ padding: '16px 20px' }}>
          {placeholderGroupSection ?? providerDetailPanel}
        </div>

        <ModalFooter
          hasChanges={hasChanges}
          ready={draftsReady}
          saving={manualSaving}
          saved={manualSaved}
          onSave={() => { void handleManualSave(); }}
        />

        <ConnectProviderDrawer
          open={connectDrawerOpen}
          onClose={() => setConnectDrawerOpen(false)}
          onConnected={handleProviderConnected}
        />
      </div>
    </div>
  );
}
