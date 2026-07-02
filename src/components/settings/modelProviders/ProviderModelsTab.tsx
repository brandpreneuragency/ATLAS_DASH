import { useState, useRef } from 'react';
import { Search, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AIProviderConfig, ModelItem } from '../../../types';
import { ModelSwitch } from '../../modals/modelProvider/ModelSwitch';
import { ModelHoverCard } from '../../modals/modelProvider/ModelHoverCard';
import { AddCustomModelInput } from '../../modals/modelProvider/AddCustomModelInput';

type FilterType = 'all' | 'enabled' | 'disabled' | 'custom' | 'vision' | 'tool_use' | 'reasoning';

interface ProviderModelsTabProps {
  provider: AIProviderConfig;
  hiddenModels: string[];
  onToggleModel: (providerId: string, modelId: string, enabled: boolean) => void;
  onAddCustomModel: (providerId: string, slug: string) => void;
  onSyncModels?: () => void;
}

export function ProviderModelsTab({
  provider,
  hiddenModels,
  onToggleModel,
  onAddCustomModel,
  onSyncModels,
}: ProviderModelsTabProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [hoveredModel, setHoveredModel] = useState<{ model: ModelItem; rect: DOMRect } | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const models = provider.models ?? [];

  const isHidden = (modelId: string) =>
    hiddenModels.includes(`${provider.id}:${modelId}`);

  const filteredModels = models.filter((m) => {
    const matchesSearch = !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.id.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    switch (activeFilter) {
      case 'enabled':
        return !isHidden(m.id);
      case 'disabled':
        return isHidden(m.id);
      case 'custom':
        return m.custom === true;
      case 'vision':
        return m.capabilities?.vision === true;
      case 'tool_use':
        return m.capabilities?.toolCalling === true;
      case 'reasoning':
        return m.capabilities?.reasoning === 'High' || m.capabilities?.reasoning === 'Medium';
      default:
        return true;
    }
  });

  const handleMouseEnter = (model: ModelItem) => {
    const rect = rowRefs.current[model.id]?.getBoundingClientRect();
    if (rect) setHoveredModel({ model, rect });
  };

  const FILTER_BUTTONS: { id: FilterType; labelKey: string }[] = [
    { id: 'all', labelKey: 'models.filterAll' },
    { id: 'enabled', labelKey: 'models.filterEnabled' },
    { id: 'disabled', labelKey: 'models.filterDisabled' },
    { id: 'custom', labelKey: 'models.filterCustom' },
    { id: 'vision', labelKey: 'models.filterVision' },
    { id: 'tool_use', labelKey: 'models.filterToolUse' },
    { id: 'reasoning', labelKey: 'models.filterReasoning' },
  ];

  return (
    <div className="col gap-2" style={{ padding: '16px 0' }}>
      {/* Search and sync */}
      <div className="row gap-2" style={{ alignItems: 'center' }}>
        <div className="row gap-2 flex-1 settings-search-input-wrap">
          <Search size={14} style={{ color: 'var(--c-text-3)', flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('models.searchModels')}
            className="flex-1 settings-search-input"
          />
        </div>
        {onSyncModels && (
          <button
            type="button"
            onClick={onSyncModels}
            className="btn-send settings-action-btn"
            title={t('models.syncModels')}
            aria-label={t('models.syncModels')}
          >
            <Download size={12} />
            <span>{t('models.syncModels')}</span>
          </button>
        )}
        <span className="subtle" style={{ fontSize: 'var(--fs-xs)', whiteSpace: 'nowrap' }}>
          {t('models.modelCount', { count: models.length })}
        </span>
      </div>

      {/* Filters */}
      <div className="row gap-1 settings-filter-bar">
        {FILTER_BUTTONS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setActiveFilter(filter.id)}
            className={activeFilter === filter.id ? 'btn-brand settings-filter-btn settings-filter-btn--active' : 'btn-xs settings-filter-btn settings-filter-btn--inactive'}
          >
            {t(filter.labelKey)}
          </button>
        ))}
      </div>

      {/* Model table */}
      <div className="col gap-1">
        {filteredModels.length === 0 ? (
          <div className="subtle settings-models-empty">
            {models.length === 0 ? t('models.noModelsAvailable') : t('models.noSearchResults')}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="row settings-model-table-header">
              <span style={{ flex: 2 }}>{t('models.colModelName')}</span>
              <span style={{ flex: 2 }}>{t('models.colModelId')}</span>
              <span style={{ flex: 2 }}>{t('models.colCapabilities')}</span>
              <span style={{ flex: 1 }}>{t('models.colSource')}</span>
              <span style={{ width: 48, textAlign: 'center' }}>{t('models.colEnabled')}</span>
            </div>

            {/* Table rows */}
            {filteredModels.map((model) => {
              const enabled = !isHidden(model.id);
              const capabilities = model.capabilities;
              const capItems: string[] = [];
              if (capabilities?.vision) capItems.push(t('models.capVision'));
              if (capabilities?.toolCalling) capItems.push(t('models.capToolUse'));
              if (capabilities?.reasoning === 'High' || capabilities?.reasoning === 'Medium') {
                capItems.push(t('models.capReasoning'));
              }

              return (
                <div
                  key={model.id}
                  ref={(el) => { rowRefs.current[model.id] = el; }}
                  className="row provider-model-row settings-model-table-row"
                  tabIndex={0}
                  onMouseEnter={() => handleMouseEnter(model)}
                  onMouseLeave={() => setHoveredModel(null)}
                  onFocus={() => handleMouseEnter(model)}
                  onBlur={() => setHoveredModel(null)}
                >
                  <span className="settings-model-name">
                    {model.name}
                  </span>
                  <span className="settings-model-id">
                    {model.id}
                  </span>
                  <span className="settings-model-caps">
                    {capItems.length > 0 ? capItems.join(', ') : t('models.capUnknown')}
                  </span>
                  <span className={`settings-model-source ${model.custom ? 'settings-model-source--custom' : 'settings-model-source--synced'}`}>
                    {model.custom ? t('models.sourceCustom') : t('models.sourceSynced')}
                  </span>
                  <span className="settings-model-toggle-cell">
                    <ModelSwitch
                      checked={enabled}
                      onChange={(checked) => onToggleModel(provider.id, model.id, checked)}
                      ariaLabel={`${enabled ? t('models.hideFromSelector', { model: model.name }) : t('models.showInSelector', { model: model.name })}`}
                    />
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Add custom model */}
      <div style={{ borderTop: '1px solid var(--c-border-1)', paddingTop: 8 }}>
        <AddCustomModelInput
          onAdd={(slug) => onAddCustomModel(provider.id, slug)}
          existingIds={models.map((m) => m.id)}
        />
      </div>

      {hoveredModel && (
        <ModelHoverCard
          targetRect={hoveredModel.rect}
          provider={provider}
          model={hoveredModel.model}
          enabled={!isHidden(hoveredModel.model.id)}
        />
      )}
    </div>
  );
}
