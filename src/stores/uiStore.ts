import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { db } from '../services/db';
import i18n from '../i18n';
import type { FileViewerItem } from '../types';

export interface Toast {
  id: string;
  message: string;
  type: 'error' | 'info';
  actionLabel?: string;
  onAction?: () => void;
}

interface SelectionState {
  text: string;
  from: number;
  to: number;
}

export type SidebarTab = 'chat' | 'actions' | 'characters' | 'models';

interface UIStore {
  sidebarOpen: boolean;
  sidebarWidth: number; // vw 15-40
  sidebarTab: SidebarTab;
  selectedText: SelectionState | null;
  activeModal:
    | 'settings'
    | 'agentEditor'
    | 'quickPrompts'
    | 'editAgent'
    | 'modelManagement'
    | 'fontSettings'
    | 'writersManager'
    | 'taskProfilesManager'
    | 'actionsManager'
    | null;
  actionsManagerScope: 'writer' | 'task';
  editingAgentId: string | null;
  findReplaceOpen: boolean;
  htmlViewOpen: boolean;

  fileExplorerOpen: boolean;
  fileExplorerWidth: number; // vw 15-40
  settingsPanelOpen: boolean;
  expandedPaths: string[];
  selectedTreePath: string | null;
  editorFontFamily: string;
  editorFontSize: 12 | 14 | 16;
  language: 'en' | 'tr';

  taskMode: boolean;
  activeTaskId: string | null;
  taskListOpen: boolean;
  subtasksOpen: boolean;

  splitEditorWidth: number;

  /** File viewer panel state */
  fileViewerOpen: boolean;
  fileViewerFile: FileViewerItem | null;
  fileViewerPreviousSidebarOpen: boolean;
  fileViewerPreviousSidebarWidth: number;

  toasts: Toast[];
  showToast: (message: string, type?: Toast['type']) => void;
  showToastWithAction: (message: string, actionLabel: string, onAction: () => void, type?: Toast['type']) => void;
  dismissToast: (id: string) => void;

  setSidebarOpen: (v: boolean) => void;
  setSidebarWidth: (w: number) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  setSelectedText: (sel: SelectionState | null) => void;
  setActiveModal: (m: UIStore['activeModal']) => void;
  setActionsManagerScope: (scope: 'writer' | 'task') => void;
  setEditingAgentId: (id: string | null) => void;
  setFindReplaceOpen: (v: boolean) => void;
  setHtmlViewOpen: (v: boolean) => void;
  setFileExplorerOpen: (v: boolean) => void;
  setFileExplorerWidth: (w: number) => void;
  setSettingsPanelOpen: (v: boolean) => void;
  setEditorFontFamily: (font: string) => void;
  setEditorFontSize: (size: 12 | 14 | 16) => void;
  setLanguage: (lang: 'en' | 'tr') => void;
  toggleExpandedPath: (path: string) => void;
  setExpandedPaths: (paths: string[]) => void;
  setSelectedTreePath: (path: string | null) => void;
  setTaskMode: (v: boolean) => void;
  setActiveTaskId: (id: string | null) => void;
  setTaskListOpen: (v: boolean) => void;
  setSubtasksOpen: (v: boolean) => void;
  setSplitEditorWidth: (w: number) => void;
  openFileViewer: (file: FileViewerItem) => void;
  closeFileViewer: () => void;
  setFileViewerFile: (file: FileViewerItem | null) => void;
  loadUISettings: () => Promise<void>;
}

