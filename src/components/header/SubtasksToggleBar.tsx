import { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, Folder } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useTaskStore } from '../../stores/taskStore';
import { useProjectStore } from '../../stores/projectStore';

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

export function SubtasksToggleBar() {
  const { taskMode, activeTaskId, subtasksOpen, setSubtasksOpen } = useUIStore();
  const storeActiveId = useTaskStore((s) => s.activeTaskId);
  const tasks = useTaskStore((s) => s.tasks);
  const updateTask = useTaskStore((s) => s.updateTask);

  const effectiveId = activeTaskId ?? storeActiveId;
  const activeTask = tasks.find((t) => t.id === effectiveId) ?? null;

  const [localTitle, setLocalTitle] = useState(activeTask?.title ?? '');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { projects } = useProjectStore();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const dateRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalTitle(activeTask?.title ?? '');
  }, [activeTask?.id, activeTask?.title]);

  useEffect(() => {
    if (isEditingTitle) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [isEditingTitle]);

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

  if (!taskMode) return null;

  const startEditingTitle = () => {
    setLocalTitle(activeTask?.title ?? '');
    setIsEditingTitle(true);
  };

  const commit = () => {
    if (!activeTask) return;
    const next = localTitle.trim();
    if (next !== activeTask.title) {
      updateTask(activeTask.id, { title: next });
    }
    setIsEditingTitle(false);
  };

  const cancelTitleEdit = () => {
    setLocalTitle(activeTask?.title ?? '');
    setIsEditingTitle(false);
  };

  return (
    <div
      className={`subtasks-toggle-bar${subtasksOpen ? ' subtasks-toggle-bar--on' : ''}`}
    >
      <button
        type="button"
        className="subtasks-toggle-btn"
        onClick={() => setSubtasksOpen(!subtasksOpen)}
        title={subtasksOpen ? 'Collapse subtasks' : 'Expand subtasks'}
        aria-label={subtasksOpen ? 'Collapse subtasks' : 'Expand subtasks'}
        aria-expanded={subtasksOpen ? 'true' : 'false'}
      >
        <ChevronDown
          size={14}
          style={{
            transform: subtasksOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        />
      </button>
      {isEditingTitle ? (
        <input
          ref={inputRef}
          type="text"
          className="subtasks-title-input"
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancelTitleEdit();
            }
          }}
          placeholder="Untitled task"
          aria-label="Task title"
          spellCheck={false}
        />
      ) : (
        <button
          type="button"
          className="subtasks-title-input"
          onClick={startEditingTitle}
          title="Click to rename"
        >
          {activeTask?.title || 'Untitled task'}
        </button>
      )}
      {activeTask && (
        <>
          <div ref={dateRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
            <button
              type="button"
              onClick={() => setShowDatePicker(!showDatePicker)}
              title={activeTask.date ? `Due: ${activeTask.date}` : 'Set due date'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, padding: 0,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: activeTask.date ? 'var(--c-accent)' : 'var(--c-text-2)',
                flexShrink: 0, borderRadius: 8,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--c-background-2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <Calendar size={14} />
            </button>
            {showDatePicker && (
              <div className="drop" style={{ position: 'absolute', top: '100%', right: 0, minWidth: 160, marginTop: 2, zIndex: 1000 }}>
                {dateOptions().map((opt) => (
                  <button
                    key={opt.value || '__empty__'}
                    type="button"
                    className="drop-item"
                    onClick={() => { updateTask(activeTask.id, { date: opt.value }); setShowDatePicker(false); }}
                    style={{ fontSize: 'var(--fs-11)' }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div ref={projectRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setShowProjectPicker(!showProjectPicker)}
              title={activeTask.projectId ? 'Change project' : 'Set project'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, padding: 0,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: activeTask.projectId ? 'var(--c-accent)' : 'var(--c-text-2)',
                flexShrink: 0, borderRadius: 8,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--c-background-2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <Folder size={14} />
            </button>
            {showProjectPicker && (
              <div className="drop" style={{ position: 'absolute', top: '100%', right: 0, minWidth: 160, marginTop: 2, zIndex: 1000 }}>
                <button
                  type="button"
                  className="drop-item"
                  onClick={() => { updateTask(activeTask.id, { projectId: null }); setShowProjectPicker(false); }}
                  style={{ fontSize: 'var(--fs-11)' }}
                >
                  No project
                </button>
                {projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="drop-item"
                    onClick={() => { updateTask(activeTask.id, { projectId: p.id }); setShowProjectPicker(false); }}
                    style={{ fontSize: 'var(--fs-11)' }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
