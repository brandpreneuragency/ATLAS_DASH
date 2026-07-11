import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import {
  ComposerCard,
  ComposerTextarea,
  ComposerRoot,
  ComposerRow,
  ComposerSendButton,
} from '../ui/Composer';
import { useTaskStore } from '../../stores/taskStore';
import { useUIStore } from '../../stores/uiStore';
import { useThemedPlaceholder } from '../../utils/placeholders';
import { parseTaskInput } from '../../services/nlpParser';
import { getTodayIso, getTomorrowIso } from '../../services/taskFormat';
import { TASK_TITLE_MAX_LENGTH } from '../../types';
import './taskList.css';

interface SubtaskQuickCreateInputProps {
  parentTaskId: string;
}

export function SubtaskQuickCreateInput({ parentTaskId }: SubtaskQuickCreateInputProps) {
  const [value, setValue] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [assignedDate, setAssignedDate] = useState<string | null>(null);
  const { createSubtask, tasks } = useTaskStore();
  const { setSubtasksOpen } = useUIStore();
  const parentTask = tasks.find((t) => t.id === parentTaskId) ?? null;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const addSubtaskPlaceholder = useThemedPlaceholder('addSubtaskFooter');
  const parsed = value.trim() ? parseTaskInput(value) : null;

  const effectiveDate = assignedDate ?? null;
  const hasDateValue = !!effectiveDate?.trim();
  const dateButtonLabel = (() => {
    if (!effectiveDate) return 'Due date';
    if (effectiveDate === getTodayIso()) return 'Today';
    if (effectiveDate === getTomorrowIso()) return 'Tomorrow';
    const parsedDate = new Date(effectiveDate);
    if (Number.isNaN(parsedDate.getTime())) return effectiveDate;
    return parsedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  })();

  const handleDatePick = (dateStr: string) => {
    setAssignedDate(dateStr || null);
    setShowDatePicker(false);
    inputRef.current?.focus();
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newParsed = newValue.trim() ? parseTaskInput(newValue) : null;
    let cleaned = newValue;
    let changed = false;

    if (newParsed?.date && !assignedDate) {
      setAssignedDate(newParsed.date);
      if (newParsed.date === getTodayIso() && /\btoday\b/i.test(cleaned)) {
        cleaned = cleaned.replace(/\btoday\b/i, '');
      } else if (newParsed.date === getTomorrowIso() && /\btomorrow\b/i.test(cleaned)) {
        cleaned = cleaned.replace(/\btomorrow\b/i, '');
      } else if (/\d{4}-\d{2}-\d{2}/.test(cleaned)) {
        cleaned = cleaned.replace(/\d{4}-\d{2}-\d{2}/, '');
      }
      changed = true;
    }

    setValue(changed ? cleaned.replace(/\s+/g, ' ').trim() : newValue);
  };

  const handleSend = async () => {
    const title = parsed?.title?.trim();
    if (!title || !parentTask) return;
    const subtask = await createSubtask(parentTask.id, title, undefined, effectiveDate ?? parentTask.date);
    if (!subtask) return;
    setSubtasksOpen(true);
    setValue('');
    setAssignedDate(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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

  function DateDropdown() {
    if (!showDatePicker) return null;
    return (
      <div
        id="stqc-date-dropdown"
        className="drop"
        onMouseDown={(event) => event.stopPropagation()}
        style={{ left: 0, bottom: '100%', minWidth: 140, marginBottom: 2 }}
      >
        <button type="button" className="drop-item" onClick={() => handleDatePick('')} style={{ fontSize: 'var(--fs-base)' }}>
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
            }}
            style={{ fontSize: 'var(--fs-base)' }}
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
          style={{ fontSize: 'var(--fs-base)' }}
        >
          Custom...
        </button>
      </div>
    );
  }

  return (
    <div id="subtask-quick-create-wrapper" style={{ height: 'fit-content', width: '100%', padding: '0px', flexShrink: 0 }}>
      <ComposerRoot id="subtask-quick-create" className="composer-root--clear">
        <ComposerCard>
          {/* Row 1: Text field */}
          <ComposerRow>
            <ComposerTextarea
              id="stqc-text-input"
              ref={inputRef}
              data-subtask-quick-create
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={addSubtaskPlaceholder}
              rows={1}
              maxLength={TASK_TITLE_MAX_LENGTH}
            />
          </ComposerRow>

          {/* Row 2: Left dropup + right send button */}
          <ComposerRow className="task-quick-create-bottom-row">
            <div className="task-quick-create-actions" ref={datePickerRef}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="btn-icon task-quick-create-dropup-btn"
                  data-kind="date"
                  data-active={hasDateValue ? 'true' : 'false'}
                  title={hasDateValue ? `Due: ${dateButtonLabel}` : 'Set due date'}
                  aria-label={hasDateValue ? `Due: ${dateButtonLabel}` : 'Set due date'}
                  aria-haspopup="menu"
                  aria-expanded={showDatePicker}
                >
                  <Calendar size={12} className="task-quick-create-dropup-icon" />
                  <span className="trunc med task-quick-create-dropup-label">{dateButtonLabel}</span>
                  <ChevronDown size={12} className="task-quick-create-dropup-chevron" />
                </button>
                <DateDropdown />
                <input
                  ref={dateInputRef}
                  type="date"
                  onChange={(e) => { handleDatePick(e.target.value); setShowDatePicker(false); }}
                  style={{ position: 'absolute', left: 0, bottom: 0, width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
                />
              </div>
            </div>
            <div className="task-quick-create-send">
              <ComposerSendButton onClick={handleSend} disabled={!parsed?.title} title="Add subtask" />
            </div>
          </ComposerRow>
        </ComposerCard>
      </ComposerRoot>
    </div>
  );
}
