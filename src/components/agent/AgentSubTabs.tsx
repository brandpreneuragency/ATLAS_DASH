import { useAgentAreaStore, type AgentSubTab } from '../../stores/agentAreaStore';

const TABS: { key: AgentSubTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'chat', label: 'Chat' },
  { key: 'runs', label: 'Runs' },
  { key: 'workflows', label: 'Workflows' },
  { key: 'schedules', label: 'Schedules' },
];

/**
 * Agent area sub-navigation: Overview (Control's `MissionControl.tsx`),
 * Chat (the pre-existing Hermes `ChatWorkspace`, wired at M5b), Runs
 * (Control's `Automation.tsx` runs list + `RunDetail.tsx`), Workflows
 * (Control's `Automation.tsx` WorkflowsSection + `WorkflowEditor.tsx`), and
 * Schedules (Control's `Automation.tsx` Hermes cron table). Brain Review
 * remains later-phase content.
 */
export function AgentSubTabs() {
  const subTab = useAgentAreaStore((s) => s.subTab);
  const setSubTab = useAgentAreaStore((s) => s.setSubTab);

  return (
    <div
      role="tablist"
      aria-label="Agent views"
      style={{
        display: 'flex',
        gap: 4,
        padding: '8px 16px',
        borderBottom: '1px solid var(--c-border-1)',
        flexShrink: 0,
      }}
    >
      {TABS.map((tab) => {
        const active = subTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`agent-subtab-${tab.key}`}
            aria-selected={active}
            className="btn-icon"
            style={{
              fontSize: 'var(--fs-sm)',
              padding: '4px 12px',
              borderRadius: 6,
              fontWeight: active ? 600 : 400,
              background: active ? 'var(--c-background-4)' : 'transparent',
              color: active ? 'var(--c-text-1)' : 'var(--c-text-2)',
            }}
            onClick={() => setSubTab(tab.key)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
