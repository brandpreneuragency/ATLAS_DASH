import type React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronRight, ChevronDown, Folder, FolderOpen, File,
  MoreHorizontal, FilePlus, FolderPlus, Pencil, Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../stores/uiStore';
import { useFileSystemStore, type TreeNode as TreeNodeType } from '../../stores/fileSystemStore';
import { useDocumentStore } from '../../stores/documentStore';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface TreeNodeProps {
  node: TreeNodeType;
  depth: number;
  searchActive?: boolean;
}

interface ContextMenu {
  x: number;
  y: number;
}

interface InlineInput {
  mode: 'rename' | 'new-file' | 'new-folder';
}

export function TreeNode({ node, depth, searchActive = false }: TreeNodeProps) {
  const { t } = useTranslation();
  const { expandedPaths, toggleExpandedPath, setExpandedPaths, setSelectedTreePath, selectedTreePath } = useUIStore();
  const { ensureChildrenLoaded, createFile, createDirectory, rename, remove, move } = useFileSystemStore();
  const { openFileFromTree, renameDocumentBySourcePath, deleteDocumentsBySourcePaths, renameDocumentBySourcePath: moveDocumentPath } = useDocumentStore();

  const expanded = (searchActive && node.kind === 'directory') || expandedPaths.includes(node.path);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [inlineInput, setInlineInput] = useState<InlineInput | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showKebab, setShowKebab] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const contextRef = useRef<HTMLDivElement>(null);
  const kebabRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    if (!contextMenu) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (contextRef.current?.contains(target)) return;
      if (kebabRef.current?.contains(target)) return;
      closeContextMenu();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu();
    };

    const id = window.setTimeout(() => {
      document.addEventListener('pointerdown', onPointerDown, true);
      document.addEventListener('keydown', onKeyDown);
    }, 0);

    return () => {
      window.clearTimeout(id);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [contextMenu, closeContextMenu]);

  useEffect(() => {
    if (inlineInput && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [inlineInput]);


  const handleClick = async () => {
    if (inlineInput?.mode === 'rename') return;
    if (node.kind === 'directory') {
      if (!expanded && node.children === undefined) {
        await ensureChildrenLoaded(node.fullPath);
      }
      toggleExpandedPath(node.path);
    }
    setSelectedTreePath(node.path);
    if (node.kind === 'file') {
      await openFileFromTree(node, false);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLLIElement>) => {
    if (inlineInput) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      await handleClick();
    } else if (e.key === 'F2') {
      e.preventDefault();
      startRename();
    } else if (e.key === 'Delete') {
      e.preventDefault();
      setConfirmDelete(true);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const allNodes = Array.from(
        document.querySelectorAll<HTMLLIElement>('[data-tree-node]')
      );
      const idx = allNodes.indexOf(e.currentTarget);
      const next = e.key === 'ArrowDown' ? allNodes[idx + 1] : allNodes[idx - 1];
      next?.focus();
    } else if (e.key === 'ArrowRight' && node.kind === 'directory' && !expanded) {
      e.preventDefault();
      if (node.children === undefined) await ensureChildrenLoaded(node.fullPath);
      toggleExpandedPath(node.path);
    } else if (e.key === 'ArrowLeft' && node.kind === 'directory' && expanded) {
      e.preventDefault();
      toggleExpandedPath(node.path);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const startRename = () => {
    setContextMenu(null);
    setInlineInput({ mode: 'rename' });
    setInputValue(node.name);
  };

  const startNewFile = () => {
    setContextMenu(null);
    // expand directory first if not expanded
    if (!expanded) toggleExpandedPath(node.path);
    setInlineInput({ mode: 'new-file' });
    setInputValue('');
  };

  const startNewFolder = () => {
    setContextMenu(null);
    if (!expanded) toggleExpandedPath(node.path);
    setInlineInput({ mode: 'new-folder' });
    setInputValue('');
  };

  const commitInput = async () => {
    if (!inlineInput) return;
    const val = inputValue.trim();
    setInlineInput(null);

    if (!val) return;

    if (inlineInput.mode === 'rename') {
      if (val === node.name) return;
      const oldDisplayPath = node.path;
      const result = await rename(node.fullPath, val);
      if (result) {
        await renameDocumentBySourcePath(result.oldPath, result.newPath, val);
        // update expanded paths if it was a directory
        if (result.kind === 'directory') {
          const parentDisplay = oldDisplayPath.includes('/')
            ? oldDisplayPath.substring(0, oldDisplayPath.lastIndexOf('/'))
            : '';
          const newDisplayPath = parentDisplay
            ? `${parentDisplay}/${val}`
            : val;
          const updated = expandedPaths
            .filter((p) => p !== oldDisplayPath && !p.startsWith(oldDisplayPath + '/'))
            .concat(expanded ? [newDisplayPath] : []);
          setExpandedPaths(updated);
        }
      }
    } else if (inlineInput.mode === 'new-file') {
      await createFile(node.fullPath, val);
    } else if (inlineInput.mode === 'new-folder') {
      await createDirectory(node.fullPath, val);
    }
  };

  const handleInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitInput();
    else if (e.key === 'Escape') setInlineInput(null);
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    const removedPaths = await remove(node.fullPath);
    await deleteDocumentsBySourcePaths(removedPaths);
    // clean up expanded paths (expandedPaths uses display paths)
    const ownDisplayPath = node.path;
    setExpandedPaths(expandedPaths.filter(
      (p) => p !== ownDisplayPath && !p.startsWith(ownDisplayPath + '/')
    ));
  };

  // ── Drag-and-drop handlers ──────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.fullPath);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (node.kind !== 'directory') return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (node.kind !== 'directory') return;
    const srcPath = e.dataTransfer.getData('text/plain');
    if (!srcPath || srcPath === node.fullPath) return;
    const result = await move(srcPath, node.fullPath);
    if (result) {
      // Update any open document whose sourcePath was under the moved item
      for (const oldPath of result.oldPaths) {
        const newPath = result.newBasePath + oldPath.slice(srcPath.length);
        const name = oldPath.split('/').pop() ?? oldPath;
        await moveDocumentPath(oldPath, newPath, name);
      }
      // Auto-expand target folder (expandedPaths uses display paths)
      if (!expandedPaths.includes(node.path)) toggleExpandedPath(node.path);
    }
  };

  return (
    <>
      <li
        data-tree-node
        tabIndex={0}
        className={`tree-node group relative select-none${isDragOver ? '' : ''}`}
        style={{
          '--tree-depth': depth,
          ...(depth === 0 && node.kind === 'directory' ? {} : { minHeight: 32 }),
          ...(depth === 0
            ? {
                borderRadius: 8,
                paddingLeft: 0,
                paddingRight: 0,
                paddingTop: 6,
                paddingBottom: 6,
              }
            : {
                borderRadius: 0,
                padding: 0,
              }),
          backgroundColor:
            selectedTreePath === node.path || (node.kind === 'directory' && expanded)
              ? 'var(--c-background-2)'
              : 'transparent',
          fontSize: 'var(--fs-xs)',
          color: 'var(--c-text-1)',
          cursor: 'default',
          ...(isDragOver ? { outline: '2px solid var(--c-accent-center-panel)', outlineOffset: -2 } : {}),
        } as React.CSSProperties}
        draggable
        onKeyDown={handleKeyDown}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setShowKebab(true)}
        onMouseLeave={() => setShowKebab(false)}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Row content */}
        <div className="row-xs" style={{
          height: 32,
          paddingLeft: 6,
        }}
          onClick={handleClick}
          onAuxClick={(e) => { if (node.kind === 'file') { e.preventDefault(); openFileFromTree(node, true); } }}
        >
          {node.kind === 'directory' ? (
            <>
              <span className="shrink-0 subtle" style={{ width: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              </span>
              {expanded
                ? <FolderOpen size={13} className="shrink-0" style={{ color: selectedTreePath === node.path ? 'var(--c-accent-1)' : 'var(--c-text-2)' }} />
                : <Folder size={13} className="shrink-0" style={{ color: selectedTreePath === node.path ? 'var(--c-accent-1)' : 'var(--c-text-2)' }} />
              }
            </>
          ) : (
            <>
              <span className="shrink-0" style={{ width: 14 }} />
              <File size={13} className="shrink-0" style={{ color: selectedTreePath === node.path ? 'var(--c-accent-1)' : 'var(--c-text-2)' }} />
            </>
          )}

          {inlineInput?.mode === 'rename' ? (
            <input
              ref={inputRef}
              title={t('explorer.rename')}
              placeholder={node.name}
              className="ctrl-xs flex-1 min-w-0"
              style={{ marginLeft: 4, borderColor: 'var(--c-accent-center-panel)' }}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleInputKey}
              onBlur={commitInput}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="trunc flex-1 min-w-0" style={{
              marginLeft: 4,
              fontWeight: 500,
              color: selectedTreePath === node.path ? 'var(--c-accent-1)' : 'var(--c-text-2)'
            }}>{node.name}</span>
          )}

          {/* Inline new-file / new-folder / kebab buttons on hover */}
          {showKebab && !inlineInput && (
            <>
              {node.kind === 'directory' && (
                <>
                  <button
                    type="button"
                    className="btn-icon"
                    style={{ width: 'var(--control-height-sm)', height: 'var(--control-height-sm)' }}
                    onClick={(e) => { e.stopPropagation(); startNewFile(); }}
                    title={t('explorer.newFile')}
                    aria-label={t('explorer.newFile')}
                  >
                    <FilePlus size={11} />
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    style={{ width: 'var(--control-height-sm)', height: 'var(--control-height-sm)' }}
                    onClick={(e) => { e.stopPropagation(); startNewFolder(); }}
                    title={t('explorer.newFolder')}
                    aria-label={t('explorer.newFolder')}
                  >
                    <FolderPlus size={11} />
                  </button>
                </>
              )}
              <button
                ref={kebabRef}
                type="button"
                className="btn-icon"
                style={{ width: 'var(--control-height-sm)', height: 'var(--control-height-sm)', marginRight: 4 }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (contextMenu) {
                    closeContextMenu();
                  } else {
                    setContextMenu({ x: e.clientX, y: e.clientY });
                  }
                }}
                title="Options"
                aria-label="Options"
              >
                <MoreHorizontal size={11} />
              </button>
            </>
          )}
        </div>

        {/* Nested children container */}
        {node.kind === 'directory' && expanded && (
          <ul className="tree-children" style={{ listStyle: 'none', paddingLeft: 6, paddingRight: 6, margin: 0 }}>
            {/* Inline new-file / new-folder input */}
            {inlineInput && inlineInput.mode !== 'rename' && (
              <li
                className="tree-node row-xs"
                style={{
                  '--tree-depth': depth + 1, height: 32, fontSize: 'var(--fs-xs)',
                  color: 'var(--c-text-1)',
                } as React.CSSProperties}
              >
                <span className="shrink-0" style={{ width: 14 }} />
                {inlineInput.mode === 'new-file'
                  ? <File size={13} className="shrink-0 subtle" />
                  : <Folder size={13} className="shrink-0" style={{ color: 'var(--c-text-2)' }} />
                }
                <input
                  ref={inputRef}
                  title={inlineInput.mode === 'new-file' ? t('explorer.newFileName') : t('explorer.newFolderName')}
                  placeholder={inlineInput.mode === 'new-file' ? t('explorer.filenamePlaceholder') : t('explorer.folderPlaceholder')}
                  className="ctrl-xs flex-1 min-w-0"
                  style={{ marginLeft: 4, marginRight: 12, borderColor: 'var(--c-accent-center-panel)' }}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleInputKey}
                  onBlur={commitInput}
                />
              </li>
            )}
            {node.children && node.children.map((child) => (
              <TreeNode key={child.fullPath} node={child} depth={depth + 1} searchActive={searchActive} />
            ))}
          </ul>
        )}
      </li>

      {/* Context menu (rename and delete only) */}
      {contextMenu && (
        <div
          ref={contextRef}
          className="drop"
          style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, minWidth: 160 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" onClick={startRename}
            className="drop-item">
            <Pencil size={12} /> {t('explorer.rename')}
          </button>
          <button type="button" onClick={() => { setContextMenu(null); setConfirmDelete(true); }}
            className="drop-item" style={{ color: '#EF4444' }}>
            <Trash2 size={12} /> {t('explorer.delete')}
          </button>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={`${t('explorer.delete')} "${node.name}"${node.kind === 'directory' ? ' and all its contents' : ''}?`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}
