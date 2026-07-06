// CRM / Forms AI sidebar — Panel 3.
//
// Layout- and styling-linked to the doc-mode AI sidebar (AISidebar.tsx):
// the root reuses #ai-sidebar + .panel, the body reuses
// .panel-body.ai-scroll-host, and the footer reuses
// .ai-sidebar-composer.panel-footer, so the shared CSS applies.
//
// This is UI scaffolding only — no AI/network calls and no real CRM/Forms
// mutations. Suggestions are mocked from the active agent + context, and
// Apply goes through a confirmation dialog + toast (no destructive apply).
//
// Owned files (this agent): CRMAISidebar.tsx, CRMAgents.ts, crmAiSidebar.css.
// Do NOT edit AISidebar.tsx / aiSidebar.css / global CSS / stores / layout.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Brain,
  Check,
  Plus,
  User,
  X,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import {
  ComposerCard,
  ComposerIconButton,
  ComposerRow,
  ComposerSendButton,
  ComposerTextarea,
} from '../ui/Composer';
import { useAIStore } from '../../stores/aiStore';
import { useUIStore } from '../../stores/uiStore';
import {
  CRM_AGENTS,
  getCRMAgentById,
  type CRMAgentContextScope,
  type CRMAgentId,
} from './CRMAgents';
import './crmAiSidebar.css';

function maxHeightVw(): number {
  return Math.round(window.innerWidth * 0.5);
}

/* ------------------------------------------------------------------ *
 * Public props — the Layout shell passes the current CRM/Forms
 * selection so this sidebar can show context-aware suggestions.
 * ------------------------------------------------------------------ */

export interface CRMAISidebarContext {
  module: 'crm' | 'forms';
  /** activeCRMPage or activeFormsPage from uiStore. */
  page: string;
  leadId?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  pipelineView?: string | null;
  formId?: string | null;
  submissionId?: string | null;
  embedState?: 'draft' | 'published' | 'archived' | null;
}

export interface CRMAISidebarProps {
  crmContext: CRMAISidebarContext;
}

/* ------------------------------------------------------------------ *
 * Context derivation — maps (module, page, selection) to a
 * CRMAgentContextScope key (or null when nothing is selected).
 * ------------------------------------------------------------------ */

function deriveContextKind(ctx: CRMAISidebarContext): CRMAgentContextScope | null {
  const { module, page } = ctx;
  if (module === 'crm') {
    switch (page) {
      case 'dashboard':
        return 'dashboard';
      case 'leads':
        return ctx.leadId ? 'lead' : null;
      case 'contacts':
        return ctx.contactId ? 'contact' : null;
      case 'companies':
        return ctx.companyId ? 'company' : null;
      case 'pipeline':
        return 'pipeline';
      case 'activities':
        // Activities timeline -> analyst/summary context (maps to dashboard).
        return 'dashboard';
      case 'settings':
        return null;
      default:
        return null;
    }
  }
  // forms
  switch (page) {
    case 'dashboard':
      return 'dashboard';
    case 'list':
      return ctx.formId ? 'form' : null;
    case 'builder':
      return ctx.formId ? 'form' : null;
    case 'embed':
      return 'embed';
    case 'submissions':
      return ctx.submissionId ? 'submission' : null;
    case 'templates':
      return ctx.formId ? 'form' : null;
    case 'settings':
      return null;
    default:
      return null;
  }
}

interface ContextMeta {
  kindLabel: string;
  subLabel: string;
}

function truncId(id?: string | null): string {
  if (!id) return '—';
  return `#${id.slice(-6)}`;
}

