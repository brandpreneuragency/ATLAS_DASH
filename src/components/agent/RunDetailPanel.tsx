import { useRunsStore, isCancellableStatus } from '../../stores/runsStore';

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--c-border-1)',
  borderRadius: 8,
  padding: 14,
  background: 'var(--c-background-2)',
};

/**
 * Run Detail (Control's `RunDetail.tsx` -> Agent -> Runs, M5d). Status,
 * steps, errors, usage, and cancellation. Approve/reject for
 * `waiting_approval` runs is intentionally NOT duplicated here — D-APPROVALS
 * keeps a single approvals presentation in Today; this panel links the user
 * there instead of offering a second resolve path.
 */
export function RunDetailPanel() {
  const selectedRunId = useRunsStore((s) => s.selectedRunId);
  const run = useRunsStore((s) => s.selectedRun);
  const detailState = useRunsStore((s) => s.detailState);
  const detailError = useRunsStore((s) => s.detailError);
  const cancellingId = useRunsStore((s) => s.cancellingId);
  const errorMessage = useRunsStore((s) => s.errorMessage);
  const cancelRun = useRunsStore((s) => s.cancelRun);

  if (selectedRunId === null) {
    return (
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p className="subtle" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>
          Select a run to see its detail.
        </p>
      </div>
    );
  }

  if (detailState === 'loading' || !run) {
    return (
      <div style={cardStyle}>
        <p className="subtle" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>
          {detailState === 'error' ? detailError : 'Loading…'}
        </p>
      </div>
    );
  }

  const cancellable = isCancellableStatus(run.status);

  return (
    <div data-testid="run-detail" style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 10, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h3 style={{ margin: 0, fontSize: 'var(--fs-sm)', fontWeight: 600 }}>Run #{run.id}</h3>
        <span data-testid="run-detail-status" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600 }}>
          {run.status}
        </span>
        {run.dry_run && <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>dry run</span>}
        <button
          type="button"
          className="btn-icon"
          style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)' }}
          disabled={!cancellable || cancellingId === run.id}
          onClick={() => void cancelRun(run.id)}
        >
          {cancellingId === run.id ? 'Cancelling…' : 'Cancel run'}
        </button>
      </div>

      {run.status === 'waiting_approval' && (
        <p className="subtle" style={{ margin: 0, fontSize: 'var(--fs-xs)' }}>
          Waiting on approval — resolve it from Today.
        </p>
      )}

      {errorMessage && (
        <p role="alert" style={{ margin: 0, fontSize: 'var(--fs-xs)', color: '#b91c1c' }}>
          {errorMessage}
        </p>
      )}

      <p className="subtle" style={{ margin: 0, fontSize: 'var(--fs-xs)' }}>
        {run.trigger_kind} · ${(run.cost_usd ?? 0).toFixed(4)} · {run.tokens_in ?? 0}/{run.tokens_out ?? 0} tokens
      </p>

      {run.error && (
        <p style={{ margin: 0, fontSize: 'var(--fs-xs)', color: '#b91c1c' }}>{run.error}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {run.steps.length === 0 ? (
          <p className="subtle" style={{ margin: 0, fontSize: 'var(--fs-xs)' }}>No steps recorded.</p>
        ) : (
          run.steps.map((step) => (
            <div key={step.id} data-testid={`run-step-${step.id}`} style={{ border: '1px solid var(--c-border-1)', borderRadius: 6, padding: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-xs)' }}>
                <span className="med">{step.node_id}</span>
                <span className="subtle">{step.node_type}</span>
                <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{step.status}</span>
              </div>
              {step.error && (
                <p style={{ margin: '6px 0 0', fontSize: 'var(--fs-xs)', color: '#b91c1c' }}>{step.error}</p>
              )}
              <details style={{ marginTop: 6, fontSize: 'var(--fs-xs)' }}>
                <summary className="subtle" style={{ cursor: 'pointer' }}>Input</summary>
                <pre style={{ overflowX: 'auto', margin: '4px 0 0' }}>{JSON.stringify(step.input, null, 2)}</pre>
              </details>
              <details style={{ marginTop: 4, fontSize: 'var(--fs-xs)' }}>
                <summary className="subtle" style={{ cursor: 'pointer' }}>Output</summary>
                <pre style={{ overflowX: 'auto', margin: '4px 0 0' }}>{JSON.stringify(step.output, null, 2)}</pre>
              </details>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
