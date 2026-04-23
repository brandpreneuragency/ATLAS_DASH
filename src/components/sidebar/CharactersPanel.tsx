import { useState } from 'react';
import { Plus, Trash2, Check, User, Pencil } from 'lucide-react';
import { useAIStore } from '../../stores/aiStore';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { Agent } from '../../types';

function shortId() {
  return Math.random().toString(36).slice(2, 10);
}

const EMPTY_AGENT: Omit<Agent, 'id' | 'isDefault'> = {
  name: '',
  avatarUrl: '',
  systemPrompt: '',
};

export function CharactersPanel() {
  const { agents, activeAgentId, setActiveAgent, saveAgent, deleteAgent } = useAIStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_AGENT });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const startAdd = () => {
    setForm({ ...EMPTY_AGENT });
    setAdding(true);
    setEditingId(null);
  };

  const startEdit = (agent: Agent) => {
    setForm({ name: agent.name, avatarUrl: agent.avatarUrl, systemPrompt: agent.systemPrompt });
    setEditingId(agent.id);
    setAdding(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (adding) {
      await saveAgent({
        id: shortId(),
        name: form.name.trim(),
        avatarUrl: form.avatarUrl.trim(),
        systemPrompt: form.systemPrompt.trim(),
        isDefault: false,
      });
    } else if (editingId) {
      const existing = agents.find((a) => a.id === editingId);
      if (existing) {
        await saveAgent({ ...existing, name: form.name.trim(), avatarUrl: form.avatarUrl.trim(), systemPrompt: form.systemPrompt.trim() });
      }
    }
    setAdding(false);
    setEditingId(null);
  };

  const handleCancel = () => {
    setAdding(false);
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    await deleteAgent(id);
    setConfirmDeleteId(null);
  };

  const FormBlock = () => (
    <div className="border border-brand/30 rounded-xl p-3 bg-white space-y-2 mb-3">
      <input
        autoFocus
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        placeholder="Character name..."
        className="w-full text-sm border border-border rounded-lg px-3 py-1.5 outline-none focus:border-brand"
      />
      <textarea
        value={form.systemPrompt}
        onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
        placeholder="System prompt / personality..."
        rows={4}
        className="w-full text-sm border border-border rounded-lg px-3 py-1.5 outline-none focus:border-brand resize-none"
      />
      <input
        value={form.avatarUrl}
        onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))}
        placeholder="Avatar URL (optional)..."
        className="w-full text-sm border border-border rounded-lg px-3 py-1.5 outline-none focus:border-brand"
      />
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!form.name.trim()}
          className="flex-1 bg-brand text-white rounded-lg py-1.5 text-xs font-semibold hover:bg-brand-dark transition-colors disabled:opacity-40"
        >
          Save
        </button>
        <button
          onClick={handleCancel}
          className="px-3 py-1.5 border border-border rounded-lg text-xs text-text-secondary hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {confirmDeleteId && (
        <ConfirmDialog
          message="Delete this character? This cannot be undone."
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      <div className="flex items-center justify-between px-5 h-10 align-middle flex-shrink-0 bg-white rounded-[10px]">
        <h3 className="text-[12px] font-semibold text-text-primary">Characters</h3>
        <button
          onClick={startAdd}
          className="flex items-center gap-1 text-xs text-brand font-medium hover:text-brand-dark transition-colors"
        >
          <Plus size={13} /> New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {adding && <FormBlock />}

        {agents.map((agent) => (
          <div key={agent.id}>
            {editingId === agent.id ? (
              <FormBlock />
            ) : (
              <div
                className={`group flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                  agent.id === activeAgentId
                    ? 'border-brand/40 bg-white'
                    : 'border-border hover:border-brand/20 hover:bg-gray-50'
                }`}
                onClick={() => setActiveAgent(agent.id)}
              >
                <div className="w-8 h-8 rounded-full bg-brand/15 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {agent.avatarUrl ? (
                    <img src={agent.avatarUrl} alt={agent.name} className="w-full h-full object-cover" />
                  ) : (
                    <User size={14} className="text-brand" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-text-primary truncate">{agent.name}</span>
                    {agent.id === activeAgentId && <Check size={12} className="text-brand flex-shrink-0" />}
                  </div>
                  {agent.systemPrompt && (
                    <p className="text-xs text-text-secondary line-clamp-2 mt-0.5">{agent.systemPrompt}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); startEdit(agent); }}
                    className="p-1 text-text-secondary hover:text-brand transition-colors"
                  >
                    <Pencil size={12} />
                  </button>
                  {!agent.isDefault && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(agent.id); }}
                      className="p-1 text-text-secondary hover:text-red-500 transition-colors"
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
  );
}
