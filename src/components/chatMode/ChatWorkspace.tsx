import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { ChatSessionPane } from './ChatSessionPane';
import { ApprovalsInbox } from './ApprovalsInbox';
import { useHermesStore } from '../../stores/hermesStore';

/**
 * CHAT mode center workspace.
 * Session list lives in App.tsx leftPanel (SessionListColumn) — same slot as Doc Mode file tree.
 * Header hosts the approvals inbox bell (pending count badge).
 */
export function ChatWorkspace() {
  const loadSessions = useHermesStore((s) => s.loadSessions);
  const ensureChatConnection = useHermesStore((s) => s.ensureChatConnection);
  const ensureEventsSubscription = useHermesStore((s) => s.ensureEventsSubscription);
  const approvals = useHermesStore((s) => s.approvals);

  const [inboxOpen, setInboxOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadSessions();
    ensureChatConnection();
    // Events WS stays up for the rest of the app session so the badge stays live.
    ensureEventsSubscription();
  }, [loadSessions, ensureChatConnection, ensureEventsSubscription]);

  useEffect(() => {
    if (!inboxOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setInboxOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [inboxOpen]);

  const count = approvals.length;

  return (
    <div
      id="chat-workspace"
      className="panel flex-col h-full w-full min-w-0"
      style={{ display: 'flex', minHeight: 0 }}
    >
      <div
        className="panel-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
          padding: '6px 12px',
          flexShrink: 0,
          borderBottom: '1px solid var(--c-border-1)',
          position: 'relative',
        }}
      >
        <div ref={bellRef} style={{ position: 'relative' }}>
          <button
            type="button"
            id="approvals-bell"
            className="btn-icon"
            title={count > 0 ? `${count} pending approval${count === 1 ? '' : 's'}` : 'Approvals'}
            aria-label={count > 0 ? `Approvals, ${count} pending` : 'Approvals'}
            aria-expanded={inboxOpen}
            aria-haspopup="dialog"
            onClick={() => setInboxOpen((v) => !v)}
            style={{ position: 'relative', padding: 6 }}
          >
            <Bell size={16} />
            {count > 0 && (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  minWidth: 14,
                  height: 14,
                  padding: '0 3px',
                  borderRadius: 7,
                  background: '#dc2626',
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 700,
                  lineHeight: '14px',
                  textAlign: 'center',
                }}
              >
                {count > 9 ? '9+' : count}
              </span>
            )}
          </button>
          {inboxOpen && (
            <ApprovalsInbox
              onClose={() => setInboxOpen(false)}
              onOpenSession={() => setInboxOpen(false)}
            />
          )}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <ChatSessionPane />
      </div>
    </div>
  );
}
