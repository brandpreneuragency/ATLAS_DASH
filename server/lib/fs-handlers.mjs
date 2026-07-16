// server/lib/fs-handlers.mjs — one async handler per fs endpoint.
// All take (roots, allowSensitive) config and parsed request params.
import fs from 'node:fs/promises';
import { resolveSafe, isSensitive } from './paths.mjs';

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function locate(roots, allowSensitive, rootId, relPath) {
  const root = roots.find((r) => r.id === rootId);
  if (!root) throw new HttpError(400, `unknown root '${rootId}'`);
  const abs = resolveSafe(root, relPath ?? '');
  if (abs === null) throw new HttpError(400, 'path escapes root');
  if (!allowSensitive && isSensitive(abs, root, roots)) throw new HttpError(403, 'sensitive path blocked');
  return abs;
}

export function createFsHandlers({ roots, allowSensitive }) {
  return {
    roots: async () => ({ roots }),
    list: async ({ root, path: rel }) => {
      const abs = locate(roots, allowSensitive, root, rel);
      const dirents = await fs.readdir(abs, { withFileTypes: true });
      return {
        entries: dirents.map((d) => ({
          name: d.name,
          path: rel ? `${rel}/${d.name}` : d.name,
          kind: d.isDirectory() ? 'directory' : 'file',
        })),
      };
    },
    readText: async ({ root, path: rel }) =>
      fs.readFile(locate(roots, allowSensitive, root, rel), 'utf8'),
    readBin: async ({ root, path: rel }) =>
      fs.readFile(locate(roots, allowSensitive, root, rel)),
    write: async ({ root, path: rel, content }) => {
      await fs.writeFile(locate(roots, allowSensitive, root, rel), content ?? '', 'utf8');
      return { ok: true };
    },
    mkdir: async ({ root, path: rel, recursive }) => {
      await fs.mkdir(locate(roots, allowSensitive, root, rel), { recursive: recursive !== false });
      return { ok: true };
    },
    remove: async ({ root, path: rel, recursive }) => {
      await fs.rm(locate(roots, allowSensitive, root, rel), { recursive: !!recursive, force: false });
      return { ok: true };
    },
    rename: async ({ root, from, to }) => {
      await fs.rename(
        locate(roots, allowSensitive, root, from),
        locate(roots, allowSensitive, root, to),
      );
      return { ok: true };
    },
    stat: async ({ root, path: rel }) => {
      const s = await fs.stat(locate(roots, allowSensitive, root, rel));
      return { size: s.size, modifiedAt: s.mtime.toISOString(), isDirectory: s.isDirectory(), isFile: s.isFile() };
    },
    exists: async ({ root, path: rel }) => {
      try { await fs.access(locate(roots, allowSensitive, root, rel)); return { exists: true }; }
      catch (e) { if (e.status) throw e; return { exists: false }; }
    },
  };
}
export { HttpError };
