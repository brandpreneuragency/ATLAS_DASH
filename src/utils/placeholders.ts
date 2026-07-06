import { useTheme } from '../hooks/useTheme';

/**
 * Returns a placeholder string that may differ per theme.
 * The cyberpunk theme prepends ">" for that terminal feel.
 */
export function useThemedPlaceholder(key: keyof typeof PLACEHOLDERS, themeOverride?: 'default' | 'cyberpunk'): string {
  const { theme } = useTheme();
  const active = themeOverride ?? theme;
  const map = PLACEHOLDERS[key];
  return map[active] ?? map.default;
}

const PLACEHOLDERS = {
  addTask: {
    default: 'Add a task...',
    cyberpunk: '> Add a task...',
  },
  transmitMessage: {
    default: 'Write a comment...',
    cyberpunk: '> Transmit message...',
  },
  queryAI: {
    default: 'Ask AI...',
    cyberpunk: '> Query AI...',
  },
  addSubtask: {
    default: 'Add another subtask...',
    cyberpunk: '> Add another subtask...',
  },
  addSubtaskFooter: {
    default: 'Add a subtask...',
    cyberpunk: '> Add a subtask...',
  },
  find: {
    default: 'Find',
    cyberpunk: '> Find',
  },
  replace: {
    default: 'Replace',
    cyberpunk: '> Replace',
  },
  searchFiles: {
    default: 'Search files...',
    cyberpunk: '> Search files...',
  },
  linkUrl: {
    default: 'https://example.com',
    cyberpunk: '> https://example.com',
  },
  altText: {
    default: 'Alt text',
    cyberpunk: '> Alt text',
  },
} as const;
