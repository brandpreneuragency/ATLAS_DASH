import { useState, useRef, useEffect } from 'react';
import { X, Folder } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Workspace } from '../../types';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useWorkspaceStore } from '../../stores/workspaceStore';

interface WorkspaceTabProps {
  workspace: Workspace;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onRename: (newName: string) => void;
  charLimit: number;
  colorIndex?: number;
}

export function WorkspaceTab({ workspace, isActive, onSelect, onClose, onRename, charLimit }: WorkspaceTabProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(workspace.name);
  const [confirmClose, setConfirmClose] = useState(false);
  const saveCurrentFile = useWorkspaceStore((s) => s.saveCurrentFile);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  const handleDoubleClick = () => {
    if (isActive) {
      setEditValue(workspace.name);
      setIsEditing(true);
    }
  };

  const commitEdit = () => {
    if (editValue.trim() && editValue !== workspace.name) {
      onRename(editValue.trim());
    }
    setIsEditing(false);
  };

  const hasDirtyFile = !!workspace.currentFile?.isDirty;

  const handleSaveBeforeClose = async () => {
    if (workspace.currentFile?.isDirty) {
      await saveCurrentFile(workspace.id);
    }
    setConfirmClose(false);
    onClose();
  };

  return (
    <div
      id={`tab-ws-${isActive ? 'active' : 'passive'}-${workspace.id}`}
      onClick={onSelect}
      onDoubleClick={handleDoubleClick}
      onMouseDown={(e) => {
        e.stopPropagation();
        if (e.button === 1) {
          e.preventDefault();
          if (hasDirtyFile) { setConfirmClose(true); } else { onClose(); }
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
            title={t('tabs.renameTab') ?? 'Rename'}
            placeholder={t('tabs.tabNamePlaceholder') ?? 'Name'}
            className="txt-xs med bg-transparent outline-none w-24"
            style={{ borderBottom: '1px solid var(--c-accent-center-panel)' }}
          />
        ) : (
          <>
            <Folder size={12} className="mr-1 flex-shrink-0" />
            <span className="txt-xs med trunc">
              {(workspace.name ?? '').slice(0, charLimit)}{(workspace.name ?? '').length > charLimit ? '…' : ''}
            </span>
            {hasDirtyFile && (
              <span
                className="tab-dirty-dot"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--c-accent-center-panel)',
                  marginLeft: 4,
                  flexShrink: 0,
                }}
                title="Unsaved changes"
              />
            )}
          </>
        )}

        <button
          type="button"
          title={t('tabs.closeTab') ?? 'Close'}
          onClick={(e) => {
            e.stopPropagation();
            if (hasDirtyFile) { setConfirmClose(true); } else { onClose(); }
          }}
          className="tab-close"
        >
          <X size={12} />
        </button>
      </>

      {confirmClose && (
        <ConfirmDialog
          message={t('tabs.closeConfirm') ?? 'Close this workspace? Unsaved changes will be lost.'}
          onConfirm={() => {
            setConfirmClose(false);
            onClose();
          }}
          onCancel={() => setConfirmClose(false)}
          onSave={handleSaveBeforeClose}
        />
      )}
    </div>
  );
}
