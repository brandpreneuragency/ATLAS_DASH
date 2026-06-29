import { useState, useRef, useCallback, useEffect } from 'react';
import { Reply, Zap, Plus, X, Square, ChevronDown, Brain, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../stores/uiStore';
import { useChatStore } from '../../stores/chatStore';
import { useAIStore } from '../../stores/aiStore';
import { useStreamingChat } from '../../hooks/useStreamingChat';
import { db } from '../../services/db';
import { useThemedPlaceholder } from '../../utils/placeholders';
import {
  ComposerAttachments,
  ComposerCard,
  ComposerIconButton,
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

/** Max height for the chat input box, expressed as 50vw in pixels. */
function maxHeightVw(): number {
  return Math.round(window.innerWidth * 0.5);
}
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
  const accentColor = 'var(--c-accent-2)';
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const queryAIPlaceholder = useThemedPlaceholder('queryAI');

  // Dropdown states
  const [actionsDropdownOpen, setActionsDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const [quickPrompts, setQuickPrompts] = useState<QuickPrompt[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const agentRef = useRef<HTMLDivElement>(null);
  const userHeightRef = useRef<number>(0);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [documentId, taskId]);

  const { selectedText } = useUIStore();
  const { isStreaming } = useChatStore();
  const {
    getActiveAgent,
    getAgentsByScope,
    activeAgentId,
    activeTaskAgentId,
    setActiveAgent,
    providerConfigs,
    activeProviderId,
    setActiveProvider,
    setActiveModel,
    isModelHidden,
  } = useAIStore();
  const { setActiveModal, setActionsManagerScope } = useUIStore();
  const { sendMessage, stopStreaming } = useStreamingChat(threadId, mode, documentId ?? undefined, taskId ?? undefined);

  const activeAgent = getActiveAgent(mode);
  const scopedAgents = getAgentsByScope(mode);
  const activeScopedId = mode === 'task' ? activeTaskAgentId : activeAgentId;
  const activeConfig = providerConfigs.find((config) => config.id === activeProviderId);
  const activeModelName = activeConfig?.models?.find((m) => m.id === activeConfig.selectedModel)?.name;
  const modelLabel = activeConfig ? (activeModelName || activeConfig.selectedModel || t('sidebar.noModel')) : t('sidebar.noModel');
  const actionsLabel = t('chat.actions');

  // Outside-click dismissal for dropdowns
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) setActionsDropdownOpen(false);
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setModelDropdownOpen(false);
      if (agentRef.current && !agentRef.current.contains(e.target as Node)) setAgentDropdownOpen(false);
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
    const max = maxHeightVw();
    const base = Math.max(ta.scrollHeight, userHeightRef.current || 0);
    ta.style.height = `${Math.min(Math.max(base, 32), max)}px`;
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
      const next = Math.min(Math.max(startHeight - (ev.clientY - startY), 32), max);
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
    <div style={{ flexShrink: 0, paddingTop: '0px', paddingBottom: '12px', paddingLeft: '12px', paddingRight: '12px', height: 'fit-content' }}>
      {selectedText && (
        <div style={{ marginBottom: 8, fontSize: 'var(--fs-xs)', color: accentColor, background: 'var(--c-background-4)', borderRadius: 6, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="med">{t('chat.context')}</span>
          <span className="trunc italic subtle">
            {selectedText.text.slice(0, 60)}{selectedText.text.length > 60 ? '...' : ''}
          </span>
        </div>
      )}

      {replyToMessage && (
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--c-background-4)', borderRadius: 8, padding: '6px 10px', fontSize: 'var(--fs-sm)', border: '1px solid var(--c-border-1)' }}>
          <Reply size={12} style={{ color: accentColor, flexShrink: 0 }} />
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 6, flex: 1, overflow: 'hidden' }}>
            <div style={{ width: 2, borderRadius: 1, background: accentColor, flexShrink: 0 }} />
            <div style={{ overflow: 'hidden', minWidth: 0 }}>
              <div className="semibold" style={{ fontSize: 'var(--fs-sm)', color: accentColor, marginBottom: 1 }}>
                {replyToMessage.role === 'user' ? 'You' : 'Assistant'}
              </div>
              <div className="subtle trunc" style={{ fontSize: 'var(--fs-sm)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {replyToMessage.content.slice(0, 120)}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClearReply}
            className="btn-icon shrink-0"
            title="Cancel reply"
            style={{ width: 'var(--control-height-sm)', height: 'var(--control-height-sm)' }}
          >
            <X size={10} />
          </button>
        </div>
      )}

      <ComposerCard id="chat-input-card">
        <div
          className="composer-resize-handle"
          onMouseDown={handleResizeStart}
          title="Drag up to expand"
        />
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

        <ComposerTextarea
          id="chat-input"
          ref={textareaRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); handleInput(); }}
          onKeyDown={handleKeyDown}
          placeholder={queryAIPlaceholder || t('chat.askPlaceholder', { name: activeAgent.name })}
          rows={1}
          style={{ height: '44px', paddingTop: '12px', paddingBottom: '12px' }}
        />

        <ComposerRow className="chat-input-bottom-row">
          <div className="chat-input-bottom-col chat-input-bottom-col--left">
            <div className="chat-input-bottom-col chat-input-bottom-col--tools">
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
                  className="chat-input-dropup-btn"
                  title={t('chat.actions')}
                  aria-label={actionsLabel}
                  aria-haspopup="menu"
                  aria-expanded={actionsDropdownOpen}
                >
                  <Zap size={14} className="chat-input-dropup-icon" />

                  <ChevronDown size={12} className="chat-input-dropup-chevron" />
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
                          <Zap size={11} style={{ color: accentColor, flexShrink: 0 }} />
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
            </div>

            <div ref={modelRef} className="chat-input-bottom-col chat-input-bottom-col--model">
              <button
                type="button"
                onClick={() => { setModelDropdownOpen((v) => !v); setAgentDropdownOpen(false); }}
                className="chat-input-dropup-btn"
                data-active="true"
                style={{ color: accentColor }}
                aria-label={modelLabel}
                aria-haspopup="menu"
                aria-expanded={modelDropdownOpen}
              >
                <Brain size={12} className="chat-input-dropup-icon" />
                <span className="trunc med chat-input-dropup-label">{modelLabel}</span>
                <ChevronDown size={12} className="chat-input-dropup-chevron" />
              </button>
              {modelDropdownOpen && (
                <div className="drop" style={{ left: 0, bottom: '100%', marginBottom: 4, minWidth: 180 }}>
                  {providerConfigs.length === 0 && (
                    <div className="subtle" style={{ padding: '8px 12px', fontSize: 'var(--fs-xs)' }}>{t('sidebar.noProviders')}</div>
                  )}
                  {providerConfigs.filter((config) => config.status === 'connected').flatMap((config) => {
                    const visibleModels = (config.models ?? []).filter((m) => !isModelHidden(config.id, m.id));
                    return visibleModels.map((model) => (
                      <button
                        type="button"
                        key={`${config.id}:${model.id}`}
                        onClick={() => { setActiveProvider(config.id); setActiveModel(config.id, model.id); setModelDropdownOpen(false); }}
                        className={`drop-item${config.id === activeProviderId && config.selectedModel === model.id ? ' header-dropdown-item--active' : ''}`}
                        style={{ fontSize: 'var(--fs-xs)' }}
                      >
                        <span className="med">{config.name} / {model.name}</span>
                      </button>
                    ));
                  })}
                  <div style={{ borderTop: '1px solid var(--c-border-1)', marginTop: 4, paddingTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => { setActiveModal('modelManagement'); setModelDropdownOpen(false); }}
                      className="drop-item drop-item--brand"
                    >
                      {t('sidebar.manageModels')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div ref={agentRef} className="chat-input-bottom-col chat-input-bottom-col--agent">
              <button
                type="button"
                onClick={() => { setAgentDropdownOpen((v) => !v); setModelDropdownOpen(false); }}
                className="chat-input-dropup-btn"
                data-active="true"
                style={{ color: accentColor }}
                aria-label={activeAgent.name}
                aria-haspopup="menu"
                aria-expanded={agentDropdownOpen}
              >
                <User size={12} className="chat-input-dropup-icon" />
                <span className="trunc med chat-input-dropup-label">{activeAgent.name}</span>
                <ChevronDown size={12} className="chat-input-dropup-chevron" />
              </button>
              {agentDropdownOpen && (
                <div className="drop" style={{ right: 0, bottom: '100%', marginBottom: 4, minWidth: 180 }}>
                  {scopedAgents.map((agent) => (
                    <button
                      type="button"
                      key={agent.id}
                      onClick={() => { setActiveAgent(agent.id, mode); setAgentDropdownOpen(false); }}
                      className={`drop-item${agent.id === activeScopedId ? ' header-dropdown-item--active' : ''}`}
                      style={{ fontSize: 'var(--fs-xs)' }}
                    >
                      <span className="trunc med">{agent.name}</span>
                    </button>
                  ))}
                  <div style={{ borderTop: '1px solid var(--c-border-1)', marginTop: 4, paddingTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => { setActiveModal(mode === 'task' ? 'taskProfilesManager' : 'writersManager'); setAgentDropdownOpen(false); }}
                      className="drop-item drop-item--brand"
                    >
                      {mode === 'task' ? '+ Manage Task Profiles' : t('sidebar.manageWriters')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right side: send button */}
          <div className="chat-input-bottom-col chat-input-bottom-col--send">
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
          </div>
        </ComposerRow>
      </ComposerCard>
    </div>
  );
}
