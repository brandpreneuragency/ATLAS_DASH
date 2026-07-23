import { useEffect, useMemo, useState } from 'react';
import { Star, Ban, Trash2 } from 'lucide-react';
import { SettingsPanels } from './SettingsPanels';
import {
  useSettingsSystemStore,
  flattenModelOptions,
  type ModelListEntry,
} from '../../stores/settingsSystemStore';

type SubTab = 'models' | 'providers' | 'notifications' | 'limits' | 'backup';

const SUBTABS: { id: SubTab; label: string }[] = [
  { id: 'models', label: 'Hermes model' },
  { id: 'providers', label: 'Provider keys' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'limits', label: 'Run limits' },
  { id: 'backup', label: 'Backup & system' },
];

/**
 * Settings -> System (D-MODELS): folds Control's `Models.tsx` (Hermes model
 * switching, provider keys, model favorites/hidden) and `Settings.tsx`
 * (notifications, run limits, backup status, system health) into one
 * settings-admin subsection. Secrets are rendered exactly as the backend
 * masks them (`redacted_value`, `*_set` booleans) — never unmasked, never
 * echoed back into a mutation unless the user typed a fresh value.
 */
export function SystemSection() {
  const state = useSettingsSystemStore((s) => s.state);
  const errorMessage = useSettingsSystemStore((s) => s.errorMessage);
  const refresh = useSettingsSystemStore((s) => s.refresh);
  const [activeTab, setActiveTab] = useState<SubTab>('models');

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const leftMain = (
    <div className="settings-list-body">
      {SUBTABS.map((t) => (
        <button
          key={t.id}
          className={`settings-list-item${activeTab === t.id ? ' settings-list-item--active' : ''}`}
          onClick={() => setActiveTab(t.id)}
        >
          <span className="settings-list-item-title">{t.label}</span>
        </button>
      ))}
    </div>
  );

  const centerMain = (
    <div className="settings-detail-body">
      {state === 'loading' && (
        <p className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
          Loading…
        </p>
      )}
      {errorMessage && (
        <div role="alert" style={{ fontSize: 'var(--fs-sm)', color: '#b91c1c' }}>
          {errorMessage}
        </div>
      )}
      {state === 'ready' && activeTab === 'models' && <ModelsPanel />}
      {state === 'ready' && activeTab === 'providers' && <ProviderKeysPanel />}
      {state === 'ready' && activeTab === 'notifications' && <NotificationsPanel />}
      {state === 'ready' && activeTab === 'limits' && <LimitsPanel />}
      {state === 'ready' && activeTab === 'backup' && <BackupHealthPanel />}
    </div>
  );

  return <SettingsPanels leftMain={leftMain} centerMain={centerMain} />;
}

function ModelRow({ entry, fav, hidden }: { entry: ModelListEntry; fav: boolean; hidden: boolean }) {
  const togglePref = useSettingsSystemStore((s) => s.togglePref);
  const switchModel = useSettingsSystemStore((s) => s.switchModel);
  return (
    <div
      data-testid={`model-row-${entry.model}`}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        border: '1px solid var(--c-border-1)', borderRadius: 6, padding: '6px 10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
        <button
          type="button"
          className="btn-icon"
          aria-label={`favorite ${entry.model}`}
          style={{ color: fav ? '#b45309' : undefined }}
          onClick={() => void togglePref('favorites', entry.model)}
        >
          <Star size={13} />
        </button>
        <button
          type="button"
          className="btn-icon"
          aria-label={`hide ${entry.model}`}
          style={{ color: hidden ? '#b91c1c' : undefined }}
          onClick={() => void togglePref('hidden', entry.model)}
        >
          <Ban size={13} />
        </button>
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--fs-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.model}
        </span>
        <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>{entry.provider}</span>
      </div>
      <button type="button" className="btn" style={{ fontSize: 'var(--fs-xs)', flexShrink: 0 }} onClick={() => void switchModel(entry.model, entry.provider)}>
        Use this model
      </button>
    </div>
  );
}

