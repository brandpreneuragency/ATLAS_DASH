import { useTranslation } from 'react-i18next';
import type { AIProviderConfig } from '../../../types';

interface ProviderUsageTabProps {
  provider: AIProviderConfig;
}

export function ProviderUsageTab({ provider }: ProviderUsageTabProps) {
  const { t } = useTranslation();
  const models = (provider.models ?? []).filter((m) => m.enabled);

  return (
    <div className="col gap-3" style={{ padding: '16px 0' }}>
      <div className="col gap-2">
        <div className="label-sm">{t('models.usageTitle')}</div>
        <div
          className="row gap-2"
          style={{
            padding: 12,
            borderRadius: 8,
            border: '1px solid var(--c-border-1)',
            background: 'var(--c-background-1)',
            alignItems: 'center',
          }}
        >
          <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>{t('models.usageMonth')}</span>
          <span className="med" style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-text-2)' }}>
            {t('models.usageEstimatedCost')}: {t('models.usageNotTracked')}
          </span>
        </div>
      </div>

      {models.length > 0 && (
        <div className="col gap-2">
          <div className="label-sm">{t('models.usageByModel')}</div>
          <div
            style={{
              borderRadius: 8,
              border: '1px solid var(--c-border-1)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              className="row"
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid var(--c-border-1)',
                background: 'var(--c-background-1)',
                fontSize: 'var(--fs-xs)',
                fontWeight: 600,
                color: 'var(--c-text-2)',
              }}
            >
              <span style={{ flex: 1 }}>{t('models.usageProvider')}</span>
              <span style={{ flex: 1 }}>{t('models.usageModel')}</span>
              <span style={{ flex: 1, textAlign: 'right' }}>{t('models.usageInputTokens')}</span>
              <span style={{ flex: 1, textAlign: 'right' }}>{t('models.usageOutputTokens')}</span>
              <span style={{ flex: 1, textAlign: 'right' }}>{t('models.usageCost')}</span>
            </div>
            {models.map((m) => (
              <div
                key={m.id}
                className="row"
                style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--c-border-1)',
                  fontSize: 'var(--fs-sm)',
                  color: 'var(--c-text-2)',
                }}
              >
                <span style={{ flex: 1 }}>{provider.name}</span>
                <span style={{ flex: 1 }}>{m.name || m.id}</span>
                <span style={{ flex: 1, textAlign: 'right' }}>{t('models.usageNotTracked')}</span>
                <span style={{ flex: 1, textAlign: 'right' }}>{t('models.usageNotTracked')}</span>
                <span style={{ flex: 1, textAlign: 'right' }}>{t('models.usageNotTracked')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
        <span className="label-sm" style={{ color: 'var(--c-text-2)' }}>{t('models.usageTitle')}</span>
        <p className="subtle" style={{ fontSize: 'var(--fs-sm)', maxWidth: 420, margin: 0 }}>
          {t('models.usageNoData')}
        </p>
      </div>
    </div>
  );
}
