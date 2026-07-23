import { useEffect, useRef, useState } from 'react';
import { Folder, File, FolderPlus, Upload, Trash2, Move, RotateCcw } from 'lucide-react';
import { useFilesStore, joinRelPath } from '../../stores/filesStore';

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--c-border-1)',
  borderRadius: 8,
  background: 'var(--c-background-2)',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Breadcrumbs({ dir, onNavigate }: { dir: string; onNavigate: (d: string) => void }) {
  const parts = dir ? dir.split('/') : [];
  return (
    <nav aria-label="breadcrumbs" style={{ fontSize: 'var(--fs-xs)', display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" className="btn-icon" style={{ fontSize: 'var(--fs-xs)' }} onClick={() => onNavigate('')}>
        root
      </button>
      {parts.map((part, i) => {
        const prefix = parts.slice(0, i + 1).join('/');
        return (
          <span key={prefix} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span className="subtle">/</span>
            <button type="button" className="btn-icon" style={{ fontSize: 'var(--fs-xs)' }} onClick={() => onNavigate(prefix)}>
              {part}
            </button>
          </span>
        );
      })}
    </nav>
  );
}

/**
 * Files area (Control's `frontend/src/pages/Files.tsx`, M2 map: root-jailed
 * VPS file browser/editor, D-FILES). Master-detail: a directory listing
 * (with breadcrumb navigation, multi-select, mkdir/move/delete/upload) on
 * the left, an mtime-aware read/write editor on the right. This is a
 * distinct surface from Work -> Documents (`fileExplorer/`, `fileViewer/`,
 * `editor/`), which stays on its own workspace-scoped filesystem store —
 * this area talks only to `server/app/routers/files.py`'s single root jail.
 */
export function FilesArea() {
  const currentDir = useFilesStore((s) => s.currentDir);
  const entries = useFilesStore((s) => s.entries);
  const dirState = useFilesStore((s) => s.dirState);
  const dirError = useFilesStore((s) => s.dirError);
  const selected = useFilesStore((s) => s.selected);
  const actionError = useFilesStore((s) => s.actionError);
  const busy = useFilesStore((s) => s.busy);

  const navigate = useFilesStore((s) => s.navigate);
  const toggleSelect = useFilesStore((s) => s.toggleSelect);
  const openFile = useFilesStore((s) => s.openFile);
  const mkdir = useFilesStore((s) => s.mkdir);
  const moveSelected = useFilesStore((s) => s.moveSelected);
  const deleteSelected = useFilesStore((s) => s.deleteSelected);
  const upload = useFilesStore((s) => s.upload);

  const [newFolderName, setNewFolderName] = useState('');
  const [showMove, setShowMove] = useState(false);
  const [moveDest, setMoveDest] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void navigate('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    if (await mkdir(name)) setNewFolderName('');
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} item(s)?`)) return;
    await deleteSelected(true);
  };

  const handleMove = async () => {
    if (await moveSelected(moveDest)) {
      setShowMove(false);
      setMoveDest('');
    }
  };

  return (
    <div id="files-area" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <h2 style={{ margin: 0, fontSize: 'var(--fs-lg, 18px)', color: 'var(--c-text-1)' }}>Files</h2>
        <Breadcrumbs dir={currentDir} onNavigate={(d) => void navigate(d)} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <input
          aria-label="new folder name"
          className="ctrl"
          style={{ fontSize: 'var(--fs-sm)', width: 160 }}
          placeholder="New folder name"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void handleCreateFolder()}
        />
        <button type="button" className="btn-icon" title="Create folder" disabled={!newFolderName.trim() || busy} onClick={() => void handleCreateFolder()}>
          <FolderPlus size={14} />
        </button>
        <button type="button" className="btn-icon" title="Upload file" disabled={busy} onClick={() => fileInputRef.current?.click()}>
          <Upload size={14} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          aria-label="upload file"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = '';
          }}
        />
        <button type="button" className="btn-icon" title="Move selected" disabled={selected.size === 0 || busy} onClick={() => setShowMove((v) => !v)}>
          <Move size={14} />
        </button>
        <button type="button" className="btn-icon" title="Delete selected" disabled={selected.size === 0 || busy} onClick={() => void handleDelete()}>
          <Trash2 size={14} />
        </button>
        {selected.size > 0 && <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>{selected.size} selected</span>}
        {busy && <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>Working…</span>}
      </div>

      {showMove && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <input
            aria-label="move destination"
            className="ctrl"
            style={{ fontSize: 'var(--fs-sm)', width: 240 }}
            placeholder="Destination (e.g. archive/2026)"
            value={moveDest}
            onChange={(e) => setMoveDest(e.target.value)}
          />
          <button type="button" className="btn" style={{ fontSize: 'var(--fs-xs)' }} onClick={() => void handleMove()}>Confirm move</button>
          <button type="button" className="btn-icon" style={{ fontSize: 'var(--fs-xs)' }} onClick={() => setShowMove(false)}>Cancel</button>
        </div>
      )}

      {(dirState === 'error' || actionError) && (
        <div role="alert" style={{ fontSize: 'var(--fs-sm)', color: '#b91c1c', flexShrink: 0 }}>
          {dirError ?? actionError}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12 }}>
        <div style={{ ...cardStyle, flex: '1 1 45%', minWidth: 0, overflowY: 'auto' }}>
          {dirState === 'loading' ? (
            <p className="subtle" style={{ margin: 0, padding: 14, fontSize: 'var(--fs-sm)' }}>Loading…</p>
          ) : entries.length === 0 ? (
            <p className="subtle" style={{ margin: 0, padding: 14, fontSize: 'var(--fs-sm)' }}>Empty folder.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
              <tbody>
                {entries.map((entry) => {
                  const full = joinRelPath(currentDir, entry.name);
                  return (
                    <tr
                      key={full}
                      data-testid={`files-row-${full}`}
                      style={{ borderBottom: '1px solid var(--c-border-1)' }}
                    >
                      <td style={{ padding: '4px 8px', width: 24 }}>
                        <input
                          type="checkbox"
                          aria-label={`select ${entry.name}`}
                          checked={selected.has(full)}
                          onChange={() => toggleSelect(full)}
                        />
                      </td>
                      <td
                        style={{ padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                        onClick={() => (entry.is_dir ? void navigate(full) : void openFile(full))}
                      >
                        {entry.is_dir ? <Folder size={14} /> : <File size={14} />}
                        <span>{entry.name}</span>
                      </td>
                      <td className="subtle" style={{ padding: '4px 8px', textAlign: 'right' }}>
                        {entry.is_dir ? '' : formatSize(entry.size)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ flex: '1 1 55%', minWidth: 0 }}>
          <FileDetailPanel />
        </div>
      </div>
    </div>
  );
}

function FileDetailPanel() {
  const openPath = useFilesStore((s) => s.openPath);
  const openContent = useFilesStore((s) => s.openContent);
  const openState = useFilesStore((s) => s.openState);
  const openError = useFilesStore((s) => s.openError);
  const dirty = useFilesStore((s) => s.dirty);
  const conflict = useFilesStore((s) => s.conflict);
  const busy = useFilesStore((s) => s.busy);
  const setContent = useFilesStore((s) => s.setContent);
  const save = useFilesStore((s) => s.save);
  const reloadOpenFile = useFilesStore((s) => s.reloadOpenFile);
  const closeFile = useFilesStore((s) => s.closeFile);

  if (openPath === null) {
    return (
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p className="subtle" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>Select a file to view or edit it.</p>
      </div>
    );
  }

  return (
    <div data-testid="file-detail" style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 8, height: '100%', padding: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--fs-xs)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={openPath}>
          {openPath}
        </span>
        {dirty && <span data-testid="dirty-indicator" style={{ fontSize: 'var(--fs-xs)', color: '#b45309' }}>● unsaved</span>}
        <button type="button" className="btn" style={{ fontSize: 'var(--fs-xs)' }} disabled={busy || openState !== 'ready'} onClick={() => void save()}>
          Save
        </button>
        <button type="button" className="btn-icon" style={{ fontSize: 'var(--fs-xs)' }} onClick={closeFile}>
          Close
        </button>
      </div>

      {conflict && (
        <div data-testid="conflict-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', border: '1px solid #b45309', borderRadius: 6, background: 'rgba(180,83,9,0.08)', fontSize: 'var(--fs-xs)' }}>
          <span>File changed on disk since you opened it.</span>
          <span style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn-icon" onClick={() => void reloadOpenFile()}>
              <RotateCcw size={12} /> Reload
            </button>
            <button type="button" className="btn" onClick={() => void save({ force: true })}>
              Overwrite anyway
            </button>
          </span>
        </div>
      )}

      {openState === 'error' && (
        <div role="alert" style={{ fontSize: 'var(--fs-sm)', color: '#b91c1c' }}>{openError}</div>
      )}

      {openState === 'loading' ? (
        <p className="subtle" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>Loading…</p>
      ) : (
        <textarea
          aria-label="file content"
          value={openContent}
          onChange={(e) => setContent(e.target.value)}
          style={{
            flex: 1,
            minHeight: 0,
            resize: 'none',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 'var(--fs-sm)',
            padding: 10,
            border: '1px solid var(--c-border-1)',
            borderRadius: 6,
            background: 'var(--c-background-1)',
            color: 'var(--c-text-1)',
          }}
        />
      )}
    </div>
  );
}
