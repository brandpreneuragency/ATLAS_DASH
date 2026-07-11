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
        <div className="row gap-2 settings-usage-card">
          <span className="subtle" style={{ fontSize: 'var(--fs-base)' }}>{t('models.usageMonth')}</span>
          <span className="med" style={{ fontSize: 'var(--fs-base)', color: 'var(--c-text-2)' }}>
            {t('models.usageEstimatedCost')}: {t('models.usageNotTracked')}
          </span>
        </div>
      </div>

      {models.length > 0 && (
        <div className="col gap-2">
          <div className="label-sm">{t('models.usageByModel')}</div>
          <div className="settings-usage-table">
            {/* Header */}
            <div className="row settings-usage-table-header">
              <span className="settings-usage-cell">{t('models.usageProvider')}</span>
              <span className="settings-usage-cell">{t('models.usageModel')}</span>
              <span className="settings-usage-cell settings-usage-cell--right">{t('models.usageInputTokens')}</span>
              <span className="settings-usage-cell settings-usage-cell--right">{t('models.usageOutputTokens')}</span>
              <span className="settings-usage-cell settings-usage-cell--right">{t('models.usageCost')}</span>
            </div>
            {models.map((m) => (
              <div
                key={m.id}
                className="row settings-usage-table-row"
              >
                <span className="settings-usage-cell">{provider.name}</span>
                <span className="settings-usage-cell">{m.name || m.id}</span>
                <span className="settings-usage-cell settings-usage-cell--right">{t('models.usageNotTracked')}</span>
                <span className="settings-usage-cell settings-usage-cell--right">{t('models.usageNotTracked')}</span>
                <span className="settings-usage-cell settings-usage-cell--right">{t('models.usageNotTracked')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="col settings-coming-soon-card">
        <span className="label-sm" style={{ color: 'var(--c-text-2)' }}>{t('models.usageTitle')}</span>
        <p className="subtle" style={{ fontSize: 'var(--fs-base)', maxWidth: 420, margin: 0 }}>
          {t('models.usageNoData')}
        </p>
      </div>
    </div>
  );
}
