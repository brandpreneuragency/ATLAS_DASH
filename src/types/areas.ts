/**
 * The six top-level navigation areas (ratified at CP-M2, `docs/V1_M2_MODULE_MAP.md`).
 * Exactly six. No seventh area may be added here — the assistant sidebar,
 * context-window widgets, modals/overlays, and page templates are Global
 * shell surfaces, not areas.
 */
export const AREAS = ['agent', 'work', 'clients', 'today', 'files', 'settings'] as const;

export type Area = (typeof AREAS)[number];

export const DEFAULT_AREA: Area = 'work';

export function isArea(value: string | undefined): value is Area {
  return (AREAS as readonly string[]).includes(value ?? '');
}

/** First path segment of `pathname`, e.g. `/clients/pipeline` -> `clients`. */
export function areaFromPathname(pathname: string): Area {
  const seg = pathname.split('/')[1];
  return isArea(seg) ? seg : DEFAULT_AREA;
}

export interface AreaDef {
  key: Area;
  label: string;
  path: string;
}

export const AREA_DEFS: readonly AreaDef[] = [
  { key: 'agent', label: 'Agent', path: '/agent' },
  { key: 'work', label: 'Work', path: '/work' },
  { key: 'clients', label: 'Clients', path: '/clients' },
  { key: 'today', label: 'Today', path: '/today' },
  { key: 'files', label: 'Files', path: '/files' },
  { key: 'settings', label: 'Settings', path: '/settings' },
];
