import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Plus, RefreshCw, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../../../stores/aiStore';
import type { AIProviderConfig, SearchProvider } from '../../../types';
import {
  PROVIDER_PRESETS,
  PRESET_PROVIDER_IDS,
} from '../modelProviders/providerPresets';

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

export const DEFAULTS_SELECTION_ID = '__defaults__';
export const ADD_PROVIDER_SELECTION_ID = '__add_provider__';

type CategoryId = 'llm' | 'webSearch' | 'browser' | 'storage';

function isKeyPresent(key: string | undefined): boolean {
  return Boolean(key && key.trim().length > 0);
}

interface ToolsListProps {
  focusId: string | null;
  onSelect: (id: string) => void;
}

interface CollapsibleCategoryProps {
  id: CategoryId;
  label: string;
  count?: number;
  collapsed: boolean;
  onToggle: (id: CategoryId) => void;
  trailing?: ReactNode;
  children: ReactNode;
}

function CollapsibleCategory({
  id,
  label,
  count,
  collapsed,
  onToggle,
  trailing,
  children,
}: CollapsibleCategoryProps) {
  return (
    <div className="settings-provider-group">
      <div className="settings-provider-group-head settings-provider-group-head--collapsible">
        <button
          type="button"
          className="settings-provider-group-head-toggle"
          onClick={() => onToggle(id)}
          aria-expanded={!collapsed}
          aria-controls={`settings-category-${id}`}
          id={`settings-category-head-${id}`}
        >
          <span className="settings-provider-group-head-label">
            {collapsed ? <ChevronRight size={12} aria-hidden /> : <ChevronDown size={12} aria-hidden />}
            <span>{label}</span>
          </span>
        </button>
        {trailing}
        {count !== undefined && (
          <span className="settings-provider-group-count">{count}</span>
        )}
      </div>
      {!collapsed && (
        <div
          className="settings-provider-group-body"
          id={`settings-category-${id}`}
          role="group"
          aria-labelledby={`settings-category-head-${id}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function ProviderListItem({
  provider,
  focusId,
  onSelect,
}: {
  provider: AIProviderConfig;
  focusId: string | null;
  onSelect: (id: string) => void;
}) {
  const connected = provider.status === 'connected';
  const modelCount = (provider.models ?? []).length;
  const enabledCount = (provider.models ?? []).filter(
    (m) => !useAIStore.getState().isModelHidden(provider.id, m.id),
  ).length;
  const isActive = focusId === provider.id;

  return (
    <button
      type="button"
      className={`settings-list-item${isActive ? ' settings-list-item--active' : ''}`}
      onClick={() => onSelect(provider.id)}
      aria-current={isActive ? 'true' : undefined}
    >
      <span
        className={`settings-status-dot ${connected ? 'settings-status-dot--connected' : 'settings-status-dot--disconnected'}`}
        aria-hidden
      />
      <span className="settings-list-item-title">{provider.name}</span>
      <span className="settings-list-item-meta">
        {enabledCount}/{modelCount}
      </span>
    </button>
  );
}

export function ToolsList({ focusId, onSelect }: ToolsListProps) {
  const { t } = useTranslation();
  const searchConfig = useAIStore((s) => s.searchConfig);
  const providerConfigs = useAIStore((s) => s.providerConfigs);
  const [collapsed, setCollapsed] = useState<Set<CategoryId>>(new Set());

  const toggleCategory = useCallback((id: CategoryId) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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
      className={`settings-status-dot ${connected ? 'settings-status-dot--connected' : 'settings-status-dot--disconnected'}`}
      aria-hidden
    />
  );

  const { presetProviders, customProviders } = useMemo(() => {
    const byId = new Map(providerConfigs.map((p) => [p.id, p]));
    const presets: AIProviderConfig[] = PROVIDER_PRESETS.map((preset) => {
      const existing = byId.get(preset.id);
      if (existing) return existing;
      // Fallback display if store has not seeded yet (should be rare).
      return {
        id: preset.id,
        name: t(preset.labelKey),
        provider: preset.id,
        apiKey: '',
        selectedModel: '',
        isActive: false,
        baseUrl: preset.defaultBaseUrl,
        customModels: [],
        status: 'needs_key' as const,
        models: [],
      };
    });
    const customs = providerConfigs.filter((p) => !PRESET_PROVIDER_IDS.has(p.id));
    return { presetProviders: presets, customProviders: customs };
  }, [providerConfigs, t]);

  const llmCount = presetProviders.length + customProviders.length;

  return (
    <div className="settings-list-body">
      <CollapsibleCategory
        id="llm"
        label={t('settings.groupLLM')}
        count={llmCount}
        collapsed={collapsed.has('llm')}
        onToggle={toggleCategory}
        trailing={
          <button
            type="button"
            className="btn-icon"
            title={t('settings.refreshProviderStatus')}
            onClick={() => void useAIStore.getState().refreshAllProviderStatuses()}
          >
            <RefreshCw size={14} />
          </button>
        }
      >
        {presetProviders.map((p) => (
          <ProviderListItem key={p.id} provider={p} focusId={focusId} onSelect={onSelect} />
        ))}
        {customProviders.map((p) => (
          <ProviderListItem key={p.id} provider={p} focusId={focusId} onSelect={onSelect} />
        ))}
        <button
          type="button"
          className={`settings-list-item${focusId === ADD_PROVIDER_SELECTION_ID ? ' settings-list-item--active' : ''}`}
          onClick={() => onSelect(ADD_PROVIDER_SELECTION_ID)}
          aria-current={focusId === ADD_PROVIDER_SELECTION_ID ? 'true' : undefined}
        >
          <Plus size={14} aria-hidden />
          <span className="settings-list-item-title">{t('models.addCustomProvider')}</span>
        </button>
        <button
          type="button"
          className={`settings-list-item${focusId === DEFAULTS_SELECTION_ID ? ' settings-list-item--active' : ''}`}
          onClick={() => onSelect(DEFAULTS_SELECTION_ID)}
          aria-current={focusId === DEFAULTS_SELECTION_ID ? 'true' : undefined}
        >
          <Settings2 size={14} aria-hidden />
          <span className="settings-list-item-title">{t('models.tabDefaults')}</span>
        </button>
      </CollapsibleCategory>

      <CollapsibleCategory
        id="webSearch"
        label={t('settings.groupWebSearch')}
        count={SEARCH_TOOLS.length}
        collapsed={collapsed.has('webSearch')}
        onToggle={toggleCategory}
      >
        {SEARCH_TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={`settings-list-item${focusId === tool.id ? ' settings-list-item--active' : ''}`}
            onClick={() => onSelect(tool.id)}
            aria-current={focusId === tool.id ? 'true' : undefined}
          >
            {renderDot(isKeyPresent(getKeyForProvider(tool.id)))}
            <span className="settings-list-item-title">{t(tool.labelKey)}</span>
          </button>
        ))}
      </CollapsibleCategory>

      <CollapsibleCategory
        id="browser"
        label={t('tools.groupBrowser')}
        collapsed={collapsed.has('browser')}
        onToggle={toggleCategory}
      >
        <div className="settings-list-item settings-list-item--placeholder" style={{ cursor: 'default' }}>
          <span className="settings-list-item-title subtle" style={{ fontStyle: 'italic' }}>
            {t('settings.comingSoon')}
          </span>
        </div>
      </CollapsibleCategory>

      <CollapsibleCategory
        id="storage"
        label={t('tools.groupStorage')}
        collapsed={collapsed.has('storage')}
        onToggle={toggleCategory}
      >
        <div className="settings-list-item settings-list-item--placeholder" style={{ cursor: 'default' }}>
          <span className="settings-list-item-title subtle" style={{ fontStyle: 'italic' }}>
            {t('settings.comingSoon')}
          </span>
        </div>
      </CollapsibleCategory>
    </div>
  );
}
