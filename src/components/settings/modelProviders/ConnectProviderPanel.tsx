import { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Loader2, Check, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../../../stores/aiStore';

interface ConnectProviderPanelProps {
  open: boolean;
  onClose: () => void;
  onConnected?: (providerId: string) => void;
}

type ConnectPhase = 'idle' | 'checking' | 'importing' | 'saving';

/**
 * Custom provider add form (center panel).
 * Built-in presets are selected from the left list; this screen only collects
 * name + base URL + API key for an OpenAI-compatible custom endpoint.
 *
 * Reset by remounting (parent should change `key` when re-opening).
 */
export function ConnectProviderPanel({ open, onClose, onConnected }: ConnectProviderPanelProps) {
  const { t } = useTranslation();
  const connectNewProvider = useAIStore((s) => s.connectNewProvider);

  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [phase, setPhase] = useState<ConnectPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => nameRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase === 'idle') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, phase, onClose]);

  if (!open) return null;

  const canSubmit =
    name.trim().length > 0 &&
    baseUrl.trim().length > 0 &&
    apiKey.trim().length > 0 &&
    phase === 'idle';

  const handleCancel = () => {
    if (phase !== 'idle') return;
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);

    setPhase('checking');
    await new Promise((r) => setTimeout(r, 80));

    setPhase('importing');
    const result = await connectNewProvider({
      name,
      baseUrl,
      apiKey,
      presetId: 'custom',
    });

    if (!result.ok) {
      setPhase('idle');
      setError(result.error);
      return;
    }

    setPhase('saving');
    setSuccessCount(result.modelCount);
    await new Promise((r) => setTimeout(r, 300));

    onConnected?.(result.provider.id);
  };

  const phaseLabel =
    phase === 'checking'
      ? t('models.phaseChecking')
      : phase === 'importing'
        ? t('models.phaseImporting')
        : phase === 'saving'
          ? t('models.phaseSaving')
          : '';

  return (
    <div className="connect-provider-panel">
      <div className="connect-provider-panel__body">
        <p className="subtle" style={{ fontSize: 'var(--fs-sm)', marginTop: 0, marginBottom: 12 }}>
          {t('models.presetCustomDesc')}
        </p>

        {phase !== 'idle' && (
          <div className="row gap-2" style={{ alignItems: 'center', marginBottom: 8 }}>
            <Loader2 size={14} className="spin" />
            <span style={{ fontSize: 'var(--fs-sm)' }}>{phaseLabel}</span>
          </div>
        )}

        {successCount !== null && (
          <div className="row gap-2 settings-feedback-success" style={{ marginBottom: 8 }}>
            <Check size={14} />
            <span>{t('models.connectedWithCount', { count: successCount })}</span>
          </div>
        )}

        <div className="col gap-3">
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
              disabled={phase !== 'idle'}
            />
          </div>

          <div className="col gap-1">
            <div className="label-sm">{t('models.baseUrl')}</div>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit) void handleSubmit();
              }}
              placeholder="https://api.example.com/v1"
              className="ctrl ctrl--mono ctrl--flat w-full"
              style={{ fontSize: 'var(--fs-xs)' }}
              autoComplete="off"
              spellCheck={false}
              disabled={phase !== 'idle'}
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
                  if (e.key === 'Enter' && canSubmit) void handleSubmit();
                }}
                placeholder={t('models.pasteKey')}
                className="ctrl ctrl--mono ctrl--flat flex-1"
                style={{ fontSize: 'var(--fs-xs)' }}
                autoComplete="off"
                spellCheck={false}
                disabled={phase !== 'idle'}
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="btn-icon"
                aria-label={showKey ? t('models.hideKey') : t('models.showKey')}
                disabled={phase !== 'idle'}
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
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      <div className="connect-provider-panel__foot">
        <button
          type="button"
          onClick={handleCancel}
          className="btn-xs"
          style={{ border: '1px solid var(--c-border-1)' }}
          disabled={phase !== 'idle'}
        >
          {t('models.cancel')}
        </button>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          className="btn-brand"
          style={{ opacity: canSubmit ? 1 : 0.4 }}
        >
          {phase !== 'idle' ? (
            <>
              <Loader2 size={14} className="spin" />
              {phaseLabel}
            </>
          ) : (
            t('models.connect')
          )}
        </button>
      </div>
    </div>
  );
}
