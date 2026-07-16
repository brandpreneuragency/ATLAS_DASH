// Path-safety helpers for the fs API. Pure functions — no I/O.
import path from 'node:path';

/** Resolve a root-relative path; null if it escapes the root or is absolute. */
export function resolveSafe(root, relPath) {
  if (typeof relPath !== 'string') return null;
  if (relPath.startsWith('/') || relPath.startsWith('\\')) return null;
  const abs = path.posix.normalize(path.posix.join(root.path, relPath));
  if (abs !== root.path && !abs.startsWith(root.path + '/')) return null;
  return abs;
}

/**
 * A path is sensitive when it is an .env* file, or lives under a `.hermes/`
 * segment — unless the ACTIVE root is itself inside `.hermes` (the memories
 * root), which whitelists its own subtree.
 */
export function isSensitive(absPath, activeRoot, _roots) {
  const base = path.posix.basename(absPath);
  if (base === '.env' || base.startsWith('.env.')) return true;
  if (activeRoot.path.includes('/.hermes')) return false;
  return absPath.includes('/.hermes/') || absPath.endsWith('/.hermes');
}
