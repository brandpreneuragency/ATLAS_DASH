import { Plus } from 'lucide-react';
import { useFileSystemStore } from '../../stores/fileSystemStore';

export function FileTreeTabs() {
  const { connectedFolders, activeFolderId, setActiveFolderId, openFolder } = useFileSystemStore();

  return (
    <div
      id="filetree-root-row"
      style={{
        display: 'flex',
        height: '36px',
        alignItems: 'center',
        background: 'var(--c-background-2)',
      }}
    >
      <button
        type="button"
        onClick={openFolder}
        title="Connect folder"
        className="tbar-btn"
        style={{
          borderRadius: 0,
          borderRight: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          borderTopColor: 'transparent',
          borderLeftColor: 'transparent',
        }}
      >
        <Plus size={14} />
      </button>
      <select
        className="flex-1 min-w-0"
        style={{
          height: '100%',
          border: 'none',
          borderBottom: '1px solid var(--border)',
          borderRadius: 0,
          background: 'transparent',
          color: 'var(--c-text-1)',
          fontSize: 'var(--fs-xs)',
          padding: '0 10px',
          cursor: 'pointer',
        }}
        value={activeFolderId ?? ''}
        onChange={(e) => {
          if (e.target.value) setActiveFolderId(e.target.value);
        }}
      >
        {connectedFolders.length === 0 && (
          <option value="">No folders connected</option>
        )}
        {connectedFolders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.rootNode?.name ?? 'Unnamed'}
          </option>
        ))}
      </select>
    </div>
  );
}
