import Dexie, { type Table } from 'dexie';
import type { Document, ChatMessage, Agent, AIProviderConfig, AppSettings, QuickPrompt } from '../types';

export interface FileHandleRecord {
  key: string;
  handle: FileSystemDirectoryHandle;
}

class ZenEditorDB extends Dexie {
  documents!: Table<Document>;
  chatMessages!: Table<ChatMessage>;
  agents!: Table<Agent>;
  providerConfigs!: Table<AIProviderConfig>;
  settings!: Table<AppSettings>;
  quickPrompts!: Table<QuickPrompt>;
  fileHandles!: Table<FileHandleRecord>;

  constructor() {
    super('ZenEditorDB');
    this.version(1).stores({
      documents: 'id, title, updatedAt, order',
      chatMessages: 'id, documentId, agentId, timestamp',
      agents: 'id, name, isDefault',
      providerConfigs: 'id, provider, isActive',
      settings: 'key',
      quickPrompts: 'id, createdAt',
    });
    this.version(2).stores({
      documents: 'id, title, updatedAt, order',
      chatMessages: 'id, documentId, agentId, timestamp',
      agents: 'id, name, isDefault',
      providerConfigs: 'id, provider, isActive',
      settings: 'key',
      quickPrompts: 'id, createdAt',
      fileHandles: 'key',
    });
  }
}

export const db = new ZenEditorDB();

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const row = await db.settings.get(key);
  if (row === undefined) return defaultValue;
  return row.value as T;
}

export async function setSetting(key: string, value: string | number | boolean) {
  await db.settings.put({ key, value });
}
