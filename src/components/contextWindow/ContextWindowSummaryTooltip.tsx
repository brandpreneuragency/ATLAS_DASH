import { useTranslation } from 'react-i18next';
import { formatContextNumber, useContextWindowData } from './useContextWindowData';

export function ContextWindowSummaryTooltip() {
  const { t } = useTranslation();
  const { activeThread, activeModel, contextLimit, stats, usagePercent } = useContextWindowData();

  if (!activeThread) {
    return (
      <div className="context-window-summary-tooltip" role="tooltip">
        <p className="context-window-summary-empty">
          {t('contextWindow.noThread', 'Open a chat to see context usage.')}
        </p>
      </div>
    );
  }

  return (
    <div className="context-window-summary-tooltip" role="tooltip">
      <div className="context-window-summary-header">
        <span className="context-window-summary-title trunc">{activeThread.title}</span>
        {usagePercent !== null && (
          <span className="context-window-summary-badge">{usagePercent}%</span>
        )}
      </div>
      <div className="context-window-summary-meta">
        {t('contextWindow.totalTokens', 'Total Tokens')}: {formatContextNumber(stats.totalTokens)}
        {contextLimit ? ` / ${formatContextNumber(contextLimit)}` : ''}
      </div>
      <div className="context-window-summary-meta">
        {t('contextWindow.messages', 'Messages')}: {formatContextNumber(stats.totalMessages)}
        {activeModel?.name ? ` | ${activeModel.name}` : ''}
      </div>
    </div>
  );
}