function deriveContextMeta(
  ctx: CRMAISidebarContext,
  kind: CRMAgentContextScope | null,
): ContextMeta | null {
  if (!kind) return null;
  switch (kind) {
    case 'dashboard':
      return ctx.module === 'forms'
        ? { kindLabel: 'Forms Dashboard', subLabel: 'Form stats · submissions' }
        : { kindLabel: 'CRM Dashboard', subLabel: 'Recent leads · pipeline · follow-ups' };
    case 'lead':
      return { kindLabel: 'Lead', subLabel: truncId(ctx.leadId) };
    case 'contact':
      return { kindLabel: 'Contact', subLabel: truncId(ctx.contactId) };
    case 'company':
      return { kindLabel: 'Company', subLabel: truncId(ctx.companyId) };
    case 'pipeline':
      return { kindLabel: 'Pipeline', subLabel: ctx.pipelineView ?? 'All deals' };
    case 'form': {
      const parts: Array<string | null> = [truncId(ctx.formId), ctx.embedState ?? null];
      return {
        kindLabel: 'Form',
        subLabel: parts.filter((s): s is string => Boolean(s)).join(' · '),
      };
    }
    case 'submission':
      return { kindLabel: 'Submission', subLabel: truncId(ctx.submissionId) };
    case 'embed':
      return { kindLabel: 'Embed', subLabel: ctx.embedState ?? 'draft' };
  }
}

function defaultAgentIdForModule(module: 'crm' | 'forms'): CRMAgentId {
  return module === 'forms' ? 'form-assistant' : 'lead-qualifier';
}

// Default agent when the context changes and the current agent is no
// longer relevant. Dashboard is handled per-module at the call site.
const DEFAULT_AGENT_FOR_CONTEXT: Record<Exclude<CRMAgentContextScope, 'dashboard'>, CRMAgentId> = {
  lead: 'lead-qualifier',
  contact: 'follow-up-writer',
  company: 'follow-up-writer',
  pipeline: 'pipeline-analyst',
  form: 'form-assistant',
  submission: 'lead-qualifier',
  embed: 'form-assistant',
};

/* ------------------------------------------------------------------ *
 * Suggested actions per agent (mock, static). Each action carries the
 * prompt text that gets dropped into the composer when clicked.
 * ------------------------------------------------------------------ */

interface CRMAction {
  title: string;
  sub: string;
  prompt: string;
}

const SUGGESTED_ACTIONS: Record<CRMAgentId, CRMAction[]> = {
  'lead-qualifier': [
    { title: 'Score this lead', sub: 'Auto-score 0–100 with ICP fit', prompt: 'Score this lead' },
    { title: 'Suggest next step', sub: 'Best next action based on stage', prompt: 'Suggest next step' },
    { title: 'Flag missing data', sub: 'Highlight gaps in the record', prompt: 'Flag missing data' },
    { title: 'Qualify by ICP', sub: 'Match against ideal customer profile', prompt: 'Qualify by ICP' },
  ],
  'follow-up-writer': [
    { title: 'Draft follow-up email', sub: 'Personalized email ready to send', prompt: 'Draft follow-up email' },
    { title: 'Reply to last message', sub: 'Match tone of the inbound message', prompt: 'Write reply to last message' },
    { title: 'Suggest subject lines', sub: '3 options ranked by open rate', prompt: 'Suggest subject lines' },
    { title: 'Create follow-up task', sub: 'Schedule a reminder task', prompt: 'Create follow-up task' },
  ],
  'pipeline-analyst': [
    { title: 'Find stuck deals', sub: 'Deals idle beyond stage SLA', prompt: 'Find stuck deals' },
    { title: 'Forecast this month', sub: 'Weighted pipeline projection', prompt: 'Forecast this month' },
    { title: 'Summarize pipeline', sub: 'Stage distribution + risks', prompt: 'Summarize pipeline' },
    { title: 'Suggest deals to push', sub: 'Top opportunities to advance', prompt: 'Suggest deals to push' },
  ],
  'form-assistant': [
    { title: 'Simplify this form', sub: 'Cut fields to lift conversion', prompt: 'Simplify this form' },
    { title: 'Suggest missing fields', sub: 'Add captures for better qualification', prompt: 'Suggest missing fields' },
    { title: 'Improve labels', sub: 'Clearer, friendlier copy', prompt: 'Improve labels' },
    { title: 'Generate multi-step version', sub: 'Split into 2–3 steps', prompt: 'Generate multi-step version' },
  ],
};

