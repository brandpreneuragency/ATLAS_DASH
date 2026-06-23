import { Plus, Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFileSystemStore } from '../../stores/fileSystemStore';

export function FileTreeTabs() {
  const { t } = useTranslation();
  const { connectedFolders, activeFolderId, setActiveFolderId, openFolder, folderCapability } = useFileSystemStore();
  const nativeAvailable = folderCapability === 'available';

  return (
    <div
      id="filetree-root-row"
      style={{
        display: 'flex',
        height: 'var(--control-height-sm)',
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
      {nativeAvailable ? (
        <button
          type="button"
          onClick={openFolder}
          title={t('explorer.openFolder')}
          className="tbar-btn"
          style={{ borderRadius: 0 }}
        >
          <Plus size={14} />
        </button>
      ) : (
        <span
          title={t('explorer.desktopRequired')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 'var(--fs-xs)',
            color: 'var(--c-text-2)',
            padding: '0 4px',
            cursor: 'default',
          }}
        >
          <Monitor size={13} />
        </span>
      )}
      {nativeAvailable ? (
        <select
          className="flex-1 min-w-0"
          style={{
            height: '100%',
            border: 'none',
            borderRadius: 0,
            background: 'transparent',
            color: 'var(--c-text-1)',
            fontSize: 'var(--fs-base)',
            padding: 0,
            cursor: 'pointer',
          }}
          value={activeFolderId ?? ''}
          onChange={(e) => {
            if (e.target.value) setActiveFolderId(e.target.value);
          }}
        >
          {connectedFolders.length === 0 && (
            <option value="">{t('explorer.noFoldersConnected')}</option>
          )}
          {connectedFolders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.rootNode?.name ?? 'Unnamed'}
            </option>
          ))}
        </select>
      ) : (
        <span
          style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--c-text-2)',
            padding: '0 4px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {t('explorer.desktopRequired')}
        </span>
      )}
    </div>
  );
}
