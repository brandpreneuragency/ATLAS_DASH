import { useState, useRef, useEffect } from 'react';
import type React from 'react';
import { FolderOpen, MoreHorizontal, RefreshCw, FolderX, PlugZap, Plus, FilePlus, FolderPlus, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFileSystemStore } from '../../stores/fileSystemStore';
import { useUIStore } from '../../stores/uiStore';
// import { FileExplorerToggle } from '../header/FileExplorerToggle';
import { TreeNode } from './TreeNode';

function KebabMenu({ onRefresh, onClose }: { onRefresh: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={t('explorer.folderOptions')}
        className="w-6 h-6 flex items-center justify-center rounded hover:bg-highlight/40 text-text-secondary"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="absolute left-0 top-7 z-50 w-36 rounded-lg border border-border bg-white shadow-lg py-1">
          <button type="button" onClick={() => { onRefresh(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-highlight/30">
            <RefreshCw size={12} /> {t('explorer.refresh')}
          </button>
          <button type="button" onClick={() => { onClose(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-highlight/30">
            <FolderX size={12} /> {t('explorer.closeFolder')}
          </button>
        </div>
      )}
    </div>
  );
}

function AddMenu({ onNewFile, onNewFolder }: { onNewFile: () => void; onNewFolder: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={t('explorer.newFileOrFolder')}
        className="w-6 h-6 flex items-center justify-center rounded hover:bg-highlight/40 text-text-secondary"
      >
        <Plus size={14} />
      </button>
      {open && (
        <div className="absolute left-0 top-7 z-50 w-40 rounded-lg border border-border bg-white shadow-lg py-1">
          <button type="button" onClick={() => { onNewFile(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-highlight/30">
            <FilePlus size={12} /> {t('explorer.newFile')}
          </button>
          <button type="button" onClick={() => { onNewFolder(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-highlight/30">
            <FolderPlus size={12} /> {t('explorer.newFolder')}
          </button>
        </div>
      )}
    </div>
  );
}

const POLL_INTERVAL_MS = 10_000;

export function FileExplorerPanel() {
  const { t } = useTranslation();
  const {
    rootHandle, rootNode, loading, error, needsReconnect, permissionLost,
    openFolder, closeFolder, refreshDir, loadFileSystemSettings,
    reconnectPermission, createFile, createDirectory,
  } = useFileSystemStore();
  const { expandedPaths, setExpandedPaths, fileExplorerOpen } = useUIStore();

  // inline input at root level (new file / new folder)
  const [rootInput, setRootInput] = useState<{ mode: 'new-file' | 'new-folder' } | null>(null);
  const [rootInputValue, setRootInputValue] = useState('');
  const rootInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (rootInput && rootInputRef.current) {
      rootInputRef.current.focus();
    }
  }, [rootInput]);

  // Poll-based external-change detection while panel is visible
  useEffect(() => {
    if (!fileExplorerOpen || !rootNode) return;
    const id = setInterval(async () => {
      await refreshDir(rootNode.path);
      for (const dirPath of expandedPaths) {
        await refreshDir(dirPath);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fileExplorerOpen, rootNode, expandedPaths, refreshDir]);

  const handleReconnect = async () => {
    if (!rootHandle) return;
    const perm = await rootHandle.requestPermission({ mode: 'readwrite' });
    if (perm === 'granted') await loadFileSystemSettings();
  };

  const startRootNew = (mode: 'new-file' | 'new-folder') => {
    if (!rootNode) return;
    // ensure root is "expanded" so the virtual row appears
    if (!expandedPaths.includes(rootNode.path)) {
      setExpandedPaths([...expandedPaths, rootNode.path]);
    }
    setRootInput({ mode });
    setRootInputValue('');
  };

  const commitRootInput = async () => {
    if (!rootInput || !rootNode) return;
    const val = rootInputValue.trim();
    const mode = rootInput.mode;
    setRootInput(null);
    if (!val) return;
    if (mode === 'new-file') await createFile(rootNode.path, val);
    else await createDirectory(rootNode.path, val);
  };

  const handleRootInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitRootInput();
    else if (e.key === 'Escape') setRootInput(null);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 pb-[10px] text-xs font-medium text-text-secondary uppercase tracking-wide">
        <div className="flex items-center gap-0.5">
          {rootNode && (
            <>
              <AddMenu
                onNewFile={() => startRootNew('new-file')}
                onNewFolder={() => startRootNew('new-folder')}
              />
              <KebabMenu
                onRefresh={() => refreshDir(rootNode.path)}
                onClose={closeFolder}
              />
            </>
          )}
          {/* FileExplorerToggle removed */}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto pl-0 pr-0 pb-[10px]">
        {error && (
          <p className="text-xs text-red-500 mb-2 leading-snug">{error}</p>
        )}

        {permissionLost && (
          <div className="flex items-start gap-2 mb-2 px-2 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <ShieldAlert size={13} className="flex-shrink-0 mt-0.5 text-amber-500" />
            <div className="flex-1 min-w-0">
              <span className="font-medium">{t('explorer.permissionLost')}</span>
              <button
                type="button"
                onClick={reconnectPermission}
                className="ml-1 underline hover:no-underline"
              >
                {t('explorer.reconnect')}
              </button>
            </div>
          </div>
        )}

        {needsReconnect && !rootNode && (
          <button type="button" onClick={handleReconnect}
            className="w-full flex items-center justify-center gap-2 h-9 rounded-lg bg-white hover:bg-highlight/30 border border-border text-xs text-text-primary transition-colors mb-2">
            <PlugZap size={13} className="text-brand" />
            <span className="font-medium">{t('explorer.reconnectFolder')}</span>
          </button>
        )}

        {!rootNode && !needsReconnect && (
          <button type="button" onClick={openFolder} disabled={loading}
            className="w-full flex h-[30px] items-center justify-start gap-2 rounded-lg border-0 bg-transparent px-3 text-left text-xs text-text-primary transition-colors hover:bg-highlight/30 disabled:opacity-50">
            <FolderOpen size={13} className="text-brand" />
            <span className="font-medium">{loading ? t('explorer.opening') : t('explorer.openFolder')}</span>
          </button>
        )}

        {rootNode?.children && (
          <ul className="space-y-px">
            {rootNode.children.map((child) => (
              <TreeNode key={child.path} node={child} depth={0} />
            ))}

            {/* Root-level inline new entry */}
            {rootInput && (
              <li className="tree-node flex items-center gap-1 h-7 text-xs text-text-primary"
                style={{ '--tree-depth': 0 } as React.CSSProperties}>
                <span className="flex-shrink-0 w-3.5" />
                {rootInput.mode === 'new-file'
                  ? <span className="text-text-secondary">📄</span>
                  : <span className="text-yellow-500">📁</span>
                }
                <input
                  ref={rootInputRef}
                  title={rootInput.mode === 'new-file' ? t('explorer.newFileName') : t('explorer.newFolderName')}
                  placeholder={rootInput.mode === 'new-file' ? t('explorer.filenamePlaceholder') : t('explorer.folderPlaceholder')}
                  className="ml-1 flex-1 min-w-0 bg-white border border-brand rounded px-1 text-xs outline-none"
                  value={rootInputValue}
                  onChange={(e) => setRootInputValue(e.target.value)}
                  onKeyDown={handleRootInputKey}
                  onBlur={commitRootInput}
                />
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
