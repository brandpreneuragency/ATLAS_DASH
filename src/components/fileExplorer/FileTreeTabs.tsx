import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Brain } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { getFolderConnector } from '../../services/runtime';
import type { FolderConnector } from '../../services/folder-connector';
import type { FsRoot } from '../../services/tabsApi';
import { sortDocModeRoots } from './sortDocModeRoots';

/** Duck-type for RemoteFolderConnector extras (avoids a static import that breaks code-splitting). */
type RemoteConnector = FolderConnector & {
  listRoots: () => Promise<FsRoot[]>;
  connectRoot: (rootId: string) => Promise<string>;
};

function isRemoteConnector(c: FolderConnector): c is RemoteConnector {
  return 'listRoots' in c && typeof (c as RemoteConnector).listRoots === 'function';
}

/**
 * Workspace folder control for the file tree.
 *
 * Each workspace tab has at most one attached folder (the AI agent root).
 * Empty (native): full-width "CONNECT FOLDER" opens the native picker.
 * Empty (remote / tabs_api): list of VPS roots from RemoteFolderConnector.listRoots().
 * Selected: shows the folder path or root label; click is a no-op (no replace/clear).
 */
export function FileTreeTabs() {
  const { t } = useTranslation();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const loading = useWorkspaceStore((s) => s.loading);
  const connectFolderInWorkspace = useWorkspaceStore((s) => s.connectFolderInWorkspace);
  const getActiveConnectedFolders = useWorkspaceStore((s) => s.getActiveConnectedFolders);
  const getActiveFolderId = useWorkspaceStore((s) => s.getActiveFolderId);

  const connectedFolders = getActiveConnectedFolders();
  const activeFolderId = getActiveFolderId();
  const activeFolder =
    connectedFolders.find((f) => f.id === activeFolderId) ?? connectedFolders[0] ?? null;
  // Prefer absolute path so the user sees the full route, not only the basename.
  const folderPath = activeFolder?.path ?? activeFolder?.rootNode?.fullPath ?? null;
  const hasFolder = Boolean(folderPath);
  const canSelect = Boolean(activeWorkspaceId) && !hasFolder && !loading;

  const [remoteRoots, setRemoteRoots] = useState<FsRoot[] | null>(null);
  const [remoteReady, setRemoteReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const connector = await getFolderConnector();
        if (cancelled) return;
        if (isRemoteConnector(connector)) {
          const roots = await connector.listRoots();
          if (!cancelled) setRemoteRoots(roots);
        } else if (!cancelled) {
          setRemoteRoots(null);
        }
      } catch {
        if (!cancelled) setRemoteRoots(null);
      } finally {
        if (!cancelled) setRemoteReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedRemoteRoots = useMemo(
    () => (remoteRoots ? sortDocModeRoots(remoteRoots) : null),
    [remoteRoots],
  );

  const activeRemoteRoot =
    remoteRoots && folderPath
      ? remoteRoots.find((r) => folderPath === `${r.id}:` || folderPath.startsWith(`${r.id}:`))
      : undefined;
  const remoteLabel = activeRemoteRoot?.label;
  const isMemoriesFolder = activeRemoteRoot?.id === 'memories';

  const label = hasFolder
    ? (remoteLabel ?? folderPath!)
    : loading
      ? t('explorer.opening')
      : t('explorer.selectFolder');

  const ariaLabel = hasFolder
    ? t('explorer.workspaceFolderAria', { name: remoteLabel ?? folderPath })
    : t('explorer.selectFolder');

  const handleNativeClick = () => {
    if (!canSelect || !activeWorkspaceId) return;
    void connectFolderInWorkspace(activeWorkspaceId);
  };

  const handleRemoteRoot = async (root: FsRoot) => {
    if (!canSelect || !activeWorkspaceId) return;
    const connector = await getFolderConnector();
    if (!isRemoteConnector(connector)) return;
    const path = await connector.connectRoot(root.id);
    // Same tree-load path as Tauri after connectFolder(): pass fullPath into the store action.
    await connectFolderInWorkspace(activeWorkspaceId, path);
  };

  const showRemotePicker = remoteReady && sortedRemoteRoots !== null && !hasFolder;

  return (
    <div
      id="filetree-root-row"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: showRemotePicker ? 'auto' : '32px',
        alignItems: 'stretch',
        gap: showRemotePicker ? 4 : 0,
        marginBottom: '0px',
        marginLeft: '0px',
        marginRight: '0px',
        paddingTop: '8px',
        paddingBottom: '8px',
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
      {showRemotePicker ? (
        sortedRemoteRoots.length === 0 ? (
          <p className="subtle" style={{ margin: 0, padding: '4px 8px', fontSize: 'var(--fs-xs)' }}>
            {t('explorer.noRemoteRoots')}
          </p>
        ) : (
          sortedRemoteRoots.map((root) => (
            <button
              key={root.id}
              type="button"
              className="filetree-select-folder-btn"
              onClick={() => {
                void handleRemoteRoot(root);
              }}
              disabled={!canSelect}
              aria-disabled={!canSelect}
              aria-label={t('explorer.connectRemoteRoot', { label: root.label })}
              title={root.label}
            >
              {root.id === 'memories' ? (
                <Brain size={14} className="filetree-select-folder-icon" aria-hidden />
              ) : null}
              <span className="filetree-select-folder-label">{root.label}</span>
            </button>
          ))
        )
      ) : (
        <button
          type="button"
          className={`filetree-select-folder-btn${hasFolder ? ' is-selected' : ''}`}
          onClick={handleNativeClick}
          disabled={!canSelect || (remoteReady && remoteRoots !== null)}
          aria-disabled={!canSelect || (remoteReady && remoteRoots !== null)}
          aria-label={ariaLabel}
          title={hasFolder ? (remoteLabel ?? folderPath!) : t('explorer.selectFolder')}
        >
          {isMemoriesFolder ? (
            <Brain size={14} className="filetree-select-folder-icon" aria-hidden />
          ) : null}
          <span className="filetree-select-folder-label">{label}</span>
        </button>
      )}
    </div>
  );
}
