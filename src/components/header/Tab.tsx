import { useState, useRef, useEffect } from 'react';
import { FileText, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Document } from '../../types';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useFileSystemStore } from '../../stores/fileSystemStore';

type TipTapNode = { type?: string; text?: string; marks?: { type: string; attrs?: Record<string, unknown> }[]; attrs?: Record<string, unknown>; content?: TipTapNode[] };

function inlineText(node: TipTapNode, md = true): string {
  if (node.type === 'text') {
    let t = node.text ?? '';
    if (md && node.marks) {
      for (const m of node.marks) {
        if (m.type === 'bold')          t = `**${t}**`;
        else if (m.type === 'italic')   t = `*${t}*`;
        else if (m.type === 'strike')   t = `~~${t}~~`;
        else if (m.type === 'code')     t = `\`${t}\``;
        else if (m.type === 'link')     t = `[${t}](${m.attrs?.href ?? ''})`;
      }
    }
    return t;
  }
  return (node.content ?? []).map((c) => inlineText(c, md)).join('');
}

function blockToMd(node: TipTapNode, listIndex = { n: 0 }): string {
  switch (node.type) {
    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1;
      return `${'#'.repeat(level)} ${(node.content ?? []).map((c) => inlineText(c)).join('')}\n\n`;
    }
    case 'paragraph':
      return `${(node.content ?? []).map((c) => inlineText(c)).join('')}\n\n`;
    case 'blockquote':
      return (node.content ?? []).map((c) => `> ${blockToMd(c, listIndex).trimEnd()}`).join('\n') + '\n\n';
    case 'bulletList':
      return (node.content ?? []).map((c) => `- ${(c.content?.[0]?.content ?? []).map((x) => inlineText(x)).join('')}`).join('\n') + '\n\n';
    case 'orderedList': {
      let i = 1;
      return (node.content ?? []).map((c) => `${i++}. ${(c.content?.[0]?.content ?? []).map((x) => inlineText(x)).join('')}`).join('\n') + '\n\n';
    }
    case 'codeBlock':
      return `\`\`\`\n${(node.content ?? []).map((c) => c.text ?? '').join('')}\n\`\`\`\n\n`;
    default:
      return (node.content ?? []).map((c) => blockToMd(c, listIndex)).join('');
  }
}

function toMarkdown(jsonContent: string): string {
  try {
    const doc = JSON.parse(jsonContent) as TipTapNode;
    return (doc.content ?? []).map((n) => blockToMd(n)).join('').trim();
  } catch { return jsonContent; }
}

function toPlainText(jsonContent: string): string {
  try {
    const doc = JSON.parse(jsonContent) as TipTapNode;
    const parts: string[] = [];
    const walk = (n: TipTapNode) => {
      if (n.type === 'text') { parts.push(n.text ?? ''); return; }
      (n.content ?? []).forEach(walk);
      if (['paragraph','heading','listItem','blockquote','codeBlock'].includes(n.type ?? '')) parts.push('\n');
    };
    walk(doc);
    return parts.join('').trim();
  } catch { return jsonContent; }
}

interface TabProps {
  doc: Document;
  isActive: boolean;
  compressed?: boolean;
  onSelect: () => void;
  onClose: () => void;
  onRename: (newTitle: string) => void;
}

export function Tab({ doc, isActive, compressed = false, onSelect, onClose, onRename }: TabProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(doc.title);
  const [confirmClose, setConfirmClose] = useState(false);
  const { rootHandle } = useFileSystemStore();

  const handleSave = async () => {
    const base = doc.title || 'Untitled';

    if ('showSaveFilePicker' in window) {
      try {
        const opts: Parameters<typeof window.showSaveFilePicker>[0] = {
          suggestedName: `${base}.md`,
          types: [
            { description: t('tabs.markdownFile'), accept: { 'text/markdown': ['.md'] } },
            { description: t('tabs.textFile'),     accept: { 'text/plain':    ['.txt'] } },
          ],
        };
        if (rootHandle) (opts as Record<string, unknown>).startIn = rootHandle;
        const fileHandle = await window.showSaveFilePicker(opts);
        const ext = fileHandle.name.endsWith('.txt') ? 'txt' : 'md';
        const content = ext === 'md' ? toMarkdown(doc.content) : toPlainText(doc.content);
        const writable = await fileHandle.createWritable();
        await writable.write(new Blob([content], { type: 'text/plain;charset=utf-8' }));
        await writable.close();
        setConfirmClose(false);
        onClose();
      } catch (err: unknown) {
        if ((err as { name?: string })?.name !== 'AbortError') console.error(err);
      }
    } else {
      // Fallback: download as .md
      const content = toMarkdown(doc.content);
      const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${base}.md`;
      a.click();
      URL.revokeObjectURL(url);
      setConfirmClose(false);
      onClose();
    }
  };
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  const handleDoubleClick = () => {
    if (isActive) {
      setEditValue(doc.title);
      setIsEditing(true);
    }
  };

  const commitEdit = () => {
    if (editValue.trim() && editValue !== doc.title) {
      onRename(editValue.trim());
    }
    setIsEditing(false);
  };

  return (
    <div
      onClick={onSelect}
      onDoubleClick={handleDoubleClick}
      onMouseDown={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          const hasContent = doc.content?.includes('"text":');
          if (hasContent) { setConfirmClose(true); } else { onClose(); }
        }
      }}
      className={`
        group relative flex items-center gap-1.5 cursor-pointer
        border-[1px] border-solid border-[rgba(216,194,248,1)] [border-image:none] rounded-[10px] transition-all duration-150 select-none flex-shrink-0 mr-[5px]
        ${compressed ? 'px-2 w-[70px]' : 'px-3 w-[100px]'}
        ${isActive
          ? 'h-[36px] py-2 mt-[5px] mb-[5px] bg-[rgba(234,219,255,1)] z-10 text-text-primary'
          : 'h-[36px] py-1.5 mb-[5px] bg-transparent text-text-secondary hover:text-text-primary hover:bg-gray-50'
        }
      `}
    >
      <FileText size={13} className="flex-shrink-0 opacity-60" />

      {compressed && (
        <span className="text-xs font-medium truncate">{doc.title}</span>
      )}

      {!compressed && (
        <>
          {isEditing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') { setIsEditing(false); }
              }}
              onClick={(e) => e.stopPropagation()}
              title={t('tabs.renameTab')}
              placeholder={t('tabs.tabNamePlaceholder')}
              className="text-xs font-medium bg-transparent outline-none border-b border-brand w-24"
            />
          ) : (
            <span className="text-xs font-medium truncate">{doc.title}</span>
          )}

          <button
            type="button"
            title={t('tabs.closeTab')}
            onClick={(e) => {
              e.stopPropagation();
              // doc.content is TipTap JSON; presence of "text": means there's actual content
              const hasContent = doc.content?.includes('"text":');
              if (hasContent) { setConfirmClose(true); } else { onClose(); }
            }}
            className={`
              flex-shrink-0 w-4 h-4 flex items-center justify-center rounded
              hover:bg-gray-200 transition-colors ml-0.5
              ${isActive ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover:opacity-60'}
            `}
          >
            <X size={10} />
          </button>
        </>
      )}

      {confirmClose && (
        <ConfirmDialog
          message={t('tabs.closeConfirm')}
          onConfirm={() => { setConfirmClose(false); onClose(); }}
          onCancel={() => setConfirmClose(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
