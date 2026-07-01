import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AIProviderConfig } from '../../../types';

interface ProviderAdvancedTabProps {
  provider: AIProviderConfig;
  onDeleteProvider: (id: string) => void;
  onSaveBaseUrl: (id: string, baseUrl: string) => void;
}

export function ProviderAdvancedTab({ provider, onDeleteProvider, onSaveBaseUrl }: ProviderAdvancedTabProps) {
  const { t } = useTranslation();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draftBaseUrl, setDraftBaseUrl] = useState(provider.baseUrl);
  const [baseUrlDirty, setBaseUrlDirty] = useState(false);

  const handleSaveBaseUrl = () => {
    if (draftBaseUrl !== provider.baseUrl) {
      onSaveBaseUrl(provider.id, draftBaseUrl);
    }
    setBaseUrlDirty(false);
  };

  return (
    <div className="col gap-3" style={{ padding: '16px 0' }}>
      {/* Provider info */}
      <div
        className="col gap-2"
        style={{
          padding: 16,
          borderRadius: 12,
          border: '1px solid var(--c-border-1)',
          background: 'var(--c-background-1)',
        }}
      >
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>{t('models.advancedProviderId')}</span>
          <span className="med" style={{ fontSize: 'var(--fs-xs)', fontFamily: 'ui-monospace, monospace', color: 'var(--c-text-1)' }}>
            {provider.id}
          </span>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>{t('models.advancedBaseUrl')}</span>
          <input
            type="text"
            value={draftBaseUrl}
            placeholder={t('models.advancedBaseUrlPlaceholder')}
            onChange={(e) => {
              setDraftBaseUrl(e.target.value);
              setBaseUrlDirty(true);
            }}
            onBlur={handleSaveBaseUrl}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveBaseUrl();
            }}
            style={{
              flex: 1,
              maxWidth: '60%',
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid var(--c-border-1)',
              background: 'var(--c-background-0)',
              color: 'var(--c-text-1)',
              fontSize: 'var(--fs-xs)',
              fontFamily: 'ui-monospace, monospace',
              textAlign: 'right',
            }}
          />
        </div>
        {baseUrlDirty && (
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn-xs"
              style={{ fontSize: 'var(--fs-xs)', border: '1px solid var(--c-border-1)' }}
              onClick={handleSaveBaseUrl}
            >
              {t('models.save')}
            </button>
          </div>
        )}
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>{t('models.advancedProviderType')}</span>
          <span className="med" style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-1)' }}>
            {provider.provider}
          </span>
        </div>
      </div>

      {/* Future items */}
      <div
        className="col gap-2"
        style={{
          padding: 16,
          borderRadius: 12,
          border: '1px dashed var(--c-border-2)',
          background: 'var(--c-background-1)',
          opacity: 0.7,
        }}
      >
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>{t('models.advancedRequestTimeout')}</span>
          <span className="med" style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-2)' }}>
            {t('models.advancedRequestTimeoutFuture')}
          </span>
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>{t('models.advancedCustomHeaders')}</span>
          <span className="med" style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-2)' }}>
            {t('models.advancedCustomHeadersFuture')}
          </span>
        </div>
      </div>

      {/* Danger zone */}
      <div className="col gap-2">
        <div className="label-sm" style={{ color: 'var(--c-danger, #dc2626)' }}>{t('models.dangerZone')}</div>
        <div
          className="col gap-2"
          style={{
            padding: 16,
            borderRadius: 12,
            border: '1px solid var(--c-danger, #dc2626)',
            background: 'rgba(220, 38, 38, 0.03)',
          }}
        >
          <p className="subtle" style={{ fontSize: 'var(--fs-sm)', margin: 0 }}>
            {t('models.dangerZoneProviderHint')}
          </p>
          {confirmDelete ? (
            <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-xs"
                style={{ border: '1px solid var(--c-border-1)' }}
                onClick={() => setConfirmDelete(false)}
              >
                {t('models.cancel')}
              </button>
              <button
                type="button"
                className="btn-xs"
                style={{ background: 'var(--c-danger, #dc2626)', color: '#fff', border: 'none' }}
                onClick={() => {
                  onDeleteProvider(provider.id);
                  setConfirmDelete(false);
                }}
              >
                {t('models.confirmDelete')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn-xs"
              style={{ border: '1px solid var(--c-danger, #dc2626)', color: 'var(--c-danger, #dc2626)', alignSelf: 'flex-start' }}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={14} />
              {t('models.deleteProvider')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
