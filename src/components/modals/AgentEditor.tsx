import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAIStore } from '../../stores/aiStore';
import type { Agent } from '../../types';

function shortId() {
  return Math.random().toString(36).slice(2, 10);
}

export function AgentEditor() {
  const { activeModal, editingAgentId, setActiveModal, setEditingAgentId } = useUIStore();
  const { agents, saveAgent, deleteAgent, setActiveAgent } = useAIStore();

  const isOpen = activeModal === 'agentEditor' || activeModal === 'editAgent';
  const editingAgent = editingAgentId ? agents.find((a) => a.id === editingAgentId) : null;

  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');

  useEffect(() => {
    if (editingAgent) {
      setName(editingAgent.name);
      setAvatarUrl(editingAgent.avatarUrl);
      setSystemPrompt(editingAgent.systemPrompt);
    } else {
      setName('');
      setAvatarUrl('');
      setSystemPrompt('You are a helpful writing assistant.');
    }
  }, [editingAgent, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim()) return;
    const agent: Agent = {
      id: editingAgent?.id ?? shortId(),
      name: name.trim(),
      avatarUrl: avatarUrl.trim(),
      systemPrompt: systemPrompt.trim(),
      isDefault: editingAgent?.isDefault ?? false,
    };
    await saveAgent(agent);
    setActiveAgent(agent.id);
    setActiveModal(null);
    setEditingAgentId(null);
  };

  const handleDelete = async () => {
    if (!editingAgent || editingAgent.isDefault) return;
    await deleteAgent(editingAgent.id);
    setActiveModal(null);
    setEditingAgentId(null);
  };

  const close = () => {
    setActiveModal(null);
    setEditingAgentId(null);
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">
            {editingAgent ? 'Edit Agent' : 'New Agent'}
          </h2>
          <button onClick={close} className="text-text-secondary hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Agent Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aaron the Script Writer"
              className="w-full text-sm border border-border rounded-lg px-3 py-2 outline-none focus:border-brand"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Avatar URL (optional)</label>
            <input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="w-full text-sm border border-border rounded-lg px-3 py-2 outline-none focus:border-brand"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={6}
              placeholder="Describe how this agent should behave..."
              className="w-full text-sm border border-border rounded-lg px-3 py-2 outline-none focus:border-brand resize-none leading-relaxed"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="flex-1 bg-brand text-white rounded-lg py-2 text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-40"
            >
              {editingAgent ? 'Save Changes' : 'Create Agent'}
            </button>
            {editingAgent && !editingAgent.isDefault && (
              <button
                onClick={handleDelete}
                className="w-10 flex items-center justify-center border border-red-200 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            )}
            <button
              onClick={close}
              className="px-4 py-2 border border-border rounded-lg text-sm text-text-secondary hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
