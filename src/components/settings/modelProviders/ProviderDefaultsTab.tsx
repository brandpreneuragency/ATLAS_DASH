import { useTranslation } from 'react-i18next';
import { useAIStore } from '../../../stores/aiStore';
import type { TaskModelDefaultKey } from '../../../types';

const TASK_LABELS: { key: TaskModelDefaultKey; i18nKey: string }[] = [
  { key: 'general_chat', i18nKey: 'models.defaultsGeneralChat' },
  { key: 'writing', i18nKey: 'models.defaultsWriting' },
  { key: 'task_management', i18nKey: 'models.defaultsTaskManagement' },
  { key: 'app_management', i18nKey: 'models.defaultsAppManagement' },
  { key: 'coding', i18nKey: 'models.defaultsCoding' },
  { key: 'deep_reasoning', i18nKey: 'models.defaultsDeepReasoning' },
  { key: 'fast_cheap', i18nKey: 'models.defaultsFastCheap' },
  { key: 'long_context', i18nKey: 'models.defaultsLongContext' },
  { key: 'vision', i18nKey: 'models.defaultsVision' },
  { key: 'structured_output', i18nKey: 'models.defaultsStructuredOutput' },
  { key: 'tool_use', i18nKey: 'models.defaultsToolUse' },
  { key: 'fallback', i18nKey: 'models.defaultsFallback' },
];

function filterModelsForTask(
  taskKey: TaskModelDefaultKey,
  models: { id: string; name: string; capabilities: { vision: boolean; toolCalling: boolean; speed: string; cost: string; reasoning: string } }[],
) {
  return models.filter((m) => {
    const c = m.capabilities;
    switch (taskKey) {
      case 'vision':
        return c.vision === true;
      case 'tool_use':
        return c.toolCalling === true;
      case 'deep_reasoning':
        return c.reasoning === 'High';
      case 'fast_cheap':
        return c.speed === 'Fast' || c.cost === 'Free' || c.cost === 'Limited';
      default:
        return true;
    }
  });
}

export function ProviderDefaultsTab() {
  const { t } = useTranslation();
  const taskModelDefaults = useAIStore((s) => s.taskModelDefaults);
  const providerConfigs = useAIStore((s) => s.providerConfigs);
  const setTaskDefault = useAIStore((s) => s.setTaskDefault);
  const removeTaskDefault = useAIStore((s) => s.removeTaskDefault);

  const connectedProviders = providerConfigs.filter((p) => p.status === 'connected' || (p.models ?? []).length > 0);

  return (
    <div className="col gap-3" style={{ padding: '16px 0' }}>
      <div className="col gap-2">
        <div className="label-sm">{t('models.defaultsTaskDefault')}</div>
        <p className="subtle" style={{ fontSize: 'var(--fs-sm)', margin: 0 }}>
          {t('models.defaultsTaskDefaultHint')}
        </p>
      </div>

      <div className="col gap-2">
        {TASK_LABELS.map(({ key, i18nKey }) => {
          const current = taskModelDefaults.find((d) => d.taskKey === key);
          const selectedProvider = current
            ? connectedProviders.find((p) => p.id === current.providerId)
            : undefined;
          const availableModels = selectedProvider
            ? filterModelsForTask(key, (selectedProvider.models ?? []).filter((m) => m.enabled))
            : [];

          return (
            <div
              key={key}
              className="row gap-2 settings-defaults-row"
            >
              <span className="med settings-defaults-label">
                {t(i18nKey)}
              </span>

              {/* Provider select */}
              <select
                value={current?.providerId ?? ''}
                onChange={(e) => {
                  const providerId = e.target.value;
                  if (!providerId) {
                    removeTaskDefault(key);
                    return;
                  }
                  const provider = connectedProviders.find((p) => p.id === providerId);
                  const firstModel = provider?.models?.find((m) => m.enabled)?.id ?? '';
                  setTaskDefault(key, providerId, firstModel);
                }}
                className="settings-defaults-select"
              >
                <option value="">{t('models.defaultsNoProvider')}</option>
                {connectedProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              {/* Model select */}
              <select
                value={current?.modelId ?? ''}
                disabled={!current?.providerId}
                onChange={(e) => {
                  if (current?.providerId) {
                    setTaskDefault(key, current.providerId, e.target.value);
                  }
                }}
                className="settings-defaults-select"
                style={{ opacity: current?.providerId ? 1 : 0.5 }}
              >
                <option value="">{current?.providerId ? t('models.defaultsNoProvider') : '—'}</option>
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.id}
                  </option>
                ))}
              </select>

              {current && (
                <button
                  type="button"
                  className="btn-xs"
                  style={{
                    border: '1px solid var(--c-border-1)',
                    fontSize: 'var(--fs-xs)',
                    padding: '2px 8px',
                    whiteSpace: 'nowrap',
                  }}
                  onClick={() => removeTaskDefault(key)}
                >
                  {t('models.defaultsClear')}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
