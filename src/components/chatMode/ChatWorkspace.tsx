import { useEffect } from 'react';
import { ChatSessionPane } from './ChatSessionPane';
import { useHermesStore } from '../../stores/hermesStore';

/**
 * CHAT mode center workspace.
 * Session list lives in App.tsx leftPanel (SessionListColumn) — same slot as Doc Mode file tree.
 */
export function ChatWorkspace() {
  const loadSessions = useHermesStore((s) => s.loadSessions);
  const ensureChatConnection = useHermesStore((s) => s.ensureChatConnection);

  useEffect(() => {
    void loadSessions();
    ensureChatConnection();
  }, [loadSessions, ensureChatConnection]);

  return <ChatSessionPane />;
}
