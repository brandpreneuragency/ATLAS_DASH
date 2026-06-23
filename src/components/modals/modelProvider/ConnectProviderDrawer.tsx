import { useState, useEffect, useRef } from 'react';
import { X, Eye, EyeOff, Loader2, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../../../stores/aiStore';
import { useUIStore } from '../../../stores/uiStore';

interface ConnectProviderDrawerProps {
  open: boolean;
  onClose: () => void;
  onConnected?: (providerId: string) => void;
}

export function ConnectProviderDrawer({ open, onClose, onConnected }: ConnectProviderDrawerProps) {
  const { t } = useTranslation();
  const addProvider = useAIStore((s) => s.addProvider);
  const importProviderModels = useAIStore((s) => s.importProviderModels);

  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setBaseUrl('');
      setApiKey('');
      setShowKey(false);
      setConnecting(false);
      setError(null);
      // Focus the name input shortly after opening
      const id = window.setTimeout(() => nameRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!connecting) onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, connecting, onClose]);

  if (!open) return null;

  const canSubmit =
    name.trim().length > 0 &&
    baseUrl.trim().length > 0 &&
    apiKey.trim().length > 0 &&
    !connecting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setConnecting(true);
    setError(null);
    try {
      const created = await addProvider(name, baseUrl, apiKey);
      if (!created) {
        setError('Failed to create provider.');
        setConnecting(false);
        return;
      }

      // Attempt to import models immediately so the user sees results
      const result = await importProviderModels(created.id, baseUrl, apiKey);
      if (!result.ok) {
        setError(result.error);
        // Provider was still created — notify but don't block
        useUIStore.getState().showToast(result.error, 'error');
      } else {
        useUIStore.getState().showToast(t('models.imported'), 'info');
      }

      onConnected?.(created.id);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect provider.';
      setError(msg);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <>
      {/* Scrim */}
      <div
        className="connect-provider-scrim"
        onClick={() => !connecting && onClose()}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className="connect-provider-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-provider-title"
      >
        <div className="connect-provider-drawer__head">
          <h2 id="connect-provider-title" className="semibold" style={{ fontSize: 'var(--fs-base)', margin: 0 }}>
            {t('models.connectProvider')}
          </h2>
          <button
            type="button"
            onClick={() => !connecting && onClose()}
            aria-label={t('models.close')}
            className="modal-close"
            disabled={connecting}
            style={{
              width: 'var(--control-height-sm)',
              height: 'var(--control-height-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="connect-provider-drawer__body">
          <p className="subtle" style={{ fontSize: 'var(--fs-sm)', marginTop: 0 }}>
            Add an OpenAI-compatible provider by entering a name, base URL, and API key. Models will be imported automatically.
          </p>

          <div className="col gap-1">
            <div className="label-sm">{t('models.providerName')}</div>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('models.providerNamePlaceholder')}
              className="ctrl ctrl--mono w-full"
              style={{ fontSize: 'var(--fs-xs)' }}
              autoComplete="off"
              spellCheck={false}
              disabled={connecting}
            />
          </div>

          <div className="col gap-1">
            <div className="label-sm">{t('models.baseUrl')}</div>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit) handleSubmit();
              }}
              placeholder="https://api.example.com/v1 (not /chat/completions)"
              className="ctrl ctrl--mono ctrl--flat w-full"
              style={{ fontSize: 'var(--fs-xs)' }}
              autoComplete="off"
              spellCheck={false}
              disabled={connecting}
            />
          </div>

          <div className="col gap-1">
            <div className="label-sm">{t('models.apiKeyLabel')}</div>
            <div className="row gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmit) handleSubmit();
                }}
                placeholder={t('models.pasteKey')}
                className="ctrl ctrl--mono ctrl--flat flex-1"
                style={{ fontSize: 'var(--fs-xs)' }}
                autoComplete="off"
                spellCheck={false}
                disabled={connecting}
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="btn-icon"
                aria-label={showKey ? t('models.hideKey') : t('models.showKey')}
                disabled={connecting}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && (
            <div
              className="row-xs"
              role="alert"
              style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-danger, #dc2626)', gap: 6 }}
            >
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="connect-provider-drawer__foot">
          <button
            type="button"
            onClick={() => !connecting && onClose()}
            className="btn-xs"
            style={{ border: '1px solid var(--c-border-1)' }}
            disabled={connecting}
          >
            {t('models.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="btn-brand"
            style={{ opacity: canSubmit ? 1 : 0.4 }}
          >
            {connecting ? (
              <>
                <Loader2 size={14} className="spin" />
                {t('models.importing')}
              </>
            ) : (
              <>
                <Plus size={14} />
                {t('models.connectProvider')}
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
