import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const dropRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!isOpen || !ref.current) {
      setPos(null);
      return;
    }

    const updatePos = () => {
      if (!ref.current) return;
      const anchor = ref.current.getBoundingClientRect();
      const dropWidth = dropRef.current?.offsetWidth ?? 140;
      const dropHeight = dropRef.current?.offsetHeight ?? 0;
      let top = anchor.bottom + 2;
      let left = anchor.right - dropWidth;
      if (left < 8) left = 8;
      if (left + dropWidth > window.innerWidth - 8) {
        left = window.innerWidth - dropWidth - 8;
      }
      if (dropHeight > 0 && top + dropHeight > window.innerHeight - 8) {
        top = Math.max(8, anchor.top - dropHeight - 2);
      }
      setPos({ top, left });
    };

    updatePos();
    window.addEventListener('resize', updatePos);
    // Capture scroll from nested panels (subtasks / comments) so the menu stays anchored.
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (dropRef.current?.contains(target)) return;
      onClose();
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
      {isOpen &&
        createPortal(
          <div
            ref={dropRef}
            className="drop subtask-due-date-drop"
            style={
              pos
                ? { position: 'fixed', top: pos.top, left: pos.left, right: 'auto' }
                : { position: 'fixed', top: 0, left: 0, right: 'auto', visibility: 'hidden' }
            }
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
          </div>,
          document.body
        )}
    </div>
  );
}
