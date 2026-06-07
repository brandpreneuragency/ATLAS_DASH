import { useCallback, useMemo, useState } from 'react';
import { Plus, Trash2, Check, User, Pencil } from 'lucide-react';
import { useAIStore } from '../../stores/aiStore';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { Agent } from '../../types';

function shortId() {
  return Math.random().toString(36).slice(2, 10);
}

const EMPTY_AGENT: Omit<Agent, 'id' | 'isDefault' | 'scope'> = {
  name: '',
  avatarUrl: '',
  systemPrompt: '',
};

interface FormBlockProps {
  form: typeof EMPTY_AGENT;
  onSave: () => void;
  onCancel: () => void;
  onChange: (field: keyof typeof EMPTY_AGENT, value: string) => void;
}

interface CharactersPanelProps {
  scope: 'writer' | 'task';
  title: string;
}

const FormBlock: React.FC<FormBlockProps> = ({ form, onSave, onCancel, onChange }) => (
  <div
    className="card"
    style={{ border: '1px solid rgba(139,92,246,0.3)', padding: 12, marginBottom: 12 }}
  >
    <div className="col" style={{ gap: 8 }}>
      <input
        autoFocus
        value={form.name}
        onChange={(event) => onChange('name', event.target.value)}
        placeholder="Profile name..."
        className="ctrl"
        style={{ fontSize: 'var(--fs-sm)' }}
      />
      <textarea
        value={form.systemPrompt}
        onChange={(event) => onChange('systemPrompt', event.target.value)}
        placeholder="System prompt / personality..."
        rows={4}
        className="ctrl"
        style={{ fontSize: 'var(--fs-sm)', resize: 'none' }}
      />
      <input
        value={form.avatarUrl}
        onChange={(event) => onChange('avatarUrl', event.target.value)}
        placeholder="Avatar URL (optional)..."
        className="ctrl"
        style={{ fontSize: 'var(--fs-sm)' }}
      />
      <div className="row gap-2">
        <button
          onClick={onSave}
          disabled={!form.name.trim()}
          className="btn-brand flex-1"
          style={{ justifyContent: 'center', padding: '6px 0' }}
        >
          Save
        </button>
        <button onClick={onCancel} className="btn subtle" style={{ fontSize: 'var(--fs-xs)' }}>
          Cancel
        </button>
      </div>
    </div>
  </div>
);

export function CharactersPanel({ scope, title }: CharactersPanelProps) {
  const { agents, activeAgentId, activeTaskAgentId, setActiveAgent, saveAgent, deleteAgent } =
    useAIStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_AGENT });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const scopedAgents = useMemo(() => agents.filter((agent) => agent.scope === scope), [agents, scope]);
  const activeScopedId = scope === 'task' ? activeTaskAgentId : activeAgentId;

  const startAdd = useCallback(() => {
    setForm({ ...EMPTY_AGENT });
    setAdding(true);
    setEditingId(null);
  }, []);

  const startEdit = useCallback((agent: Agent) => {
    setForm({ name: agent.name, avatarUrl: agent.avatarUrl, systemPrompt: agent.systemPrompt });
    setEditingId(agent.id);
    setAdding(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) return;
    if (adding) {
      await saveAgent({
        id: shortId(),
        name: form.name.trim(),
        avatarUrl: form.avatarUrl.trim(),
        systemPrompt: form.systemPrompt.trim(),
        isDefault: false,
        scope,
      });
    } else if (editingId) {
      const existing = scopedAgents.find((agent) => agent.id === editingId);
      if (existing) {
        await saveAgent({
          ...existing,
          name: form.name.trim(),
          avatarUrl: form.avatarUrl.trim(),
          systemPrompt: form.systemPrompt.trim(),
        });
      }
    }
    setAdding(false);
    setEditingId(null);
  }, [adding, editingId, form, saveAgent, scope, scopedAgents]);

  const handleCancel = useCallback(() => {
    setAdding(false);
    setEditingId(null);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteAgent(id);
      setConfirmDeleteId(null);
    },
    [deleteAgent]
  );

  const handleFormChange = useCallback((field: keyof typeof EMPTY_AGENT, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-h">
      {confirmDeleteId && (
        <ConfirmDialog
          message="Delete this profile? This cannot be undone."
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      <div
        className="shrink-0 row"
        style={{
          justifyContent: 'space-between',
          padding: '8px 12px',
          height: 36,
          verticalAlign: 'middle',
          background: 'var(--c-background-3)',
          borderRadius: 10,
        }}
      >
        <h3 className="semibold" style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-1)' }}>
          {title}
        </h3>
        <button
          onClick={startAdd}
          className="row gap-1"
          style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--c-accent-center-panel)',
            fontWeight: 500,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Plus size={13} /> New
        </button>
      </div>

      <div className="flex-1 overflow-y-a" style={{ padding: '12px 16px' }}>
        <div className="col" style={{ gap: 8 }}>
          {adding && (
            <FormBlock form={form} onSave={handleSave} onCancel={handleCancel} onChange={handleFormChange} />
          )}

          {scopedAgents.map((agent) => (
            <div key={agent.id}>
              {editingId === agent.id ? (
                <FormBlock form={form} onSave={handleSave} onCancel={handleCancel} onChange={handleFormChange} />
              ) : (
                <div
                  className="row gap-3 c-ptr"
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border:
                      agent.id === activeScopedId
                        ? '1px solid rgba(139,92,246,0.4)'
                        : '1px solid var(--c-border-1)',
                    background: agent.id === activeScopedId ? 'var(--c-background-3)' : 'transparent',
                    transition: 'border-color 0.15s, background-color 0.15s',
                  }}
                  onClick={() => setActiveAgent(agent.id, scope)}
                  onMouseEnter={(event) => {
                    if (agent.id !== activeScopedId) {
                      event.currentTarget.style.borderColor = 'rgba(139,92,246,0.2)';
                      event.currentTarget.style.background = 'var(--c-background-4)';
                    }
                  }}
                  onMouseLeave={(event) => {
                    if (agent.id !== activeScopedId) {
                      event.currentTarget.style.borderColor = 'var(--c-border-1)';
                      event.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <div
                    className="shrink-0 overflow-h"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'rgba(139,92,246,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {agent.avatarUrl ? (
                      <img src={agent.avatarUrl} alt={agent.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <User size={14} style={{ color: 'var(--c-accent-center-panel)' }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="row gap-1">
                      <span className="trunc med" style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-text-1)' }}>
                        {agent.name}
                      </span>
                      {agent.id === activeScopedId && (
                        <Check size={12} className="shrink-0" style={{ color: 'var(--c-accent-center-panel)' }} />
                      )}
                    </div>
                    {agent.systemPrompt && (
                      <p
                        className="subtle"
                        style={{
                          fontSize: 'var(--fs-xs)',
                          marginTop: 2,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {agent.systemPrompt}
                      </p>
                    )}
                  </div>
                  <div
                    className="row gap-1 shrink-0"
                    style={{ opacity: 0, transition: 'opacity 0.15s' }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.opacity = '1';
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.opacity = '0';
                    }}
                  >
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        startEdit(agent);
                      }}
                      className="btn-icon"
                      style={{ padding: 4 }}
                      title="Edit"
                    >
                      <Pencil size={12} />
                    </button>
                    {!agent.isDefault && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setConfirmDeleteId(agent.id);
                        }}
                        className="btn-icon"
                        style={{ padding: 4 }}
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
