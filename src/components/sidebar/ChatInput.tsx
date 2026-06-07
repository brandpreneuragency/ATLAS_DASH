import { useState, useRef, useCallback, useEffect } from 'react';
import { Reply, Zap, Plus, X, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../stores/uiStore';
import { useChatStore } from '../../stores/chatStore';
import { useAIStore } from '../../stores/aiStore';
import { useStreamingChat } from '../../hooks/useStreamingChat';
import { db } from '../../services/db';
import {
  ComposerAttachments,
  ComposerCard,
  ComposerIconButton,
  ComposerLeft,
  ComposerRoot,
  ComposerRow,
  ComposerSendButton,
  ComposerTextarea,
} from '../ui/Composer';
import type { Attachment, ChatMessage, QuickPrompt } from '../../types';

interface ChatInputProps {
  mode: 'writer' | 'task';
  threadId: string;
  documentId: string | null;
  taskId?: string | null;
  replyToMessage?: ChatMessage | null;
  onClearReply?: () => void;
}

const MAX_HEIGHT = 192; // 8 rows × 24px
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

interface PromptOption extends QuickPrompt {
  builtin?: boolean;
}

const TASK_BUILT_INS: PromptOption[] = [
  {
    id: 'builtin_task_summarize',
    title: 'Summarize Task',
    prompt: 'Summarize this task with status, blockers, and next steps.',
    scope: 'task',
    createdAt: 0,
    builtin: true,
  },
  {
    id: 'builtin_task_subtasks',
    title: 'Create Subtasks',
    prompt: 'Create actionable subtasks from this task context.',
    scope: 'task',
    createdAt: 0,
    builtin: true,
  },
  {
    id: 'builtin_task_next_steps',
    title: 'Next Steps',
    prompt: 'List the next concrete steps in priority order.',
    scope: 'task',
    createdAt: 0,
    builtin: true,
  },
  {
    id: 'builtin_task_update_details',
    title: 'Update Details',
    prompt: 'Propose updates for title, notes, dates, and status based on this context.',
    scope: 'task',
    createdAt: 0,
    builtin: true,
  },
  {
    id: 'builtin_task_split',
    title: 'Split Into Tasks',
    prompt: 'Split this work into smaller tasks and subtasks with clear ownership.',
    scope: 'task',
    createdAt: 0,
    builtin: true,
  },
];

export function ChatInput({ mode, threadId, documentId, taskId, replyToMessage, onClearReply }: ChatInputProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Dropdown states
  const [actionsDropdownOpen, setActionsDropdownOpen] = useState(false);
  const [quickPrompts, setQuickPrompts] = useState<QuickPrompt[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [documentId, taskId]);

  const { selectedText } = useUIStore();
  const { isStreaming } = useChatStore();
  const { getActiveAgent } = useAIStore();
  const { setActiveModal, setActionsManagerScope } = useUIStore();
  const { sendMessage, stopStreaming } = useStreamingChat(threadId, mode, documentId ?? undefined, taskId ?? undefined);

  const activeAgent = getActiveAgent(mode);

  // Outside-click dismissal for dropdowns
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) setActionsDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Load quick prompts when actions dropdown opens
  useEffect(() => {
    if (actionsDropdownOpen) {
      db.quickPrompts
        .where('scope')
        .equals(mode)
        .reverse()
        .sortBy('createdAt')
        .then(setQuickPrompts);
    }
  }, [actionsDropdownOpen, mode]);

  // Handle quick prompt selection from other components
  useEffect(() => {
    const handler = (e: Event) => {
      const prompt = (e as CustomEvent<string>).detail;
      setValue(prompt);
      textareaRef.current?.focus();
    };
    window.addEventListener('quickPromptSelected', handler);
    return () => window.removeEventListener('quickPromptSelected', handler);
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || isStreaming) return;
    const toSend = attachments.slice();
    const replyData = replyToMessage ? {
      id: replyToMessage.id,
      role: replyToMessage.role,
      content: replyToMessage.content.slice(0, 200),
      sender: replyToMessage.role === 'user' ? 'You' : 'Assistant',
    } : undefined;
    setValue('');
    setAttachments([]);
    onClearReply?.();
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    try {
      await sendMessage(
        trimmed,
        selectedText?.text,
        selectedText?.from,
        selectedText?.to,
        toSend.length ? toSend : undefined,
        true,
        replyData
      );
    } catch (err) {
      console.error('Chat error:', err);
    }
  }, [value, attachments, isStreaming, sendMessage, selectedText, replyToMessage, onClearReply]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_HEIGHT)}px`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) continue;
      if (file.size > MAX_FILE_BYTES) continue;
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments((prev) => [
          ...prev,
          { name: file.name, dataUrl: reader.result as string, mimeType: file.type },
        ]);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !isStreaming;
  const promptOptions: PromptOption[] = mode === 'task' ? [...TASK_BUILT_INS, ...quickPrompts] : quickPrompts;

  return (
    <div style={{ background: 'rgba(230, 215, 191, 0)', borderTop: '1px solid var(--layout-border)', borderRadius: 0 }}>
    <ComposerRoot id="chat-input-root" className="shrink-0">
      {selectedText && (
        <div style={{ marginBottom: 8, fontSize: 'var(--fs-xs)', color: 'var(--c-accent-center-panel)', background: 'var(--c-background-4)', borderRadius: 6, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="med">{t('chat.context')}</span>
          <span className="trunc italic subtle">
            {selectedText.text.slice(0, 60)}{selectedText.text.length > 60 ? '...' : ''}
          </span>
        </div>
      )}

      {replyToMessage && (
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--c-background-4)', borderRadius: 8, padding: '6px 10px', fontSize: 'var(--fs-11)', border: '1px solid var(--c-border-1)' }}>
          <Reply size={12} style={{ color: 'var(--c-accent-center-panel)', flexShrink: 0 }} />
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 6, flex: 1, overflow: 'hidden' }}>
            <div style={{ width: 2, borderRadius: 1, background: 'var(--c-accent-center-panel)', flexShrink: 0 }} />
            <div style={{ overflow: 'hidden', minWidth: 0 }}>
              <div className="semibold" style={{ fontSize: 'var(--fs-11)', color: 'var(--c-accent-center-panel)', marginBottom: 1 }}>
                {replyToMessage.role === 'user' ? 'You' : 'Assistant'}
              </div>
              <div className="subtle trunc" style={{ fontSize: 'var(--fs-11)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {replyToMessage.content.slice(0, 120)}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClearReply}
            className="btn-icon shrink-0"
            title="Cancel reply"
            style={{ width: 18, height: 18 }}
          >
            <X size={10} />
          </button>
        </div>
      )}

      <ComposerCard id="chat-input-card">
        {attachments.length > 0 && (
          <ComposerAttachments>
            {attachments.map((att, i) => (
              <div key={i} className="relative" style={{ display: 'inline-block' }}>
                <img
                  src={att.dataUrl}
                  alt={att.name}
                  style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--c-border-1)' }}
                />
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  title={t('chat.removeAttachment')}
                  className="absolute"
                  style={{ top: -6, right: -6, width: 16, height: 16, background: 'var(--c-text-1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0'; }}
                >
                  <X size={9} style={{ color: '#fff' }} />
                </button>
              </div>
            ))}
          </ComposerAttachments>
        )}

        <ComposerRow>
          <ComposerLeft>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              aria-label={t('chat.attachImage')}
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <ComposerIconButton
              onClick={() => fileInputRef.current?.click()}
              className="composer-attach-button"
              title={t('chat.attachImage')}
            >
              <Plus size={14} />
            </ComposerIconButton>

            <div ref={actionsRef} className="relative">
              <ComposerIconButton
                onClick={() => setActionsDropdownOpen((v) => !v)}
                title={t('chat.actions')}
              >
                <Zap size={14} style={{ color: 'var(--c-accent-center-panel)' }} />
              </ComposerIconButton>
              {actionsDropdownOpen && (
                <div className="drop" style={{ left: 0, bottom: '100%', marginBottom: 4, minWidth: 192 }}>
                  {promptOptions.length === 0 ? (
                    <div className="subtle" style={{ padding: '8px 12px', fontSize: 'var(--fs-xs)' }}>{t('chat.noActions')}</div>
                  ) : (
                    promptOptions.map((qp) => (
                      <button
                        type="button"
                        key={qp.id}
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('quickPromptSelected', { detail: qp.prompt }));
                          setActionsDropdownOpen(false);
                        }}
                        className="drop-item"
                      >
                        <Zap size={11} style={{ color: 'var(--c-accent-center-panel)', flexShrink: 0 }} />
                        <span className="trunc med">{qp.title}</span>
                      </button>
                    ))
                  )}
                  <div style={{ borderTop: '1px solid var(--c-border-1)', marginTop: 4, paddingTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setActionsManagerScope(mode);
                        setActiveModal('actionsManager');
                        setActionsDropdownOpen(false);
                      }}
                      className="drop-item drop-item--brand"
                    >
                      {t('chat.manageActions')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </ComposerLeft>

          <ComposerTextarea
            id="chat-input"
            ref={textareaRef}
            value={value}
            onChange={(e) => { setValue(e.target.value); handleInput(); }}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.askPlaceholder', { name: activeAgent.name })}
            rows={1}
          />
          {isStreaming ? (
            <ComposerIconButton
              onClick={stopStreaming}
              className="shrink-0"
              title={t('chat.stop')}
            >
              <Square size={12} fill="currentColor" style={{ color: 'var(--c-text-2)' }} />
            </ComposerIconButton>
          ) : (
            <ComposerSendButton onClick={handleSend} disabled={!canSend} title={t('chat.send')} />
          )}
        </ComposerRow>
      </ComposerCard>
    </ComposerRoot>
    </div>
  );
}
