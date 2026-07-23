import { useEffect } from 'react';
import { ShieldAlert, ShieldOff } from 'lucide-react';
import { useKillSwitchStore } from '../../stores/killSwitchStore';

/**
 * Persistent-header kill switch (M1/M2: engage/release backed by Control's
 * system router, imported at M3 to `server/app/routers/system.py`).
 * State and the `GET/POST /api/killswitch` calls live in `killSwitchStore`;
 * this component is a thin view.
 */
export function KillSwitch() {
  const status = useKillSwitchStore((s) => s.status);
  const busy = useKillSwitchStore((s) => s.busy);
  const refresh = useKillSwitchStore((s) => s.refresh);
  const toggle = useKillSwitchStore((s) => s.toggle);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const engaged = status === 'engaged';
  const label =
    status === 'loading'
      ? 'Kill switch (loading)'
      : status === 'error'
      ? 'Kill switch (unavailable)'
      : engaged
      ? 'Kill switch engaged — click to release'
      : 'Kill switch — click to engage';

  return (
    <button
      type="button"
      id="header-btn-killswitch"
      onClick={() => void toggle()}
      disabled={busy || status === 'loading' || status === 'error'}
      aria-pressed={engaged}
      aria-label={label}
      title={label}
      className={`ai-toggle-btn killswitch-btn${engaged ? ' killswitch-btn--engaged' : ''}`}
    >
      {engaged ? <ShieldAlert size={16} /> : <ShieldOff size={16} />}
    </button>
  );
}
