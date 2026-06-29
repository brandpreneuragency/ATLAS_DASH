import { useMemo, useState } from 'react';
import { Plus, User, UserCog } from 'lucide-react';
import { useAIStore } from '../../stores/aiStore';
import { SettingsPanels } from './SettingsPanels';
import { AgentEditorForm } from './AgentEditorForm';

type AgentScope = 'writer' | 'task';

export function AgentsSection() {
  const agents = useAIStore((s) => s.agents);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newScope, setNewScope] = useState<AgentScope | null>(null);

  const writers = useMemo(() => agents.filter((a) => a.scope === 'writer'), [agents]);
  const tasks = useMemo(() => agents.filter((a) => a.scope === 'task'), [agents]);
  const selected = selectedId ? agents.find((a) => a.id === selectedId) ?? null : null;

  const startNew = (scope: AgentScope) => { setSelectedId(null); setNewScope(scope); };
  const pick = (id: string) => { setSelectedId(id); setNewScope(null); };
  const onDone = () => { setSelectedId(null); setNewScope(null); };

  const renderGroup = (label: string, icon: React.ReactNode, list: typeof writers, scope: AgentScope) => (
    <div style={{ marginBottom: 8 }}>
      <div className="settings-list-head" style={{ padding: '6px 4px', borderBottom: 'none' }}>
        <span className="semibold" style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-2)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {icon} {label} ({list.length})
        </span>
        <button className="btn-icon" title={`New ${scope} agent`} onClick={() => startNew(scope)}>
          <Plus size={14} />
        </button>
      </div>
      {list.map((a) => (
        <button
          key={a.id}
          className={`settings-list-item${selectedId === a.id ? ' settings-list-item--active' : ''}`}
          onClick={() => pick(a.id)}
        >
          {a.avatarUrl ? (
            <img src={a.avatarUrl} alt="" style={{ width: 18, height: 18, borderRadius: 9999, flexShrink: 0 }} />
          ) : (
            <span style={{ width: 18, height: 18, borderRadius: 9999, background: 'var(--c-background-4)', flexShrink: 0 }} />
          )}
          <span className="settings-list-item-title">{a.name}</span>
          {a.isDefault && <span className="settings-list-item-meta">default</span>}
        </button>
      ))}
    </div>
  );

  const leftMain = (
    <div className="settings-list-body">
      {renderGroup('Writers', <User size={13} />, writers, 'writer')}
      {renderGroup('Task Profiles', <UserCog size={13} />, tasks, 'task')}
      {agents.length === 0 && <div className="settings-empty">No agents yet. Create one with +.</div>}
    </div>
  );

  const centerMain = selected
    ? <AgentEditorForm agentId={selected.id} scope={selected.scope} onDone={onDone} />
    : newScope
    ? <AgentEditorForm agentId={null} scope={newScope} onDone={onDone} />
    : <div className="settings-empty">Select an agent to edit, or create a new one.</div>;

  return (
    <SettingsPanels
      leftHeader={<div className="settings-list-head"><h3>Agents</h3><span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>{agents.length}</span></div>}
      leftMain={leftMain}
      centerHeader={<div className="settings-list-head"><h3>{selected ? 'Edit agent' : newScope ? 'New agent' : 'Agents'}</h3></div>}
      centerMain={centerMain}
    />
  );
}
