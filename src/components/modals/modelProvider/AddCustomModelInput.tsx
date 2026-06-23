import { useState, useRef } from 'react';
import { Plus } from 'lucide-react';

interface AddCustomModelInputProps {
  onAdd: (slug: string) => void;
  existingIds: string[];
}

export function AddCustomModelInput({ onAdd, existingIds }: AddCustomModelInputProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const slug = value.trim();
    if (!slug) {
      setError('Model ID is required');
      return;
    }
    if (existingIds.includes(slug)) {
      setError('This model ID already exists');
      return;
    }
    setValue('');
    setError(null);
    onAdd(slug);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <div className="col gap-1" style={{ padding: '8px 12px' }}>
      <div className="row gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
          placeholder="Add custom model"
          className="ctrl ctrl--mono flex-1"
          style={{ fontSize: 'var(--fs-xs)', height: 32, padding: '4px 10px', backgroundColor: 'transparent' }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!value.trim()}
          aria-label="Add custom model"
          className="btn-icon"
          style={{
            width: 32,
            height: 32,
            border: '1px solid var(--c-border-1)',
            borderRadius: 8,
            opacity: value.trim() ? 1 : 0.4,
          }}
        >
          <Plus size={14} />
        </button>
      </div>
      {error && (
        <span className="subtle" style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-danger)' }}>{error}</span>
      )}
    </div>
  );
}
