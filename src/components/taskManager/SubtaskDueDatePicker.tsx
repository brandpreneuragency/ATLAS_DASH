import { useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';
import { getTodayIso, getTomorrowIso } from '../../services/taskFormat';

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

function formatDateLabel(date: string): string {
  if (!date) return '';
  if (date === getTodayIso()) return 'Today';
  if (date === getTomorrowIso()) return 'Tomorrow';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface SubtaskDueDatePickerProps {
  date: string;
  onChange: (date: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  isCompleted?: boolean;
}

export function SubtaskDueDatePicker({
  date,
  onChange,
  isOpen,
  onToggle,
  onClose,
  isCompleted = false,
}: SubtaskDueDatePickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isOpen, onClose]);

  const hasDate = !!date?.trim();
  const label = formatDateLabel(date);

  return (
    <div ref={ref} className="subtask-due-date-field">
      <button
        type="button"
        className={`subtask-due-date-btn${hasDate ? ' subtask-due-date-btn--active' : ''}${isCompleted ? ' subtask-due-date-btn--completed' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        title={hasDate ? `Due: ${date}` : 'Set due date'}
        aria-label={hasDate ? `Due: ${label}` : 'Set due date'}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <Calendar size={10} />
        {hasDate && <span className="subtask-due-date-label">{label}</span>}
      </button>
      {isOpen && (
        <div
          className="drop subtask-due-date-drop"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {dateOptions().map((opt) => (
            <button
              key={opt.value || '__empty__'}
              type="button"
              className="drop-item"
              onClick={() => {
                onChange(opt.value);
                onClose();
              }}
              style={{ fontSize: 'var(--fs-base)' }}
            >
              {opt.label}
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
            }}
            style={{ fontSize: 'var(--fs-base)' }}
          >
            Custom...
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={date ?? ''}
            onChange={(e) => {
              onChange(e.target.value);
              onClose();
            }}
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
          />
        </div>
      )}
    </div>
  );
}
