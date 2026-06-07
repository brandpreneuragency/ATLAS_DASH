import { useState, useRef, useEffect } from 'react';
import type React from 'react';
import {
  FilePlus, FolderPlus, X,
  File, Folder, FolderOpen,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFileSystemStore, type TreeNode as TreeNodeType } from '../../stores/fileSystemStore';
import { useUIStore } from '../../stores/uiStore';
import { detectTauri } from '../../utils/tauri';
import { TreeNode } from './TreeNode';
import { FileTreeTabs } from './FileTreeTabs';

const POLL_INTERVAL_MS = 10_000;

function filterTreeNode(node: TreeNodeType, query: string): TreeNodeType | null {
  const ownMatch = node.name.toLowerCase().includes(query);
  const matchingChildren = node.children
    ?.map((child) => filterTreeNode(child, query))
    .filter((child): child is TreeNodeType => child !== null) ?? [];

  if (!ownMatch && matchingChildren.length === 0) return null;
  if (node.kind === 'directory') return { ...node, children: matchingChildren };
  return node;
}

function hasUnloadedDirectory(node: TreeNodeType): boolean {
  if (node.kind !== 'directory') return false;
  if (node.children === undefined) return true;
  return node.children.some(hasUnloadedDirectory);
}

export function FileExplorerPanel() {
  const { t } = useTranslation();
  const {
    rootNode, error,
    refreshDir,
    createFile, createDirectory, ensureSubtreeLoaded,
  } = useFileSystemStore();
  const { expandedPaths, setExpandedPaths, fileExplorerOpen } = useUIStore();

  // inline input at root level (new file / new folder)
  const [rootInput, setRootInput] = useState<{ mode: 'new-file' | 'new-folder' } | null>(null);
  const [rootInputValue, setRootInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const rootInputRef = useRef<HTMLInputElement>(null);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const searchActive = normalizedSearch.length > 0;
  const searchIndexing = searchActive && Boolean(rootNode && hasUnloadedDirectory(rootNode));
  const visibleRootChildren = rootNode?.children
    ? searchActive
      ? rootNode.children
        .map((child) => filterTreeNode(child, normalizedSearch))
        .filter((child): child is TreeNodeType => child !== null)
      : rootNode.children
    : [];

  const isTauri = detectTauri();

  useEffect(() => {
    if (rootInput && rootInputRef.current) {
      rootInputRef.current.focus();
    }
  }, [rootInput]);

  useEffect(() => {
    if (!searchActive || !searchIndexing || !rootNode) return;
    void ensureSubtreeLoaded(rootNode.fullPath).catch(() => undefined);
  }, [ensureSubtreeLoaded, rootNode, searchActive, searchIndexing]);

  // Poll-based external-change detection while panel is visible
  useEffect(() => {
    if (!fileExplorerOpen || !rootNode) return;
    const id = setInterval(async () => {
      await refreshDir(rootNode.fullPath);
      for (const dirPath of expandedPaths) {
        await refreshDir(dirPath);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fileExplorerOpen, rootNode, expandedPaths, refreshDir]);

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
    if (mode === 'new-file') await createFile(rootNode.fullPath, val);
    else await createDirectory(rootNode.fullPath, val);
  };

  const handleRootInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitRootInput();
    else if (e.key === 'Escape') setRootInput(null);
  };

  return (
    <div className="flex-col h-full" style={{ display: 'flex', minHeight: 0, background: 'var(--c-background-2)' }}>
      <div className="shrink-0" style={{ height: 42, paddingLeft: 0, paddingRight: 0 }}>
        <FileTreeTabs />
      </div>

      {rootNode?.children && (
        <div
          role="search"
          style={{
            height: 32,
            borderBottom: '1px solid var(--layout-border)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 8px',
            background: 'var(--left-bg)',
          }}
        >
          <input
            type="search"
            aria-label={t('explorer.searchFiles')}
            title={t('explorer.searchFiles')}
            placeholder={t('explorer.searchPlaceholder')}
            value={searchQuery}
            spellCheck={false}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              height: 32,
              border: 'none',
              borderRadius: 0,
              background: 'rgba(255, 255, 255, 0)',
              color: 'var(--c-text-1)',
              fontSize: 'var(--fs-xs)',
              padding: '0 8px',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              title={t('explorer.clearSearch')}
              aria-label={t('explorer.clearSearch')}
              onClick={() => setSearchQuery('')}
              style={{ marginLeft: -28, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-2)', display: 'flex', alignItems: 'center' }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Body */}
      <div className="ai-scroll flex-1 overflow-y-a left-scrollbar" style={{ minHeight: 0, padding: 0, background: 'var(--c-background-2)' }}>
        {error && (
          <p style={{ fontSize: 'var(--fs-xs)', color: '#EF4444', marginBottom: 8, lineHeight: 1.375 }}>{error}</p>
        )}

        {/* Browser-mode disabled state. The file explorer is a Tauri-only
            feature (path-based filesystem access). In the VPS web build we
            show a clear empty state instead of offering broken buttons. The
            Tauri desktop path is untouched. */}
        {!isTauri && !rootNode && (
          <div
            id="file-explorer-browser-empty"
            className="flex-col items-center justify-center"
            style={{
              padding: '32px 16px',
              gap: 10,
              color: 'var(--c-text-3)',
              textAlign: 'center',
            }}
          >
            <FolderOpen size={28} className="subtle" />
            <p className="txt-sm med" style={{ color: 'var(--c-text-2)' }}>
              Local folders are available in the desktop app.
            </p>
            <p className="txt-xs subtle" style={{ maxWidth: 220, lineHeight: 1.4 }}>
              Use the TABS desktop build to connect a local folder and work
              with your files on disk.
            </p>
          </div>
        )}

        {rootNode?.children && (
          <ul id="filetree-list" style={{
            display: 'flex', flexDirection: 'column', gap: 1,
            listStyle: 'none', padding: 0, margin: 0,
          }}>
            <li className="flex items-center gap-1 filetree-actions" style={{ height: 28, padding: '0 8px', fontSize: 'var(--fs-xs)' }}>
              <button
                type="button"
                onClick={() => startRootNew('new-file')}
                title={t('explorer.newFile')}
                aria-label={t('explorer.newFile')}
                className="btn-icon"
                style={{ width: 24, height: 24 }}
              >
                <FilePlus size={14} />
              </button>
              <button
                type="button"
                onClick={() => startRootNew('new-folder')}
                title={t('explorer.newFolder')}
                aria-label={t('explorer.newFolder')}
                className="btn-icon"
                style={{ width: 24, height: 24 }}
              >
                <FolderPlus size={14} />
              </button>
            </li>
            {searchIndexing && (
              <li className="filetree-search-status" aria-live="polite">
                {t('explorer.searchLoading')}
              </li>
            )}

            {visibleRootChildren.map((child) => (
              <TreeNode key={child.path} node={child} depth={0} searchActive={searchActive} />
            ))}

            {searchActive && !searchIndexing && visibleRootChildren.length === 0 && (
              <li className="filetree-search-status" aria-live="polite">
                {t('explorer.noSearchMatches')}
              </li>
            )}

            {/* Root-level inline new entry */}
            {rootInput && (
              <li
                className="tree-node row-xs"
                style={{
                  '--tree-depth': 0, height: 28, fontSize: 'var(--fs-xs)',
                  color: 'var(--c-text-1)',
                } as React.CSSProperties}
              >
                <span className="shrink-0" style={{ width: 14 }} />
                {rootInput.mode === 'new-file'
                  ? <File size={13} className="shrink-0 subtle" />
                  : <Folder size={13} className="shrink-0" style={{ color: 'var(--c-text-2)' }} />
                }
                <input
                  ref={rootInputRef}
                  title={rootInput.mode === 'new-file' ? t('explorer.newFileName') : t('explorer.newFolderName')}
                  placeholder={rootInput.mode === 'new-file' ? t('explorer.filenamePlaceholder') : t('explorer.folderPlaceholder')}
                  className="ctrl-xs flex-1 min-w-0"
                  style={{ marginLeft: 4, marginRight: 12, borderColor: 'var(--c-accent-center-panel)' }}
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
