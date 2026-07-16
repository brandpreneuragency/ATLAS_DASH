/**
 * Shared placeholder copy for inputs across the app.
 */
export function usePlaceholder(key: keyof typeof PLACEHOLDERS): string {
  return PLACEHOLDERS[key];
}

const PLACEHOLDERS = {
  addTask: 'Add a task...',
  transmitMessage: 'Write a comment...',
  queryAI: 'Ask AI...',
  addSubtask: 'Add another subtask...',
  addSubtaskFooter: 'Add a subtask...',
  find: 'Find',
  replace: 'Replace',
  searchFiles: 'Search files...',
  linkUrl: 'https://example.com',
  altText: 'Alt text',
} as const;
