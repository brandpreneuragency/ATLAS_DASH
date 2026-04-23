import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Editor } from '@tiptap/react';

interface LinkInsertProps {
  editor: Editor | null;
  onClose: () => void;
}

export function LinkInsert({ editor, onClose }: LinkInsertProps) {
  const existing = editor?.getAttributes('link').href ?? '';
  const [url, setUrl] = useState(existing);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const insert = () => {
    if (!editor) return;
    if (url.trim()) {
      editor.chain().focus().setLink({ href: url.trim() }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    onClose();
  };

  const remove = () => {
    editor?.chain().focus().unsetLink().run();
    onClose();
  };

  return (
    <div
      ref={containerRef}
      className="absolute top-full left-0 mt-1 z-50 bg-white border border-border rounded-lg shadow-lg w-72 p-3"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-text-secondary">Insert Link</span>
        <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
          <X size={14} />
        </button>
      </div>

      <div className="space-y-2">
        <input
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && insert()}
          placeholder="https://example.com"
          className="w-full text-sm border border-border rounded-md px-2 py-1.5 outline-none focus:border-brand"
        />
        <div className="flex gap-2">
          {existing && (
            <button
              onClick={remove}
              className="flex-1 text-xs font-medium border border-border rounded-md py-1.5 hover:bg-gray-50 transition-colors"
            >
              Remove
            </button>
          )}
          <button
            onClick={insert}
            disabled={!url.trim() && !existing}
            className="flex-1 text-xs font-medium bg-brand text-white rounded-md py-1.5 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {existing ? 'Update' : 'Insert'}
          </button>
        </div>
      </div>
    </div>
  );
}
