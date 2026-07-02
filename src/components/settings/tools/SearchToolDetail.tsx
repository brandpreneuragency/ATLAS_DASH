import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../../../stores/aiStore';
import type { SearchProvider } from '../../../types';

interface SearchToolDetailProps {
  providerId: SearchProvider;
}

interface ProviderMeta {
  labelKey: string;
  keyField: keyof Pick<import('../../../types').SearchConfig, 'exaKey' | 'tavilyKey' | 'firecrawlKey' | 'braveKey'>;
  keyLabelKey: string;
  keyHintKey: string;
  placeholder: string;
}

const PROVIDER_META: Record<SearchProvider, ProviderMeta> = {
  tavily: {
    labelKey: 'settings.tavily',
    keyField: 'tavilyKey',
    keyLabelKey: 'settings.tavilyKey',
    keyHintKey: 'settings.tavilyKeyHint',
    placeholder: 'tvly-...',
  },
  exa: {
    labelKey: 'settings.exa',
    keyField: 'exaKey',
    keyLabelKey: 'settings.exaKey',
    keyHintKey: 'settings.exaKeyHint',
    placeholder: 'exa_...',
  },
  firecrawl: {
    labelKey: 'settings.firecrawl',
    keyField: 'firecrawlKey',
    keyLabelKey: 'settings.firecrawlKey',
    keyHintKey: 'settings.firecrawlKeyHint',
    placeholder: 'fc-...',
  },
  brave: {
    labelKey: 'settings.brave',
    keyField: 'braveKey',
    keyLabelKey: 'settings.braveKey',
    keyHintKey: 'settings.braveKeyHint',
    placeholder: 'BSA...',
  },
};

export function SearchToolDetail({ providerId }: SearchToolDetailProps) {
  const { t } = useTranslation();
  const searchConfig = useAIStore((s) => s.searchConfig);
  const saveSearchConfig = useAIStore((s) => s.saveSearchConfig);

  const meta = PROVIDER_META[providerId];
  const [draftKey, setDraftKey] = useState(searchConfig[meta.keyField]);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isDefault = searchConfig.searchProvider === providerId;
  const isEnabled = searchConfig.enabled;

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await saveSearchConfig({
        ...searchConfig,
        [meta.keyField]: draftKey.trim(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDefault = async () => {
    await saveSearchConfig({
      ...searchConfig,
      searchProvider: providerId,
    });
  };

  const handleToggleEnabled = async () => {
    await saveSearchConfig({
      ...searchConfig,
      enabled: !isEnabled,
    });
  };

  return (
    <div className="col gap-3" style={{ maxWidth: 480 }}>
      <div className="col gap-3">
        <div className="col gap-1">
          <div className="label-sm">{t(meta.keyLabelKey)}</div>
          <p className="subtle" style={{ fontSize: 'var(--fs-xs)', margin: 0 }}>
            {t(meta.keyHintKey)}
          </p>
        </div>
        <div className="row gap-2">
          <input
            type={showKey ? 'text' : 'password'}
            value={draftKey}
            onChange={(e) => { setDraftKey(e.target.value); setSaved(false); }}
            placeholder={meta.placeholder}
            className="ctrl ctrl--mono flex-1"
            style={{ fontSize: 'var(--fs-xs)', backgroundColor: 'rgba(194, 194, 194, 0)' }}
          />
          <button type="button" onClick={() => setShowKey((v) => !v)} className="btn-icon">
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      <div className="col gap-1">
        <div className="label-sm">{t('tools.defaultSearchProvider')}</div>
        <button
          type="button"
          onClick={handleToggleDefault}
          className={`settings-list-item${isDefault ? ' settings-list-item--active' : ''}`}
          style={{ justifyContent: 'space-between' }}
        >
          <span className="settings-list-item-title">
            {isDefault ? t('tools.isDefault') : t('tools.setAsDefault')}
          </span>
          {isDefault && (
            <span className="settings-list-item-meta" style={{ color: 'var(--c-success)' }}>
              {t('tools.default')}
            </span>
          )}
        </button>
      </div>

      <div className="col gap-1">
        <div className="label-sm">{t('tools.webSearch')}</div>
        <div
          className="row gap-2"
          style={{ alignItems: 'center', justifyContent: 'space-between' }}
        >
          <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
            {isEnabled ? t('settings.enabled') : t('settings.disabled')}
          </span>
          <button
            type="button"
            onClick={handleToggleEnabled}
            className={`settings-toggle ${isEnabled ? 'settings-toggle--on' : 'settings-toggle--off'}`}
            aria-label={isEnabled ? t('settings.disable') : t('settings.enable')}
          >
            <span className={`settings-toggle-knob ${isEnabled ? 'settings-toggle-knob--on' : 'settings-toggle-knob--off'}`} />
          </button>
        </div>
      </div>

      <div style={{ paddingTop: 8 }}>
        <button
          type="button"
          onClick={() => { void handleSave(); }}
          disabled={saving}
          className="btn btn--primary"
          style={{ minWidth: 100 }}
        >
          {saving ? t('models.importing') : saved ? t('settings.saved') : t('settings.save')}
        </button>
      </div>
    </div>
  );
}
