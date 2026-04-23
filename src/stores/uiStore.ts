import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { db } from '../services/db';
import i18n from '../i18n';

export interface Toast {
  id: string;
  message: string;
  type: 'error' | 'info';
}

interface SelectionState {
  text: string;
  from: number;
  to: number;
}

export type SidebarTab = 'chat' | 'actions' | 'characters' | 'models';

interface UIStore {
  sidebarOpen: boolean;
  sidebarWidth: number; // percentage 30-40
  sidebarTab: SidebarTab;
  selectedText: SelectionState | null;
  activeModal: 'settings' | 'agentEditor' | 'quickPrompts' | 'editAgent' | 'modelManagement' | 'fontSettings' | 'writersManager' | 'actionsManager' | null;
  editingAgentId: string | null;
  findReplaceOpen: boolean;

  fileExplorerOpen: boolean;
  fileExplorerWidth: number; // percentage 20-40
  expandedPaths: string[];
  editorFontFamily: string;
  editorFontSize: 12 | 14 | 16;
  isDarkMode: boolean;
  language: 'en' | 'tr';

  toasts: Toast[];
  showToast: (message: string, type?: Toast['type']) => void;
  dismissToast: (id: string) => void;

  setSidebarOpen: (v: boolean) => void;
  setSidebarWidth: (w: number) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  setSelectedText: (sel: SelectionState | null) => void;
  setActiveModal: (m: UIStore['activeModal']) => void;
  setEditingAgentId: (id: string | null) => void;
  setFindReplaceOpen: (v: boolean) => void;
  setFileExplorerOpen: (v: boolean) => void;
  setFileExplorerWidth: (w: number) => void;
  setEditorFontFamily: (font: string) => void;
  setEditorFontSize: (size: 12 | 14 | 16) => void;
  setIsDarkMode: (v: boolean) => void;
  setLanguage: (lang: 'en' | 'tr') => void;
  toggleExpandedPath: (path: string) => void;
  setExpandedPaths: (paths: string[]) => void;
  loadUISettings: () => Promise<void>;
}

export const useUIStore = create<UIStore>((set, get) => ({
  toasts: [],

  showToast: (message, type = 'error') => {
    const id = nanoid(6);
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => get().dismissToast(id), 4000);
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  sidebarOpen: true,
  sidebarWidth: 33,
  sidebarTab: 'chat',
  selectedText: null,
  activeModal: null,
  editingAgentId: null,
  findReplaceOpen: false,

  fileExplorerOpen: false,
  fileExplorerWidth: 20,
  expandedPaths: [],
  editorFontFamily: 'Inter',
  editorFontSize: 12,
  isDarkMode: false,
  language: 'en',

  setSidebarOpen: (v) => {
    set({ sidebarOpen: v });
    db.settings.put({ key: 'sidebarOpen', value: v });
  },

  setSidebarWidth: (w) => {
    const clamped = Math.min(40, Math.max(30, w));
    set({ sidebarWidth: clamped });
    db.settings.put({ key: 'sidebarWidth', value: clamped });
  },

  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setSelectedText: (sel) => set({ selectedText: sel }),
  setActiveModal: (m) => set({ activeModal: m }),
  setEditingAgentId: (id) => set({ editingAgentId: id }),
  setFindReplaceOpen: (v) => set({ findReplaceOpen: v }),

  setEditorFontFamily: (font) => {
    set({ editorFontFamily: font });
    db.settings.put({ key: 'editorFontFamily', value: font });
  },

  setEditorFontSize: (size) => {
    set({ editorFontSize: size });
    db.settings.put({ key: 'editorFontSize', value: size });
  },

  setIsDarkMode: (v) => {
    set({ isDarkMode: v });
    db.settings.put({ key: 'isDarkMode', value: v });
  },

  setLanguage: (lang) => {
    set({ language: lang });
    i18n.changeLanguage(lang);
    db.settings.put({ key: 'language', value: lang });
  },

  setFileExplorerOpen: (v) => {
    set({ fileExplorerOpen: v });
    db.settings.put({ key: 'fileExplorerOpen', value: v });
  },

  setFileExplorerWidth: (w) => {
    const clamped = Math.min(40, Math.max(20, w));
    set({ fileExplorerWidth: clamped });
    db.settings.put({ key: 'fileExplorerWidth', value: clamped });
  },

  toggleExpandedPath: (path) => {
    const current = get().expandedPaths;
    const next = current.includes(path)
      ? current.filter((p) => p !== path)
      : [...current, path];
    set({ expandedPaths: next });
    db.settings.put({ key: 'fileExplorerExpandedPaths', value: JSON.stringify(next) });
  },

  setExpandedPaths: (paths) => {
    set({ expandedPaths: paths });
    db.settings.put({ key: 'fileExplorerExpandedPaths', value: JSON.stringify(paths) });
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
    const isDarkMode = await db.settings.get('isDarkMode');
    const language = await db.settings.get('language');

    const lang = (language?.value === 'tr' ? 'tr' : 'en') as 'en' | 'tr';
    i18n.changeLanguage(lang);

    set({
      sidebarOpen: sidebarOpen ? Boolean(sidebarOpen.value) : true,
      sidebarWidth: sidebarWidth ? Number(sidebarWidth.value) : 33,
      sidebarTab: (sidebarTab ? String(sidebarTab.value) : 'chat') as SidebarTab,
      fileExplorerOpen: fileExplorerOpen ? Boolean(fileExplorerOpen.value) : false,
      fileExplorerWidth: fileExplorerWidth ? Number(fileExplorerWidth.value) : 20,
      expandedPaths: fileExplorerExpandedPaths ? JSON.parse(String(fileExplorerExpandedPaths.value)) : [],
      editorFontFamily: editorFontFamily ? String(editorFontFamily.value) : 'Inter',
      editorFontSize: editorFontSize ? (Number(editorFontSize.value) as 12 | 14 | 16) : 12,
      isDarkMode: isDarkMode ? Boolean(isDarkMode.value) : false,
      language: lang,
    });
  },
}));
