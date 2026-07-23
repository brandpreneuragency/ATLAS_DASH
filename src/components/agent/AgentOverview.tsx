import { useEffect } from 'react';
import {
  useAgentOverviewStore,
  RUN_STATUSES,
  type RunStatus,
} from '../../stores/agentOverviewStore';

const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  waiting_approval: 'Waiting approval',
  succeeded: 'Succeeded',
  failed: 'Failed',
  cancelled: 'Cancelled',
  budget_exceeded: 'Budget exceeded',
};

function relativeTime(ts: string): string {
  const then = new Date(ts).getTime();
  if (Number.isNaN(then)) return ts;
  const diff = Math.max(0, Date.now() - then);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--c-border-1)',
  borderRadius: 8,
  padding: 14,
  background: 'var(--c-background-2)',
};

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 10px',
  fontSize: 'var(--fs-sm)',
  fontWeight: 600,
  color: 'var(--c-text-1)',
};

/**
 * Agent Overview (Control's `MissionControl.tsx` -> Agent area, M5c).
 * Agent health, system health, event activity, run counts. The kill switch
 * already lives in the persistent header (M5b) and is intentionally NOT
 * duplicated here.
 */
export function AgentOverview() {
  const state = useAgentOverviewStore((s) => s.state);
  const health = useAgentOverviewStore((s) => s.health);
  const agents = useAgentOverviewStore((s) => s.agents);
  const events = useAgentOverviewStore((s) => s.events);
  const runCounts = useAgentOverviewStore((s) => s.runCounts);
  const errorMessage = useAgentOverviewStore((s) => s.errorMessage);
  const refresh = useAgentOverviewStore((s) => s.refresh);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div
      id="agent-overview"
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--fs-lg, 18px)', color: 'var(--c-text-1)' }}>
          Agent Overview
        </h2>
        {state === 'loading' && (
          <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
            Loading…
          </span>
        )}
      </div>

      {state === 'error' && (
        <div
          role="alert"
          style={{
            ...cardStyle,
            borderColor: '#b91c1c',
            color: '#b91c1c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 'var(--fs-sm)' }}>{errorMessage ?? 'Failed to load agent overview.'}</span>
          <button type="button" className="btn-icon" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div style={cardStyle} aria-label="System health">
          <h3 style={sectionTitleStyle}>System health</h3>
          {health ? (
            <dl style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: 0, fontSize: 'var(--fs-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <dt className="subtle">Backend</dt>
                <dd style={{ margin: 0 }}>{health.status}</dd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <dt className="subtle">Database</dt>
                <dd style={{ margin: 0 }}>{health.db}</dd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <dt className="subtle">Hermes runs API</dt>
                <dd style={{ margin: 0 }}>{health.hermes.runs_api}</dd>
              </div>
            </dl>
          ) : (
            <p className="subtle" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>
              {state === 'loading' ? 'Loading…' : 'Unavailable.'}
            </p>
          )}
        </div>

        <div style={cardStyle} aria-label="Run counts">
          <h3 style={sectionTitleStyle}>Run counts</h3>
          <dl style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: 0, fontSize: 'var(--fs-sm)' }}>
            {RUN_STATUSES.map((statusKey) => (
              <div key={statusKey} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <dt className="subtle">{RUN_STATUS_LABEL[statusKey]}</dt>
                <dd style={{ margin: 0 }} data-testid={`run-count-${statusKey}`}>
                  {runCounts[statusKey]}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div style={cardStyle} aria-label="Agent health">
        <h3 style={sectionTitleStyle}>Agent health</h3>
        {agents.length === 0 ? (
          <p className="subtle" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>
            {state === 'loading' ? 'Loading…' : 'No agents configured.'}
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {agents.map((agent) => (
              <li
                key={agent.id}
                data-testid={`agent-card-${agent.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  fontSize: 'var(--fs-sm)',
                  padding: '6px 0',
                  borderBottom: '1px solid var(--c-border-1)',
                }}
              >
                <span>{agent.name}</span>
                <span className="subtle">{agent.model ?? '—'}</span>
                <span className="subtle">{agent.active_runs} active</span>
                <span
                  style={{
                    color: agent.status === 'ok' ? '#15803d' : '#b91c1c',
                    fontWeight: 600,
                  }}
                >
                  {agent.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={cardStyle} aria-label="Event activity">
        <h3 style={sectionTitleStyle}>Event activity</h3>
        {events.length === 0 ? (
          <p className="subtle" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>
            {state === 'loading' ? 'Loading…' : 'No recent events.'}
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {events.slice(0, 10).map((event) => (
              <li
                key={event.id}
                data-testid={`event-row-${event.id}`}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 'var(--fs-xs)' }}
              >
                <span>
                  <span className="med">{event.kind}</span>{' '}
                  <span className="subtle">({event.source})</span>
                </span>
                <span className="subtle">{relativeTime(event.ts)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
