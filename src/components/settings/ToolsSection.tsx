import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../../stores/aiStore';
import { SettingsPanels } from './SettingsPanels';
import { ToolsList } from './tools/ToolsList';
import { ToolDetailPanel } from './tools/ToolDetailPanel';
import { SearchToolDetail } from './tools/SearchToolDetail';
import type { SearchProvider } from '../../types';

const SEARCH_PROVIDER_IDS: string[] = ['tavily', 'exa', 'firecrawl', 'brave'];

interface ToolsSectionProps {
  rightHeader?: ReactNode;
  rightMain?: ReactNode;
  rightFooter?: ReactNode;
}

export function ToolsSection({ rightHeader, rightMain, rightFooter }: ToolsSectionProps) {
  const { t } = useTranslation();
  const searchConfig = useAIStore((s) => s.searchConfig);
  const [focusToolId, setFocusToolId] = useState<string | null>(null);

  const focusedTool = SEARCH_PROVIDER_IDS.includes(focusToolId ?? '')
    ? (focusToolId as SearchProvider)
    : null;

  const toolLabel = focusedTool
    ? t(`settings.${focusedTool}` as const)
    : null;

  const connected = focusedTool
    ? Boolean(searchConfig[`${focusedTool}Key` as keyof typeof searchConfig]?.toString().trim())
    : false;

  return (
    <SettingsPanels
      leftHeader={
        <div className="settings-list-head">
          <h3>{t('tools.title')}</h3>
        </div>
      }
      leftMain={<ToolsList focusToolId={focusToolId} onSelectTool={setFocusToolId} />}
      centerHeader={<ToolDetailPanel toolLabel={toolLabel} connected={connected} />}
      centerMain={
        <div className="settings-detail-body">
          {focusedTool ? (
            <SearchToolDetail providerId={focusedTool} />
          ) : (
            <div className="settings-empty">
              <p>{t('tools.selectToolHint')}</p>
            </div>
          )}
        </div>
      }
      rightHeader={rightHeader}
      rightMain={rightMain}
      rightFooter={rightFooter}
    />
  );
}
