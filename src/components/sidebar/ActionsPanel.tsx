import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Zap, Pencil } from 'lucide-react';
import { db } from '../../services/db';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { QuickPrompt } from '../../types';

function shortId() {
  return Math.random().toString(36).slice(2, 10);
}

interface PromptItem extends QuickPrompt {
  builtin?: boolean;
}

interface ActionsPanelProps {
  scope: 'writer' | 'task';
}

const TASK_BUILT_INS: PromptItem[] = [
  {
    id: 'builtin_task_summarize',
    title: 'Summarize Task',
    prompt: 'Summarize this task with status, blockers, and next steps.',
    scope: 'task',
    createdAt: 0,
    builtin: true,
  },
  {
    id: 'builtin_task_subtasks',
    title: 'Create Subtasks',
    prompt: 'Create actionable subtasks from this task context.',
    scope: 'task',
    createdAt: 0,
    builtin: true,
  },
  {
    id: 'builtin_task_next_steps',
    title: 'Next Steps',
    prompt: 'List the next concrete steps in priority order.',
    scope: 'task',
    createdAt: 0,
    builtin: true,
  },
  {
    id: 'builtin_task_update_details',
    title: 'Update Details',
    prompt: 'Propose updates for title, notes, dates, and status based on this context.',
    scope: 'task',
    createdAt: 0,
    builtin: true,
  },
  {
    id: 'builtin_task_split',
    title: 'Split Into Tasks',
    prompt: 'Split this work into smaller tasks and subtasks with clear ownership.',
    scope: 'task',
    createdAt: 0,
    builtin: true,
  },
];

export function ActionsPanel({ scope }: ActionsPanelProps) {
  const [customPrompts, setCustomPrompts] = useState<QuickPrompt[]>([]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    db.quickPrompts
      .where('scope')
      .equals(scope)
      .reverse()
      .sortBy('createdAt')
      .then(setCustomPrompts);
  }, [scope]);

  const promptItems = useMemo<PromptItem[]>(() => {
    if (scope === 'task') {
      return [...TASK_BUILT_INS, ...customPrompts];
    }
    return customPrompts;
  }, [customPrompts, scope]);

  const handleAdd = async () => {
    if (!newTitle.trim() || !newPrompt.trim()) return;
    const prompt: QuickPrompt = {
      id: shortId(),
      title: newTitle.trim(),
      prompt: newPrompt.trim(),
      scope,
      createdAt: Date.now(),
    };
    await db.quickPrompts.put(prompt);
    setCustomPrompts((previous) => [prompt, ...previous]);
    resetForm();
  };

  const handleSaveEdit = async () => {
    if (!editingId || !newTitle.trim() || !newPrompt.trim()) return;
    const existing = customPrompts.find((prompt) => prompt.id === editingId);
    if (!existing) return;
    const updated = { ...existing, title: newTitle.trim(), prompt: newPrompt.trim() };
    await db.quickPrompts.put(updated);
    setCustomPrompts((previous) =>
      previous.map((prompt) => (prompt.id === editingId ? updated : prompt))
    );
    resetForm();
  };

  const handleDelete = async (id: string) => {
    await db.quickPrompts.delete(id);
    setCustomPrompts((previous) => previous.filter((prompt) => prompt.id !== id));
    setConfirmDeleteId(null);
  };

  const startEdit = (prompt: QuickPrompt) => {
    setEditingId(prompt.id);
    setNewTitle(prompt.title);
    setNewPrompt(prompt.prompt);
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
    <div className="flex-1 flex flex-col overflow-h">
      {confirmDeleteId && (
        <ConfirmDialog
          message="Delete this action? This cannot be undone."
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      <div
        className="shrink-0 row"
        style={{
          justifyContent: 'space-between',
          padding: '8px 12px',
          verticalAlign: 'middle',
          background: 'var(--c-background-3)',
          borderRadius: 10,
          height: 36,
          fontSize: 'var(--fs-sm)',
        }}
      >
        <h3 className="semibold" style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-1)' }}>
          Actions
        </h3>
        <button
          type="button"
          onClick={() => {
            setAdding((value) => !value);
            setEditingId(null);
            setNewTitle('');
            setNewPrompt('');
          }}
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

      <div className="flex-1 overflow-y-a" style={{ padding: '12px 0' }}>
        <div className="col" style={{ gap: 8 }}>
          {isFormOpen && (
            <div
              style={{
                border: '1px solid rgba(139,92,246,0.3)',
                borderRadius: 12,
                padding: 12,
                background: 'rgba(139,92,246,0.03)',
                marginBottom: 12,
              }}
            >
              <div className="col" style={{ gap: 8 }}>
                <input
                  autoFocus
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="Action title..."
                  className="ctrl"
                  style={{ fontSize: 'var(--fs-sm)' }}
                />
                <textarea
                  value={newPrompt}
                  onChange={(event) => setNewPrompt(event.target.value)}
                  placeholder="Prompt text..."
                  rows={3}
                  className="ctrl"
                  style={{ fontSize: 'var(--fs-sm)', resize: 'none' }}
                />
                <div className="row gap-2">
                  <button
                    type="button"
                    onClick={editingId ? handleSaveEdit : handleAdd}
                    disabled={!newTitle.trim() || !newPrompt.trim()}
                    className="btn-brand flex-1"
                    style={{ justifyContent: 'center', padding: '6px 0' }}
                  >
                    Save
                  </button>
                  <button type="button" onClick={resetForm} className="btn subtle" style={{ fontSize: 'var(--fs-xs)' }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {promptItems.length === 0 && !isFormOpen && (
            <div
              className="flex flex-col"
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 0',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'var(--c-background-4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}
              >
                <Zap size={18} style={{ color: 'var(--c-accent-center-panel)' }} />
              </div>
              <p className="med" style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-text-1)', marginBottom: 4 }}>
                No actions yet
              </p>
              <p className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
                Create reusable prompts to speed up your workflow.
              </p>
            </div>
          )}

          {promptItems.map((promptItem) =>
            editingId === promptItem.id ? null : (
              <div
                key={promptItem.id}
                className="row gap-3 c-ptr"
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid var(--c-border-1)',
                  background: 'var(--c-background-3)',
                  transition: 'border-color 0.15s, background-color 0.15s',
                }}
                onClick={() => handleRun(promptItem.prompt)}
                onMouseEnter={(event) => {
                  event.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)';
                  event.currentTarget.style.background = 'rgba(139,92,246,0.04)';
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.borderColor = 'var(--c-border-1)';
                  event.currentTarget.style.background = 'var(--c-background-3)';
                }}
              >
                <Zap size={14} className="shrink-0" style={{ color: 'var(--c-accent-center-panel)', marginTop: 2 }} />
                <div className="flex-1 min-w-0">
                  <div className="med" style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-text-1)' }}>
                    {promptItem.title}
                  </div>
                  <div className="subtle trunc" style={{ fontSize: 'var(--fs-xs)', marginTop: 2 }}>
                    {promptItem.prompt}
                  </div>
                </div>
                {promptItem.builtin ? (
                  <span className="subtle" style={{ fontSize: 'var(--fs-11)' }}>
                    built-in
                  </span>
                ) : (
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
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        startEdit(promptItem);
                      }}
                      className="btn-icon"
                      style={{ padding: 4 }}
                      title="Edit"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setConfirmDeleteId(promptItem.id);
                      }}
                      className="btn-icon"
                      style={{ padding: 4 }}
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