export const useUIStore = create<UIStore>((set, get) => ({
  toasts: [],

  showToast: (message, type = 'error') => {
    const id = nanoid(6);
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => get().dismissToast(id), 4000);
  },

  showToastWithAction: (message, actionLabel, onAction, type = 'info') => {
    const id = nanoid(6);
    set((s) => ({ toasts: [...s.toasts, { id, message, type, actionLabel, onAction }] }));
    setTimeout(() => get().dismissToast(id), 8000);
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  sidebarOpen: true,
  sidebarWidth: 33,
  sidebarTab: 'chat',
  selectedText: null,
  activeModal: null,
  actionsManagerScope: 'writer',
  editingAgentId: null,
  findReplaceOpen: false,
  htmlViewOpen: false,

  fileExplorerOpen: false,
  fileExplorerWidth: 22,
  settingsPanelOpen: false,
  expandedPaths: [],
  selectedTreePath: null,
  editorFontFamily: 'Inter',
  editorFontSize: 12,
  language: 'en',
  taskMode: false,
  activeTaskId: null,
  taskListOpen: true,
  subtasksOpen: true,
  splitEditorWidth: 30,

  fileViewerOpen: false,
  fileViewerFile: null,
  fileViewerPreviousSidebarOpen: true,
  fileViewerPreviousSidebarWidth: 33,

  setSidebarOpen: (v) => {
    set({ sidebarOpen: v });
    db.settings.put({ key: 'sidebarOpen', value: v });
  },

  setSidebarWidth: (w) => {
    const clamped = Math.min(40, Math.max(15, w));
    set({ sidebarWidth: clamped });
    db.settings.put({ key: 'sidebarWidth', value: clamped });
  },

  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setSelectedText: (sel) => set({ selectedText: sel }),
  setActiveModal: (m) => set({ activeModal: m }),
  setActionsManagerScope: (scope) => set({ actionsManagerScope: scope }),
  setEditingAgentId: (id) => set({ editingAgentId: id }),
  setFindReplaceOpen: (v) => set({ findReplaceOpen: v }),
  setHtmlViewOpen: (v) => set({ htmlViewOpen: v }),

  setEditorFontFamily: (font) => {
    set({ editorFontFamily: font });
    db.settings.put({ key: 'editorFontFamily', value: font });
  },

  setEditorFontSize: (size) => {
    set({ editorFontSize: size });
    db.settings.put({ key: 'editorFontSize', value: size });
  },

  setLanguage: (lang) => {
    set({ language: lang });
    i18n.changeLanguage(lang);
    document.documentElement.lang = lang;
    db.settings.put({ key: 'language', value: lang });
  },

  setFileExplorerOpen: (v) => {
    set({ fileExplorerOpen: v });
    db.settings.put({ key: 'fileExplorerOpen', value: v });
  },

  setFileExplorerWidth: (w) => {
    const clamped = Math.min(40, Math.max(15, w));
    set({ fileExplorerWidth: clamped });
    db.settings.put({ key: 'fileExplorerWidth', value: clamped });
  },

  setSettingsPanelOpen: (v) => {
    set({ settingsPanelOpen: v });
  },

  toggleExpandedPath: (path) => {
    const current = get().expandedPaths;
    const isExpanded = current.includes(path);
    if (isExpanded) {
      const next = current.filter((p) => p !== path);
      set({ expandedPaths: next });
      db.settings.put({ key: 'fileExplorerExpandedPaths', value: JSON.stringify(next) });
    } else {
      const parentPath = path.substring(0, path.lastIndexOf('/'));
      const next = [...current.filter((p) => {
        const pParent = p.substring(0, p.lastIndexOf('/'));
        return pParent !== parentPath;
      }), path];
      set({ expandedPaths: next });
      db.settings.put({ key: 'fileExplorerExpandedPaths', value: JSON.stringify(next) });
    }
  },

  setExpandedPaths: (paths) => {
    set({ expandedPaths: paths });
    db.settings.put({ key: 'fileExplorerExpandedPaths', value: JSON.stringify(paths) });
  },

  setSelectedTreePath: (path) => set({ selectedTreePath: path }),

  setTaskMode: (v) => {
    set({ taskMode: v });
    db.settings.put({ key: 'taskMode', value: v });
  },

  setActiveTaskId: (id) => {
    set({ activeTaskId: id });
    if (id) db.settings.put({ key: 'lastActiveTaskId', value: id });
  },

  setTaskListOpen: (v) => {
    set({ taskListOpen: v });
    db.settings.put({ key: 'taskListOpen', value: v });
  },

  setSubtasksOpen: (v) => set({ subtasksOpen: v }),

  setSplitEditorWidth: (w) => {
    const clamped = Math.min(50, Math.max(20, w));
    set({ splitEditorWidth: clamped });
    db.settings.put({ key: 'splitEditorWidth', value: clamped });
  },

  openFileViewer: (file) => {
    const { sidebarOpen, sidebarWidth } = get();
    set({
      fileViewerPreviousSidebarOpen: sidebarOpen,
      fileViewerPreviousSidebarWidth: sidebarWidth,
      sidebarOpen: false,
      fileViewerOpen: true,
      fileViewerFile: file,
    });
  },

  closeFileViewer: () => {
    const { fileViewerPreviousSidebarOpen, fileViewerPreviousSidebarWidth } = get();
    set({
      fileViewerOpen: false,
      fileViewerFile: null,
      sidebarOpen: fileViewerPreviousSidebarOpen,
      sidebarWidth: fileViewerPreviousSidebarWidth,
    });
  },

  setFileViewerFile: (file) => {
    set({ fileViewerFile: file });
  },

  loadUISettings: async () => {
    const sidebarOpen = await db.settings.get('sidebarOpen');
    const sidebarWidth = await db.settings.get('sidebarWidth');
    const sidebarTab = await db.settings.get('sidebarTab');
    const fileExplorerOpen = await db.settings.get('fileExplorerOpen');
    const fileExplorerWidth = await db.settings.get('fileExplorerWidth');
    const fileExplorerExpandedPaths = await db.settings.get('fileExplorerExpandedPaths');
    const editorFontFamily = await db.settings.get('editorFontFamily');
    const editorFontSize = await db.settings.get('editorFontSize');
    const language = await db.settings.get('language');
    const taskMode = await db.settings.get('taskMode');
    const lastActiveTaskId = await db.settings.get('lastActiveTaskId');
    const taskListOpen = await db.settings.get('taskListOpen');
    const splitEditorWidth = await db.settings.get('splitEditorWidth');

    const lang = (language?.value === 'tr' ? 'tr' : 'en') as 'en' | 'tr';
    i18n.changeLanguage(lang);
    document.documentElement.lang = lang;

    set({
      sidebarOpen: sidebarOpen ? Boolean(sidebarOpen.value) : true,
      sidebarWidth: Math.min(40, Math.max(15, sidebarWidth ? Number(sidebarWidth.value) : 25)),
      sidebarTab: (sidebarTab ? String(sidebarTab.value) : 'chat') as SidebarTab,
      fileExplorerOpen: fileExplorerOpen ? Boolean(fileExplorerOpen.value) : false,
      fileExplorerWidth: Math.min(40, Math.max(15, fileExplorerWidth ? Number(fileExplorerWidth.value) : 20)),
      expandedPaths: fileExplorerExpandedPaths ? JSON.parse(String(fileExplorerExpandedPaths.value)) : [],
      editorFontFamily: editorFontFamily ? String(editorFontFamily.value) : 'Inter',
      editorFontSize: editorFontSize ? (Number(editorFontSize.value) as 12 | 14 | 16) : 12,
      language: lang,
      taskMode: taskMode ? Boolean(taskMode.value) : false,
      activeTaskId: lastActiveTaskId ? String(lastActiveTaskId.value) : null,
      taskListOpen: taskListOpen ? Boolean(taskListOpen.value) : true,
      splitEditorWidth: splitEditorWidth ? Number(splitEditorWidth.value) : 30,
    });
  },
}));
