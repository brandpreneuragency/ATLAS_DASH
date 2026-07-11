import { useTranslation } from 'react-i18next';

interface ToolDetailPanelProps {
  toolLabel: string;
  connected: boolean;
}

export function ToolDetailPanel({ toolLabel, connected }: ToolDetailPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="settings-list-head">
      <h3>{toolLabel}</h3>
      <span
        className="settings-list-item-meta settings-provider-detail-head-meta"
        style={{ color: connected ? 'var(--c-success)' : 'var(--c-text-3)' }}
      >
        {connected ? t('tools.active') : t('tools.notConnected')}
      </span>
    </div>
  );
}
