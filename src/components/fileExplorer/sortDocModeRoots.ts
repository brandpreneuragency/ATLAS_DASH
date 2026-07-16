import type { FsRoot } from '../../services/tabsApi';

/** Preferred pin order: `atlas`, then `memories`, then any other roots (stable). */
const PIN_ORDER = ['atlas', 'memories'] as const;

/**
 * Sort Doc Mode VPS roots so `memories` sits immediately after `atlas`.
 * Other roots keep their relative order after the pinned pair.
 */
export function sortDocModeRoots(roots: FsRoot[]): FsRoot[] {
  return roots
    .map((root, index) => ({ root, index }))
    .sort((a, b) => {
      const ai = PIN_ORDER.indexOf(a.root.id as (typeof PIN_ORDER)[number]);
      const bi = PIN_ORDER.indexOf(b.root.id as (typeof PIN_ORDER)[number]);
      const aPin = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
      const bPin = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
      if (aPin !== bPin) return aPin - bPin;
      return a.index - b.index;
    })
    .map(({ root }) => root);
}
