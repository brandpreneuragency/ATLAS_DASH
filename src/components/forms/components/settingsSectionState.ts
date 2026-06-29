// Tiny component-scoped UI state that keeps the Forms Settings section in
// sync between Panel 1 (SettingsNav) and Panel 2 (FormsSettingsPage).
//
// This is NOT entity/data store state — it is a single UI string (the active
// settings section) and lives here so the two sibling panels can share it
// without editing uiStore/formsStore (owned by other agents). Uses
// useSyncExternalStore for tear-free subscription.

import { useSyncExternalStore } from 'react';

export type FormsSettingsSection =
  | 'defaults'
  | 'spam'
  | 'notifications'
  | 'webhooks'
  | 'file_uploads'
  | 'embed_security'
  | 'export';

export const FORMS_SETTINGS_SECTIONS: { key: FormsSettingsSection; label: string }[] = [
  { key: 'defaults', label: 'Defaults' },
  { key: 'spam', label: 'Spam Protection' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'webhooks', label: 'Webhooks' },
  { key: 'file_uploads', label: 'File Uploads' },
  { key: 'embed_security', label: 'Embed Security' },
  { key: 'export', label: 'Export' },
];

let currentSection: FormsSettingsSection = 'defaults';
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function setFormsSettingsSection(section: FormsSettingsSection): void {
  if (section === currentSection) return;
  currentSection = section;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): FormsSettingsSection {
  return currentSection;
}

export function useFormsSettingsSection(): FormsSettingsSection {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
