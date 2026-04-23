import { useState, useRef, useEffect } from 'react';
import { X, Link2, Upload } from 'lucide-react';
import type { Editor } from '@tiptap/react';

interface ImageInsertProps {
  editor: Editor | null;
  onClose: () => void;
}

export function ImageInsert({ editor, onClose }: ImageInsertProps) {
  const [tab, setTab] = useState<'url' | 'upload'>('url');
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  const insertUrl = () => {
    if (!editor || !url.trim()) return;
    editor.chain().focus().setImage({ src: url.trim() }).run();
    onClose();
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const insertUpload = () => {
    if (!editor || !preview) return;
    editor.chain().focus().setImage({ src: preview }).run();
    onClose();
  };

  return (
    <div
      ref={containerRef}
      className="absolute top-full left-0 mt-1 z-50 bg-white border border-border rounded-lg shadow-lg w-72"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <span className="text-xs font-semibold text-text-secondary">Insert Image</span>
        <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
          <X size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mx-3 mb-3">
        <button
          onClick={() => setTab('url')}
          className={`flex items-center gap-1 px-2 pb-1.5 text-xs font-medium transition-colors ${
            tab === 'url'
              ? 'text-brand border-b-2 border-brand'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <Link2 size={11} /> URL
        </button>
        <button
          onClick={() => setTab('upload')}
          className={`flex items-center gap-1 px-2 pb-1.5 text-xs font-medium transition-colors ${
            tab === 'upload'
              ? 'text-brand border-b-2 border-brand'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <Upload size={11} /> Upload
        </button>
      </div>

      <div className="px-3 pb-3 space-y-2">
        {tab === 'url' ? (
          <>
            <input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && insertUrl()}
              placeholder="https://example.com/image.png"
              className="w-full text-sm border border-border rounded-md px-2 py-1.5 outline-none focus:border-brand"
            />
            <button
              onClick={insertUrl}
              disabled={!url.trim()}
              className="w-full text-xs font-medium bg-brand text-white rounded-md py-1.5 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              Insert
            </button>
          </>
        ) : (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            {preview ? (
              <div className="space-y-2">
                <img src={preview} alt="preview" className="w-full max-h-32 object-contain rounded border border-border" />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                    className="flex-1 text-xs font-medium border border-border rounded-md py-1.5 hover:bg-gray-50 transition-colors"
                  >
                    Change
                  </button>
                  <button
                    onClick={insertUpload}
                    className="flex-1 text-xs font-medium bg-brand text-white rounded-md py-1.5 hover:opacity-90 transition-opacity"
                  >
                    Insert
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex flex-col items-center gap-1.5 py-5 border-2 border-dashed border-border rounded-md hover:border-brand hover:bg-brand/5 transition-colors"
              >
                <Upload size={18} className="text-text-secondary" />
                <span className="text-xs text-text-secondary">Click to choose a file</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
