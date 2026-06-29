import { useRef, useState } from 'react';
import { Send } from 'lucide-react';

interface CRMNoteInputProps {
  /** Called when the user submits a non-empty note. */
  onSubmit: (body: string) => void | Promise<void>;
  placeholder?: string;
  /** Disabled state (e.g. while sending). */
  busy?: boolean;
}

/**
 * Bottom note/comment input mirroring TaskCommentInput styling (composer-like
 * card, textarea grows, send button bottom-right). Scoped to `crm-note-input-*`.
 */
export function CRMNoteInput({ onSubmit, placeholder = 'Add a note…', busy }: CRMNoteInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInput = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(Math.max(ta.scrollHeight, 40), 180)}px`;
  };

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    try {
      await onSubmit(trimmed);
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch {
      // Keep the text so the user can retry; the store surfaces the toast.
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="crm-note-input">
      <div className="crm-note-input-card">
        <textarea
          ref={textareaRef}
          className="crm-note-input-textarea"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={busy}
        />
        <div className="crm-note-input-row">
          <span className="crm-note-input-hint subtle">⌘/Ctrl + Enter to save</span>
          <button
            type="button"
            className="crm-note-input-send"
            onClick={() => void submit()}
            disabled={busy || !text.trim()}
            title="Save note"
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
