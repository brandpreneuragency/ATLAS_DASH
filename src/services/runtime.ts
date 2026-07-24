// Runtime detector — selects the correct folder connector adapter.
//
// Call `getFolderConnector()` to get the singleton connector for the
// current runtime. Prefers the VPS remote API when available, otherwise
// the browser File System Access API. UI code should never import
// platform-specific FS backends directly.

import type { FolderConnector } from './folder-connector';
import { BrowserFolderConnector } from './browser-folder-connector';

let _connector: FolderConnector | null = null;

/** Lazy-initialise and return the folder connector for the current runtime. */
export async function getFolderConnector(): Promise<FolderConnector> {
  if (_connector) return _connector;

  const { tabsApi } = await import('./tabsApi');
  if (await tabsApi.available()) {
    const { RemoteFolderConnector } = await import('./remote-folder-connector');
    _connector = new RemoteFolderConnector();
  } else {
    _connector = new BrowserFolderConnector();
  }

  return _connector;
}

/** Synchronous access — returns null before the first async init. */
export function getCachedFolderConnector(): FolderConnector | null {
  return _connector;
}
