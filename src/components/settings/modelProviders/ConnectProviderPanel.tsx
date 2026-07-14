import { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Loader2, Check, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../../../stores/aiStore';
import { PROVIDER_PRESETS, type ProviderPreset } from './providerPresets';

interface ConnectProviderPanelProps {
  open: boolean;
  onClose: () => void;
  onConnected?: (providerId: string) => void;
}

type Step = 'preset' | 'form';
type ConnectPhase = 'idle' | 'checking' | 'importing' | 'saving';

export function ConnectProviderPanel({ open, onClose, onConnected }: ConnectProviderPanelProps) {
  const { t } = useTranslation();
  const connectNewProvider = useAIStore((s) => s.connectNewProvider);

  const [step, setStep] = useState<Step>('preset');
  const [selectedPreset, setSelectedPreset] = useState<ProviderPreset | null>(null);
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [phase, setPhase] = useState<ConnectPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);
  const addProviderBtnRef = useRef<HTMLButtonElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (open) {
      setStep('preset');
      setSelectedPreset(null);
      setName('');
      setBaseUrl('');
      setApiKey('');
      setShowKey(false);
      setPhase('idle');
      setError(null);
      setSuccessCount(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (phase === 'idle') {
          if (step === 'form') {
            setStep('preset');
            setSelectedPreset(null);
            setError(null);
          } else {
            onClose();
          }
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, phase, step, onClose]);

  useEffect(() => {
    if (!open) return;
    if (step === 'preset') {
      const id = window.setTimeout(() => addProviderBtnRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
    if (step === 'form' && selectedPreset?.id !== 'custom') {
      const id = window.setTimeout(() => keyRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => nameRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [open, step, selectedPreset]);

  if (!open) return null;

  const isKnownPreset = selectedPreset && selectedPreset.id !== 'custom';

  const canSubmit =
    name.trim().length > 0 &&
    baseUrl.trim().length > 0 &&
    apiKey.trim().length > 0 &&
    phase === 'idle';

  const handlePresetSelect = (preset: ProviderPreset) => {
    setSelectedPreset(preset);
    setStep('form');
    setError(null);
    if (preset.id === 'custom') {
      setName('');
      setBaseUrl('');
    } else {
      setName(t(preset.labelKey));
      setBaseUrl(preset.defaultBaseUrl);
    }
    setApiKey('');
  };

  const handleBack = () => {
    if (phase !== 'idle') return;
    setStep('preset');
    setSelectedPreset(null);
    setError(null);
  };

  const handleCancel = () => {
    if (phase !== 'idle') return;
    if (step === 'form') {
      handleBack();
      return;
    }
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
      presetId: selectedPreset?.id,
    });

    if (!result.ok) {
      setPhase('idle');
      setError(result.error);
      return;
    }

    setPhase('saving');
    setSuccessCount(result.modelCount);
    await new Promise((r) => setTimeout(r, 300));

    // Parent closes add mode via onConnected — do not call onClose (that clears selection).
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
        {step === 'form' && (
          <div className="row gap-2" style={{ alignItems: 'center', marginBottom: 4 }}>
            <button
              type="button"
              onClick={handleBack}
              className="btn-icon"
              disabled={phase !== 'idle'}
              aria-label={t('models.back')}
              style={{ flexShrink: 0 }}
            >
              ←
            </button>
            <span className="semibold" style={{ fontSize: 'var(--fs-base)' }}>
              {selectedPreset ? t(selectedPreset.labelKey) : t('models.connectProvider')}
            </span>
          </div>
        )}

        {step === 'preset' && (
          <div className="col gap-2">
            <p className="subtle" style={{ fontSize: 'var(--fs-sm)', marginTop: 0, marginBottom: 8 }}>
              {t('models.chooseProviderType')}
            </p>
            <div className="col gap-1.5">
              {PROVIDER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  ref={preset.id === 'custom' ? addProviderBtnRef : undefined}
                  type="button"
                  className="connect-preset-btn"
                  onClick={() => handlePresetSelect(preset)}
                >
                  <span className="connect-preset-btn__label">{t(preset.labelKey)}</span>
                  {preset.descriptionKey && (
                    <span className="connect-preset-btn__desc subtle">{t(preset.descriptionKey)}</span>
                  )}
                  {preset.verified && (
                    <span className="connect-preset-btn__badge">
                      {t('models.verified')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'form' && (
          <>
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

            {!isKnownPreset && (
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
            )}

            {!isKnownPreset && (
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
            )}

            <div className="col gap-1">
              <div className="label-sm">{t('models.apiKeyLabel')}</div>
              <div className="row gap-2">
                <input
                  ref={keyRef}
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
          </>
        )}
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
        {step === 'form' && (
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
        )}
      </div>
    </div>
  );
}
