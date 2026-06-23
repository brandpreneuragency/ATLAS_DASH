import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Document } from '../../types';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useFileSystemStore } from '../../stores/fileSystemStore';
import { useDocumentStore } from '../../stores/documentStore';
import { serialize } from '../../services/fileFormat';
import { getDocumentTabMeta } from './DocumentTabDropdownItem';
import { writeTextFile, pickSaveTabsPath, getExt, joinPath } from '../../services/fs-adapter';

interface TabProps {
  doc: Document;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onRename: (newTitle: string) => void;
  charLimit: number;
  colorIndex?: number;
}

export function Tab({ doc, isActive, onSelect, onClose, onRename, charLimit }: TabProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(doc.title);
  const [confirmClose, setConfirmClose] = useState(false);
  const { rootNode } = useFileSystemStore();
  const { updateDocument } = useDocumentStore();

  const handleSave = async () => {
    const editorJson = (() => {
      try { return JSON.parse(doc.content) as object; } catch { return { type: 'doc', content: [] }; }
    })();

    // CASE 1: file already has a path (opened from tree or saved before)
    if (doc.sourcePath) {
      const ext = getExt(doc.sourcePath) || 'md';
      try {
        await writeTextFile(doc.sourcePath, serialize(editorJson, ext));
        await updateDocument(doc.id, { isDirty: false });
        setConfirmClose(false);
        onClose();
      } catch (err) {
        console.warn('[Close Save] disk write failed:', err);
      }
      return;
    }

    // CASE 2: new/unsaved file -> show save dialog
    const base = doc.title || 'Untitled';
    const filters = [
      { name: t('tabs.markdownFile'), extensions: ['md'] },
      { name: t('tabs.textFile'), extensions: ['txt'] },
    ];
    const suggestedName = `${base}.md`;
    const defaultDir = rootNode?.fullPath;
    try {
      const newPath = await pickSaveTabsPath(
        suggestedName,
        filters,
        defaultDir ? joinPath(defaultDir, suggestedName) : suggestedName
      );
      if (!newPath) return;
      const ext = getExt(newPath) || 'md';
      await writeTextFile(newPath, serialize(editorJson, ext));
      setConfirmClose(false);
      onClose();
    } catch (err) {
      console.error(err);
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

  const isEmpty = !doc.content?.includes('"text":');
  const isCleanFile = !!doc.sourcePath && !doc.isDirty;
  const isReplaceable = isEmpty || isCleanFile;
  const { hasEdits } = getDocumentTabMeta(doc);

  return (
    <div
      id={`tab-doc-${isActive ? 'active' : 'passive'}-${doc.id}`}
      onClick={onSelect}
      onDoubleClick={handleDoubleClick}
      onMouseDown={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          if (hasEdits) { setConfirmClose(true); } else { onClose(); }
        }
      }}
      className={`group relative justify-start min-w-0 pl-3 pr-1 ${isActive ? 'tab-active' : 'tab-passive'}`}
    >
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
            className="txt-xs med bg-transparent outline-none w-24" style={{ borderBottom: '1px solid var(--c-accent-center-panel)' }}
          />
        ) : (
          <span className={`txt-xs med trunc${isReplaceable ? ' italic' : ''}`}>
            {(doc.title ?? '').slice(0, charLimit)}{(doc.title ?? '').length > charLimit ? '…' : ''}
          </span>
        )}

        <button
          type="button"
          title={t('tabs.closeTab')}
          onClick={(e) => {
            e.stopPropagation();
            if (hasEdits) { setConfirmClose(true); } else { onClose(); }
          }}
          className="tab-close"
        >
          <X size={12} />
        </button>
      </>

      {confirmClose && (
        <ConfirmDialog
          message={t('tabs.closeConfirm')}
          onConfirm={() => { 
            console.log('[Tab] onConfirm called for doc:', doc.id);
            setConfirmClose(false); 
            console.log('[Tab] calling onClose');
            onClose(); 
            console.log('[Tab] onClose completed');
          }}
          onCancel={() => setConfirmClose(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
