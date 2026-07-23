import { useEffect } from 'react';
import { useTodayApprovalsStore, type Approval } from '../../stores/todayApprovalsStore';

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

function kindLabel(kind: Approval['kind']): string {
  return kind === 'hermes_run' ? 'Hermes run approval' : 'Workflow gate';
}

/**
 * Today area approvals inbox (M2 map D-APPROVALS). Full-page presentation
 * of the automation-engine approvals queue — `server/app/routers/approvals.py`
 * — surfaced from the Today area per the ratified module map. This is a
 * different domain from `src/components/chatMode/ApprovalsInbox.tsx` (which
 * is the Hermes *chat session* dangerous-command popover); that component is
 * untouched by this phase.
 */
export function TodayApprovals() {
  const state = useTodayApprovalsStore((s) => s.state);
  const approvals = useTodayApprovalsStore((s) => s.approvals);
  const errorMessage = useTodayApprovalsStore((s) => s.errorMessage);
  const resolvingIds = useTodayApprovalsStore((s) => s.resolvingIds);
  const conflictIds = useTodayApprovalsStore((s) => s.conflictIds);
  const refresh = useTodayApprovalsStore((s) => s.refresh);
  const resolve = useTodayApprovalsStore((s) => s.resolve);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div
      id="today-approvals"
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--fs-lg, 18px)', color: 'var(--c-text-1)' }}>
          Approvals
        </h2>
        {state === 'loading' && (
          <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
            Loading…
          </span>
        )}
      </div>

      {errorMessage && (
        <div
          role="alert"
          style={{
            border: '1px solid #b91c1c',
            borderRadius: 8,
            padding: 10,
            color: '#b91c1c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            fontSize: 'var(--fs-sm)',
          }}
        >
          <span>{errorMessage}</span>
          <button type="button" className="btn-icon" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      )}

      {state === 'ready' && approvals.length === 0 && (
        <p className="subtle" style={{ fontSize: 'var(--fs-sm)', margin: 0 }}>
          No pending approvals.
        </p>
      )}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {approvals.map((approval) => {
          const busy = resolvingIds.includes(approval.id);
          const conflicted = conflictIds.includes(approval.id);
          return (
            <li
              key={approval.id}
              data-testid={`approval-${approval.id}`}
              style={{
                border: '1px solid var(--c-border-1)',
                borderRadius: 8,
                padding: 12,
                background: 'var(--c-background-2)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 'var(--fs-sm)' }}>{approval.message}</span>
                <span className="subtle" style={{ fontSize: 'var(--fs-xs)', flexShrink: 0 }}>
                  {relativeTime(approval.requested_at)}
                </span>
              </div>
              <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
                {kindLabel(approval.kind)}
                {approval.run_id !== null ? ` · run #${approval.run_id}` : ''}
              </span>

              {conflicted && (
                <span style={{ fontSize: 'var(--fs-xs)', color: '#b45309' }}>
                  Just missed it — the run wasn&apos;t ready yet. Try again.
                </span>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-icon"
                  disabled={busy}
                  style={{
                    fontSize: 'var(--fs-xs)',
                    padding: '4px 10px',
                    border: '1px solid var(--c-border-1)',
                    borderRadius: 6,
                  }}
                  onClick={() => void resolve(approval.id, 'rejected')}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  disabled={busy}
                  style={{
                    fontSize: 'var(--fs-xs)',
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: 'var(--c-accent-center-panel)',
                    color: '#fff',
                  }}
                  onClick={() => void resolve(approval.id, 'approved')}
                >
                  Approve
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
