import { useState, useRef, useCallback, useEffect } from 'react';
import { Square, ChevronDown, ChevronRight, User, Zap, Plus, X, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../stores/uiStore';
import { useChatStore } from '../../stores/chatStore';
import { useAIStore } from '../../stores/aiStore';
import { useStreamingChat } from '../../hooks/useStreamingChat';
import { PROVIDER_MODELS } from '../../services/ai/router';
import { db } from '../../services/db';
import type { Attachment, QuickPrompt } from '../../types';

interface ChatInputProps {
  documentId: string;
}

const MAX_HEIGHT = 192; // 8 rows × 24px
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export function ChatInput({ documentId }: ChatInputProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Dropdown states
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const [actionsDropdownOpen, setActionsDropdownOpen] = useState(false);
  const [quickPrompts, setQuickPrompts] = useState<QuickPrompt[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const agentRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  const { selectedText } = useUIStore();
  const { isStreaming } = useChatStore();
  const { agents, activeAgentId, setActiveAgent, getActiveAgent, providerConfigs, activeProviderId, setActiveProvider, isModelHidden, setActiveModel } = useAIStore();
  const { setActiveModal } = useUIStore();
  const { sendMessage, stopStreaming } = useStreamingChat(documentId);

  const activeAgent = getActiveAgent();
  const activeConfig = providerConfigs.find((c) => c.id === activeProviderId);
  const modelLabel = activeConfig ? activeConfig.selectedModel : t('chat.noModel');

  // Outside-click dismissal for all dropdowns
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setModelDropdownOpen(false);
      if (agentRef.current && !agentRef.current.contains(e.target as Node)) setAgentDropdownOpen(false);
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) setActionsDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Pre-expand the active provider's section when model dropdown opens
  useEffect(() => {
    if (modelDropdownOpen && activeConfig) {
      setExpandedProviders(new Set([activeConfig.provider]));
    }
  }, [modelDropdownOpen, activeConfig]);

  // Load quick prompts when actions dropdown opens
  useEffect(() => {
    if (actionsDropdownOpen) {
      db.quickPrompts.orderBy('createdAt').reverse().toArray().then(setQuickPrompts);
    }
  }, [actionsDropdownOpen]);

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
    setValue('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    try {
      await sendMessage(
        trimmed,
        selectedText?.text,
        selectedText?.from,
        selectedText?.to,
        toSend.length ? toSend : undefined
      );
    } catch (err) {
      console.error('Chat error:', err);
    }
  }, [value, attachments, isStreaming, sendMessage, selectedText]);

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

  return (
    <div className="flex-shrink-0 pl-[20px] pr-[18px] pb-[10px] pt-[6px]">
      {/* Selected text context chip */}
      {selectedText && (
        <div className="mb-2 text-xs text-brand bg-highlight rounded-md px-3 py-1.5 flex items-center gap-2">
          <span className="font-medium">{t('chat.context')}</span>
          <span className="truncate italic text-text-secondary">
            {selectedText.text.slice(0, 60)}{selectedText.text.length > 60 ? '...' : ''}
          </span>
        </div>
      )}

      {/* Main card */}
      <div className="bg-white rounded-[12px] flex flex-col shadow-sm">
        {/* Attachment thumbnails */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {attachments.map((att, i) => (
              <div key={i} className="relative group">
                <img
                  src={att.dataUrl}
                  alt={att.name}
                  className="w-10 h-10 rounded-md object-cover border border-border"
                />
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  title={t('chat.removeAttachment')}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-text-primary rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={9} className="text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); handleInput(); }}
          onKeyDown={handleKeyDown}
          placeholder={t('chat.askPlaceholder', { name: activeAgent.name })}
          rows={1}
          className="chat-textarea w-full bg-transparent text-xs text-text-primary placeholder-text-secondary resize-none outline-none leading-6 px-3 pt-3 pb-2"
        />

        {/* Footer — two rows, send button pinned absolute bottom-right */}
        <div className="flex flex-col px-2 pt-1.5 pb-2 border-t border-border/40 bg-white rounded-b-[12px]">

          {/* Row 1: Actions + Writer */}
          <div className="flex items-center gap-1">
            {/* Actions dropdown */}
            <div ref={actionsRef} className="relative">
              <button
                type="button"
                onClick={() => { setActionsDropdownOpen((v) => !v); setModelDropdownOpen(false); setAgentDropdownOpen(false); }}
                className="flex items-center gap-0.5 h-6 px-2 rounded-md text-[11px] text-text-secondary hover:text-text-primary hover:bg-gray-100 transition-colors"
              >
                <Zap size={10} className="text-brand flex-shrink-0" />
                <span className="font-medium">{t('chat.actions')}</span>
                <ChevronDown size={10} className={`flex-shrink-0 transition-transform ${actionsDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {actionsDropdownOpen && (
                <div className="dropdown-menu absolute left-0 bottom-full mb-1 w-48 bg-white border border-border rounded-lg shadow-lg z-50 py-1">
                  {quickPrompts.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-text-secondary">{t('chat.noActions')}</div>
                  ) : (
                    quickPrompts.map((qp) => (
                      <button
                        type="button"
                        key={qp.id}
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('quickPromptSelected', { detail: qp.prompt }));
                          setActionsDropdownOpen(false);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs text-text-primary hover:bg-highlight/40 transition-colors"
                      >
                        <Zap size={11} className="text-brand flex-shrink-0" />
                        <span className="truncate font-medium">{qp.title}</span>
                      </button>
                    ))
                  )}
                  <div className="border-t border-border mt-1 pt-1">
                    <button
                      type="button"
                      onClick={() => { setActiveModal('actionsManager'); setActionsDropdownOpen(false); }}
                      className="w-full text-left px-3 py-2 text-xs text-brand hover:bg-highlight transition-colors"
                    >
                      {t('chat.manageActions')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Agent (Writer) dropdown */}
            <div ref={agentRef} className="relative min-w-0 flex-1">
              <button
                type="button"
                onClick={() => { setAgentDropdownOpen((v) => !v); setModelDropdownOpen(false); setActionsDropdownOpen(false); }}
                className="flex items-center gap-0.5 h-6 px-2 rounded-md text-[11px] text-text-secondary hover:text-text-primary hover:bg-gray-100 transition-colors w-full"
              >
                <span className="truncate font-medium">{activeAgent.name}</span>
                <ChevronDown size={10} className="flex-shrink-0" />
              </button>
              {agentDropdownOpen && (
                <div className="dropdown-menu absolute left-0 bottom-full mb-1 w-52 bg-white border border-border rounded-lg shadow-lg z-50 py-1">
                  {agents.map((agent) => (
                    <button
                      type="button"
                      key={agent.id}
                      onClick={() => { setActiveAgent(agent.id); setAgentDropdownOpen(false); }}
                      className={`flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors ${
                        agent.id === activeAgentId ? 'bg-highlight text-brand' : 'text-text-primary hover:bg-gray-50'
                      }`}
                    >
                      <div className="w-5 h-5 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                        {agent.avatarUrl ? (
                          <img src={agent.avatarUrl} alt={agent.name} className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <User size={10} className="text-brand" />
                        )}
                      </div>
                      <span className="truncate font-medium">{agent.name}</span>
                    </button>
                  ))}
                  <div className="border-t border-border mt-1 pt-1">
                    <button
                      type="button"
                      onClick={() => { setActiveModal('writersManager'); setAgentDropdownOpen(false); }}
                      className="w-full text-left px-3 py-2 text-xs text-brand hover:bg-highlight transition-colors"
                    >
                      {t('chat.manageWriters')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Attach + Model + Send */}
          <div className="flex items-center gap-1 mt-0.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              aria-label={t('chat.attachImage')}
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-7 h-7 flex items-center justify-center rounded-md text-text-secondary hover:text-text-primary hover:bg-gray-100 transition-colors flex-shrink-0"
              title={t('chat.attachImage')}
            >
              <Plus size={14} />
            </button>

            {/* Model dropdown — grouped by provider, collapsible */}
            <div ref={modelRef} className="relative min-w-0 flex-1">
              <button
                type="button"
                onClick={() => { setModelDropdownOpen((v) => !v); setAgentDropdownOpen(false); setActionsDropdownOpen(false); }}
                className="flex items-center gap-0.5 h-6 px-2 rounded-md text-[11px] text-text-secondary hover:text-text-primary hover:bg-gray-100 transition-colors w-full"
              >
                <span className="truncate font-medium">{modelLabel}</span>
                <ChevronDown size={10} className="flex-shrink-0" />
              </button>
              {modelDropdownOpen && (
                <div className="dropdown-menu absolute left-0 bottom-full mb-1 w-64 bg-white border border-border rounded-lg shadow-lg z-50 flex flex-col max-h-72 overflow-hidden">
                  {providerConfigs.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-text-secondary">{t('chat.noProviders')}</div>
                  ) : (
                    <div className="overflow-y-auto flex-1">
                      {providerConfigs.map((config) => {
                        const providerLabel = PROVIDER_MODELS[config.provider]?.label ?? config.provider;
                        const allModels = PROVIDER_MODELS[config.provider]?.models ?? [];
                        const visibleModels = allModels.filter((m) => !isModelHidden(config.provider, m));
                        const isExpanded = expandedProviders.has(config.provider);
                        const isActiveProvider = config.id === activeProviderId;
                        return (
                          <div key={config.id}>
                            {/* Provider header */}
                            <button
                              type="button"
                              onClick={() => setExpandedProviders((prev) => {
                                const next = new Set(prev);
                                if (next.has(config.provider)) next.delete(config.provider);
                                else next.add(config.provider);
                                return next;
                              })}
                              className="w-full flex items-center gap-1.5 px-3 py-1.5 text-left hover:bg-gray-50 transition-colors"
                            >
                              {isExpanded
                                ? <ChevronDown size={10} className="text-text-secondary flex-shrink-0" />
                                : <ChevronRight size={10} className="text-text-secondary flex-shrink-0" />}
                              <span className={`text-[11px] font-semibold truncate ${isActiveProvider ? 'text-brand' : 'text-text-primary'}`}>
                                {providerLabel}
                              </span>
                              {isActiveProvider && (
                                <span className="ml-auto text-[9px] text-brand font-medium flex-shrink-0">{t('chat.active')}</span>
                              )}
                            </button>
                            {/* Models list */}
                            {isExpanded && visibleModels.map((modelId) => {
                              const isActiveModel = isActiveProvider && config.selectedModel === modelId;
                              return (
                                <button
                                  type="button"
                                  key={modelId}
                                  onClick={() => {
                                    setActiveModel(config.provider, modelId);
                                    setActiveProvider(config.id);
                                    setModelDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center gap-2 pl-7 pr-3 py-1.5 text-left text-[11px] transition-colors ${
                                    isActiveModel ? 'text-brand bg-highlight/60' : 'text-text-secondary hover:bg-gray-50 hover:text-text-primary'
                                  }`}
                                >
                                  <span className="truncate">{modelId}</span>
                                  {isActiveModel && <Check size={10} className="flex-shrink-0 ml-auto text-brand" />}
                                </button>
                              );
                            })}
                            {isExpanded && visibleModels.length === 0 && (
                              <p className="pl-7 pr-3 py-1.5 text-[11px] text-text-secondary italic">{t('chat.allModelsHidden')}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="border-t border-border flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => { setActiveModal('modelManagement'); setModelDropdownOpen(false); }}
                      className="w-full text-left px-3 py-2 text-xs text-brand hover:bg-highlight transition-colors"
                    >
                      {t('chat.manageModels')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Send / Stop */}
            {isStreaming ? (
              <button
                type="button"
                onClick={stopStreaming}
                className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-transparent transition-colors"
                title={t('chat.stop')}
              >
                <Square size={10} fill="currentColor" className="text-[rgba(146,17,118,1)]" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className="send-btn flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:scale-100"
                title={t('chat.send')}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
