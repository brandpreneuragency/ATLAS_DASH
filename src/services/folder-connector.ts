// Folder connector service — bridge pattern.
//
// Production (VPS) uses RemoteFolderConnector via tabs_api `/fs`. Local Vite
// without the API falls back to the browser File System Access API.
//
// UI components must call only this interface — never platform FS APIs directly.

export type FolderConnectionState =
  | 'unsupported'   // no folder backend available in this environment
  | 'available'      // ready to connect (remote roots or browser picker)
  | 'connecting'     // picker dialog open / folder is loading
  | 'connected'      // folder connected and tree loaded
  | 'error';         // permission lost or I/O error

export interface FolderConnector {
  /** Current connection capability & state. */
  readonly state: FolderConnectionState;

  /** Whether folder access is available (remote API or browser FSA). */
  isAvailable(): boolean;

  /** Show a folder picker / connect flow and return the chosen path, or null
   *  if the user cancelled or the runtime doesn't support it. */
  connectFolder(): Promise<string | null>;

  /** Read the root-level children of a connected folder. */
  readDir(path: string): Promise<FolderDirEntry[]>;

  /** Read a text file. */
  readTextFile(path: string): Promise<string>;

  /** Read a file's raw bytes (used for image attachments). */
  readBinaryFile(path: string): Promise<Uint8Array>;

  /** Write a text file (creates or overwrites). */
  writeTextFile(path: string, content: string): Promise<void>;

  /** Create a directory. */
  mkdir(path: string, recursive?: boolean): Promise<void>;

  /** Delete a file or directory. */
  remove(path: string, recursive?: boolean): Promise<void>;

  /** Rename / move a path. */
  rename(from: string, to: string): Promise<void>;

  /** Check whether a path exists on disk. */
  exists(path: string): Promise<boolean>;

  /** Get file/directory metadata. */
  getMetadata(path: string): Promise<FolderMetadata>;

  /** Present a Save As dialog. */
  pickSavePath(
    suggestedName: string,
    defaultPath?: string,
    filters?: { name: string; extensions: string[] }[],
  ): Promise<string | null>;

  /** Present an Open File dialog. */
  pickOpenFile(filters?: { name: string; extensions: string[] }[]): Promise<string | null>;

  /** State change callback for UI reactivity. */
  onStateChange?: (state: FolderConnectionState) => void;
}

export interface FolderDirEntry {
  name: string;
  path: string;
  kind: 'file' | 'directory';
}

export interface FolderMetadata {
  size: number;
  modifiedAt: Date | null;
  isDirectory: boolean;
  isFile: boolean;
}
