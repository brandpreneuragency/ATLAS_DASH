import { useTranslation } from 'react-i18next';
import { useAIStore } from '../../../stores/aiStore';
import type { SearchProvider } from '../../../types';

interface SearchToolDef {
  id: SearchProvider;
  labelKey: string;
}

const SEARCH_TOOLS: SearchToolDef[] = [
  { id: 'tavily', labelKey: 'settings.tavily' },
  { id: 'exa', labelKey: 'settings.exa' },
  { id: 'firecrawl', labelKey: 'settings.firecrawl' },
  { id: 'brave', labelKey: 'settings.brave' },
];

function isKeyPresent(key: string | undefined): boolean {
  return Boolean(key && key.trim().length > 0);
}

interface ToolsListProps {
  focusToolId: string | null;
  onSelectTool: (id: string) => void;
}

export function ToolsList({ focusToolId, onSelectTool }: ToolsListProps) {
  const { t } = useTranslation();
  const searchConfig = useAIStore((s) => s.searchConfig);

  const getKeyForProvider = (id: SearchProvider): string => {
    switch (id) {
      case 'tavily': return searchConfig.tavilyKey;
      case 'exa': return searchConfig.exaKey;
      case 'firecrawl': return searchConfig.firecrawlKey;
      case 'brave': return searchConfig.braveKey;
    }
  };

  const renderDot = (connected: boolean) => (
    <span
      className="settings-list-item-meta"
      style={{
        width: 8,
        height: 8,
        borderRadius: 9999,
        flexShrink: 0,
        background: connected ? 'var(--c-success)' : 'var(--c-text-3)',
      }}
      aria-hidden
    />
  );

  return (
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
              onClick={() => onSelectTool(tool.id)}
            >
              {renderDot(isKeyPresent(getKeyForProvider(tool.id)))}
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
}