function ModelsPanel() {
  const modelInfo = useSettingsSystemStore((s) => s.modelInfo);
  const prefs = useSettingsSystemStore((s) => s.prefs);
  const [q, setQ] = useState('');
  const [showHidden, setShowHidden] = useState(false);

  const all = useMemo(() => flattenModelOptions(modelInfo), [modelInfo]);
  const matches = (m: string) => !q || m.toLowerCase().includes(q.toLowerCase());

  const favorites = all.filter((m) => prefs.favorites.includes(m.model) && matches(m.model));
  const hiddenModels = all.filter((m) => prefs.hidden.includes(m.model) && matches(m.model));
  const visible = all.filter((m) => !prefs.hidden.includes(m.model) && matches(m.model));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 'var(--fs-base)' }}>Hermes model</h3>
        <input
          aria-label="search models"
          className="ctrl"
          style={{ fontSize: 'var(--fs-sm)', width: 220 }}
          placeholder="filter models…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div data-testid="current-model-card" style={{ border: '1px solid var(--c-border-1)', borderRadius: 8, padding: 12 }}>
        <p className="subtle" style={{ margin: 0, fontSize: 'var(--fs-xs)', textTransform: 'uppercase' }}>Current model</p>
        {modelInfo ? (
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 'var(--fs-lg, 18px)', fontWeight: 600 }}>{modelInfo.current.model}</span>
            <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>{modelInfo.current.provider}</span>
            {modelInfo.current.capabilities?.context_window !== undefined && (
              <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
                ctx {modelInfo.current.capabilities.context_window.toLocaleString('en-US')}
              </span>
            )}
          </div>
        ) : (
          <p className="subtle" style={{ margin: '6px 0 0' }}>unavailable</p>
        )}
      </div>

      {favorites.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 6px', fontSize: 'var(--fs-sm)' }}>★ Favorites</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {favorites.map((m) => <ModelRow key={m.model} entry={m} fav hidden={false} />)}
          </div>
        </div>
      )}

      <div>
        <h4 style={{ margin: '0 0 6px', fontSize: 'var(--fs-sm)' }}>All models ({visible.length})</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {visible.map((m) => (
            <ModelRow key={m.model} entry={m} fav={prefs.favorites.includes(m.model)} hidden={false} />
          ))}
          {visible.length === 0 && <p className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>No models match.</p>}
        </div>
      </div>

      {hiddenModels.length > 0 && (
        <div>
          <button type="button" className="btn-icon" style={{ fontSize: 'var(--fs-xs)' }} onClick={() => setShowHidden((v) => !v)}>
            {showHidden ? 'Hide' : 'Show'} hidden ({hiddenModels.length})
          </button>
          {showHidden && (
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {hiddenModels.map((m) => <ModelRow key={m.model} entry={m} fav={prefs.favorites.includes(m.model)} hidden />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProviderKeysPanel() {
  const env = useSettingsSystemStore((s) => s.env);
  const busy = useSettingsSystemStore((s) => s.busy);
  const putEnvKey = useSettingsSystemStore((s) => s.putEnvKey);
  const deleteEnvKey = useSettingsSystemStore((s) => s.deleteEnvKey);
  const [keyName, setKeyName] = useState('');
  const [keyValue, setKeyValue] = useState('');

  const entries = Object.entries(env).filter(([, entry]) => entry.is_set);

  const add = async () => {
    if (!keyName || !keyValue) return;
    if (await putEnvKey(keyName, keyValue)) {
      setKeyName('');
      setKeyValue('');
    }
  };

  return (
    <div data-testid="provider-keys-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 'var(--fs-base)' }}>Provider keys</h3>
      <p className="subtle" style={{ margin: 0, fontSize: 'var(--fs-xs)' }}>
        Values are masked by Hermes before they ever reach this app — only the redacted form is shown, and it cannot be unmasked here.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {entries.map(([name, entry]) => (
          <div
            key={name}
            data-testid={`env-row-${name}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 10px', border: '1px solid var(--c-border-1)', borderRadius: 6 }}
          >
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--fs-sm)' }}>{name}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span data-testid={`env-masked-${name}`} className="subtle" style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--fs-sm)' }}>
                {entry.redacted_value ?? '••••'}
              </span>
              <button type="button" className="btn-icon" aria-label={`delete ${name}`} disabled={busy} onClick={() => void deleteEnvKey(name)}>
                <Trash2 size={13} />
              </button>
            </span>
          </div>
        ))}
        {entries.length === 0 && <p className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>No provider keys set.</p>}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <label style={{ flex: 1, fontSize: 'var(--fs-sm)' }}>
          Key name
          <input className="ctrl w-full" style={{ fontSize: 'var(--fs-sm)' }} value={keyName} onChange={(e) => setKeyName(e.target.value)} />
        </label>
        <label style={{ flex: 1, fontSize: 'var(--fs-sm)' }}>
          Key value
          <input
            type="password"
            aria-label="key value"
            className="ctrl w-full"
            style={{ fontSize: 'var(--fs-sm)' }}
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
          />
        </label>
        <button type="button" className="btn" disabled={!keyName || !keyValue || busy} onClick={() => void add()}>
          Add key
        </button>
      </div>
    </div>
  );
}

function NotificationsPanel() {
  const notify = useSettingsSystemStore((s) => s.notify);
  const busy = useSettingsSystemStore((s) => s.busy);
  const saveNotifications = useSettingsSystemStore((s) => s.saveNotifications);
  const testNotifications = useSettingsSystemStore((s) => s.testNotifications);

  // Secret inputs ALWAYS start blank — the backend never sends the real
  // value back, only whether one is set (`*_set`). Plain fields (chat id,
  // smtp "to") start prefilled since they are not secret.
  const [token, setToken] = useState('');
  const [chatId, setChatId] = useState(notify?.telegram_chat_id ?? '');
  const [smtpUrl, setSmtpUrl] = useState('');
  const [smtpTo, setSmtpTo] = useState(notify?.smtp_to ?? '');
  const [status, setStatus] = useState<string | null>(null);

  const save = async () => {
    setStatus(null);
    const patch: Record<string, string> = {};
    if (token) patch.telegram_bot_token = token;
    if (chatId) patch.telegram_chat_id = chatId;
    if (smtpUrl) patch.smtp_url = smtpUrl;
    if (smtpTo) patch.smtp_to = smtpTo;
    if (await saveNotifications(patch)) {
      setToken('');
      setSmtpUrl('');
      setStatus('Saved.');
    }
  };

  const sendTest = async () => {
    setStatus('Sending test message…');
    const result = await testNotifications();
    if (result) {
      setStatus(`Test: telegram ${result.telegram ? 'sent' : 'failed/not configured'}, email ${result.email ? 'sent' : 'failed/not configured'}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420 }}>
      <h3 style={{ margin: 0, fontSize: 'var(--fs-base)' }}>Notifications</h3>
      <label style={{ fontSize: 'var(--fs-sm)' }}>
        Telegram bot token {notify?.telegram_bot_token_set && <span style={{ color: '#15803d', fontSize: 'var(--fs-xs)' }}>(set)</span>}
        <input
          type="password"
          aria-label="telegram bot token"
          className="ctrl w-full"
          style={{ fontSize: 'var(--fs-sm)' }}
          placeholder={notify?.telegram_bot_token_set ? '•••••• (leave blank to keep)' : ''}
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      </label>
      <label style={{ fontSize: 'var(--fs-sm)' }}>
        Telegram chat id
        <input className="ctrl w-full" style={{ fontSize: 'var(--fs-sm)' }} value={chatId} onChange={(e) => setChatId(e.target.value)} />
      </label>
      <label style={{ fontSize: 'var(--fs-sm)' }}>
        SMTP URL {notify?.smtp_url_set && <span style={{ color: '#15803d', fontSize: 'var(--fs-xs)' }}>(set)</span>}
        <input
          type="password"
          aria-label="smtp url"
          className="ctrl w-full"
          style={{ fontSize: 'var(--fs-sm)' }}
          placeholder={notify?.smtp_url_set ? '•••••• (leave blank to keep)' : 'smtp://user:pass@host:port'}
          value={smtpUrl}
          onChange={(e) => setSmtpUrl(e.target.value)}
        />
      </label>
      <label style={{ fontSize: 'var(--fs-sm)' }}>
        Email to
        <input className="ctrl w-full" style={{ fontSize: 'var(--fs-sm)' }} value={smtpTo} onChange={(e) => setSmtpTo(e.target.value)} />
      </label>
      {status && <p className="subtle" style={{ fontSize: 'var(--fs-sm)', margin: 0 }}>{status}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn" disabled={busy} onClick={() => void save()}>Save</button>
        <button type="button" className="btn-icon" disabled={busy} onClick={() => void sendTest()}>Send test message</button>
      </div>
    </div>
  );
}

function LimitsPanel() {
  const limits = useSettingsSystemStore((s) => s.limits);
  const busy = useSettingsSystemStore((s) => s.busy);
  const saveLimits = useSettingsSystemStore((s) => s.saveLimits);
  const [mrph, setMrph] = useState(String(limits?.default_max_runs_per_hour ?? 6));
  const [budget, setBudget] = useState(limits?.default_budget_usd_per_run != null ? String(limits.default_budget_usd_per_run) : '');
  const [status, setStatus] = useState<string | null>(null);

  const save = async () => {
    setStatus(null);
    if (await saveLimits(Number(mrph), budget === '' ? null : Number(budget))) {
      setStatus('Saved — applied to new workflows.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
      <h3 style={{ margin: 0, fontSize: 'var(--fs-base)' }}>Run limits & budgets</h3>
      <label style={{ fontSize: 'var(--fs-sm)' }}>
        Default max runs per hour
        <input type="number" min={1} className="ctrl w-full" style={{ fontSize: 'var(--fs-sm)' }} value={mrph} onChange={(e) => setMrph(e.target.value)} />
      </label>
      <label style={{ fontSize: 'var(--fs-sm)' }}>
        Default budget per run (USD, empty = no cap)
        <input type="number" step="0.01" className="ctrl w-full" style={{ fontSize: 'var(--fs-sm)' }} value={budget} onChange={(e) => setBudget(e.target.value)} />
      </label>
      <p className="subtle" style={{ fontSize: 'var(--fs-sm)', margin: 0 }}>
        Global concurrency: {limits?.global_concurrency ?? '…'} <span style={{ fontSize: 'var(--fs-xs)' }}>(fixed — engine semaphore)</span>
      </p>
      {status && <p className="subtle" style={{ fontSize: 'var(--fs-sm)', margin: 0 }}>{status}</p>}
      <button type="button" className="btn" disabled={busy} onClick={() => void save()}>Save limits</button>
    </div>
  );
}

function BackupHealthPanel() {
  const backup = useSettingsSystemStore((s) => s.backup);
  const health = useSettingsSystemStore((s) => s.health);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div data-testid="backup-status" style={{ border: '1px solid var(--c-border-1)', borderRadius: 8, padding: 12 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 'var(--fs-base)' }}>Backups</h3>
        {backup === null ? (
          <p className="subtle" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>status unavailable</p>
        ) : backup.ok ? (
          <p style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>
            last backup {backup.ts ? new Date(backup.ts).toLocaleString() : 'unknown time'}
            {typeof backup.size === 'number' && <span className="subtle"> · {(backup.size / 1024).toFixed(0)} KB</span>}
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: '#b91c1c' }}>{backup.reason ?? backup.error ?? 'failed'}</p>
        )}
      </div>

      <div data-testid="system-health" style={{ border: '1px solid var(--c-border-1)', borderRadius: 8, padding: 12 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 'var(--fs-base)' }}>System health</h3>
        {health === null ? (
          <p className="subtle" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>status unavailable</p>
        ) : (
          <div style={{ fontSize: 'var(--fs-sm)', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span>status: {health.status}</span>
            <span>db: {health.db}</span>
            <span>hermes: {JSON.stringify(health.hermes)}</span>
            <span className="subtle">version {health.version}</span>
          </div>
        )}
      </div>
    </div>
  );
}
