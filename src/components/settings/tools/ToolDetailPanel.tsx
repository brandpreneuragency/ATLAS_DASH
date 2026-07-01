import { useTranslation } from 'react-i18next';

interface ToolDetailPanelProps {
  toolLabel: string | null;
  connected: boolean;
}

export function ToolDetailPanel({ toolLabel, connected }: ToolDetailPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="settings-list-head">
      <h3>{toolLabel ?? t('tools.selectTool')}</h3>
      {toolLabel && (
        <span
          className="settings-list-item-meta"
          style={{
            fontSize: 'var(--fs-xs)',
            color: connected ? 'var(--c-success)' : 'var(--c-text-3)',
          }}
        >
          {connected ? t('tools.active') : t('tools.notConnected')}
        </span>
      )}
    </div>
  );
}
