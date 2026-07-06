import { useState, useEffect, useRef } from 'react';
import { Calendar, Folder } from 'lucide-react';
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

export function TaskMetadataControls() {
  const { activeTaskId } = useUIStore();
  const storeActiveId = useTaskStore((s) => s.activeTaskId);
  const tasks = useTaskStore((s) => s.tasks);
  const updateTask = useTaskStore((s) => s.updateTask);
  const { projects } = useProjectStore();

  const effectiveId = activeTaskId ?? storeActiveId;
  const activeTask = tasks.find((t) => t.id === effectiveId) ?? null;
  const activeProject = activeTask ? projects.find((p) => p.id === activeTask.projectId) ?? null : null;

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const dateRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="tdp-meta-controls row-xs items-center justify-start">
      <div ref={dateRef} className="tdp-meta-field">
        <button
          type="button"
          className="tdp-meta-field-btn"
          onClick={() => setShowDatePicker(!showDatePicker)}
          title={activeTask?.date ? `Due: ${activeTask.date}` : 'Set due date'}
          disabled={!activeTask}
          style={{ color: activeTask?.date ? 'var(--c-text-1)' : 'var(--c-text-2)' }}
        >
          <Calendar size={12} />
          <span className="tdp-meta-field-label">
            {activeTask?.date ? activeTask.date : 'No due date'}
          </span>
        </button>
        {showDatePicker && activeTask && (
          <div className="drop" style={{ position: 'absolute', top: '100%', left: 0, minWidth: 160, marginTop: 2, zIndex: 1000 }}>
            {dateOptions().map((opt) => (
              <button
                key={opt.value || '__empty__'}
                type="button"
                className="drop-item"
                onClick={() => { updateTask(activeTask.id, { date: opt.value }); setShowDatePicker(false); }}
                style={{ fontSize: 'var(--fs-sm)' }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div ref={projectRef} className="tdp-meta-field">
        <button
          type="button"
          className="tdp-meta-field-btn"
          onClick={() => setShowProjectPicker(!showProjectPicker)}
          title={activeTask?.projectId ? 'Change project' : 'Set project'}
          disabled={!activeTask}
          style={{ color: activeTask?.projectId ? 'var(--c-text-1)' : 'var(--c-text-2)' }}
        >
          <Folder size={12} />
          <span className="tdp-meta-field-label">
            {activeProject ? activeProject.name : 'No project'}
          </span>
        </button>
        {showProjectPicker && activeTask && (
          <div className="drop" style={{ position: 'absolute', top: '100%', left: 0, minWidth: 160, marginTop: 2, zIndex: 1000 }}>
            <button
              type="button"
              className="drop-item"
              onClick={() => { updateTask(activeTask.id, { projectId: null }); setShowProjectPicker(false); }}
              style={{ fontSize: 'var(--fs-sm)' }}
            >
              No project
            </button>
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                className="drop-item"
                onClick={() => { updateTask(activeTask.id, { projectId: p.id }); setShowProjectPicker(false); }}
                style={{ fontSize: 'var(--fs-sm)' }}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
