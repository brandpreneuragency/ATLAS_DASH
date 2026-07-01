import { useState } from 'react';
import { Eye, EyeOff, Loader2, Download, Link2, Check, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AIProviderConfig, ProviderImportUiState } from '../../../types';
import { ProviderStatusBadge } from '../../modals/modelProvider/ProviderStatusBadge';

interface ProviderConnectionTabProps {
  provider: AIProviderConfig;
  draftKey: string;
  draftBaseUrl: string;
  importState: ProviderImportUiState;
  connectionState: { phase: 'idle' | 'connecting' | 'error'; message?: string };
  onDraftKeyChange: (value: string) => void;
  onDraftBaseUrlChange: (value: string) => void;
  onImport: () => void;
  onConnect: () => void;
}

export function ProviderConnectionTab({
  provider,
  draftKey,
  draftBaseUrl,
  importState,
  connectionState,
  onDraftKeyChange,
  onDraftBaseUrlChange,
  onImport,
  onConnect,
}: ProviderConnectionTabProps) {
  const { t } = useTranslation();
  const [showKey, setShowKey] = useState(false);

  const status = provider.status ?? 'not_connected';
  const modelCount = (provider.models ?? []).length;
  const canSubmit = Boolean(draftBaseUrl.trim()) && Boolean(draftKey.trim()) && importState.phase !== 'importing';
  const isImporting = importState.phase === 'importing';
  const isConnecting = connectionState.phase === 'connecting';

  const lastImportedAt = provider.lastImportedAt;
  const lastImportedLabel = lastImportedAt
    ? new Date(lastImportedAt).toLocaleString()
    : null;

  return (
    <div className="col gap-3" style={{ padding: '16px 0' }}>
      {/* Status strip */}
      <div className="row gap-2" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <ProviderStatusBadge status={status} />
        {lastImportedLabel && (
          <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
            {t('models.lastImportedAt', { time: lastImportedLabel })}
          </span>
        )}
      </div>

      {status === 'connected' && (
        <div
          className="row gap-2"
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            background: 'rgba(34,197,94,0.05)',
            justifyContent: 'space-between',
          }}
        >
          <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
            {modelCount > 0
              ? t('models.connectedWithCount', { count: modelCount })
              : t('models.connectedNoModels')}
          </span>
        </div>
      )}

      {/* Base URL */}
      <div className="col gap-1">
        <div className="label-sm">{t('models.baseUrl')}</div>
        <input
          type="text"
          value={draftBaseUrl}
          onChange={(e) => onDraftBaseUrlChange(e.target.value)}
          placeholder="https://api.example.com/v1"
          className="ctrl ctrl--mono ctrl--flat w-full"
          style={{ fontSize: 'var(--fs-xs)' }}
        />
      </div>

      {/* API Key */}
      <div className="col gap-1">
        <div className="label-sm">{t('models.apiKeyLabel')}</div>
        <div className="row gap-2">
          <input
            type={showKey ? 'text' : 'password'}
            value={draftKey}
            onChange={(e) => onDraftKeyChange(e.target.value)}
            placeholder={t('models.pasteKey')}
            className="ctrl ctrl--mono ctrl--flat flex-1"
            style={{ fontSize: 'var(--fs-xs)' }}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setShowKey((s) => !s)}
            className="btn-icon"
            aria-label={showKey ? t('models.hideKey') : t('models.showKey')}
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="row gap-2" style={{ justifyContent: 'flex-end', marginTop: 4 }}>
        <button
          type="button"
          onClick={onImport}
          disabled={!canSubmit || isConnecting}
          className="btn-send"
          title={t('models.importModels')}
          aria-label={t('models.importModels')}
          style={{
            width: 'auto',
            minWidth: 'var(--div-h-1)',
            height: 'var(--div-h-1)',
            padding: '0 12px',
            gap: 6,
            fontSize: 'var(--fs-xs)',
            fontWeight: 600,
            opacity: canSubmit && !isConnecting ? 1 : 0.4,
            cursor: canSubmit && !isConnecting ? 'pointer' : 'not-allowed',
          }}
        >
          {isImporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
          <span>{isImporting ? t('models.importing') : t('models.importModels')}</span>
        </button>
        <button
          type="button"
          onClick={onConnect}
          disabled={!canSubmit || modelCount === 0 || isImporting || isConnecting || status === 'connected'}
          className="btn-brand"
          title={status === 'connected' ? t('models.connected') : t('models.connectProvider')}
          aria-label={status === 'connected' ? t('models.connected') : t('models.connectProvider')}
          style={{
            width: 'fit-content',
            height: 'var(--div-h-1)',
            padding: '0 14px',
            gap: 6,
            fontSize: 'var(--fs-xs)',
            fontWeight: 600,
            opacity: (canSubmit && modelCount > 0 && !isImporting && !isConnecting && status !== 'connected') ? 1 : 0.4,
          }}
        >
          {isConnecting ? (
            <Loader2 size={14} className="spin" />
          ) : status === 'connected' ? (
            <Check size={14} />
          ) : (
            <Link2 size={14} />
          )}
          <span>
            {isConnecting
              ? t('models.connecting')
              : status === 'connected'
                ? t('models.connected')
                : t('models.connect')}
          </span>
        </button>
      </div>

      {/* Error display */}
      {(connectionState.phase === 'error' || importState.phase === 'error') && (
        <div
          className="row-xs"
          role="alert"
          style={{
            fontSize: 'var(--fs-sm)',
            color: 'var(--c-danger, #dc2626)',
            gap: 6,
          }}
        >
          <AlertCircle size={12} />
          <span>{connectionState.phase === 'error' ? connectionState.message : importState.message}</span>
        </div>
      )}

      {/* Sync / test placeholder */}
      <div
        className="col"
        style={{
          padding: 16,
          borderRadius: 8,
          border: '1px dashed var(--c-border-2)',
          background: 'var(--c-background-1)',
          alignItems: 'center',
          textAlign: 'center',
          gap: 6,
        }}
      >
        <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
          {t('models.connectionTestPlaceholder')}
        </span>
      </div>
    </div>
  );
}
