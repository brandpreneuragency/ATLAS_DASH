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

import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Building2,
  Check,
  Code,
  Columns3,
  FormInput,
  Inbox,
  LayoutDashboard,
  Mail,
  Sparkles,
  Target,
  TrendingUp,
  User,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useUIStore } from '../../stores/uiStore';
import {
  CRM_AGENTS,
  getCRMAgentById,
  type CRMAgentContextScope,
  type CRMAgentId,
} from './CRMAgents';
import './crmAiSidebar.css';

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
 * Icon maps (typed — no string lookups at render time).
 * ------------------------------------------------------------------ */

const AGENT_ICONS: Record<CRMAgentId, LucideIcon> = {
  'lead-qualifier': Target,
  'follow-up-writer': Mail,
  'pipeline-analyst': TrendingUp,
  'form-assistant': FormInput,
};

const CONTEXT_ICONS: Record<CRMAgentContextScope, LucideIcon> = {
  dashboard: LayoutDashboard,
  lead: User,
  contact: User,
  company: Building2,
  pipeline: Columns3,
  form: FormInput,
  submission: Inbox,
  embed: Code,
};

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
      return 'form';
    case 'settings':
      return null;
    default:
      return null;
  }
}

interface ContextMeta {
  kindLabel: string;
  subLabel: string;
  icon: LucideIcon;
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
        ? { kindLabel: 'Forms Dashboard', subLabel: 'Form stats · submissions', icon: LayoutDashboard }
        : { kindLabel: 'CRM Dashboard', subLabel: 'Recent leads · pipeline · follow-ups', icon: LayoutDashboard };
    case 'lead':
      return { kindLabel: 'Lead', subLabel: truncId(ctx.leadId), icon: CONTEXT_ICONS.lead };
    case 'contact':
      return { kindLabel: 'Contact', subLabel: truncId(ctx.contactId), icon: CONTEXT_ICONS.contact };
    case 'company':
      return { kindLabel: 'Company', subLabel: truncId(ctx.companyId), icon: CONTEXT_ICONS.company };
    case 'pipeline':
      return { kindLabel: 'Pipeline', subLabel: ctx.pipelineView ?? 'All deals', icon: CONTEXT_ICONS.pipeline };
    case 'form': {
      const parts: Array<string | null> = [truncId(ctx.formId), ctx.embedState ?? null];
      return {
        kindLabel: 'Form',
        subLabel: parts.filter((s): s is string => Boolean(s)).join(' · '),
        icon: CONTEXT_ICONS.form,
      };
    }
    case 'submission':
      return { kindLabel: 'Submission', subLabel: truncId(ctx.submissionId), icon: CONTEXT_ICONS.submission };
    case 'embed':
      return { kindLabel: 'Embed', subLabel: ctx.embedState ?? 'draft', icon: CONTEXT_ICONS.embed };
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
  const showToast = useUIStore((s) => s.showToast);

  const [activeAgentId, setActiveAgentId] = useState<CRMAgentId>(
    defaultAgentIdForModule(crmContext.module),
  );
  const [inputValue, setInputValue] = useState('');
  const [suggestion, setSuggestion] = useState<CRMSuggestion | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);

  const contextKind = useMemo(() => deriveContextKind(crmContext), [crmContext]);
  const contextMeta = useMemo(
    () => deriveContextMeta(crmContext, contextKind),
    [crmContext, contextKind],
  );

  const activeAgentDef = getCRMAgentById(activeAgentId);
  const relevantAgents = useMemo(
    () => (contextKind ? CRM_AGENTS.filter((a) => a.contextScope.includes(contextKind)) : CRM_AGENTS),
    [contextKind],
  );

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
  // Capitalized so JSX treats it as a component (not a DOM tag). Falls back
  // to the empty-state icon when nothing is selected.
  const ContextIcon: LucideIcon = contextMeta?.icon ?? Bot;

  const runSuggest = (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || !contextKind) return;
    const s = buildMockSuggestion(activeAgentId, contextPhrase, trimmed);
    setSuggestion(s);
  };

  const handleSuggestClick = () => runSuggest(inputValue);

  const handleQuickPrompt = (prompt: string) => {
    setInputValue(prompt);
    runSuggest(prompt);
  };

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

  const canSuggest = inputValue.trim().length > 0 && hasContext;
  const canApply = !!suggestion;

  const hint = !hasContext
    ? 'Select an item to suggest'
    : !inputValue.trim()
    ? 'Type or pick a prompt'
    : suggestion
    ? 'Preview ready — Apply or discard'
    : 'Press Enter or Suggest';

  const actions = SUGGESTED_ACTIONS[activeAgentId];

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

      {/* Subheader: CRM Agents header + agent selector */}
      <div className="crm-ai-header">
        <div className="crm-ai-header-title-row">
          <span className="crm-ai-header-title">CRM Agents</span>
          <span className="crm-ai-header-count">{CRM_AGENTS.length}</span>
        </div>
        <div className="crm-ai-agent-selector" role="tablist" aria-label="CRM Agents">
          {CRM_AGENTS.map((agent) => {
            const Icon = AGENT_ICONS[agent.id];
            const isActive = agent.id === activeAgentId;
            const isRelevant = relevantAgents.some((a) => a.id === agent.id);
            return (
              <button
                key={agent.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                title={`${agent.name} — ${agent.description}`}
                className={[
                  'crm-ai-agent-chip',
                  isActive ? 'crm-ai-agent-chip--on' : '',
                  !isRelevant ? 'crm-ai-agent-chip--dim' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setActiveAgentId(agent.id)}
              >
                <Icon size={15} />
                <span className="crm-ai-agent-chip-name">{agent.name}</span>
              </button>
            );
          })}
        </div>
      </div>

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
              {/* Context summary card */}
              <div className="crm-ai-context-card">
                <div className="crm-ai-context-icon">
                  <ContextIcon size={16} />
                </div>
                <div className="crm-ai-context-text">
                  <span className="crm-ai-context-kind">{contextMeta.kindLabel}</span>
                  <span className="crm-ai-context-sub">{contextMeta.subLabel}</span>
                </div>
              </div>

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

      {/* Footer composer — always visible (bottom input stays reachable) */}
      <div className="ai-sidebar-composer panel-footer">
        <div className="crm-ai-composer">
          {/* Quick prompts for the active agent */}
          <div className="crm-ai-quick-prompts">
            {activeAgentDef.quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="crm-ai-quick-prompt"
                onClick={() => handleQuickPrompt(prompt)}
                disabled={!hasContext}
                title={hasContext ? prompt : 'Select an item first'}
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input card — mirrors #chat-input-card visual (bg-2, radius 8) */}
          <div className="crm-ai-composer-card">
            <textarea
              className="crm-ai-composer-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                hasContext
                  ? `Ask ${activeAgentDef.name} about this ${contextMeta?.kindLabel ?? 'item'}…`
                  : 'Select an item to get CRM Agent suggestions…'
              }
              rows={1}
              aria-label="CRM Agent prompt"
            />
            <div className="crm-ai-composer-row">
              <span className="crm-ai-composer-hint">{hint}</span>
              <button
                type="button"
                className="crm-ai-suggest-btn"
                onClick={handleSuggestClick}
                disabled={!canSuggest}
                title="Generate a suggestion preview"
              >
                <Sparkles size={13} />
                Suggest
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CRMAISidebar;
