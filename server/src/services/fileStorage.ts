// File storage service.
//
// Files live on the VPS filesystem under:
//
//   {FILE_STORAGE_ROOT}/users/{ownerId}/{fileId}/{safeStoredName}
//
// The fileId is generated server-side (cuid) and is the only path component
// the client can never influence. The original filename is sanitized before
// it touches the filesystem — see `sanitizeFilename`.
//
// This module never exposes the absolute storage path to callers; routes
// read it from the DB row to stream the file and never put it in a response.

import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, mkdirSync } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { config } from '../config.js';

// ── Filename sanitization ──────────────────────────────────────────────────

const SAFE_NAME_MAX_LEN = 200;

// Allow word characters, ASCII letters/digits, dot, dash, underscore, space.
// Everything else (path separators, NUL bytes, control chars, shell
// metacharacters) gets replaced with an underscore. Subsequent runs collapse.
const UNSAFE_CHARS = /[^a-zA-Z0-9._\- ]/g;

/**
 * Convert an arbitrary user-supplied filename into a safe storage name.
 *
 * Guarantees:
 *   - No path separators (/, \).
 *   - No NUL bytes or control characters.
 *   - No leading dot (so `.htaccess` becomes `htaccess`).
 *   - No `..` segments after stripping.
 *   - At most {@link SAFE_NAME_MAX_LEN} characters.
 *   - Always non-empty (falls back to `file`).
 */
export function sanitizeFilename(input: string): string {
  if (typeof input !== 'string' || input.length === 0) return 'file';

  // 1. Take only the basename — strips any path the client tried to inject.
  //    `path.basename` handles both POSIX and Windows separators.
  const base = path.basename(input.replace(/\\/g, '/'));

  // 2. Strip control chars (NUL, \x01-\x1F, DEL) and unsafe characters.
  let cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(UNSAFE_CHARS, '_')
    .trim();

  // 3. Collapse runs of underscores or dots so we don't get `____.txt` or
  //    `..hidden`. We allow internal dots (for extensions) but never two in
  //    a row.
  cleaned = cleaned.replace(/_{2,}/g, '_').replace(/\.{2,}/g, '.');

  // 4. Strip any leading dots so `.htaccess` becomes `htaccess` and `..`
  //    becomes empty.
  cleaned = cleaned.replace(/^\.+/, '');

  // 5. Bound the length. We keep the extension if possible.
  if (cleaned.length > SAFE_NAME_MAX_LEN) {
    const ext = path.extname(cleaned);
    const stem = cleaned.slice(0, SAFE_NAME_MAX_LEN - ext.length);
    cleaned = stem + ext;
  }

  // 6. Fall back if the result is empty.
  if (cleaned.length === 0) return 'file';

  return cleaned;
}

// ── Path resolution ────────────────────────────────────────────────────────

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

function assertSafeId(label: string, value: string): void {
  if (!ID_PATTERN.test(value)) {
    throw new Error(`unsafe ${label}: ${JSON.stringify(value)}`);
  }
}

/**
 * Build the absolute on-disk path for a user/file combination. The result is
 * always inside the configured storage root; if a caller managed to inject
 * `..` segments past the validators, the function throws instead of returning
 * a path that escapes the root.
 */
export function resolveStoragePath(ownerId: string, fileId: string, storedName: string): string {
  assertSafeId('ownerId', ownerId);
  assertSafeId('fileId', fileId);
  const safeStoredName = sanitizeFilename(storedName);
  const root = path.resolve(config.fileStorageRoot);
  const userDir = path.join(root, 'users', ownerId, fileId);
  const fullPath = path.join(userDir, safeStoredName);
  const normalized = path.resolve(fullPath);
  if (!normalized.startsWith(root + path.sep) && normalized !== root) {
    throw new Error(`resolved path escapes storage root: ${normalized}`);
  }
  return normalized;
}

/**
 * Return the absolute path to the temp directory used by multer. Living under
 * the same storage root means the final `rename` is an atomic same-filesystem
 * move on Linux.
 */
export function tempUploadDir(): string {
  return path.resolve(config.fileStorageRoot, '.tmp');
}

// ── Disk operations ────────────────────────────────────────────────────────

/**
 * Compute a SHA-256 hex digest of the bytes in `filePath` by streaming. We
 * never load the whole file into memory.
 */
export async function sha256OfFile(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(filePath), hash);
  return hash.digest('hex');
}

/**
 * Move a temporary upload (e.g. a multer disk-storage temp file) into its
 * final location. Creates the destination directory if needed.
 *
 * The move is atomic when source and destination are on the same filesystem
 * (which they always are when the temp dir lives under the storage root).
 */
export async function moveIntoStorage(
  tempPath: string,
  destPath: string,
): Promise<void> {
  await mkdir(path.dirname(destPath), { recursive: true });
  try {
    await rename(tempPath, destPath);
  } catch (err) {
    // Cross-device or permission edge case: fall back to copy + unlink.
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'EXDEV') throw err;
    await pipeline(createReadStream(tempPath), createWriteStream(destPath));
    await rm(tempPath, { force: true });
  }
}

/**
 * Best-effort cleanup. Removes the file at the given path (if any) and tries
 * to remove the immediate parent directory if it ends up empty. Never throws.
 */
export async function removeFromStorage(storagePath: string): Promise<void> {
  await rm(storagePath, { force: true }).catch(() => undefined);
  // Attempt to remove the empty {fileId} dir. Ignore if not empty / missing.
  await rm(path.dirname(storagePath), { recursive: false, maxRetries: 0 })
    .catch(() => undefined);
}

/**
 * Ensure the configured storage root and its temp subdirectory exist on disk.
 * Called once at server boot.
 */
export async function ensureStorageRoot(): Promise<void> {
  const root = path.resolve(config.fileStorageRoot);
  await mkdir(root, { recursive: true });
  await mkdir(tempUploadDir(), { recursive: true });
}

/**
 * Return the file size in bytes. Throws if the file is missing.
 */
export async function fileSize(filePath: string): Promise<number> {
  const s = await stat(filePath);
  return s.size;
}

// ── Limits ─────────────────────────────────────────────────────────────────

/** Max upload size in bytes (derived from MAX_UPLOAD_MB env). */
export const MAX_UPLOAD_BYTES = config.maxUploadMb * 1024 * 1024;

// ── Module-load init ───────────────────────────────────────────────────────
//
// Create the storage root and temp dir synchronously when this module is
// first imported. This guarantees the directories exist before multer or
// any route handler tries to write into them. Failure here is fatal: the
// server cannot accept uploads without a working storage root.

try {
  mkdirSync(path.resolve(config.fileStorageRoot), { recursive: true });
  mkdirSync(tempUploadDir(), { recursive: true });
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('[fileStorage] failed to initialise storage root:', err);
  throw err;
}