/* ------------------------------------------------------------------ *
 * Mock suggestion builder (Suggest -> Preview -> Apply flow).
 * No real AI; content is derived from agent + context.
 * ------------------------------------------------------------------ */

interface CRMPreviewChange {
  label: string;
  before?: string;
  after?: string;
  kind: 'add' | 'update' | 'flag';
}

interface CRMSuggestion {
  id: string;
  agentId: CRMAgentId;
  prompt: string;
  title: string;
  summary: string;
  changes: CRMPreviewChange[];
  applyLabel: string;
}

let suggestionSeq = 0;

function buildMockSuggestion(
  agentId: CRMAgentId,
  contextPhrase: string,
  prompt: string,
): CRMSuggestion {
  suggestionSeq += 1;
  const id = `crm-sugg-${suggestionSeq}`;
  const base = { id, agentId, prompt };

  switch (agentId) {
    case 'lead-qualifier':
      return {
        ...base,
        title: 'Lead score & qualification',
        summary: `Proposed score and next step for ${contextPhrase}.`,
        applyLabel: 'Apply score & create task',
        changes: [
          { label: 'Score', kind: 'update', before: '—', after: '82/100 (Warm)' },
          { label: 'ICP fit', kind: 'add', after: 'Strong — matches SMB SaaS ICP' },
          { label: 'Missing data', kind: 'flag', after: 'Phone, company size' },
          { label: 'Next step', kind: 'add', after: 'Send discovery-call invite' },
        ],
      };
    case 'follow-up-writer':
      return {
        ...base,
        title: 'Follow-up email draft',
        summary: `Personalized outreach draft for ${contextPhrase}.`,
        applyLabel: 'Insert draft & schedule task',
        changes: [
          { label: 'Subject', kind: 'add', after: 'Quick idea for your team' },
          { label: 'Body', kind: 'add', after: 'Hi — thanks for reaching out…' },
          { label: 'Tone', kind: 'update', before: 'Generic', after: 'Consultative' },
          { label: 'Follow-up task', kind: 'add', after: 'Remind me in 3 days' },
        ],
      };
    case 'pipeline-analyst':
      return {
        ...base,
        title: 'Pipeline review',
        summary: `Stuck deals and forecast for ${contextPhrase}.`,
        applyLabel: 'Log review & notify owners',
        changes: [
          { label: 'Stuck deals', kind: 'flag', after: '2 deals idle > 14 days' },
          { label: 'Forecast (month)', kind: 'add', after: '$48,200 weighted' },
          { label: 'Push', kind: 'add', after: 'Acme Corp — Proposal stage' },
          { label: 'Win rate', kind: 'update', before: '31%', after: '34%' },
        ],
      };
    case 'form-assistant':
      return {
        ...base,
        title: 'Form improvements',
        summary: `Suggested changes for ${contextPhrase}.`,
        applyLabel: 'Apply form changes',
        changes: [
          { label: 'Fields', kind: 'update', before: '11 fields', after: '7 fields' },
          { label: 'Label', kind: 'update', before: '“Data”', after: '“What do you need?”' },
          { label: 'Missing field', kind: 'add', after: 'Company size (select)' },
          { label: 'Multi-step', kind: 'add', after: 'Split into 2 steps' },
        ],
      };
  }
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

export function CRMAISidebar({ crmContext }: CRMAISidebarProps) {
  const { t } = useTranslation();
  const accentColor = 'var(--c-accent-2)';
  const showToast = useUIStore((s) => s.showToast);
  const openSettings = useUIStore((s) => s.openSettings);
  const {
    providerConfigs,
    activeProviderId,
    setActiveProvider,
    setActiveModel,
    isModelHidden,
  } = useAIStore();

  const [activeAgentId, setActiveAgentId] = useState<CRMAgentId>(
    defaultAgentIdForModule(crmContext.module),
  );
  const [inputValue, setInputValue] = useState('');
  const [suggestion, setSuggestion] = useState<CRMSuggestion | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);
  const [actionsDropdownOpen, setActionsDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const agentRef = useRef<HTMLDivElement>(null);
  const userHeightRef = useRef<number>(0);

  const contextKind = useMemo(() => deriveContextKind(crmContext), [crmContext]);
  const contextMeta = useMemo(
    () => deriveContextMeta(crmContext, contextKind),
    [crmContext, contextKind],
  );

  const activeAgentDef = getCRMAgentById(activeAgentId);

  const hasContext = contextKind !== null && contextMeta !== null;

  // Auto-switch agent when the context changes and the current agent is
  // no longer relevant. Keeps the sidebar aligned with the active page.
  useEffect(() => {
    if (!contextKind) return;
    const current = getCRMAgentById(activeAgentId);
    if (current.contextScope.includes(contextKind)) return;
    const next =
      contextKind === 'dashboard'
        ? defaultAgentIdForModule(crmContext.module)
        : DEFAULT_AGENT_FOR_CONTEXT[contextKind];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveAgentId(next);
  }, [contextKind, activeAgentId, crmContext.module]);

  // Clear any pending preview when the context or agent changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSuggestion(null);
  }, [contextKind, activeAgentId]);

  const contextPhrase = contextMeta ? contextMeta.kindLabel.toLowerCase() : 'this view';

  const runSuggest = (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || !contextKind) return;
    const s = buildMockSuggestion(activeAgentId, contextPhrase, trimmed);
    setSuggestion(s);
  };

  const handleSuggestClick = () => runSuggest(inputValue);

  const handleActionClick = (action: CRMAction) => {
    setInputValue(action.prompt);
    runSuggest(action.prompt);
  };

  const handleApplyClick = () => {
    if (!suggestion) return;
    setConfirmApply(true);
  };

  const handleConfirmApply = () => {
    // CRM_AI_APPLY_TODO: wire Apply to crmService/formsService mutations
    // once pages are integrated; never apply destructively without preview
    // confirmation. This handler currently only simulates the flow.
    const label = suggestion?.title ?? 'suggestion';
    setConfirmApply(false);
    setSuggestion(null);
    setInputValue('');
    showToast(`Applied (preview): ${label}`, 'info');
  };

  const handleDiscardPreview = () => {
    setSuggestion(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      runSuggest(inputValue);
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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) setActionsDropdownOpen(false);
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setModelDropdownOpen(false);
      if (agentRef.current && !agentRef.current.contains(e.target as Node)) setAgentDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const canSuggest = inputValue.trim().length > 0 && hasContext;
  const canApply = !!suggestion;

  const actions = SUGGESTED_ACTIONS[activeAgentId];
  const activeConfig = providerConfigs.find((config) => config.id === activeProviderId);
  const activeModelName = activeConfig?.models?.find((m) => m.id === activeConfig.selectedModel)?.name;
  const modelLabel = activeConfig
    ? (activeModelName || activeConfig.selectedModel || t('sidebar.noModel'))
    : t('sidebar.noModel');
  const actionsLabel = t('chat.actions');

  return (
    <div
      id="ai-sidebar"
      className="panel flex flex-col h-full w-full overflow-h"
      style={{
        background: 'rgba(233, 233, 233, 0)',
        borderStyle: 'none',
        borderWidth: '0px',
        borderColor: 'rgba(0, 0, 0, 0)',
        borderImage: 'none',
      }}
    >
      {confirmApply && (
        <ConfirmDialog
          message={`Apply "${suggestion?.title ?? 'this suggestion'}" to the current ${contextMeta?.kindLabel ?? 'item'}? This will update the record (mock — no real change is made yet).`}
          confirmLabel="Apply"
          onConfirm={handleConfirmApply}
          onCancel={() => setConfirmApply(false)}
        />
      )}

      {/* Body */}
      {!contextMeta ? (
        <div id="chat-empty-state" className="panel-body empty-state chat-empty-state">
          <div className="chat-empty-state-icon">
            <Bot size={32} />
          </div>
          <p className="chat-empty-state-title">CRM Agents are ready</p>
          <p className="chat-empty-state-subtitle subtle">
            Select a lead, contact, company, pipeline, form, or submission to get CRM Agent suggestions.
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <div
            className="panel-body ai-scroll-host flex-1 min-h-0"
            style={{ paddingLeft: 18, paddingRight: 18 }}
          >
            <div className="ai-scroll crm-ai-scroll">
              {/* Suggested actions for the active agent + context */}
              <div>
                <p className="crm-ai-section-label">
                  {activeAgentDef.name} · suggested actions
                </p>
                <div className="crm-ai-suggestions">
                  {actions.map((action) => (
                    <button
                      key={action.title}
                      type="button"
                      className="crm-ai-suggestion-item"
                      onClick={() => handleActionClick(action)}
                    >
                      <Zap size={14} className="crm-ai-suggestion-item-icon" />
                      <span className="crm-ai-suggestion-item-text">
                        <span className="crm-ai-suggestion-item-title">{action.title}</span>
                        <span className="crm-ai-suggestion-item-sub">{action.sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview pane (Suggest -> Preview -> Apply) */}
              {suggestion && (
                <div className="crm-ai-preview">
                  <div className="crm-ai-preview-head">
                    <span className="crm-ai-preview-title">{suggestion.title}</span>
                    <span className="crm-ai-preview-badge">Preview</span>
                  </div>
                  <p className="crm-ai-preview-summary">{suggestion.summary}</p>
                  <p className="crm-ai-preview-prompt">“{suggestion.prompt}”</p>
                  <div className="crm-ai-preview-changes">
                    {suggestion.changes.map((change, i) => (
                      <div
                        key={`${suggestion.id}-${i}`}
                        className={`crm-ai-preview-change crm-ai-preview-change--${change.kind}`}
                      >
                        <span className="crm-ai-preview-change-label">{change.label}</span>
                        {change.before && (
                          <span className="crm-ai-preview-change-before">{change.before}</span>
                        )}
                        {change.after && (
                          <span className="crm-ai-preview-change-after">{change.after}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="crm-ai-preview-actions">
                    <button
                      type="button"
                      className="crm-ai-ghost-btn"
                      onClick={handleDiscardPreview}
                      title="Discard this preview"
                    >
                      <X size={13} />
                      Discard
                    </button>
                    <button
                      type="button"
                      className="crm-ai-apply-btn"
                      onClick={handleApplyClick}
                      disabled={!canApply}
                      title={suggestion.applyLabel}
                    >
                      <Check size={13} />
                      {suggestion.applyLabel}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer composer — same shell as task-mode ChatInput (#chat-input-card) */}
      <div className="ai-sidebar-composer panel-footer">
        <div style={{ flexShrink: 0, paddingTop: 0, paddingBottom: 12, paddingLeft: 12, paddingRight: 12, height: 'fit-content' }}>
          <ComposerCard id="chat-input-card">
            <div
              className="composer-resize-handle"
              onMouseDown={handleResizeStart}
              title="Drag up to expand"
            />

            <ComposerTextarea
              id="chat-input"
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                handleInput();
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                hasContext
                  ? `Ask ${activeAgentDef.name} about this ${contextMeta?.kindLabel ?? 'item'}…`
                  : 'Select an item to get CRM Agent suggestions…'
              }
              rows={1}
              style={{ height: 'fit-content', padding: '18px 18px 0' }}
              aria-label="CRM Agent prompt"
            />

            <ComposerRow className="chat-input-bottom-row">
              <div className="chat-input-bottom-col chat-input-bottom-col--left">
                <div className="chat-input-bottom-col chat-input-bottom-col--tools">
                  <ComposerIconButton
                    className="composer-attach-button"
                    title={t('chat.attachImage')}
                    aria-label={t('chat.attachImage')}
                    disabled
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
                      disabled={!hasContext}
                    >
                      <Zap size={14} className="chat-input-dropup-icon" />
                    </ComposerIconButton>
                    {actionsDropdownOpen && (
                      <div className="drop" style={{ left: 0, bottom: '100%', marginBottom: 4, minWidth: 192 }}>
                        {actions.map((action) => (
                          <button
                            type="button"
                            key={action.title}
                            onClick={() => {
                              handleActionClick(action);
                              setActionsDropdownOpen(false);
                            }}
                            className="drop-item"
                          >
                            <Zap size={11} style={{ color: accentColor, flexShrink: 0 }} />
                            <span className="trunc med">{action.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div ref={modelRef} className="chat-input-bottom-col chat-input-bottom-col--model">
                  <button
                    type="button"
                    onClick={() => {
                      setModelDropdownOpen((v) => !v);
                      setAgentDropdownOpen(false);
                    }}
                    className="chat-input-dropup-btn"
                    data-active="true"
                    style={{ color: accentColor }}
                    aria-label={modelLabel}
                    aria-haspopup="menu"
                    aria-expanded={modelDropdownOpen}
                  >
                    <Brain size={12} className="chat-input-dropup-icon" />
                    <span className="trunc med chat-input-dropup-label">{modelLabel}</span>
                  </button>
                  {modelDropdownOpen && (
                    <div className="drop" style={{ left: 0, bottom: '100%', marginBottom: 4, minWidth: 180 }}>
                      {providerConfigs.length === 0 && (
                        <div className="subtle" style={{ padding: '8px 12px', fontSize: 'var(--fs-xs)' }}>
                          {t('sidebar.noProviders')}
                        </div>
                      )}
                      {providerConfigs
                        .filter((config) => config.status === 'connected')
                        .flatMap((config) => {
                          const visibleModels = (config.models ?? []).filter(
                            (m) => !isModelHidden(config.id, m.id),
                          );
                          return visibleModels.map((model) => (
                            <button
                              type="button"
                              key={`${config.id}:${model.id}`}
                              onClick={() => {
                                setActiveProvider(config.id);
                                setActiveModel(config.id, model.id);
                                setModelDropdownOpen(false);
                              }}
                              className={`drop-item${
                                config.id === activeProviderId && config.selectedModel === model.id
                                  ? ' header-dropdown-item--active'
                                  : ''
                              }`}
                              style={{ fontSize: 'var(--fs-xs)' }}
                            >
                              <span className="med">
                                {config.name} / {model.name}
                              </span>
                            </button>
                          ));
                        })}
                      <div style={{ borderTop: '1px solid var(--c-border-1)', marginTop: 4, paddingTop: 4 }}>
                        <button
                          type="button"
                          onClick={() => {
                            openSettings('models');
                            setModelDropdownOpen(false);
                          }}
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
                    onClick={() => {
                      setAgentDropdownOpen((v) => !v);
                      setModelDropdownOpen(false);
                    }}
                    className="chat-input-dropup-btn"
                    data-active="true"
                    style={{ color: accentColor }}
                    aria-label={activeAgentDef.name}
                    aria-haspopup="menu"
                    aria-expanded={agentDropdownOpen}
                  >
                    <User size={12} className="chat-input-dropup-icon" />
                    <span className="trunc med chat-input-dropup-label">{activeAgentDef.name}</span>
                  </button>
                  {agentDropdownOpen && (
                    <div className="drop" style={{ right: 0, bottom: '100%', marginBottom: 4, minWidth: 180 }}>
                      {CRM_AGENTS.map((agent) => (
                        <button
                          type="button"
                          key={agent.id}
                          onClick={() => {
                            setActiveAgentId(agent.id);
                            setAgentDropdownOpen(false);
                          }}
                          className={`drop-item${
                            agent.id === activeAgentId ? ' header-dropdown-item--active' : ''
                          }`}
                          style={{ fontSize: 'var(--fs-xs)' }}
                        >
                          <span className="trunc med">{agent.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="chat-input-bottom-col chat-input-bottom-col--send">
                <ComposerSendButton
                  onClick={handleSuggestClick}
                  disabled={!canSuggest}
                  title="Generate a suggestion preview"
                />
              </div>
            </ComposerRow>
          </ComposerCard>
        </div>
      </div>
    </div>
  );
}

export default CRMAISidebar;
