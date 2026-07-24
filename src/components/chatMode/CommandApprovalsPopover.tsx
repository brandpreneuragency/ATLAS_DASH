import { useHermesStore } from '../../stores/hermesStore';
import { formatRelativeTime } from '../../utils/timeFormat';

interface CommandApprovalsPopoverProps {
  onClose?: () => void;
  /** Called after navigating to a session (e.g. close popover). */
  onOpenSession?: (sessionId: string) => void;
}

/**
 * Pending Hermes dangerous-command approvals.
 * Approve → approval.respond { choice: "once" }; Deny → { choice: "deny" }.
 *
 * This is NOT the workflow approvals queue. It is one of two distinct approval
 * domains (DP-1, resolved 2026-07-24 — see `docs/V1_M2_MODULE_MAP.md`):
 * these are ephemeral, WebSocket-delivered command prompts from `useHermesStore`
 * with no database row and no run to resume. Persistent, run-linked workflow gate
 * approvals live in `src/components/today/TodayApprovals.tsx`, backed by the
 * `approvals` table via `/api/approvals` (D-APPROVALS).
 */
export function CommandApprovalsPopover({ onClose, onOpenSession }: CommandApprovalsPopoverProps) {
  const approvals = useHermesStore((s) => s.approvals);
  const respondApproval = useHermesStore((s) => s.respondApproval);
  const openSession = useHermesStore((s) => s.openSession);

  return (
    <div
      id="command-approvals-popover"
      role="dialog"
      aria-label="Command approvals"
      className="drop"
      style={{
        position: 'absolute',
        right: 0,
        top: '100%',
        marginTop: 4,
        width: 320,
        maxHeight: 360,
        overflowY: 'auto',
        zIndex: 40,
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '2px 4px',
        }}
      >
        <span className="med" style={{ fontSize: 'var(--fs-sm)' }}>
          Command approvals
        </span>
        {onClose && (
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close command approvals"
          >
            ×
          </button>
        )}
      </div>

      {approvals.length === 0 && (
        <p className="subtle" style={{ fontSize: 'var(--fs-xs)', padding: '12px 8px', margin: 0 }}>
          No pending command approvals.
        </p>
      )}

      {approvals.map((a) => (
        <div
          key={a.id}
          style={{
            border: '1px solid var(--c-border-1)',
            borderRadius: 8,
            padding: 10,
            background: 'var(--c-background-2)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
            <span
              className="med"
              style={{
                fontSize: 'var(--fs-xs)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: '#b45309',
              }}
            >
              {a.risk}
            </span>
            <span className="subtle" style={{ fontSize: 'var(--fs-xs)', flexShrink: 0 }}>
              {formatRelativeTime(a.requestedAt)}
            </span>
          </div>

          <code
            style={{
              display: 'block',
              fontSize: 'var(--fs-xs)',
              fontFamily: 'var(--c-font-1)',
              background: 'var(--c-background-4)',
              padding: '8px 10px',
              borderRadius: 6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 120,
              overflowY: 'auto',
            }}
          >
            {a.command || '(no command text)'}
          </code>

          {a.sessionId && (
            <button
              type="button"
              className="btn-icon"
              style={{
                alignSelf: 'flex-start',
                fontSize: 'var(--fs-xs)',
                padding: '2px 6px',
                textDecoration: 'underline',
              }}
              onClick={() => {
                void openSession(a.sessionId!);
                onOpenSession?.(a.sessionId!);
              }}
            >
              Open session {a.sessionId.slice(0, 8)}…
            </button>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn-icon"
              style={{
                fontSize: 'var(--fs-xs)',
                padding: '4px 10px',
                border: '1px solid var(--c-border-1)',
                borderRadius: 6,
              }}
              onClick={() => {
                void respondApproval(a.id, false);
              }}
            >
              Deny
            </button>
            <button
              type="button"
              className="btn-icon"
              style={{
                fontSize: 'var(--fs-xs)',
                padding: '4px 10px',
                borderRadius: 6,
                background: 'var(--c-accent-center-panel)',
                color: '#fff',
              }}
              onClick={() => {
                void respondApproval(a.id, true);
              }}
            >
              Approve
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
