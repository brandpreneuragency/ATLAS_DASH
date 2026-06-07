import { useState, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { useTaskStore } from '../../stores/taskStore';
import { useTaskCommentStore } from '../../stores/taskCommentStore';
import { useUIStore } from '../../stores/uiStore';
import { TaskCommentThread } from './TaskCommentThread';
import { TaskCommentInput } from './TaskCommentInput';
import type { TaskComment, TaskStatus } from '../../types';

export function TaskDetailPanel() {
  const {
    getActiveTask,
    updateTask,
    deleteTask,
    createSubtask,
    getSubtasks,
  } = useTaskStore();
  const { loadComments, getComments } = useTaskCommentStore();
  const { showToast } = useUIStore();

  const task = getActiveTask();
  const [title, setTitle] = useState(task?.title ?? '');
  const titleRef = useRef(title);
  const taskRef = useRef(task);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const newSubtaskInputRef = useRef<HTMLInputElement>(null);
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState('');
  const editingSubtaskInputRef = useRef<HTMLInputElement>(null);
  const { subtasksOpen } = useUIStore();
  const [replyToComment, setReplyToComment] = useState<TaskComment | null>(null);
  const subtasks = task ? getSubtasks(task.id) : [];

  useEffect(() => {
    if (task) {
      loadComments(task.id);
      setTitle(task.title);
      titleRef.current = task.title;
      taskRef.current = task;
    }
  }, [task?.id, loadComments]);

  useEffect(() => {
    titleRef.current = title;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const trimmed = titleRef.current.trim();
      const currentTask = taskRef.current;
      if (trimmed && trimmed !== currentTask?.title) {
        updateTask(currentTask!.id, { title: trimmed });
      }
    }, 400);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [title, updateTask]);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [getComments(task?.id ?? '').length]);

  const cycleSubtaskStatus = (id: string, current: TaskStatus) => {
    const next: TaskStatus = current === 'in_progress' ? 'completed' : 'in_progress';
    updateTask(id, { status: next });
  };

  const handleNewSubtaskSubmit = async () => {
    const trimmed = newSubtaskTitle.trim();
    if (!trimmed || !task) return;

    setNewSubtaskTitle('');

    try {
      await createSubtask(task.id, trimmed);
    } catch (err) {
      setNewSubtaskTitle(trimmed);
      showToast(err instanceof Error ? err.message : 'Failed to add subtask.', 'error');
      return;
    }

    requestAnimationFrame(() => {
      newSubtaskInputRef.current?.focus();
    });
  };

  const handleNewSubtaskKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNewSubtaskSubmit();
    }
  };

  if (!task) {
    return (
      <div id="task-detail-panel" className="flex-col h-full items-center justify-center subtle" style={{ background: 'var(--c-background-1)' }}>
        <p className="txt-xs">Select a task from the sidebar</p>
      </div>
    );
  }

  const comments = getComments(task.id);

  return (
    <div id="task-detail-panel" className="flex-col h-full" style={{ background: 'var(--c-background-1)' }}>
      {subtasksOpen && (
        <div
          style={{
            background: 'var(--center-bg)',
            minHeight: subtasks.length === 0 ? '32px' : undefined,
            maxHeight: '40%',
            overflowY: 'auto',
            flexShrink: 1,
          }}
        >
          <div style={{ padding: '0 14px 0 14px', backgroundColor: 'var(--c-background-1)', borderRadius: '0' }}>
            <div className="col" style={{ gap: '10px', padding: '0 0 14px', backgroundColor: 'var(--c-background-1)', borderRadius: 0, borderBottom: '1px solid var(--c-border-1)' }}>
              {subtasks.map((sub) => (
                <div key={sub.id} className="row-xs items-center" style={{ gap: 8, height: 16, verticalAlign: 'middle' }}>
                  <button
                    onClick={() => cycleSubtaskStatus(sub.id, sub.status)}
                    className={`subtask-status-btn${sub.status === 'completed' ? ' subtask-status-btn--completed' : sub.status === 'in_progress' ? ' subtask-status-btn--active' : ''}`}
                  >
                    {sub.status === 'completed' && <Check size={12} style={{ color: '#fff' }} />}
                  </button>
                  {editingSubtaskId === sub.id ? (
                    <input
                      ref={editingSubtaskInputRef}
                      value={editingSubtaskTitle}
                      onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const trimmed = editingSubtaskTitle.trim();
                          if (trimmed && trimmed !== sub.title) {
                            updateTask(sub.id, { title: trimmed });
                          }
                          setEditingSubtaskId(null);
                        }
                        if (e.key === 'Escape') {
                          setEditingSubtaskId(null);
                        }
                        if (e.key === 'Backspace' && editingSubtaskTitle === '') {
                          e.preventDefault();
                          deleteTask(sub.id);
                          setEditingSubtaskId(null);
                        }
                      }}
                      onBlur={() => {
                        const trimmed = editingSubtaskTitle.trim();
                        if (trimmed && trimmed !== sub.title) {
                          updateTask(sub.id, { title: trimmed });
                        }
                        setEditingSubtaskId(null);
                      }}
                      aria-label="Edit subtask title"
                      className="flex-1 txt-xs bg-transparent outline-none"
                      style={{ border: 'none', padding: 0, height: '16px', verticalAlign: 'middle', color: 'var(--c-text-1)' }}
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSubtaskId(sub.id);
                        setEditingSubtaskTitle(sub.title);
                        requestAnimationFrame(() => editingSubtaskInputRef.current?.focus());
                      }}
                      className="txt-xs flex-1 subtask-title"
                      style={{
                        color: 'var(--c-text-3)',
                        textDecoration: sub.status === 'completed' ? 'line-through' : 'none',
                      }}
                      title="Click to edit"
                    >
                      {sub.title}
                    </button>
                  )}
                </div>
              ))}
              <div className="row-xs items-center" style={{ gap: 8 }}>
                <div className="subtask-status-add-indicator" />
                <input
                  ref={newSubtaskInputRef}
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={handleNewSubtaskKeyDown}
                  className="flex-1 txt-xs tt-primary bg-transparent outline-none"
                  style={{ border: 'none', padding: 0, height: '16px', verticalAlign: 'middle', color: 'var(--c-text-2)' }}
                  placeholder="Add another subtask..."
                />
                {newSubtaskTitle.trim() && (
                  <button
                    onClick={handleNewSubtaskSubmit}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-accent-center-panel)', display: 'flex', alignItems: 'center', padding: 0, flexShrink: 0, height: 12, width: 12 }}
                    title="Add subtask"
                  >
                    <Check size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task Chat Area - flex-1, fills remaining space */}
      <div id="tdc-thread" ref={threadRef} className="ai-scroll flex-1 overflow-y-a" style={{ padding: 0 }}>
        <TaskCommentThread comments={comments} onReplyComment={setReplyToComment} />
      </div>

      {/* Bottom Comment Input - fixed at bottom of panel */}
      <div style={{ background: 'var(--c-background-1)', height: '84px', flexShrink: 0, position: 'sticky', bottom: 0, zIndex: 2, padding: '12px 12px 0' }}>
        <TaskCommentInput replyToComment={replyToComment} onClearReply={() => setReplyToComment(null)} />
      </div>
    </div>
  );
}
