import Dexie, { type Table } from 'dexie';
import type { Document, ChatMessage, Agent, AIProviderConfig, AppSettings, QuickPrompt, Task, Project, TaskComment, TaskAIChangeBatch, ChatThreadMeta } from '../types';

export interface FileHandleRecord {
  key: string;
  path: string;
}

class ZenEditorDB extends Dexie {
  documents!: Table<Document>;
  chatMessages!: Table<ChatMessage>;
  agents!: Table<Agent>;
  providerConfigs!: Table<AIProviderConfig>;
  settings!: Table<AppSettings>;
  quickPrompts!: Table<QuickPrompt>;
  fileHandles!: Table<FileHandleRecord>;
  tasks!: Table<Task>;
  projects!: Table<Project>;
  taskComments!: Table<TaskComment>;
  taskAIChangeBatches!: Table<TaskAIChangeBatch>;
  chatThreads!: Table<ChatThreadMeta>;

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
    this.version(3).stores({
      documents: 'id, title, updatedAt, order',
      chatMessages: 'id, documentId, taskId, agentId, timestamp',
      agents: 'id, name, isDefault',
      providerConfigs: 'id, provider, isActive',
      settings: 'key',
      quickPrompts: 'id, createdAt',
      fileHandles: 'key',
      tasks: 'id, title, updatedAt, order, projectId, status',
      projects: 'id, name',
      taskComments: 'id, taskId, createdAt',
    });
    this.version(5).stores({
      documents: 'id, title, updatedAt, order',
      chatMessages: 'id, documentId, taskId, agentId, timestamp',
      agents: 'id, name, isDefault',
      providerConfigs: 'id, provider, isActive',
      settings: 'key',
      quickPrompts: 'id, createdAt',
      fileHandles: 'key',
      tasks: 'id, title, updatedAt, order, projectId, status, parentId',
      projects: 'id, name',
      taskComments: 'id, taskId, createdAt',
    }).upgrade(async (tx) => {
      // Clear all old provider configs (clean slate for custom providers)
      await tx.table('providerConfigs').clear();
    });
    this.version(6).stores({
      documents: 'id, title, updatedAt, order',
      chatMessages: 'id, documentId, taskId, agentId, timestamp',
      agents: 'id, name, isDefault, scope',
      providerConfigs: 'id, provider, isActive',
      settings: 'key',
      quickPrompts: 'id, createdAt, scope',
      fileHandles: 'key',
      tasks: 'id, title, updatedAt, order, projectId, status, parentId',
      projects: 'id, name',
      taskComments: 'id, taskId, createdAt',
      taskAIChangeBatches: 'id, taskId, createdAt, expiresAt',
    }).upgrade(async (tx) => {
      const agents = await tx.table('agents').toArray();
      await Promise.all(
        agents.map((agent: any) =>
          tx.table('agents').update(agent.id, {
            scope: agent.scope === 'task' ? 'task' : 'writer',
          })
        )
      );

      const prompts = await tx.table('quickPrompts').toArray();
      await Promise.all(
        prompts.map((prompt: any) =>
          tx.table('quickPrompts').update(prompt.id, {
            scope: prompt.scope === 'task' ? 'task' : 'writer',
          })
        )
      );
    });
    this.version(7).stores({
      documents: 'id, title, updatedAt, order',
      chatMessages: 'id, threadId, mode, agentId, timestamp',
      agents: 'id, name, isDefault, scope',
      providerConfigs: 'id, provider, isActive',
      settings: 'key',
      quickPrompts: 'id, createdAt, scope',
      fileHandles: 'key',
      tasks: 'id, title, updatedAt, order, projectId, status, parentId',
      projects: 'id, name',
      taskComments: 'id, taskId, createdAt',
      taskAIChangeBatches: 'id, taskId, createdAt, expiresAt',
      chatThreads: 'id, mode, updatedAt',
    }).upgrade(async (tx) => {
      await tx.table('chatMessages').clear();
    });
    this.version(8).stores({
      documents: 'id, title, updatedAt, order',
      chatMessages: 'id, threadId, mode, agentId, timestamp',
      agents: 'id, name, isDefault, scope',
      providerConfigs: 'id, provider, isActive',
      settings: 'key',
      quickPrompts: 'id, createdAt, scope',
      fileHandles: 'key',
      tasks: 'id, title, updatedAt, order, projectId, status, parentId',
      projects: 'id, name',
      taskComments: 'id, taskId, createdAt',
      taskAIChangeBatches: 'id, taskId, createdAt, expiresAt',
      chatThreads: 'id, mode, updatedAt',
    }).upgrade(async (tx) => {
      // Phase 3 — Tauri file system migration. Old rows in `fileHandles`
      // held a `FileSystemDirectoryHandle` from the browser File System
      // Access API, which is not a valid value in the Tauri shell. Clear
      // the table; users will reconnect their folders in the Tauri app.
      await tx.table('fileHandles').clear();
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
