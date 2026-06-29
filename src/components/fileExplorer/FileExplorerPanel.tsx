import { useState, useRef, useEffect } from 'react';
import type React from 'react';
import {
  FilePlus, FolderPlus, X,
  File, Folder, Monitor,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFileSystemStore, type TreeNode as TreeNodeType } from '../../stores/fileSystemStore';
import { useDocumentStore } from '../../stores/documentStore';
import { useUIStore } from '../../stores/uiStore';
import { TreeNode } from './TreeNode';
import { FileTreeTabs } from './FileTreeTabs';

const POLL_INTERVAL_MS = 10_000;
const SEARCH_RESULT_LIMIT = 50;

function hasUnloadedDirectory(node: TreeNodeType): boolean {
  if (node.kind !== 'directory') return false;
  if (node.children === undefined) return true;
  return node.children.some(hasUnloadedDirectory);
}

function collectSearchMatches(nodes: TreeNodeType[], query: string, max = SEARCH_RESULT_LIMIT): TreeNodeType[] {
  const results: TreeNodeType[] = [];
  const walk = (node: TreeNodeType) => {
    if (results.length >= max) return;
    if (node.name.toLowerCase().includes(query)) {
      results.push(node);
    }
    node.children?.forEach(walk);
  };
  for (const node of nodes) {
    walk(node);
    if (results.length >= max) break;
  }
  return results;
}

