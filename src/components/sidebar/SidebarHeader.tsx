import { useState, useRef, useEffect } from 'react';
import { ChevronDown, User, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../../stores/aiStore';
import { useUIStore } from '../../stores/uiStore';
import { db } from '../../services/db';
import type { QuickPrompt } from '../../types';

export function SidebarHeader() {
  const { t } = useTranslation();
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [actionsDropdownOpen, setActionsDropdownOpen] = useState(false);
  const [quickPrompts, setQuickPrompts] = useState<QuickPrompt[]>([]);
  const agentRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  const { agents, activeAgentId, setActiveAgent, getActiveAgent, providerConfigs, activeProviderId, setActiveProvider } = useAIStore();
  const { openSettings } = useUIStore();
  const activeAgent = getActiveAgent();
  const activeConfig = providerConfigs.find((c) => c.id === activeProviderId);
  const modelLabel = activeConfig
    ? activeConfig.selectedModel
    : t('sidebar.noModel');

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (agentRef.current && !agentRef.current.contains(e.target as Node)) setAgentDropdownOpen(false);
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setModelDropdownOpen(false);
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) setActionsDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (actionsDropdownOpen) {
      db.quickPrompts.orderBy('createdAt').reverse().toArray().then(setQuickPrompts);
    }
  }, [actionsDropdownOpen]);

  return (
    <div className="flex-shrink-0 rounded-[10px] bg-[rgba(240,240,240,1)]">
      <div className="flex h-[40px] items-center justify-start gap-2 px-[10px] pt-[20px] pb-[30px] bg-[rgba(240,240,240,1)]">
        {/* AI Model dropdown */}
        <div ref={modelRef} className="relative flex-1 min-w-0">
          <button
            type="button"
            onClick={() => { setModelDropdownOpen((v) => !v); setAgentDropdownOpen(false); }}
            className="w-full h-[30px] flex items-center justify-between gap-1 px-3.5 py-2.5 rounded-lg border-0 border-transparent [border-style:none] [border-image:none] bg-white hover:bg-highlight/30 transition-colors text-xs text-text-primary"
          >
            <span className="truncate font-medium">{modelLabel}</span>
            <ChevronDown size={12} className="text-text-secondary flex-shrink-0" />
          </button>

          {modelDropdownOpen && (
            <div className="dropdown-menu absolute left-0 top-full mt-1 w-56 bg-white border border-border rounded-lg z-50 py-1">
              {providerConfigs.length === 0 && (
                <div className="px-3 py-2 text-xs text-text-secondary">{t('sidebar.noProviders')}</div>
              )}
              {providerConfigs.map((config) => (
                <button
                  type="button"
                  key={config.id}
                  onClick={() => { setActiveProvider(config.id); setModelDropdownOpen(false); }}
                  className={`flex flex-col w-full px-3 py-2 text-left text-xs transition-colors ${
                    config.id === activeProviderId ? 'bg-highlight text-brand' : 'text-text-primary hover:bg-gray-50'
                  }`}
                >
                  <span className="font-medium">{config.selectedModel}</span>
                  <span className="text-text-secondary">{config.name || config.provider}</span>
                </button>
              ))}
              <div className="border-t border-border mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => { openSettings('tools'); setModelDropdownOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-brand hover:bg-highlight transition-colors"
                >
                  {t('sidebar.manageModels')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Character dropdown */}
        <div ref={agentRef} className="relative flex-1 min-w-0">
          <button
            type="button"
            onClick={() => { setAgentDropdownOpen((v) => !v); setModelDropdownOpen(false); }}
            className="w-full h-[40px] flex items-center justify-between gap-1 px-2.5 py-2.5 rounded-lg border-0 border-transparent [border-style:none] [border-image:none] bg-white hover:bg-highlight/30 transition-colors text-xs text-text-primary"
          >
            <span className="truncate font-medium">{activeAgent.name}</span>
            <ChevronDown size={12} className="text-text-secondary flex-shrink-0" />
          </button>

          {agentDropdownOpen && (
            <div className="dropdown-menu absolute right-0 top-full mt-1 w-52 bg-white border border-border rounded-lg z-50 py-1">
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
                  onClick={() => { openSettings('agents'); setAgentDropdownOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-brand hover:bg-highlight transition-colors"
                >
                  {t('sidebar.manageWriters')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions dropdown */}
        <div ref={actionsRef} className="relative flex-1 min-w-0">
          <button
            type="button"
            onClick={() => { setActionsDropdownOpen((v) => !v); setModelDropdownOpen(false); setAgentDropdownOpen(false); }}
            className="w-full h-[40px] flex items-center justify-between gap-1 px-2.5 py-2.5 rounded-lg bg-white hover:bg-highlight/30 transition-colors text-xs text-text-primary"
          >
            <span className="flex items-center gap-1.5 font-medium truncate">
              <Zap size={11} className="text-brand flex-shrink-0" />
              <span className="truncate">{t('sidebar.actions')}</span>
            </span>
            <ChevronDown size={12} className={`text-text-secondary flex-shrink-0 transition-transform ${actionsDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {actionsDropdownOpen && (
            <div className="dropdown-menu absolute right-0 top-full mt-1 w-48 bg-white border border-border rounded-lg z-50 py-1">
              {quickPrompts.length === 0 ? (
                <div className="px-3 py-2 text-xs text-text-secondary">{t('sidebar.noActions')}</div>
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
                  onClick={() => { openSettings('actions'); setActionsDropdownOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-brand hover:bg-highlight transition-colors"
                >
                  {t('sidebar.manageActions')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
