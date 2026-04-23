import { useState, useEffect } from 'react';
import { Plus, Trash2, Zap, Pencil } from 'lucide-react';
import { db } from '../../services/db';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { QuickPrompt } from '../../types';

function shortId() {
  return Math.random().toString(36).slice(2, 10);
}

export function ActionsPanel() {
  const [prompts, setPrompts] = useState<QuickPrompt[]>([]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    db.quickPrompts.orderBy('createdAt').reverse().toArray().then(setPrompts);
  }, []);

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
    resetForm();
  };

  const handleSaveEdit = async () => {
    if (!editingId || !newTitle.trim() || !newPrompt.trim()) return;
    const existing = prompts.find((p) => p.id === editingId);
    if (!existing) return;
    const updated = { ...existing, title: newTitle.trim(), prompt: newPrompt.trim() };
    await db.quickPrompts.put(updated);
    setPrompts((prev) => prev.map((p) => (p.id === editingId ? updated : p)));
    resetForm();
  };

  const handleDelete = async (id: string) => {
    await db.quickPrompts.delete(id);
    setPrompts((prev) => prev.filter((p) => p.id !== id));
    setConfirmDeleteId(null);
  };

  const startEdit = (qp: QuickPrompt) => {
    setEditingId(qp.id);
    setNewTitle(qp.title);
    setNewPrompt(qp.prompt);
    setAdding(false);
  };

  const resetForm = () => {
    setAdding(false);
    setEditingId(null);
    setNewTitle('');
    setNewPrompt('');
  };

  const handleRun = (prompt: string) => {
    window.dispatchEvent(new CustomEvent('quickPromptSelected', { detail: prompt }));
  };

  const isFormOpen = adding || editingId !== null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {confirmDeleteId && (
        <ConfirmDialog
          message="Delete this action? This cannot be undone."
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      <div className="flex items-center justify-between px-5 py-3 align-middle flex-shrink-0 bg-white rounded-[10px] h-[40px] text-sm">
        <h3 className="text-[12px] font-semibold text-text-primary">Actions</h3>
        <button
          type="button"
          onClick={() => { setAdding((v) => !v); setEditingId(null); setNewTitle(''); setNewPrompt(''); }}
          className="flex items-center gap-1 text-xs text-brand font-medium hover:text-brand-dark transition-colors"
        >
          <Plus size={13} /> New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-0 py-3 space-y-2">
        {isFormOpen && (
          <div className="border border-brand/30 rounded-xl p-3 bg-highlight/30 space-y-2 mb-3">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Action title..."
              className="w-full text-sm border border-border rounded-lg px-3 py-1.5 outline-none focus:border-brand"
            />
            <textarea
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder="Prompt text..."
              rows={3}
              className="w-full text-sm border border-border rounded-lg px-3 py-1.5 outline-none focus:border-brand resize-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={editingId ? handleSaveEdit : handleAdd}
                disabled={!newTitle.trim() || !newPrompt.trim()}
                className="flex-1 bg-brand text-white rounded-lg py-1.5 text-xs font-semibold hover:bg-brand-dark transition-colors disabled:opacity-40"
              >
                Save
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1.5 border border-border rounded-lg text-xs text-text-secondary hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {prompts.length === 0 && !isFormOpen && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-10 h-10 rounded-full bg-highlight flex items-center justify-center mb-3">
              <Zap size={18} className="text-brand" />
            </div>
            <p className="text-sm font-medium text-text-primary mb-1">No actions yet</p>
            <p className="text-xs text-text-secondary">Create reusable prompts to speed up your workflow.</p>
          </div>
        )}

        {prompts.map((qp) => (
          editingId === qp.id ? null : (
            <div
              key={qp.id}
              className="group flex items-start gap-3 p-3 rounded-xl border border-border bg-white hover:border-brand/30 hover:bg-highlight/20 transition-colors cursor-pointer"
              onClick={() => handleRun(qp.prompt)}
            >
              <Zap size={14} className="text-brand flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary">{qp.title}</div>
                <div className="text-xs text-text-secondary truncate mt-0.5">{qp.prompt}</div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); startEdit(qp); }}
                  className="p-1 text-text-secondary hover:text-brand transition-colors"
                  title="Edit"
                >
                  <Pencil size={12} />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(qp.id); }}
                  className="p-1 text-text-secondary hover:text-red-500 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
