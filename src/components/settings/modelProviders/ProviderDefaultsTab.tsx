import { useTranslation } from 'react-i18next';

export function ProviderDefaultsTab() {
  const { t } = useTranslation();

  return (
    <div className="col gap-3" style={{ padding: '16px 0' }}>
      <div className="col gap-2">
        <div className="label-sm">{t('models.defaultsTaskDefault')}</div>
        <p className="subtle" style={{ fontSize: 'var(--fs-sm)', margin: 0 }}>
          {t('models.defaultsTaskDefaultHint')}
        </p>
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
        <span className="label-sm" style={{ color: 'var(--c-text-2)' }}>{t('models.defaultsShellTitle')}</span>
        <p className="subtle" style={{ fontSize: 'var(--fs-sm)', maxWidth: 420, margin: 0 }}>
          {t('models.defaultsShellHint')}
        </p>
      </div>
    </div>
  );
}
