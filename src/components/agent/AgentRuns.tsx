import { useEffect } from 'react';
import { useRunsStore } from '../../stores/runsStore';
import { RUN_STATUSES, type RunStatus } from '../../stores/agentOverviewStore';
import { RunDetailPanel } from './RunDetailPanel';

const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  waiting_approval: 'Waiting approval',
  succeeded: 'Succeeded',
  failed: 'Failed',
  cancelled: 'Cancelled',
  budget_exceeded: 'Budget exceeded',
};

/**
 * Agent -> Runs (Control's `Automation.tsx` runs list + `RunDetail.tsx`,
 * M5d). Recent-run access with status/workflow filtering and a master-
 * detail layout; selecting a row loads full step detail and cancellation.
 */
export function AgentRuns() {
  const state = useRunsStore((s) => s.state);
  const runs = useRunsStore((s) => s.runs);
  const errorMessage = useRunsStore((s) => s.errorMessage);
  const statusFilter = useRunsStore((s) => s.statusFilter);
  const workflowFilter = useRunsStore((s) => s.workflowFilter);
  const selectedRunId = useRunsStore((s) => s.selectedRunId);
  const refresh = useRunsStore((s) => s.refresh);
  const setStatusFilter = useRunsStore((s) => s.setStatusFilter);
  const setWorkflowFilter = useRunsStore((s) => s.setWorkflowFilter);
  const selectRun = useRunsStore((s) => s.selectRun);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div id="agent-runs" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <h2 style={{ margin: 0, fontSize: 'var(--fs-lg, 18px)', color: 'var(--c-text-1)' }}>Runs</h2>

        <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', alignItems: 'center', gap: 4 }}>
          Status
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => void setStatusFilter(e.target.value as RunStatus | 'all')}
          >
            <option value="all">All</option>
            {RUN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {RUN_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', alignItems: 'center', gap: 4 }}>
          Workflow ID
          <input
            aria-label="Filter by workflow id"
            type="number"
            style={{ width: 70 }}
            value={workflowFilter ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              void setWorkflowFilter(v === '' ? null : Number(v));
            }}
          />
        </label>

        {state === 'loading' && (
          <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
            Loading…
          </span>
        )}
      </div>

      {state === 'error' && (
        <div role="alert" style={{ fontSize: 'var(--fs-sm)', color: '#b91c1c', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span>{errorMessage ?? 'Failed to load runs.'}</span>
          <button type="button" className="btn-icon" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12 }}>
        <div style={{ flex: '1 1 55%', minWidth: 0, overflowY: 'auto', border: '1px solid var(--c-border-1)', borderRadius: 8 }}>
          {runs.length === 0 ? (
            <p className="subtle" style={{ margin: 0, padding: 14, fontSize: 'var(--fs-sm)' }}>
              {state === 'loading' ? 'Loading…' : 'No runs match this filter.'}
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--c-border-1)' }}>
                  <th style={{ padding: '6px 10px' }}>Run</th>
                  <th style={{ padding: '6px 10px' }}>Workflow</th>
                  <th style={{ padding: '6px 10px' }}>Status</th>
                  <th style={{ padding: '6px 10px' }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    data-testid={`run-row-${run.id}`}
                    onClick={() => void selectRun(run.id)}
                    style={{
                      cursor: 'pointer',
                      background: selectedRunId === run.id ? 'var(--c-background-4)' : undefined,
                      borderBottom: '1px solid var(--c-border-1)',
                    }}
                  >
                    <td style={{ padding: '6px 10px' }}>#{run.id}</td>
                    <td style={{ padding: '6px 10px' }} className="subtle">
                      {run.workflow_id}
                    </td>
                    <td style={{ padding: '6px 10px' }} data-testid={`run-row-status-${run.id}`}>
                      {run.status}
                    </td>
                    <td style={{ padding: '6px 10px' }} className="subtle">
                      ${(run.cost_usd ?? 0).toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ flex: '1 1 45%', minWidth: 0 }}>
          <RunDetailPanel />
        </div>
      </div>
    </div>
  );
}
