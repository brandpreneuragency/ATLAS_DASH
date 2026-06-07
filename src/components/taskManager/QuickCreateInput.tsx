import { useState, useRef, useEffect } from 'react';
import { Calendar, Folder } from 'lucide-react';
import {
  ComposerCard,
  ComposerIconButton,
  ComposerInput,
  ComposerLeft,
  ComposerRoot,
  ComposerRow,
  ComposerSendButton,
} from '../ui/Composer';
import { useTaskStore } from '../../stores/taskStore';
import { useProjectStore } from '../../stores/projectStore';
import { parseTaskInput } from '../../services/nlpParser';

interface QuickCreateInputProps {
  prefillText?: string | null;
  onClearPrefillText?: () => void;
}

export function QuickCreateInput({ prefillText, onClearPrefillText }: QuickCreateInputProps) {
  const [value, setValue] = useState('');
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [assignedDate, setAssignedDate] = useState<string | null>(null);
  const [assignedProject, setAssignedProject] = useState<string | null>(null);
  const { createTask } = useTaskStore();
  const { projects } = useProjectStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const parsed = value.trim() ? parseTaskInput(value) : null;

  const effectiveDate = parsed?.date ?? assignedDate ?? null;
  const effectiveProject = parsed?.projectName ?? assignedProject ?? null;

  const handleSend = async () => {
    const title = parsed?.title?.trim();
    if (!title && !effectiveDate && !effectiveProject) return;
    if (!title) return;
    const project = projects.find(
      (p) => p.name.toLowerCase() === effectiveProject?.toLowerCase()
    );
    await createTask(title, {
      date: effectiveDate ?? new Date().toISOString().slice(0, 10),
      importance: parsed?.importance ?? 'medium',
      projectId: project?.id ?? null,
    });
    setValue('');
    setAssignedDate(null);
    setAssignedProject(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (prefillText) {
      setValue((prev) => {
        if (!prev.trim()) return prefillText;
        return prev;
      });
      inputRef.current?.focus();
      if (onClearPrefillText) onClearPrefillText();
    }
  }, [prefillText, onClearPrefillText]);

  useEffect(() => {
    if (!showProjectPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (projectRef.current && !projectRef.current.contains(e.target as Node)) {
        setShowProjectPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showProjectPicker]);

  useEffect(() => {
    if (!showDatePicker) return;
    const handleClick = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDatePicker]);

  const handleDatePick = (dateStr: string) => {
    if (!dateStr) return;
    setAssignedDate(dateStr);
    setShowDatePicker(false);
    inputRef.current?.focus();
  };

  const handleProjectPick = (name: string) => {
    setAssignedProject(name);
    setShowProjectPicker(false);
    inputRef.current?.focus();
  };

  return (
    <div style={{ background: 'var(--c-background-2)', height: 84, padding: '12px 12px 0' }}>
      {/* Input bar */}
      <ComposerRoot id="task-quick-create" className="composer-root--clear">
        <ComposerCard>
          <ComposerRow>
            <ComposerLeft className="composer-left--fill">
              <div ref={projectRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <ComposerIconButton
                  onClick={() => setShowProjectPicker(!showProjectPicker)}
                  title={assignedProject ? `Project: ${assignedProject}` : 'Set project'}
                  style={{ color: assignedProject ? 'var(--c-accent)' : 'var(--c-text-2)' }}
                >
                  <Folder size={13} />
                </ComposerIconButton>
                {showProjectPicker && (
                  <div id="tqc-project-dropdown" className="drop" style={{ left: 0, bottom: '100%', minWidth: 120, marginBottom: 2 }}>
                    <button type="button" className="drop-item" onClick={() => handleProjectPick('')} style={{ fontSize: 'var(--fs-11)' }}>
                      No project
                    </button>
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="drop-item"
                        onClick={() => handleProjectPick(p.name)}
                        style={{ fontSize: 'var(--fs-11)' }}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div ref={datePickerRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <ComposerIconButton
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  title={assignedDate ? `Due: ${assignedDate}` : 'Set due date'}
                  style={{ color: assignedDate ? 'var(--c-accent)' : 'var(--c-text-2)' }}
                >
                  <Calendar size={13} />
                </ComposerIconButton>
                {showDatePicker && (
                  <div id="tqc-date-dropdown" className="drop" style={{ left: 0, bottom: '100%', minWidth: 140, marginBottom: 2 }}>
                    <button type="button" className="drop-item" onClick={() => handleDatePick('')} style={{ fontSize: 'var(--fs-11)' }}>
                      No date
                    </button>
                    {['Today', 'Tomorrow', 'Next week', 'Next month'].map((label) => (
                      <button
                        key={label}
                        type="button"
                        className="drop-item"
                        onClick={() => {
                          const d = new Date();
                          if (label === 'Tomorrow') d.setDate(d.getDate() + 1);
                          else if (label === 'Next week') d.setDate(d.getDate() + 7);
                          else if (label === 'Next month') d.setMonth(d.getMonth() + 1);
                          handleDatePick(d.toISOString().slice(0, 10));
                          setShowDatePicker(false);
                        }}
                        style={{ fontSize: 'var(--fs-11)' }}
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="drop-item"
                      onClick={() => {
                        if (dateInputRef.current?.showPicker) {
                          dateInputRef.current.showPicker();
                        } else {
                          dateInputRef.current?.click();
                        }
                        setShowDatePicker(false);
                      }}
                      style={{ fontSize: 'var(--fs-11)' }}
                    >
                      Custom...
                    </button>
                  </div>
                )}
                <input
                  ref={dateInputRef}
                  type="date"
                  onChange={(e) => { handleDatePick(e.target.value); setShowDatePicker(false); }}
                  style={{ position: 'absolute', left: 0, bottom: 0, width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
                />
              </div>
              <ComposerInput
                id="tqc-text-input"
                ref={inputRef}
                data-task-quick-create
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a task..."
              />
              <ComposerSendButton onClick={handleSend} disabled={!parsed?.title} title="Add task" />
            </ComposerLeft>
          </ComposerRow>
        </ComposerCard>
      </ComposerRoot>
    </div>
  );
}
