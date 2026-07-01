import { useTranslation } from 'react-i18next';

export function ProviderUsageTab() {
  const { t } = useTranslation();

  return (
    <div className="col gap-3" style={{ padding: '16px 0' }}>
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
          <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>{t('models.usageQuota')}</span>
          <span className="med" style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-text-2)' }}>{t('models.usageNotTracked')}</span>
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>{t('models.usageCost')}</span>
          <span className="med" style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-text-2)' }}>{t('models.usageNotTracked')}</span>
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>{t('models.usageTokens')}</span>
          <span className="med" style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-text-2)' }}>{t('models.usageNotTracked')}</span>
        </div>
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
        <span className="label-sm" style={{ color: 'var(--c-text-2)' }}>{t('models.usageComingSoon')}</span>
        <p className="subtle" style={{ fontSize: 'var(--fs-sm)', maxWidth: 420, margin: 0 }}>
          {t('models.usageComingSoonHint')}
        </p>
      </div>
    </div>
  );
}
