import { useState, useEffect, useRef } from 'react';
import './taskDetail.css';
import { Check, Calendar, Folder, ChevronDown } from 'lucide-react';
import { useTaskStore } from '../../stores/taskStore';
import { useTaskCommentStore } from '../../stores/taskCommentStore';
import { useUIStore } from '../../stores/uiStore';
import { useProjectStore } from '../../stores/projectStore';
import { TaskCommentThread } from './TaskCommentThread';
import { TaskCommentInput } from './TaskCommentInput';
import type { TaskComment, TaskStatus } from '../../types';
import { useThemedPlaceholder } from '../../utils/placeholders';
import { TASK_TITLE_MAX_LENGTH } from '../../types';

function dateOptions() {
  const days: { label: string; value: string }[] = [{ label: 'No date', value: '' }];
  const today = new Date();
  const labels = ['Today', 'Tomorrow'];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const val = d.toISOString().slice(0, 10);
    const label = i < 2 ? labels[i] : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    days.push({ label, value: val });
  }
  return days;
}

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
  const addSubtaskPlaceholder = useThemedPlaceholder('addSubtask');

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
  const { subtasksOpen, setSubtasksOpen } = useUIStore();
  const { projects } = useProjectStore();
  const accentColor = 'var(--c-accent-2)';
  const activeProject = task ? projects.find((p) => p.id === task.projectId) ?? null : null;
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const dateRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!showDatePicker) return;
    const onDocClick = (e: MouseEvent) => {
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showDatePicker]);

  useEffect(() => {
    if (!showProjectPicker) return;
    const onDocClick = (e: MouseEvent) => {
      if (projectRef.current && !projectRef.current.contains(e.target as Node)) {
        setShowProjectPicker(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showProjectPicker]);

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
      <div id="task-detail-panel" className="flex-col h-full items-center justify-center subtle" style={{ background: 'rgba(233, 233, 233, 0)' }}>
        <p className="txt-xs">Select a task from the sidebar</p>
      </div>
    );
  }

  const comments = getComments(task.id);

  return (
    <div id="task-detail-panel" className="panel flex-col h-full" style={{ background: 'rgba(233, 233, 233, 0)' }}>
      {/* Task meta bar (date + project + details toggle) */}
      <div className="tdp-meta-bar">
        <div className="tdp-meta-bar-content" style={{ padding: '0 14px' }}>
          <div className="row-xs items-center" style={{ gap: 6, height: 'fit-content', verticalAlign: 'middle', marginBottom: 0, padding: '0 0 6px', borderRadius: 8, backgroundColor: 'transparent' }}>
              <div ref={dateRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 'fit-content', minHeight: '0px', padding: '6px 12px', border: '1px solid var(--c-background-2)', boxShadow: '0px 0px 12px 0px rgba(0, 0, 0, 0.05)' }}>
                <button
                  type="button"
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  title={task.date ? `Due: ${task.date}` : 'Set due date'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    height: 'fit-content', minHeight: '0px', padding: 0,
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: task.date ? accentColor : 'var(--c-text-2)',
                    flexShrink: 0, borderRadius: 8, width: 'fit-content',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0)'; }}
                >
                  <Calendar size={12} />
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'currentColor', whiteSpace: 'nowrap' }}>
                    {task.date ? task.date : 'No due date'}
                  </span>
                </button>
                {showDatePicker && (
                  <div className="drop" style={{ position: 'absolute', top: '100%', left: 0, minWidth: 160, marginTop: 2, zIndex: 1000 }}>
                    {dateOptions().map((opt) => (
                      <button
                        key={opt.value || '__empty__'}
                        type="button"
                        className="drop-item"
                        onClick={() => { updateTask(task.id, { date: opt.value }); setShowDatePicker(false); }}
                        style={{ fontSize: 'var(--fs-sm)' }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div ref={projectRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 'fit-content' }}>
                <button
                  type="button"
                  onClick={() => setShowProjectPicker(!showProjectPicker)}
                  title={task.projectId ? 'Change project' : 'Set project'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    height: 'fit-content', minHeight: '0px', padding: '6px 12px',
                    background: 'transparent', border: '1px solid var(--c-background-2)', cursor: 'pointer',
                    color: task.projectId ? accentColor : 'var(--c-text-2)',
                    flexShrink: 0, borderRadius: 8, width: 'fit-content',
                    boxShadow: '0px 0px 12px 0px rgba(0, 0, 0, 0.05)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <Folder size={14} />
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'currentColor', whiteSpace: 'nowrap' }}>
                    {activeProject ? activeProject.name : 'No project'}
                  </span>
                </button>
                {showProjectPicker && (
                  <div className="drop" style={{ position: 'absolute', top: '100%', left: 0, minWidth: 160, marginTop: 2, zIndex: 1000 }}>
                    <button
                      type="button"
                      className="drop-item"
                      onClick={() => { updateTask(task.id, { projectId: null }); setShowProjectPicker(false); }}
                      style={{ fontSize: 'var(--fs-sm)' }}
                    >
                      No project
                    </button>
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="drop-item"
                        onClick={() => { updateTask(task.id, { projectId: p.id }); setShowProjectPicker(false); }}
                        style={{ fontSize: 'var(--fs-sm)' }}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 'fit-content' }}>
                <button
                  type="button"
                  onClick={() => setSubtasksOpen(!subtasksOpen)}
                  title={subtasksOpen ? 'Collapse details' : 'Expand details'}
                  aria-label={subtasksOpen ? 'Collapse details' : 'Expand details'}
                  aria-expanded={subtasksOpen}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: 'fit-content', minHeight: '0px', padding: '6px 0',
                    background: 'transparent', border: '1px solid var(--c-background-2)', cursor: 'pointer',
                    color: 'var(--c-text-2)',
                    flexShrink: 0, borderRadius: 8, width: 'fit-content',
                    boxShadow: '0px 0px 12px 0px rgba(0, 0, 0, 0.05)',
                  }}
                >
                  <ChevronDown
                    size={12}
                    style={{
                      transform: subtasksOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                      height: 12,
                      width: 12,
                      padding: 0,
                    }}
                  />
                </button>
              </div>
            </div>
          </div>
      </div>

      {subtasksOpen && (
        <div
          className="tdp-subtasks-bar"
          style={{
            minHeight: subtasks.length === 0 ? '0px' : undefined,
          }}
        >
          <div style={{ padding: 0, backgroundColor: 'rgba(0, 0, 0, 0)', borderRadius: '0' }}>
            <div className="col" style={{ gap: '10px', padding: '18px 22px', backgroundColor: 'transparent', borderRadius: 8, height: 'fit-content', border: '1px solid var(--c-background-2)', boxShadow: 'var(--shadow-subtask-card)' }}>
              {subtasks.map((sub) => (
                <div key={sub.id} className="row-xs items-center" style={{ gap: 8, height: 16, verticalAlign: 'middle', marginLeft: 0, marginRight: 0 }}>
                  <button
                    onClick={() => cycleSubtaskStatus(sub.id, sub.status)}
                    className={`subtask-status-btn${sub.status === 'completed' ? ' subtask-status-btn--completed' : sub.status === 'in_progress' ? ' subtask-status-btn--active' : ''}`}
                  />
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
                      maxLength={TASK_TITLE_MAX_LENGTH}
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
                        textDecoration: sub.status === 'completed' ? 'line-through' : 'none',
                      }}
                      title="Click to edit"
                    >
                      {sub.title}
                    </button>
                  )}
                </div>
              ))}
              <div className="row-xs items-center" style={{ gap: 8, height: 'fit-content', lineHeight: 18 }}>
                <div className="subtask-status-add-indicator" />
                <input
                  ref={newSubtaskInputRef}
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={handleNewSubtaskKeyDown}
                  className="flex-1 txt-xs tt-primary bg-transparent outline-none"
                  style={{ border: 'none', padding: 0, height: '16px', verticalAlign: 'middle', color: 'var(--c-text-3)' }}
                  placeholder={addSubtaskPlaceholder}
                  maxLength={TASK_TITLE_MAX_LENGTH}
                />
                {newSubtaskTitle.trim() && (
                  <button
                    onClick={handleNewSubtaskSubmit}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-accent-center-panel)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0, height: 'fit-content', width: 'fit-content', minHeight: 'auto', minWidth: 'auto' }}
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
      <div id="tdc-thread" ref={threadRef} className="panel-body ai-scroll flex-1 overflow-y-a" style={{ padding: 0 }}>
        <TaskCommentThread comments={comments} onReplyComment={setReplyToComment} />
      </div>

      {/* Bottom Comment Input - fixed at bottom of panel */}
      <div className="tdp-comment-footer panel-footer">
        <TaskCommentInput replyToComment={replyToComment} onClearReply={() => setReplyToComment(null)} />
      </div>
    </div>
  );
}
