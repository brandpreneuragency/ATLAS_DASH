import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown, ListPlus, Loader2, Paperclip, Plus, Reply, X } from 'lucide-react';
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
import { useUIStore } from '../../stores/uiStore';
import { useThemedPlaceholder } from '../../utils/placeholders';
import { parseTaskInput } from '../../services/nlpParser';
import { getTodayIso, getTomorrowIso } from '../../services/taskFormat';
import { TASK_TITLE_MAX_LENGTH } from '../../types';

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
  const [attachments, setAttachments] = useState<{ name: string; size: number; file: File }[]>([]);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState<'comment' | 'subtask'>('comment');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [assignedDate, setAssignedDate] = useState<string | null>(null);
  const { addComment } = useTaskCommentStore();
  const { activeTaskId, updateTask, createSubtask, tasks } = useTaskStore();
  const { setSubtasksOpen } = useUIStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const userHeightRef = useRef<number>(0);
  const accentColor = 'var(--c-accent-2)';
  const transmitPlaceholder = useThemedPlaceholder('transmitMessage');
  const addSubtaskPlaceholder = useThemedPlaceholder('addSubtaskFooter');
  const isSubtaskMode = mode === 'subtask';
  const parsedSubtask = text.trim() ? parseTaskInput(text) : null;
  const effectiveDate = assignedDate ?? null;
  const hasDateValue = !!effectiveDate?.trim();
  const dateButtonLabel = (() => {
    if (!effectiveDate) return 'Due date';
    if (effectiveDate === getTodayIso()) return 'Today';
    if (effectiveDate === getTomorrowIso()) return 'Tomorrow';
    const parsedDate = new Date(effectiveDate);
    if (Number.isNaN(parsedDate.getTime())) return effectiveDate;
    return parsedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  })();

  const handleDatePick = (dateStr: string) => {
    setAssignedDate(dateStr || null);
    setShowDatePicker(false);
    textareaRef.current?.focus();
  };

  const toggleMode = () => {
    setMode((m) => (m === 'comment' ? 'subtask' : 'comment'));
    setAssignedDate(null);
    setShowDatePicker(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleSubtaskChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newParsed = newValue.trim() ? parseTaskInput(newValue) : null;
    let cleaned = newValue;
    if (newParsed?.date && !assignedDate) {
      setAssignedDate(newParsed.date);
      if (newParsed.date === getTodayIso() && /\btoday\b/i.test(cleaned)) {
        cleaned = cleaned.replace(/\btoday\b/i, '');
      } else if (newParsed.date === getTomorrowIso() && /\btomorrow\b/i.test(cleaned)) {
        cleaned = cleaned.replace(/\btomorrow\b/i, '');
      } else if (/\d{4}-\d{2}-\d{2}/.test(cleaned)) {
        cleaned = cleaned.replace(/\d{4}-\d{2}-\d{2}/, '');
      }
    }
    setText(cleaned.replace(/\s+/g, ' ').trim());
  };

  const handleSubtaskSend = async () => {
    const title = parsedSubtask?.title?.trim();
    if (!title || !activeTaskId) return;
    const parentTask = tasks.find((t) => t.id === activeTaskId) ?? null;
    const subtask = await createSubtask(activeTaskId, title, undefined, effectiveDate ?? parentTask?.date);
    if (!subtask) return;
    setSubtasksOpen(true);
    setText('');
    setAssignedDate(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  useEffect(() => {
    if (!showDatePicker) return;
    const handleClick = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDatePicker]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const max = maxHeightVw();
    const base = Math.max(ta.scrollHeight, userHeightRef.current || 0);
    ta.style.height = `${Math.min(Math.max(base, 42), max)}px`;
  }, [activeTaskId]);

  const handleInput = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const max = maxHeightVw();
    const base = Math.max(ta.scrollHeight, userHeightRef.current || 0);
    ta.style.height = `${Math.min(Math.max(base, 42), max)}px`;
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
      const next = Math.min(Math.max(startHeight - (ev.clientY - startY), 42), max);
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
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setAttachments((prev) => [
      ...prev,
      ...files.map((file) => ({ name: file.name, size: file.size, file })),
    ]);
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!activeTaskId || sending) return;
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;

    const replyData = replyToComment
      ? {
          id: replyToComment.id,
          text: replyToComment.text.slice(0, 200),
          sender: 'You',
        }
      : undefined;

    setSending(true);
    setProgress(0);

    const totalItems = (trimmed ? 1 : 0) + attachments.length;
    let completedItems = 0;
    const baseTime = Date.now();
    let failedAttachments: typeof attachments = [];
    let sentAny = false;

    try {
      if (trimmed) {
        const textResult = await addComment(
          activeTaskId,
          {
            text: trimmed,
            sender: 'You',
            replyTo: replyData,
            createdAt: baseTime,
          },
          undefined,
          {
            onProgress: (loaded, total) => {
              if (total > 0) {
                setProgress((completedItems + loaded / total) / totalItems);
              }
            },
          },
        );
        if (!textResult.comment) {
          failedAttachments = attachments;
          return;
        }
        sentAny = true;
        completedItems += 1;
      }

      for (let i = 0; i < attachments.length; i++) {
        const result = await addComment(
          activeTaskId,
          {
            text: '',
            sender: 'You',
            replyTo: replyData,
            createdAt: baseTime + completedItems,
          },
          attachments[i].file,
          {
            onProgress: (loaded, total) => {
              if (total > 0) {
                setProgress((completedItems + loaded / total) / totalItems);
              }
            },
          },
        );
        if (!result.comment) {
          failedAttachments = attachments.slice(i);
          return;
        }
        sentAny = true;
        completedItems += 1;
      }

      failedAttachments = [];
      if (sentAny) {
        // Bump the parent task's updatedAt to reflect new activity.
        void updateTask(activeTaskId, {});
      }
    } finally {
      setSending(false);
      setProgress(0);
      // Clear only the parts that were successfully sent; keep any failed
      // attachments (and the text if nothing was sent) so the user can retry.
      if (sentAny) {
        setText('');
        setAttachments(failedAttachments);
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        if (failedAttachments.length === 0) {
          onClearReply?.();
        }
        requestAnimationFrame(() => textareaRef.current?.focus());
      } else {
        setAttachments(failedAttachments);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isSubtaskMode) {
        void handleSubtaskSend();
      } else {
        void handleSend();
      }
    }
  };

  if (!activeTaskId) return null;

  const sendDisabled = isSubtaskMode
    ? !parsedSubtask?.title
    : sending || (!text.trim() && attachments.length === 0);
  const showProgress = sending && attachments.length > 0 && progress > 0 && progress < 1;

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

        {attachments.length > 0 && (
          <div className="px-3 pt-3 pb-1 comment-attachment-list">
            {attachments.map((att, index) => (
              <span
                key={`${att.name}-${index}`}
                className="row-xs comment-attachment-chip"
              >
                <Paperclip size={10} />
                {att.name} ({formatSize(att.size)})
                {!sending && (
                  <button onClick={() => removeAttachment(index)} title="Remove attachment">
                    <X size={10} />
                  </button>
                )}
              </span>
            ))}
            {showProgress && (
              <span className="subtle comment-attachment-progress">
                {Math.round(progress * 100)}%
              </span>
            )}
          </div>
        )}

        <ComposerTextarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            if (isSubtaskMode) {
              handleSubtaskChange(e);
            } else {
              setText(e.target.value);
              handleInput();
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={isSubtaskMode ? addSubtaskPlaceholder : sending ? 'Uploading...' : transmitPlaceholder}
          title={isSubtaskMode ? 'Add subtask' : 'Message input'}
          rows={1}
          disabled={sending}
          maxLength={isSubtaskMode ? TASK_TITLE_MAX_LENGTH : undefined}
          style={{ height: 'fit-content' }}
        />

        <ComposerRow className="task-comment-bottom-row" style={{ height: 'fit-content' }}>
          <ComposerLeft className="task-comment-bottom-col task-comment-bottom-col--left" style={{ height: 'fit-content' }}>
            <ComposerIconButton
              onClick={toggleMode}
              className="composer-mode-toggle"
              title={isSubtaskMode ? 'Switch to comment' : 'Add subtask'}
              aria-pressed={isSubtaskMode}
              data-active={isSubtaskMode ? 'true' : 'false'}
            >
              <ListPlus size={14} />
            </ComposerIconButton>
            {!isSubtaskMode && (
              <ComposerIconButton
                onClick={() => fileInputRef.current?.click()}
                className="composer-attach-button"
                title="Attach file"
                disabled={sending}
              >
                <Plus size={14} />
              </ComposerIconButton>
            )}
            {isSubtaskMode && (
              <div className="task-quick-create-actions" ref={datePickerRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="btn-icon task-quick-create-dropup-btn"
                  data-kind="date"
                  data-active={hasDateValue ? 'true' : 'false'}
                  title={hasDateValue ? `Due: ${dateButtonLabel}` : 'Set due date'}
                  aria-label={hasDateValue ? `Due: ${dateButtonLabel}` : 'Set due date'}
                  aria-haspopup="menu"
                  aria-expanded={showDatePicker ? 'true' : 'false'}
                >
                  <Calendar size={12} className="task-quick-create-dropup-icon" />
                  <span className="trunc med task-quick-create-dropup-label">{dateButtonLabel}</span>
                  <ChevronDown size={12} className="task-quick-create-dropup-chevron" />
                </button>
                {showDatePicker && (
                  <div
                    id="stqc-date-dropdown"
                    className="drop"
                    onMouseDown={(event) => event.stopPropagation()}
                    style={{ left: 0, bottom: '100%', minWidth: 140, marginBottom: 2 }}
                  >
                    <button type="button" className="drop-item" onClick={() => handleDatePick('')} style={{ fontSize: 'var(--fs-base)' }}>
                      No date
                    </button>
                    {['Today', 'Tomorrow', 'Next week', 'Next month'].map((label) => (
                      <button
                        key={label}
                        type="button"
                        className="drop-item"
                        onClick={() => {
                          const d = new Date();
                          if (label === 'Tomorrow') d.setDate(d.getDate() + 1);
                          else if (label === 'Next week') d.setDate(d.getDate() + 7);
                          else if (label === 'Next month') d.setMonth(d.getMonth() + 1);
                          handleDatePick(d.toISOString().slice(0, 10));
                        }}
                        style={{ fontSize: 'var(--fs-base)' }}
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="drop-item"
                      onClick={() => {
                        if (dateInputRef.current?.showPicker) {
                          dateInputRef.current.showPicker();
                        } else {
                          dateInputRef.current?.click();
                        }
                        setShowDatePicker(false);
                      }}
                      style={{ fontSize: 'var(--fs-base)' }}
                    >
                      Custom...
                    </button>
                  </div>
                )}
                <input
                  ref={dateInputRef}
                  type="date"
                  aria-label="Custom due date"
                  onChange={(e) => { handleDatePick(e.target.value); setShowDatePicker(false); }}
                  style={{ position: 'absolute', left: 0, bottom: 0, width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
                />
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              title="Attach files"
              className="comment-file-input"
              onChange={handleFileSelect}
            />
          </ComposerLeft>
          <div className="task-comment-bottom-col task-comment-bottom-col--send">
            {isSubtaskMode ? (
              <ComposerSendButton onClick={handleSubtaskSend} disabled={sendDisabled} title="Add subtask" />
            ) : sending ? (
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
