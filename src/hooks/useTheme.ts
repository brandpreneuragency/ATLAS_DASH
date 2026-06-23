import { useCallback } from 'react';
import { useUIStore } from '../stores/uiStore';
import { DEFAULT_THEME, THEMES, type Theme } from '../types/theme';

export function useTheme() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'default' ? 'cyberpunk' : 'default');
  }, [theme, setTheme]);

  const applyTheme = useCallback(
    (next: Theme) => {
      setTheme(next);
    },
    [setTheme]
  );

  return {
    theme,
    setTheme: applyTheme,
    toggleTheme,
    available: THEMES,
    isCyberpunk: theme === 'cyberpunk',
    isDefault: theme === DEFAULT_THEME,
  };
}
