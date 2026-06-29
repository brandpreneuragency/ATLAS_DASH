import { useEffect, useRef, useState } from 'react';
import { Loader2, Paperclip, Plus, Reply, X } from 'lucide-react';
import {
  ComposerCard,
  ComposerIconButton,
  ComposerLeft,
  ComposerRoot,
  ComposerRow,
  ComposerSendButton,
  ComposerTextarea,
} from '../ui/Composer';
import type { TaskComment } from '../../types';
import { useTaskCommentStore } from '../../stores/taskCommentStore';
import { useTaskStore } from '../../stores/taskStore';
import { useThemedPlaceholder } from '../../utils/placeholders';

/** Max height for the comment box, expressed as 50vw in pixels. */
function maxHeightVw(): number {
  return Math.round(window.innerWidth * 0.5);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface TaskCommentInputProps {
  replyToComment?: TaskComment | null;
  onClearReply?: () => void;
}

export function TaskCommentInput({ replyToComment, onClearReply }: TaskCommentInputProps) {
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<{ name: string; size: number; file: File } | null>(null);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const { addComment } = useTaskCommentStore();
  const { activeTaskId, updateTask } = useTaskStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userHeightRef = useRef<number>(0);
  const accentColor = 'var(--c-accent-2)';
  const transmitPlaceholder = useThemedPlaceholder('transmitMessage');

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const max = maxHeightVw();
    const base = Math.max(ta.scrollHeight, userHeightRef.current || 0);
    ta.style.height = `${Math.min(Math.max(base, 44), max)}px`;
  }, [activeTaskId]);

  const handleInput = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const max = maxHeightVw();
    const base = Math.max(ta.scrollHeight, userHeightRef.current || 0);
    ta.style.height = `${Math.min(Math.max(base, 44), max)}px`;
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const ta = textareaRef.current;
    if (!ta) return;
    const startY = e.clientY;
    const startHeight = ta.offsetHeight;
    const max = maxHeightVw();

    const onMove = (ev: MouseEvent) => {
      // Dragging the handle up (negative delta) grows the box upward.
      const next = Math.min(Math.max(startHeight - (ev.clientY - startY), 44), max);
      userHeightRef.current = next;
      ta.style.height = `${next}px`;
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachment({ name: file.name, size: file.size, file });
    e.target.value = '';
  };

  const handleSend = async () => {
    if (!activeTaskId || sending) return;
    const trimmed = text.trim();
    if (!trimmed && !attachment) return;

    const replyData = replyToComment
      ? {
          id: replyToComment.id,
          text: replyToComment.text.slice(0, 200),
          sender: 'You',
        }
      : undefined;

    setSending(true);
    setProgress(0);
    try {
      const result = await addComment(
        activeTaskId,
        {
          text: trimmed,
          sender: 'You',
          replyTo: replyData,
        },
        attachment?.file,
        attachment
          ? {
              onProgress: (loaded, total) => {
                if (total > 0) setProgress(loaded / total);
              },
            }
          : undefined,
      );
      if (result.comment) {
        // Bump the parent task's updatedAt to reflect new activity.
        void updateTask(activeTaskId, {});
        setText('');
        setAttachment(null);
        setProgress(0);
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        onClearReply?.();
      } else {
        // Error toast was already shown by the store; keep the input
        // intact so the user can retry.
        setProgress(0);
      }
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  if (!activeTaskId) return null;

  const sendDisabled = sending || (!text.trim() && !attachment);
  const showProgress = sending && attachment && progress > 0 && progress < 1;

  return (
    <ComposerRoot id="task-comment-input" className="composer-root--clear">
      <ComposerCard id="task-comment-card">
        <div
          className="composer-resize-handle"
          onMouseDown={handleResizeStart}
          title="Drag up to expand"
        />
        {replyToComment && (
          <div style={{ marginBottom: 4, marginLeft: 0, marginRight: 0, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, borderRadius: 6, padding: '4px 8px', fontSize: 'var(--fs-sm)', border: '1px solid var(--c-border-1)' }}>
            <Reply size={11} style={{ color: accentColor, flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 4, flex: 1, overflow: 'hidden' }}>
              <div style={{ width: 2, borderRadius: 1, background: accentColor, flexShrink: 0 }} />
              <div style={{ overflow: 'hidden', minWidth: 0 }}>
                <div className="semibold" style={{ fontSize: 'var(--fs-sm)', color: accentColor, marginBottom: 1 }}>
                  You
                </div>
                <div className="subtle trunc" style={{ fontSize: 'var(--fs-sm)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {replyToComment.text.slice(0, 120)}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClearReply}
              className="btn-icon shrink-0"
              title="Cancel reply"
              style={{ width: 'var(--control-height-sm)', height: 'var(--control-height-sm)', paddingRight: '0px' }}
            >
              <X size={9} />
            </button>
          </div>
        )}

        {attachment && (
          <div className="px-3 pt-3 pb-1">
            <span className="row-xs" style={{ background: 'var(--c-background-4)', borderRadius: 6, padding: '4px 8px', fontSize: 'var(--fs-xs)' }}>
              <Paperclip size={10} />
              {attachment.name} ({formatSize(attachment.size)})
              {!sending && (
                <button onClick={() => setAttachment(null)} style={{ color: 'var(--c-text-2)' }} title="Remove attachment">
                  <X size={10} />
                </button>
              )}
              {sending && showProgress && (
                <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
                  {Math.round(progress * 100)}%
                </span>
              )}
            </span>
          </div>
        )}

        <ComposerTextarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          placeholder={sending ? 'Uploading...' : transmitPlaceholder}
          title="Message input"
          rows={1}
          disabled={sending}
          style={{ height: 'fit-content' }}
        />

        <ComposerRow className="task-comment-bottom-row" style={{ height: 'fit-content' }}>
          <ComposerLeft className="task-comment-bottom-col task-comment-bottom-col--left" style={{ height: 'fit-content' }}>
            <ComposerIconButton
              onClick={() => fileInputRef.current?.click()}
              className="composer-attach-button"
              title="Attach file"
              disabled={sending}
            >
              <Plus size={14} />
            </ComposerIconButton>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
          </ComposerLeft>
          <div className="task-comment-bottom-col task-comment-bottom-col--send">
            {sending ? (
              <button
                type="button"
                className="composer-send-btn"
                title="Sending"
                disabled
                aria-label="Sending"
              >
                <Loader2 size={14} className="spin" />
              </button>
            ) : (
              <ComposerSendButton onClick={handleSend} disabled={sendDisabled} title="Send message" />
            )}
          </div>
        </ComposerRow>
      </ComposerCard>
    </ComposerRoot>
  );
}
