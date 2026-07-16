import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ComposerRoot,
  ComposerCard,
  ComposerRow,
  ComposerTextarea,
  ComposerSendButton,
} from '../ui/Composer';
import { useHermesStore, type HermesChatBubble } from '../../stores/hermesStore';
import { formatRelativeTime } from '../../utils/timeFormat';

function UserBubble({ message }: { message: HermesChatBubble }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
      <div
        className="user-message-bubble"
        style={{
          border: '1px solid var(--layout-border)',
          background: 'var(--right-bg)',
          borderRadius: 0,
          padding: '12px 16px',
          fontSize: 'var(--fs-xs)',
          wordBreak: 'break-word',
          maxWidth: '85%',
        }}
      >
        {message.content}
      </div>
      {message.timestamp != null && (
        <span className="subtle" style={{ fontSize: 'var(--fs-xs)', paddingRight: 4 }}>
          {formatRelativeTime(
            message.timestamp < 1e12 ? message.timestamp * 1000 : message.timestamp,
          )}
        </span>
      )}
    </div>
  );
}

function AssistantBubble({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: '100%' }}>
      <div
        className={isStreaming ? 'streaming-cursor' : undefined}
        style={{ padding: '4px 0', wordBreak: 'break-word', fontSize: 'var(--fs-xs)' }}
      >
        {isStreaming && !content ? (
          <p className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
            …
          </p>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        )}
      </div>
    </div>
  );
}

function SystemBubble({ content }: { content: string }) {
  return (
    <div
      style={{
        padding: '8px 12px',
        borderRadius: 8,
        border: '1px solid var(--c-border-1)',
        background: 'var(--c-background-4)',
        fontSize: 'var(--fs-xs)',
        color: '#e53e3e',
      }}
    >
      {content}
    </div>
  );
}

/**
 * Center pane for CHAT mode — transcript + composer wired to hermesStore.
 */
export function ChatSessionPane() {
  const messages = useHermesStore((s) => s.messages);
  const pending = useHermesStore((s) => s.pending);
  const streaming = useHermesStore((s) => s.streaming);
  const connectionState = useHermesStore((s) => s.connectionState);
  const activeSessionId = useHermesStore((s) => s.activeSessionId);
  const loadingMessages = useHermesStore((s) => s.loadingMessages);
  const sendPrompt = useHermesStore((s) => s.sendPrompt);
  const ensureChatConnection = useHermesStore((s) => s.ensureChatConnection);

  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureChatConnection();
  }, [ensureChatConnection]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, pending, streaming]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || streaming) return;
    setDraft('');
    sendPrompt(text);
  };

  const showConnBanner = connectionState !== 'connected';

  return (
    <div
      id="chat-session-pane"
      className="panel flex-col h-full w-full min-w-0"
      style={{ display: 'flex', minHeight: 0 }}
    >
      {showConnBanner && (
        <div
          role="status"
          style={{
            flexShrink: 0,
            padding: '6px 12px',
            fontSize: 'var(--fs-xs)',
            background: 'var(--c-background-4)',
            borderBottom: '1px solid var(--c-border-1)',
            color: 'var(--c-text-2)',
          }}
        >
          {connectionState === 'connecting'
            ? 'Connecting to Hermes…'
            : 'Hermes offline — check gateway'}
        </div>
      )}

      <div
        ref={listRef}
        className="panel-body ai-scroll flex-1 overflow-y-a"
        style={{
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: '16px 20px',
        }}
      >
        {loadingMessages && (
          <p className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
            Loading messages…
          </p>
        )}

        {!loadingMessages && messages.length === 0 && !pending && (
          <div className="chat-empty-state" style={{ margin: 'auto', textAlign: 'center' }}>
            <p className="chat-empty-state-title" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
              {activeSessionId ? 'No messages in this session' : 'Start a conversation'}
            </p>
            <p className="subtle" style={{ fontSize: 'var(--fs-xs)', marginTop: 6 }}>
              Send a message to Hermes. History appears in the left column.
            </p>
          </div>
        )}

        {messages.map((m) => {
          if (m.role === 'user') return <UserBubble key={m.id} message={m} />;
          if (m.role === 'system') return <SystemBubble key={m.id} content={m.content} />;
          if (m.role === 'assistant') {
            return <AssistantBubble key={m.id} content={m.content} />;
          }
          // tool / other
          return (
            <div key={m.id} className="subtle" style={{ fontSize: 'var(--fs-xs)', fontFamily: 'monospace' }}>
              [{m.role}] {m.content}
            </div>
          );
        })}

        {streaming && (pending.length > 0 || messages[messages.length - 1]?.role === 'user') && (
          <AssistantBubble content={pending} isStreaming />
        )}
      </div>

      <ComposerRoot id="hermes-chat-composer" className="shrink-0">
        <ComposerCard>
          <ComposerRow className="chat-input-text-row">
            <ComposerTextarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Message Hermes…"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              aria-label="Message Hermes"
            />
            <ComposerSendButton
              onClick={handleSend}
              disabled={!draft.trim() || streaming}
              title="Send"
            />
          </ComposerRow>
        </ComposerCard>
      </ComposerRoot>
    </div>
  );
}
