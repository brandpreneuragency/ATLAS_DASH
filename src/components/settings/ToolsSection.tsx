import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsPanels } from './SettingsPanels';

interface ToolsSectionProps {
  rightHeader?: ReactNode;
  rightMain?: ReactNode;
  rightFooter?: ReactNode;
}

interface ToolItem {
  id: string;
  labelKey: string;
  available: boolean;
}

const SEARCH_TOOLS: ToolItem[] = [
  { id: 'tavily', labelKey: 'settings.tavily', available: true },
  { id: 'exa', labelKey: 'settings.exa', available: true },
  { id: 'firecrawl', labelKey: 'settings.firecrawl', available: true },
  { id: 'brave', labelKey: 'settings.brave', available: true },
];

export function ToolsSection({ rightHeader, rightMain, rightFooter }: ToolsSectionProps) {
  const { t } = useTranslation();
  const [focusToolId, setFocusToolId] = useState<string | null>(null);

  const renderDot = (available: boolean) => (
    <span
      className="settings-list-item-meta"
      style={{
        width: 8,
        height: 8,
        borderRadius: 9999,
        flexShrink: 0,
        background: available ? 'var(--c-success)' : 'var(--c-text-3)',
      }}
      aria-hidden
    />
  );

  const leftMain = (
    <div className="settings-list-body">
      <div className="settings-provider-group">
        <div className="settings-provider-group-head">
          <span>{t('settings.groupWebSearch')}</span>
          <span className="settings-provider-group-count">{SEARCH_TOOLS.length}</span>
        </div>
        <div className="settings-provider-group-body">
          {SEARCH_TOOLS.map((tool) => (
            <button
              key={tool.id}
              className={`settings-list-item${focusToolId === tool.id ? ' settings-list-item--active' : ''}`}
              onClick={() => setFocusToolId(tool.id)}
            >
              {renderDot(tool.available)}
              <span className="settings-list-item-title">{t(tool.labelKey)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="settings-provider-group">
        <div className="settings-provider-group-head">
          <span>{t('tools.groupBrowser')}</span>
        </div>
        <div className="settings-provider-group-body">
          <div className="settings-list-item settings-list-item--placeholder" style={{ cursor: 'default' }}>
            <span className="settings-list-item-title subtle" style={{ fontStyle: 'italic' }}>
              {t('settings.comingSoon')}
            </span>
          </div>
        </div>
      </div>

      <div className="settings-provider-group">
        <div className="settings-provider-group-head">
          <span>{t('tools.groupStorage')}</span>
        </div>
        <div className="settings-provider-group-body">
          <div className="settings-list-item settings-list-item--placeholder" style={{ cursor: 'default' }}>
            <span className="settings-list-item-title subtle" style={{ fontStyle: 'italic' }}>
              {t('settings.comingSoon')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const focusedTool = SEARCH_TOOLS.find((t) => t.id === focusToolId);

  const centerHeader = (
    <div className="settings-list-head">
      <h3>{focusedTool ? t(focusedTool.labelKey) : t('tools.selectTool')}</h3>
    </div>
  );

  const centerMain = (
    <div className="settings-detail-body">
      {focusToolId ? (
        <div className="settings-empty">
          <p>{t('tools.toolDetailsPlaceholder', { tool: focusedTool ? t(focusedTool.labelKey) : '' })}</p>
        </div>
      ) : (
        <div className="settings-empty">
          <p>{t('tools.selectToolHint')}</p>
        </div>
      )}
    </div>
  );

  return (
    <SettingsPanels
      leftHeader={
        <div className="settings-list-head">
          <h3>{t('tools.title')}</h3>
        </div>
      }
      leftMain={leftMain}
      centerHeader={centerHeader}
      centerMain={centerMain}
      rightHeader={rightHeader}
      rightMain={rightMain}
      rightFooter={rightFooter}
    />
  );
}
