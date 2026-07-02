import { useState } from 'react';
import { Eye, EyeOff, Loader2, Download, Check, AlertCircle, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AIProviderConfig, ProviderImportUiState } from '../../../types';
import { ProviderStatusBadge } from '../../modals/modelProvider/ProviderStatusBadge';

interface ProviderConnectionTabProps {
  provider: AIProviderConfig;
  draftKey: string;
  draftBaseUrl: string;
  importState: ProviderImportUiState;
  connectionState: { phase: 'idle' | 'connecting' | 'error'; message?: string };
  testConnectionState: { phase: 'idle' | 'testing' | 'success' | 'error'; message?: string };
  syncState: { phase: 'idle' | 'syncing' | 'success' | 'error'; message?: string };
  onDraftKeyChange: (value: string) => void;
  onDraftBaseUrlChange: (value: string) => void;
  onTestConnection: () => void;
  onSyncModels: () => void;
}

export function ProviderConnectionTab({
  provider,
  draftKey,
  draftBaseUrl,
  importState,
  connectionState,
  testConnectionState,
  syncState,
  onDraftKeyChange,
  onDraftBaseUrlChange,
  onTestConnection,
  onSyncModels,
}: ProviderConnectionTabProps) {
  const { t } = useTranslation();
  const [showKey, setShowKey] = useState(false);

  const status = provider.status ?? 'not_connected';
  const isImporting = importState.phase === 'importing';
  const isConnecting = connectionState.phase === 'connecting';
  const isTesting = testConnectionState.phase === 'testing';
  const isSyncing = syncState.phase === 'syncing';

  const lastImportedAt = provider.lastImportedAt;
  const lastImportedLabel = lastImportedAt
    ? new Date(lastImportedAt).toLocaleString()
    : null;

  const canTest = Boolean(draftBaseUrl.trim()) && Boolean(draftKey.trim()) && !isTesting && !isSyncing && !isImporting && !isConnecting;
  const canSync = Boolean(draftBaseUrl.trim()) && Boolean(draftKey.trim()) && !isTesting && !isSyncing && !isImporting && !isConnecting;

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

      {/* Provider name (read-only display) */}
      <div className="col gap-1">
        <div className="label-sm">{t('models.providerName')}</div>
        <input
          type="text"
          value={provider.name}
          readOnly
          className="ctrl ctrl--mono ctrl--flat w-full settings-input-readonly"
        />
      </div>

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

      {/* Connection status */}
      <div className="row gap-2 settings-connection-info">
        <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
          {t('models.tabConnection')}
        </span>
        <span className="med" style={{ fontSize: 'var(--fs-sm)' }}>
          {status === 'connected'
            ? t('models.connected')
            : status === 'needs_key'
              ? t('models.needsKey')
              : status === 'connection_failed'
                ? t('models.connectionFailed')
                : status === 'sync_needed'
                  ? t('models.syncNeeded')
                  : status === 'needs_setup'
                    ? t('models.needsSetup')
                    : t('models.notConnected')}
        </span>
      </div>

      {/* Test connection feedback */}
      {testConnectionState.phase === 'success' && (
        <div className="row-xs settings-feedback-success">
          <Check size={12} />
          <span>{t('models.testSuccess')}</span>
        </div>
      )}
      {testConnectionState.phase === 'error' && (
        <div className="row-xs settings-feedback-error" role="alert">
          <AlertCircle size={12} />
          <span>{testConnectionState.message}</span>
        </div>
      )}

      {/* Sync models feedback */}
      {syncState.phase === 'success' && (
        <div className="row-xs settings-feedback-success">
          <Check size={12} />
          <span>{t('models.syncSuccess')}</span>
        </div>
      )}
      {syncState.phase === 'error' && (
        <div className="row-xs settings-feedback-error" role="alert">
          <AlertCircle size={12} />
          <span>{syncState.message}</span>
        </div>
      )}

      {/* Import / Connect errors */}
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

      {/* Actions */}
      <div className="row gap-2" style={{ justifyContent: 'flex-end', marginTop: 4 }}>
        <button
          type="button"
          onClick={onTestConnection}
          disabled={!canTest}
          className={`btn-send settings-action-btn${canTest ? '' : ' settings-action-btn--disabled'}`}
          title={t('models.testConnection')}
          aria-label={t('models.testConnection')}
        >
          {isTesting ? <Loader2 size={14} className="spin" /> : <Play size={14} />}
          <span>{isTesting ? t('models.testingConnection') : t('models.testConnection')}</span>
        </button>
        <button
          type="button"
          onClick={onSyncModels}
          disabled={!canSync}
          className={`btn-send settings-action-btn${canSync ? '' : ' settings-action-btn--disabled'}`}
          title={t('models.syncModels')}
          aria-label={t('models.syncModels')}
        >
          {isSyncing ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
          <span>{isSyncing ? t('models.syncingModels') : t('models.syncModels')}</span>
        </button>
      </div>
    </div>
  );
}
