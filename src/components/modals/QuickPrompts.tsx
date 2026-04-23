import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Zap } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { db } from '../../services/db';
import type { QuickPrompt } from '../../types';

function shortId() {
  return Math.random().toString(36).slice(2, 10);
}

interface QuickPromptsProps {
  onSelectPrompt: (prompt: string) => void;
}

export function QuickPrompts({ onSelectPrompt }: QuickPromptsProps) {
  const { activeModal, setActiveModal } = useUIStore();
  const [prompts, setPrompts] = useState<QuickPrompt[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (activeModal === 'quickPrompts') {
      db.quickPrompts.orderBy('createdAt').reverse().toArray().then(setPrompts);
    }
  }, [activeModal]);

  if (activeModal !== 'quickPrompts') return null;

  const handleAdd = async () => {
    if (!newTitle.trim() || !newPrompt.trim()) return;
    const qp: QuickPrompt = {
      id: shortId(),
      title: newTitle.trim(),
      prompt: newPrompt.trim(),
      createdAt: Date.now(),
    };
    await db.quickPrompts.put(qp);
    setPrompts((prev) => [qp, ...prev]);
    setNewTitle('');
    setNewPrompt('');
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    await db.quickPrompts.delete(id);
    setPrompts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSelect = (prompt: string) => {
    onSelectPrompt(prompt);
    setActiveModal(null);
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-text-primary">Quick Prompts</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAdding((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-brand font-medium hover:text-brand-dark transition-colors"
            >
              <Plus size={13} /> Add
            </button>
            <button onClick={() => setActiveModal(null)} className="text-text-secondary hover:text-text-primary transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {adding && (
            <div className="border border-brand/30 rounded-xl p-4 bg-highlight/30 space-y-3">
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Prompt title..."
                className="w-full text-sm border border-border rounded-lg px-3 py-2 outline-none focus:border-brand"
              />
              <textarea
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                placeholder="Prompt text..."
                rows={3}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 outline-none focus:border-brand resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={!newTitle.trim() || !newPrompt.trim()}
                  className="flex-1 bg-brand text-white rounded-lg py-1.5 text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  onClick={() => setAdding(false)}
                  className="px-3 py-1.5 border border-border rounded-lg text-sm text-text-secondary hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {prompts.length === 0 && !adding && (
            <div className="text-center py-8 text-sm text-text-secondary">
              No quick prompts saved yet. Add one to get started.
            </div>
          )}

          {prompts.map((qp) => (
            <div
              key={qp.id}
              className="group flex items-start gap-3 p-3 rounded-xl border border-border hover:border-brand/30 hover:bg-highlight/20 transition-colors cursor-pointer"
              onClick={() => handleSelect(qp.prompt)}
            >
              <Zap size={14} className="text-brand flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary">{qp.title}</div>
                <div className="text-xs text-text-secondary truncate mt-0.5">{qp.prompt}</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(qp.id); }}
                className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-red-500 transition-all"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