export function FileExplorerPanel() {
  const { t } = useTranslation();
  const {
    rootNode, error, folderCapability,
    refreshDir,
    createFile, createDirectory, ensureSubtreeLoaded, ensureChildrenLoaded,
  } = useFileSystemStore();
  const { openFileFromTree } = useDocumentStore();
  const { expandedPaths, setExpandedPaths, setSelectedTreePath, fileExplorerOpen } = useUIStore();
  const nativeAvailable = folderCapability === 'available';

  // inline input at root level (new file / new folder)
  const [rootInput, setRootInput] = useState<{ mode: 'new-file' | 'new-folder' } | null>(null);
  const [rootInputValue, setRootInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const rootInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const searchActive = normalizedSearch.length > 0;
  const searchIndexing = searchActive && Boolean(rootNode && hasUnloadedDirectory(rootNode));
  const searchMatches = rootNode?.children && searchActive
    ? collectSearchMatches(rootNode.children, normalizedSearch)
    : [];

  useEffect(() => {
    if (rootInput && rootInputRef.current) {
      rootInputRef.current.focus();
    }
  }, [rootInput]);

  useEffect(() => {
    if (!searchActive || !searchIndexing || !rootNode) return;
    void ensureSubtreeLoaded(rootNode.fullPath).catch(() => undefined);
  }, [ensureSubtreeLoaded, rootNode, searchActive, searchIndexing]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setSearchQuery('');
      setSearchDropdownOpen(false);
      e.currentTarget.blur();
    }
  };

  const handleSearchResultClick = async (node: TreeNodeType) => {
    setSelectedTreePath(node.path);
    if (node.kind === 'directory') {
      if (node.children === undefined) {
        await ensureChildrenLoaded(node.fullPath);
      }
      if (!expandedPaths.includes(node.path)) {
        setExpandedPaths([...expandedPaths, node.path]);
      }
    } else {
      await openFileFromTree(node, false);
    }
    setSearchDropdownOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="panel flex-col h-full" style={{ display: 'flex', minHeight: 0 }}>
      <div className="panel-header fep-header">
        <div className="shrink-0" style={{ height: 'fit-content', paddingLeft: 0, paddingRight: 0 }}>
          <FileTreeTabs />
        </div>

        {rootNode?.children && (
          <div
            id="filetree-search"
            ref={searchRef}
            role="search"
            className="filetree-search"
          >
            <div className="filetree-search-input-wrap">
              <input
                type="search"
                className="filetree-search-input"
                aria-label={t('explorer.searchFiles')}
                title={t('explorer.searchFiles')}
                placeholder={t('explorer.searchPlaceholder')}
                value={searchQuery}
                spellCheck={false}
                aria-expanded={searchDropdownOpen}
                aria-haspopup="listbox"
                onFocus={() => setSearchDropdownOpen(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="filetree-search-clear"
                  title={t('explorer.clearSearch')}
                  aria-label={t('explorer.clearSearch')}
                  onClick={() => setSearchQuery('')}
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <div
              className="flex items-center gap-1 filetree-actions"
              style={{ height: 28, padding: 0, fontSize: 'var(--fs-xs)' }}
            >
              <button
                type="button"
                onClick={() => startRootNew('new-file')}
                title={t('explorer.newFile')}
                aria-label={t('explorer.newFile')}
                className="btn-icon"
                style={{ width: 'var(--control-height-sm)', height: 'var(--control-height-sm)' }}
              >
                <FilePlus size={14} />
              </button>
              <button
                type="button"
                onClick={() => startRootNew('new-folder')}
                title={t('explorer.newFolder')}
                aria-label={t('explorer.newFolder')}
                className="btn-icon"
                style={{ width: 'var(--control-height-sm)', height: 'var(--control-height-sm)' }}
              >
                <FolderPlus size={12} />
              </button>
            </div>
            {searchDropdownOpen && (
              <div
                className="drop"
                role="listbox"
                aria-label={t('explorer.searchFiles')}
                style={{ left: 0, right: 0, top: '100%', marginTop: 4, minWidth: 180 }}
              >
                {searchIndexing && (
                  <div className="subtle" style={{ padding: '8px 12px', fontSize: 'var(--fs-xs)' }}>
                    {t('explorer.searchLoading')}
                  </div>
                )}
                {!searchIndexing && searchActive && searchMatches.map((node) => (
                  <button
                    type="button"
                    key={node.path}
                    role="option"
                    onClick={() => { void handleSearchResultClick(node); }}
                    className="drop-item"
                    style={{ fontSize: 'var(--fs-xs)' }}
                  >
                    {node.kind === 'file'
                      ? <File size={11} style={{ flexShrink: 0, color: 'var(--c-text-2)' }} />
                      : <Folder size={11} style={{ flexShrink: 0, color: 'var(--c-text-2)' }} />}
                    <span className="trunc med">{node.name}</span>
                  </button>
                ))}
                {!searchIndexing && searchActive && searchMatches.length === 0 && (
                  <div className="subtle" style={{ padding: '8px 12px', fontSize: 'var(--fs-xs)' }}>
                    {t('explorer.noSearchMatches')}
                  </div>
                )}
                {!searchActive && (
                  <div className="subtle" style={{ padding: '8px 12px', fontSize: 'var(--fs-xs)' }}>
                    {t('explorer.searchPlaceholder')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="panel-body ai-scroll flex-1 overflow-y-a" style={{ minHeight: 0, padding: 8 }}>
        {error && (
          <p style={{ fontSize: 'var(--fs-xs)', color: '#EF4444', marginBottom: 8, lineHeight: 1.375 }}>{error}</p>
        )}

        {!nativeAvailable && !rootNode && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 16px',
            textAlign: 'center',
            gap: 8,
          }}>
            <Monitor size={24} style={{ color: 'var(--c-text-2)' }} />
            <p style={{
              fontSize: 'var(--fs-xs)',
              color: 'var(--c-text-2)',
              lineHeight: 1.5,
              maxWidth: 200,
            }}>
              {t('explorer.desktopRequiredHint')}
            </p>
          </div>
        )}

        {rootNode?.children && (
          <ul id="filetree-list" className="ai-scroll" style={{
            display: 'flex', flexDirection: 'column', gap: 1,
            listStyle: 'none', padding: 0, margin: 0,
          }}>
            {rootNode.children.map((child) => (
              <TreeNode key={child.path} node={child} depth={0} />
            ))}

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