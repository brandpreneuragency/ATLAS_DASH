import { useState, useEffect, useCallback } from 'react';
import { X, ChevronUp, ChevronDown, Replace } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { useUIStore } from '../../stores/uiStore';

interface FindReplaceProps {
  editor: Editor | null;
}

export function FindReplace({ editor }: FindReplaceProps) {
  const { findReplaceOpen, setFindReplaceOpen } = useUIStore();
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);

  const close = () => {
    setFindReplaceOpen(false);
    setFindText('');
    setReplaceText('');
  };

  const countMatches = useCallback(() => {
    if (!editor || !findText) { setMatchCount(0); return; }
    const text = editor.getText();
    const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = text.match(regex);
    setMatchCount(matches?.length ?? 0);
  }, [editor, findText]);

  useEffect(() => { countMatches(); }, [countMatches]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    if (findReplaceOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [findReplaceOpen]);

  const handleReplace = () => {
    if (!editor || !findText) return;
    const { state, dispatch } = editor.view;
    const text = state.doc.textContent;
    const idx = text.toLowerCase().indexOf(findText.toLowerCase());
    if (idx === -1) return;
    const tr = state.tr.replaceWith(
      idx + 1,
      idx + 1 + findText.length,
      state.schema.text(replaceText)
    );
    dispatch(tr);
    countMatches();
  };

  const handleReplaceAll = () => {
    if (!editor || !findText) return;
    const content = editor.getHTML();
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const replaced = content.replace(new RegExp(escaped, 'gi'), replaceText);
    editor.commands.setContent(replaced);
    setMatchCount(0);
  };

  if (!findReplaceOpen) return null;

  return (
    <div className="absolute top-0 left-[26px] z-40 bg-white border border-border rounded-lg shadow-lg p-3 w-80 dropdown-menu">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-text-secondary">Find & Replace</span>
        <button onClick={close} className="text-text-secondary hover:text-text-primary">
          <X size={14} />
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={findText}
            onChange={(e) => setFindText(e.target.value)}
            placeholder="Find..."
            className="flex-1 text-sm border border-border rounded-md px-2 py-1.5 outline-none focus:border-brand"
          />
          <span className="text-xs text-text-secondary whitespace-nowrap">
            {matchCount > 0 ? `${currentMatch + 1}/${matchCount}` : '0/0'}
          </span>
          <button
            onClick={() => setCurrentMatch((v) => Math.max(0, v - 1))}
            className="text-text-secondary hover:text-text-primary"
          >
            <ChevronUp size={14} />
          </button>
          <button
            onClick={() => setCurrentMatch((v) => Math.min(matchCount - 1, v + 1))}
            className="text-text-secondary hover:text-text-primary"
          >
            <ChevronDown size={14} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            placeholder="Replace with..."
            className="flex-1 text-sm border border-border rounded-md px-2 py-1.5 outline-none focus:border-brand"
          />
          <button
            onClick={handleReplace}
            className="text-xs text-brand font-medium hover:underline whitespace-nowrap"
          >
            Replace
          </button>
          <button
            onClick={handleReplaceAll}
            className="text-xs text-brand font-medium hover:underline whitespace-nowrap flex items-center gap-1"
          >
            <Replace size={12} />
            All
          </button>
        </div>
      </div>
    </div>
  );
}
