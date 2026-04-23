import type React from 'react';
import { useState, useRef, useEffect } from 'react';
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
}

interface ContextMenu {
  x: number;
  y: number;
}

interface InlineInput {
  mode: 'rename' | 'new-file' | 'new-folder';
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, cb]);
}

export function TreeNode({ node, depth }: TreeNodeProps) {
  const { t } = useTranslation();
  const { expandedPaths, toggleExpandedPath, setExpandedPaths } = useUIStore();
  const { ensureChildrenLoaded, createFile, createDirectory, rename, remove, move } = useFileSystemStore();
  const { openFileAsDocument, renameDocumentBySourcePath, deleteDocumentsBySourcePaths, renameDocumentBySourcePath: moveDocumentPath } = useDocumentStore();

  const expanded = expandedPaths.includes(node.path);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [inlineInput, setInlineInput] = useState<InlineInput | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showKebab, setShowKebab] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const contextRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useClickOutside(contextRef, () => setContextMenu(null));

  useEffect(() => {
    if (inlineInput && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [inlineInput]);

  const getParentPath = (p: string) => {
    const idx = p.lastIndexOf('/');
    return idx === -1 ? p : p.slice(0, idx);
  };

  const handleClick = async () => {
    if (inlineInput?.mode === 'rename') return;
    if (node.kind === 'directory') {
      if (!expanded && node.children === undefined) {
        await ensureChildrenLoaded(node.path);
      }
      toggleExpandedPath(node.path);
    } else {
      await openFileAsDocument(node);
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
      if (node.children === undefined) await ensureChildrenLoaded(node.path);
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
      const result = await rename(node.path, val);
      if (result) {
        await renameDocumentBySourcePath(result.oldPath, result.newPath, val);
        // update expanded paths if it was a directory
        if (result.kind === 'directory') {
          const updated = expandedPaths
            .filter((p) => p !== result.oldPath && !p.startsWith(result.oldPath + '/'))
            .concat(expanded ? [result.newPath] : []);
          setExpandedPaths(updated);
        }
      }
    } else if (inlineInput.mode === 'new-file') {
      await createFile(node.path, val);
    } else if (inlineInput.mode === 'new-folder') {
      await createDirectory(node.path, val);
    }
  };

  const handleInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitInput();
    else if (e.key === 'Escape') setInlineInput(null);
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    const removedPaths = await remove(node.path);
    await deleteDocumentsBySourcePaths(removedPaths);
    // clean up expanded paths
    setExpandedPaths(expandedPaths.filter((p) => !removedPaths.includes(p) && !p.startsWith(node.path + '/')));
  };

  const parentPath = getParentPath(node.path);

  // ── Drag-and-drop handlers ──────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.path);
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
    if (!srcPath || srcPath === node.path) return;
    const result = await move(srcPath, node.path);
    if (result) {
      // Update any open document whose sourcePath was under the moved item
      for (const oldPath of result.oldPaths) {
        const newPath = result.newBasePath + oldPath.slice(srcPath.length);
        const name = oldPath.split('/').pop() ?? oldPath;
        await moveDocumentPath(oldPath, newPath, name);
      }
      // Auto-expand target folder
      if (!expandedPaths.includes(node.path)) toggleExpandedPath(node.path);
    }
  };

  return (
    <>
      <li
        data-tree-node
        tabIndex={0}
        className={`tree-node group relative flex items-center gap-1 h-7 rounded hover:bg-highlight/30 focus:bg-highlight/40 focus:outline-none cursor-default text-xs text-text-primary select-none${isDragOver ? ' outline outline-2 outline-brand bg-highlight/20' : ''}`}
        style={{ '--tree-depth': depth } as React.CSSProperties}
        draggable
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setShowKebab(true)}
        onMouseLeave={() => setShowKebab(false)}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {node.kind === 'directory' ? (
          <>
            <span className="flex-shrink-0 w-3.5 flex items-center justify-center text-text-secondary">
              {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </span>
            {expanded
              ? <FolderOpen size={13} className="text-yellow-500 flex-shrink-0" />
              : <Folder size={13} className="text-yellow-500 flex-shrink-0" />
            }
          </>
        ) : (
          <>
            <span className="flex-shrink-0 w-3.5" />
            <File size={13} className="text-text-secondary flex-shrink-0" />
          </>
        )}

        {inlineInput?.mode === 'rename' ? (
          <input
            ref={inputRef}
            title={t('explorer.rename')}
            placeholder={node.name}
            className="ml-1 flex-1 min-w-0 bg-white border border-brand rounded px-1 text-xs outline-none"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKey}
            onBlur={commitInput}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="truncate ml-1 flex-1 min-w-0">{node.name}</span>
        )}

        {/* Kebab button on hover */}
        {showKebab && !inlineInput && (
          <button
            type="button"
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-highlight/50 text-text-secondary mr-1"
            onClick={(e) => { e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY }); }}
            title="Options"
          >
            <MoreHorizontal size={11} />
          </button>
        )}
      </li>

      {/* Inline new-file / new-folder input rendered as a virtual child row */}
      {node.kind === 'directory' && expanded && inlineInput && inlineInput.mode !== 'rename' && (
        <li
          className="tree-node flex items-center gap-1 h-7 text-xs text-text-primary"
          style={{ '--tree-depth': depth + 1 } as React.CSSProperties}
        >
          <span className="flex-shrink-0 w-3.5" />
          {inlineInput.mode === 'new-file'
            ? <File size={13} className="text-text-secondary flex-shrink-0" />
            : <Folder size={13} className="text-yellow-500 flex-shrink-0" />
          }
          <input
            ref={inputRef}
            title={inlineInput.mode === 'new-file' ? t('explorer.newFileName') : t('explorer.newFolderName')}
            placeholder={inlineInput.mode === 'new-file' ? t('explorer.filenamePlaceholder') : t('explorer.folderPlaceholder')}
            className="ml-1 flex-1 min-w-0 bg-white border border-brand rounded px-1 text-xs outline-none"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKey}
            onBlur={commitInput}
          />
        </li>
      )}

      {node.kind === 'directory' && expanded && node.children && (
        node.children.map((child) => (
          <TreeNode key={child.path} node={child} depth={depth + 1} />
        ))
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextRef}
          className="fixed z-50 w-44 rounded-lg border border-border bg-white shadow-lg py-1"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {node.kind === 'directory' && (
            <>
              <button type="button" onClick={startNewFile}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-highlight/30">
                <FilePlus size={12} /> {t('explorer.newFile')}
              </button>
              <button type="button" onClick={startNewFolder}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-highlight/30">
                <FolderPlus size={12} /> {t('explorer.newFolder')}
              </button>
              <div className="my-1 border-t border-border" />
            </>
          )}
          <button type="button" onClick={startRename}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-highlight/30">
            <Pencil size={12} /> {t('explorer.rename')}
          </button>
          <button type="button" onClick={() => { setContextMenu(null); setConfirmDelete(true); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50">
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
