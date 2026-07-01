import { useState, useRef } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AIProviderConfig, ModelItem } from '../../../types';
import { ModelSwitch } from '../../modals/modelProvider/ModelSwitch';
import { ModelHoverCard } from '../../modals/modelProvider/ModelHoverCard';
import { AddCustomModelInput } from '../../modals/modelProvider/AddCustomModelInput';

interface ProviderModelsTabProps {
  provider: AIProviderConfig;
  hiddenModels: string[];
  onToggleModel: (providerId: string, modelId: string, enabled: boolean) => void;
  onAddCustomModel: (providerId: string, slug: string) => void;
}

export function ProviderModelsTab({
  provider,
  hiddenModels,
  onToggleModel,
  onAddCustomModel,
}: ProviderModelsTabProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [hoveredModel, setHoveredModel] = useState<{ model: ModelItem; rect: DOMRect } | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const models = provider.models ?? [];
  const filteredModels = search
    ? models.filter(
        (m) =>
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          m.id.toLowerCase().includes(search.toLowerCase()),
      )
    : models;

  const isHidden = (modelId: string) =>
    hiddenModels.includes(`${provider.id}:${modelId}`);

  const handleMouseEnter = (model: ModelItem) => {
    const rect = rowRefs.current[model.id]?.getBoundingClientRect();
    if (rect) setHoveredModel({ model, rect });
  };

  return (
    <div className="col gap-2" style={{ padding: '16px 0' }}>
      {/* Search */}
      <div className="row gap-2" style={{ alignItems: 'center' }}>
        <div className="row gap-2 flex-1" style={{ alignItems: 'center', border: '1px solid var(--c-border-1)', borderRadius: 8, padding: '0 8px' }}>
          <Search size={14} style={{ color: 'var(--c-text-3)', flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('models.searchModels')}
            className="flex-1"
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 'var(--fs-sm)',
              padding: '8px 0',
              color: 'var(--c-text-1)',
            }}
          />
        </div>
        <span className="subtle" style={{ fontSize: 'var(--fs-xs)', whiteSpace: 'nowrap' }}>
          {t('models.modelCount', { count: models.length })}
        </span>
      </div>

      {/* Model list */}
      <div className="col gap-1">
        {filteredModels.length === 0 ? (
          <div
            className="subtle"
            style={{ padding: '24px 12px', fontSize: 'var(--fs-sm)', textAlign: 'center' }}
          >
            {models.length === 0 ? t('models.noModelsAvailable') : t('models.noSearchResults')}
          </div>
        ) : (
          filteredModels.map((model) => {
            const enabled = !isHidden(model.id);
            return (
              <div
                key={model.id}
                ref={(el) => { rowRefs.current[model.id] = el; }}
                className="row provider-model-row"
                style={{
                  padding: '8px 12px',
                  justifyContent: 'space-between',
                  cursor: 'default',
                  outline: 'none',
                  borderRadius: 8,
                  gap: 8,
                }}
                tabIndex={0}
                onMouseEnter={() => handleMouseEnter(model)}
                onMouseLeave={() => setHoveredModel(null)}
                onFocus={() => handleMouseEnter(model)}
                onBlur={() => setHoveredModel(null)}
              >
                <div className="min-w-0 flex-1">
                  <div className="med trunc" style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-text-1)' }}>
                    {model.name}
                  </div>
                  {model.description && (
                    <div className="subtle trunc" style={{ fontSize: 'var(--fs-xs)' }}>
                      {model.description}
                    </div>
                  )}
                </div>
                <ModelSwitch
                  checked={enabled}
                  onChange={(checked) => onToggleModel(provider.id, model.id, checked)}
                  ariaLabel={`${enabled ? t('models.hideFromSelector', { model: model.name }) : t('models.showInSelector', { model: model.name })}`}
                />
              </div>
            );
          })
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
