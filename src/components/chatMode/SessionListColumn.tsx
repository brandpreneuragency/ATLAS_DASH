import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useHermesStore } from '../../stores/hermesStore';
import { formatRelativeTime } from '../../utils/timeFormat';

/** Hermes session timestamps may be seconds or ms. */
function toMs(ts: number): number {
  return ts > 0 && ts < 1e12 ? ts * 1000 : ts;
}

function sessionTitle(title: string | null, preview: string | null, id: string): string {
  if (title?.trim()) return title.trim();
  if (preview?.trim()) {
    const p = preview.trim();
    return p.length > 48 ? `${p.slice(0, 48)}…` : p;
  }
  return id.slice(0, 8);
}

/**
 * Left contextual column for CHAT mode — Hermes session history.
 * Styled similarly to the task list panel (panel + scroll + item rows).
 */
export function SessionListColumn() {
  const sessions = useHermesStore((s) => s.sessions);
  const activeSessionId = useHermesStore((s) => s.activeSessionId);
  const loadingSessions = useHermesStore((s) => s.loadingSessions);
  const error = useHermesStore((s) => s.error);
  const loadSessions = useHermesStore((s) => s.loadSessions);
  const openSession = useHermesStore((s) => s.openSession);
  const newSession = useHermesStore((s) => s.newSession);
  const renameSession = useHermesStore((s) => s.renameSession);
  const deleteSession = useHermesStore((s) => s.deleteSession);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const startRename = (id: string, current: string) => {
    setRenamingId(id);
    setRenameValue(current);
  };

  const commitRename = async () => {
    if (!renamingId) return;
    const title = renameValue.trim();
    setRenamingId(null);
    if (!title) return;
    await renameSession(renamingId, title);
  };

  return (
    <div
      id="hermes-session-list"
      className="panel flex-col h-full overflow-hidden"
      style={{ marginLeft: 0, marginRight: 0 }}
    >
      <div
        className="panel-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '10px 12px',
        }}
      >
        <span className="med" style={{ fontSize: 'var(--fs-sm)' }}>
          Sessions
        </span>
        <button
          type="button"
          className="btn-icon"
          title="New session"
          aria-label="New session"
          onClick={() => newSession()}
        >
          <Plus size={14} />
        </button>
      </div>

      <div
        className="panel-body ai-scroll flex-1 overflow-y-a"
        style={{
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: '4px 8px 12px',
        }}
      >
        {loadingSessions && (
          <p className="subtle" style={{ fontSize: 'var(--fs-xs)', padding: '8px 4px' }}>
            Loading sessions…
          </p>
        )}

        {!loadingSessions && error && (
          <p style={{ fontSize: 'var(--fs-xs)', color: '#EF4444', padding: '8px 4px', lineHeight: 1.4 }}>
            {error}
          </p>
        )}

        {!loadingSessions && !error && sessions.length === 0 && (
          <div className="flex-col items-center justify-center py-12 text-center" style={{ padding: 12 }}>
            <p className="txt-xs subtle">No sessions yet</p>
            <p className="label mt-1" style={{ fontSize: 'var(--fs-xs)' }}>
              Start a new chat to talk to Hermes
            </p>
          </div>
        )}

        {sessions.map((sess) => {
          const title = sessionTitle(sess.title, sess.preview, sess.id);
          const isActive = sess.id === activeSessionId;
          const when = formatRelativeTime(toMs(sess.last_active || sess.started_at));

          return (
            <div
              key={sess.id}
              className={`drop-item${isActive ? ' is-active' : ''}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 2,
                padding: '8px 10px',
                borderRadius: 8,
                cursor: 'pointer',
                background: isActive ? 'var(--c-background-3)' : 'transparent',
                border: isActive ? '1px solid var(--c-border-1)' : '1px solid transparent',
                position: 'relative',
              }}
              onClick={() => {
                if (renamingId === sess.id) return;
                void openSession(sess.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void openSession(sess.id);
                }
              }}
              role="button"
              tabIndex={0}
              aria-current={isActive ? 'true' : undefined}
            >
              {renamingId === sess.id ? (
                <input
                  className="ctrl-xs"
                  value={renameValue}
                  autoFocus
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => {
                    void commitRename();
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') void commitRename();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Rename session"
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span className="trunc med" style={{ flex: 1, fontSize: 'var(--fs-xs)' }}>
                    {title}
                  </span>
                  <button
                    type="button"
                    className="btn-icon"
                    title="Rename"
                    aria-label="Rename session"
                    onClick={(e) => {
                      e.stopPropagation();
                      startRename(sess.id, title);
                    }}
                    style={{ opacity: 0.7 }}
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    title="Delete"
                    aria-label="Delete session"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(sess.id);
                    }}
                    style={{ opacity: 0.7 }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              )}
              <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
                {when}
                {sess.message_count > 0 ? ` · ${sess.message_count} msgs` : ''}
              </span>

              {confirmDeleteId === sess.id && (
                <div
                  style={{
                    marginTop: 6,
                    display: 'flex',
                    gap: 6,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
                    Delete?
                  </span>
                  <button
                    type="button"
                    className="btn-icon"
                    style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px' }}
                    onClick={() => {
                      void deleteSession(sess.id);
                      setConfirmDeleteId(null);
                    }}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px' }}
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    No
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
