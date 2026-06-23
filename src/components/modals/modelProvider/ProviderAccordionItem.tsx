import { useState, useRef, useCallback } from 'react';
import { Check, ChevronDown, ChevronRight, Download, Eye, EyeOff, AlertCircle, Loader2, Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AIProviderConfig, ModelItem, ProviderImportUiState } from '../../../types';
import { ProviderStatusBadge } from './ProviderStatusBadge';
import { ModelSwitch } from './ModelSwitch';
import { ModelHoverCard } from './ModelHoverCard';
import { AddCustomModelInput } from './AddCustomModelInput';

interface ProviderAccordionItemProps {
  provider: AIProviderConfig;
  expanded: boolean;
  hiddenModels: string[];
  draftKey: string;
  draftBaseUrl: string;
  importState: ProviderImportUiState;
  connectionState: { phase: 'idle' | 'connecting' | 'error'; message?: string };
  onToggleExpand: () => void;
  onToggleModel: (providerId: string, modelId: string, enabled: boolean) => void;
  onAddCustomModel: (providerId: string, slug: string) => void;
  onDraftKeyChange: (value: string) => void;
  onDraftBaseUrlChange: (value: string) => void;
  onImport: () => void;
  onConnect: () => void;
}

export function ProviderAccordionItem({
  provider,
  expanded,
  hiddenModels,
  draftKey,
  draftBaseUrl,
  importState,
  connectionState,
  onToggleExpand,
  onToggleModel,
  onAddCustomModel,
  onDraftKeyChange,
  onDraftBaseUrlChange,
  onImport,
  onConnect,
}: ProviderAccordionItemProps) {
  const { t } = useTranslation();
  const [hoveredModel, setHoveredModel] = useState<{ model: ModelItem; rect: DOMRect } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isHidden = useCallback(
    (modelId: string) => hiddenModels.includes(`${provider.id}:${modelId}`),
    [hiddenModels, provider.id]
  );

  const handleMouseEnter = (model: ModelItem) => {
    const rect = rowRefs.current[model.id]?.getBoundingClientRect();
    if (rect) setHoveredModel({ model, rect });
  };

  const handleFocus = (model: ModelItem) => {
    const rect = rowRefs.current[model.id]?.getBoundingClientRect();
    if (rect) setHoveredModel({ model, rect });
  };

  const status = provider.status ?? 'not_connected';
  const models = provider.models ?? [];
  const modelCount = models.length;
  const canSubmit = Boolean(draftBaseUrl.trim()) && Boolean(draftKey.trim()) && importState.phase !== 'importing';
  const isImporting = importState.phase === 'importing';
  const isConnecting = connectionState.phase === 'connecting';
  const lastImportedAt = provider.lastImportedAt;
  const lastImportedLabel = lastImportedAt
    ? new Date(lastImportedAt).toLocaleString()
    : null;

  return (
    <div className="provider-accordion-item">
      {/* Header row */}
      <button
        type="button"
        onClick={onToggleExpand}
        aria-expanded={expanded}
        className="row w-full provider-accordion-trigger"
        style={{
          padding: '10px 12px',
          border: 'none',
          cursor: 'pointer',
          color: 'inherit',
          justifyContent: 'space-between',
          textAlign: 'left',
        }}
      >
        <div className="row gap-3 min-w-0">
          {expanded
            ? <ChevronDown size={15} className="subtle shrink-0" />
            : <ChevronRight size={15} className="subtle shrink-0" />
          }
          <span className="semibold trunc" style={{ fontSize: 'var(--fs-sm)' }}>{provider.name}</span>
        </div>
        <div className="row gap-2 shrink-0">
          <ProviderStatusBadge status={status} />
        </div>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="provider-accordion-panel" style={{ borderTop: '1px solid var(--c-border-1)' }}>
          <ConnectionStatusStrip
            status={status}
            modelCount={modelCount}
            lastImportedLabel={lastImportedLabel}
            t={t}
          />

          <ConnectionForm
            draftBaseUrl={draftBaseUrl}
            draftKey={draftKey}
            showKey={showKey}
            canSubmit={canSubmit}
            isImporting={isImporting}
            isConnecting={isConnecting}
            isConnected={status === 'connected'}
            hasModels={modelCount > 0}
            errorMessage={
              connectionState.phase === 'error'
                ? connectionState.message
                : importState.phase === 'error'
                  ? importState.message
                  : undefined
            }
            onBaseUrlChange={onDraftBaseUrlChange}
            onKeyChange={onDraftKeyChange}
            onToggleShowKey={() => setShowKey((s) => !s)}
            onSubmit={onImport}
            onConnect={onConnect}
            t={t}
          />

          {/* Model list */}
          <div className="provider-model-list">
            {models.length === 0 ? (
              <div className="subtle" style={{ padding: '12px', fontSize: 'var(--fs-xs)' }}>
                {t('models.noModelsAvailable')}
              </div>
            ) : (
              models.map((model) => {
                const enabled = !isHidden(model.id);
                return (
                  <div
                    key={model.id}
                    ref={(el) => { rowRefs.current[model.id] = el; }}
                    className="row provider-model-row"
                    style={{
                      padding: '0 12px',
                      justifyContent: 'space-between',
                      cursor: 'default',
                      outline: 'none',
                      height: 'fit-content',
                      gap: 0,
                    }}
                    tabIndex={0}
                    onMouseEnter={() => handleMouseEnter(model)}
                    onMouseLeave={() => setHoveredModel(null)}
                    onFocus={() => handleFocus(model)}
                    onBlur={() => setHoveredModel(null)}
                  >
                    <div className="min-w-0">
                      <div className="med trunc" style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-1)' }}>
                        {model.name}
                      </div>
                      {model.description && (
                        <div className="subtle trunc" style={{ fontSize: 'var(--fs-sm)' }}>{model.description}</div>
                      )}
                    </div>
                    <ModelSwitch
                      checked={enabled}
                      onChange={(checked) => onToggleModel(provider.id, model.id, checked)}
                      ariaLabel={`${enabled ? 'Disable' : 'Enable'} ${model.name}`}
                    />
                  </div>
                );
              })
            )}
          </div>

          {/* Add custom model */}
          <AddCustomModelInput
            onAdd={(slug) => onAddCustomModel(provider.id, slug)}
            existingIds={models.map((m) => m.id)}
          />

          {hoveredModel && (
            <ModelHoverCard
              targetRect={hoveredModel.rect}
              provider={provider}
              model={hoveredModel.model}
              enabled={!isHidden(hoveredModel.model.id)}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface ConnectionStatusStripProps {
  status: AIProviderConfig['status'];
  modelCount: number;
  lastImportedLabel: string | null;
  t: ReturnType<typeof useTranslation>['t'];
}

function ConnectionStatusStrip({ status, modelCount, lastImportedLabel, t }: ConnectionStatusStripProps) {
  if (status === 'connected') {
    return (
      <div
        className="row gap-2"
        style={{
          padding: '8px 12px',
          background: 'rgba(34,197,94,0.05)',
          justifyContent: 'space-between',
        }}
      >
        <div className="row-xs">
          <Check size={12} style={{ color: 'var(--c-accent-center-panel)' }} />
          <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
            {modelCount > 0
              ? t('models.connectedWithCount', { count: modelCount })
              : t('models.connectedNoModels')}
          </span>
        </div>
        {lastImportedLabel && (
          <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
            {t('models.lastImportedAt', { time: lastImportedLabel })}
          </span>
        )}
      </div>
    );
  }
  if (status === 'needs_setup') {
    return null;
  }
  return null;
}

interface ConnectionFormProps {
  draftBaseUrl: string;
  draftKey: string;
  showKey: boolean;
  canSubmit: boolean;
  isImporting: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  hasModels: boolean;
  errorMessage?: string;
  onBaseUrlChange: (value: string) => void;
  onKeyChange: (value: string) => void;
  onToggleShowKey: () => void;
  onSubmit: () => void;
  onConnect: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function ConnectionForm({
  draftBaseUrl,
  draftKey,
  showKey,
  canSubmit,
  isImporting,
  isConnecting,
  isConnected,
  hasModels,
  errorMessage,
  onBaseUrlChange,
  onKeyChange,
  onToggleShowKey,
  onSubmit,
  onConnect,
  t,
}: ConnectionFormProps) {
  return (
    <div className="col gap-2" style={{ padding: 12 }}>
      <div>
        <div className="label-sm" style={{ marginBottom: 4 }}>{t('models.baseUrl')}</div>
        <input
          type="text"
          value={draftBaseUrl}
          onChange={(e) => onBaseUrlChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (canSubmit) onSubmit();
            }
          }}
          placeholder="https://api.example.com/v1"
          className="ctrl ctrl--mono ctrl--flat w-full"
          style={{ fontSize: 'var(--fs-xs)' }}
        />
      </div>

      <div>
        <div className="label-sm" style={{ marginBottom: 4 }}>{t('models.apiKeyLabel')}</div>
        <div className="row gap-2">
          <input
            type={showKey ? 'text' : 'password'}
            value={draftKey}
            onChange={(e) => onKeyChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (canSubmit) onSubmit();
              }
            }}
            placeholder={t('models.pasteKey')}
            className="ctrl ctrl--mono ctrl--flat flex-1"
            style={{ fontSize: 'var(--fs-xs)' }}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={onToggleShowKey}
            className="btn-icon"
            aria-label={showKey ? t('models.hideKey') : t('models.showKey')}
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      <div className="row gap-2" style={{ justifyContent: 'flex-end', marginTop: 2 }}>
        <ImportSendButton
          disabled={!canSubmit || isConnecting}
          loading={isImporting}
          onClick={onSubmit}
          title={t('models.importModels')}
        />
        <ConnectButton
          disabled={!canSubmit || !hasModels || isImporting || isConnecting || isConnected}
          loading={isConnecting}
          connected={isConnected}
          onClick={onConnect}
          title={isConnected ? t('models.connected') : t('models.connectProvider')}
          t={t}
        />
      </div>

      {errorMessage && (
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
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}

interface ConnectButtonProps {
  disabled: boolean;
  loading: boolean;
  connected: boolean;
  onClick: () => void;
  title: string;
  t: ReturnType<typeof useTranslation>['t'];
}

function ConnectButton({ disabled, loading, connected, onClick, title, t }: ConnectButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="btn-brand"
      title={title}
      aria-label={title}
      style={{
        width: 'fit-content',
        height: 'fit-content',
        padding: '0 14px',
        gap: 6,
        fontSize: 'var(--fs-xs)',
        fontWeight: 600,
        opacity: disabled && !connected ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {loading
        ? <Loader2 size={14} className="spin" />
        : connected
          ? <Check size={14} />
          : <Link2 size={14} />}
      <span>
        {loading
          ? t('models.connecting')
          : connected
            ? t('models.connected')
            : t('models.connect')}
      </span>
    </button>
  );
}

interface ImportSendButtonProps {
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
  title: string;
}

function ImportSendButton({ disabled, loading, onClick, title }: ImportSendButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="btn-send"
      title={title}
      aria-label={title}
      style={{
        width: 'auto',
        minWidth: 'var(--div-h-1)',
        height: 'var(--div-h-1)',
        padding: '0 12px',
        gap: 6,
        fontSize: 'var(--fs-xs)',
        fontWeight: 600,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {loading ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
      <span>Import</span>
    </button>
  );
}
