import { Plus, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkspaceStore } from '../../stores/workspaceStore';

export function FileTreeTabs() {
  const { t } = useTranslation();
  const {
    activeWorkspaceId,
    connectFolderInWorkspace,
  } = useWorkspaceStore();

  return (
    <div
      id="filetree-root-row"
      style={{
        display: 'flex',
        height: '56px',
        alignItems: 'center',
        marginBottom: '0px',
        marginLeft: '0px',
        marginRight: '0px',
        paddingTop: '0px',
        paddingBottom: '0px',
        paddingLeft: '0px',
        paddingRight: '8px',
        borderRadius: '8px 8px 0 0',
        backgroundColor: 'transparent',
        borderTop: 'none',
        borderRight: 'none',
        borderLeft: 'none',
        borderBottom: 'none',
      }}
    >
      <button
        type="button"
        onClick={() => { if (activeWorkspaceId) void connectFolderInWorkspace(activeWorkspaceId); }}
        title={t('explorer.openFolder')}
        className="tbar-btn"
      >
        <Plus size={14} />
      </button>
      <FolderDropdown />
    </div>
  );
}

/**
 * Custom dropdown for the active folder selector.
 *
 * Replaces the native <select> so the open menu can be styled
 * (padding, border, active-item background). Native <select>
 * popups are rendered by the OS and ignore most CSS.
 */
function FolderDropdown() {
  const { t } = useTranslation();
  const {
    activeWorkspaceId,
    getActiveConnectedFolders,
    getActiveFolderId,
    setActiveFolderInWorkspace,
  } = useWorkspaceStore();
  const connectedFolders = getActiveConnectedFolders();
  const activeFolderId = getActiveFolderId();
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const activeFolder = connectedFolders.find((f) => f.id === activeFolderId);
  const displayText = activeFolder?.rootNode?.name ?? t('explorer.noFoldersConnected');
  const hasItems = connectedFolders.length > 0;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  // Reset highlight when opening
  useEffect(() => {
    if (open) {
      const idx = connectedFolders.findIndex((f) => f.id === activeFolderId);
      setHighlightIndex(idx >= 0 ? idx : 0);
    }
  }, [open, activeFolderId, connectedFolders]);

  const select = (id: string) => {
    if (activeWorkspaceId) setActiveFolderInWorkspace(activeWorkspaceId, id);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1) % Math.max(connectedFolders.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) =>
        i <= 0 ? Math.max(connectedFolders.length - 1, 0) : i - 1,
      );
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const folder = connectedFolders[highlightIndex];
      if (folder) select(folder.id);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`folder-dropdown ${open ? 'is-open' : ''}`}
    >
      <button
        ref={triggerRef}
        type="button"
        className="folder-dropdown-trigger"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="folder-dropdown-label">{displayText}</span>
        <ChevronDown size={14} className="folder-dropdown-chevron" />
      </button>
      {open && (
        <div
          className="folder-dropdown-menu"
          role={hasItems ? 'listbox' : undefined}
          tabIndex={hasItems ? -1 : undefined}
          onKeyDown={hasItems ? onMenuKeyDown : undefined}
        >
          {!hasItems && (
            <div className="folder-dropdown-item is-empty">
              {t('explorer.noFoldersConnected')}
            </div>
          )}
          {connectedFolders.map((f, i) => {
            const isActive = f.id === activeFolderId;
            const isHighlighted = i === highlightIndex;
            return (
              <div
                key={f.id}
                role="option"
                aria-selected={isActive}
                className={`folder-dropdown-item ${isActive ? 'is-active' : ''} ${
                  isHighlighted ? 'is-highlighted' : ''
                }`}
                onMouseEnter={() => setHighlightIndex(i)}
                onClick={() => select(f.id)}
              >
                {f.rootNode?.name ?? 'Unnamed'}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
