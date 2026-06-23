export type Theme = 'default' | 'cyberpunk';

export const THEMES: { id: Theme; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'cyberpunk', label: 'Cyberpunk' },
];

export const DEFAULT_THEME: Theme = 'default';

export function isTheme(value: unknown): value is Theme {
  return value === 'default' || value === 'cyberpunk';
}
