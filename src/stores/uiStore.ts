import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { db } from '../services/db';
import i18n from '../i18n';
import type { FileViewerItem } from '../types';
import { DEFAULT_THEME, isTheme, type Theme } from '../types/theme';

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

/** Active sub-page within the CRM module (owned by uiStore so the shell can switch panels). */
export type CRMPage = 'dashboard' | 'leads' | 'contacts' | 'companies' | 'pipeline' | 'activities' | 'settings';
/** Active sub-page within the Forms module (owned by uiStore so the shell can switch panels). */
export type FormsPage = 'dashboard' | 'list' | 'builder' | 'submissions' | 'templates' | 'settings';

/** Sub-tabs rendered inside the Settings document. Fixed and non-closable. */
export type SettingsSubTab = 'models' | 'actions' | 'appearance' | 'agents';
/** Which doc-mode tab is active: a normal document or the special Settings doc. */
export type DocActiveView = 'document' | 'settings';

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
    | 'agentsManager'
    | 'actionsManagerModal'
    | 'appearanceSettings'
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
  pageMode: boolean;
  pagePanelOpen: boolean;
  activeTaskId: string | null;
  taskListOpen: boolean;
  subtasksOpen: boolean;

  /** CRM module active — mutually exclusive with task/page/forms modes. */
  crmMode: boolean;
  /** Forms module active — mutually exclusive with task/page/crm modes. */
  formsMode: boolean;
  /** Active sub-page within the CRM module. */
  activeCRMPage: CRMPage;
  /** Active sub-page within the Forms module. */
  activeFormsPage: FormsPage;

  /** Which doc-mode tab is active (normal document vs the special Settings doc). */
  activeView: DocActiveView;
  /** Active sub-tab inside the Settings document. */
  activeSettingsSubTab: SettingsSubTab;

  splitEditorWidth: number;

  /** Panels swapped state (AI panel on left, center panel on right) */
  panelsSwapped: boolean;

  /** Active UI theme */
  theme: Theme;

  /** File viewer panel state */
  fileViewerOpen: boolean;
  fileViewerFile: FileViewerItem | null;
  fileViewerPreviousSidebarOpen: boolean;
  fileViewerPreviousSidebarWidth: number;

  aiSidebarOpen: boolean;
  contextWindowOpen: boolean;
  contextWindowCollapsed: boolean;

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
  setPageMode: (v: boolean) => void;
  setPagePanelOpen: (v: boolean) => void;
  setCrmMode: (v: boolean) => void;
  setFormsMode: (v: boolean) => void;
  setActiveCRMPage: (p: CRMPage) => void;
  setActiveFormsPage: (p: FormsPage) => void;
  setActiveView: (v: DocActiveView) => void;
  setActiveSettingsSubTab: (tab: SettingsSubTab) => void;
  /** Switch to the Settings document tab, optionally targeting a sub-tab. */
  openSettings: (subTab?: SettingsSubTab) => void;
  setActiveTaskId: (id: string | null) => void;
  setTaskListOpen: (v: boolean) => void;
  setSubtasksOpen: (v: boolean) => void;
  setSplitEditorWidth: (w: number) => void;
  setPanelsSwapped: (v: boolean) => void;
  setTheme: (theme: Theme) => void;
  openFileViewer: (file: FileViewerItem) => void;
  closeFileViewer: () => void;
  setFileViewerFile: (file: FileViewerItem | null) => void;
  setAiSidebarOpen: (v: boolean) => void;
  setContextWindowOpen: (v: boolean) => void;
  setContextWindowCollapsed: (v: boolean) => void;
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
  pageMode: false,
  pagePanelOpen: true,
  activeTaskId: null,
  taskListOpen: true,
  subtasksOpen: true,
  crmMode: false,
  formsMode: false,
  activeCRMPage: 'dashboard',
  activeFormsPage: 'dashboard',
  activeView: 'document',
  activeSettingsSubTab: 'models',
  splitEditorWidth: 30,

  panelsSwapped: false,

  theme: DEFAULT_THEME,

  fileViewerOpen: false,
  fileViewerFile: null,
  fileViewerPreviousSidebarOpen: true,
  fileViewerPreviousSidebarWidth: 33,

  aiSidebarOpen: true,
  contextWindowOpen: false,
  contextWindowCollapsed: true,

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
    // Entering/leaving a non-doc mode always returns to the document view
    // (the Settings doc only lives in pure doc mode).
    set({ taskMode: v, pageMode: false, crmMode: false, formsMode: false, activeView: 'document' });
    db.settings.put({ key: 'taskMode', value: v });
    db.settings.put({ key: 'pageMode', value: false });
    db.settings.put({ key: 'crmMode', value: false });
    db.settings.put({ key: 'formsMode', value: false });
  },

  setPageMode: (v) => {
    set({
      taskMode: false,
      pageMode: v,
      crmMode: false,
      formsMode: false,
      activeView: 'document',
    });
    db.settings.put({ key: 'taskMode', value: false });
    db.settings.put({ key: 'pageMode', value: v });
    db.settings.put({ key: 'crmMode', value: false });
    db.settings.put({ key: 'formsMode', value: false });
  },

  setPagePanelOpen: (v) => {
    set({ pagePanelOpen: v });
    db.settings.put({ key: 'pagePanelOpen', value: v });
  },

  setCrmMode: (v) => {
    set({ crmMode: v, taskMode: false, pageMode: false, formsMode: false, activeView: 'document' });
    db.settings.put({ key: 'crmMode', value: v });
    db.settings.put({ key: 'taskMode', value: false });
    db.settings.put({ key: 'pageMode', value: false });
    db.settings.put({ key: 'formsMode', value: false });
  },

  setFormsMode: (v) => {
    set({ formsMode: v, taskMode: false, pageMode: false, crmMode: false, activeView: 'document' });
    db.settings.put({ key: 'formsMode', value: v });
    db.settings.put({ key: 'taskMode', value: false });
    db.settings.put({ key: 'pageMode', value: false });
    db.settings.put({ key: 'crmMode', value: false });
  },

  setActiveCRMPage: (p) => {
    set({ activeCRMPage: p });
    db.settings.put({ key: 'activeCRMPage', value: p });
  },

  setActiveFormsPage: (p) => {
    set({ activeFormsPage: p });
    db.settings.put({ key: 'activeFormsPage', value: p });
  },

  setActiveView: (v) => set({ activeView: v }),

  setActiveSettingsSubTab: (tab) => set({ activeSettingsSubTab: tab }),

  openSettings: (subTab) => {
    set((s) => ({
      activeView: 'settings',
      activeSettingsSubTab: subTab ?? s.activeSettingsSubTab,
      // Opening Settings never disturbs the task/page/crm/forms modes; it only
      // matters in doc mode where the Settings tab lives.
    }));
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

  setPanelsSwapped: (v: boolean) => {
    set({ panelsSwapped: v });
    db.settings.put({ key: 'panelsSwapped', value: v });
  },

  setTheme: (theme) => {
    set({ theme });
    document.documentElement.setAttribute('data-theme', theme);
    void db.settings.put({ key: 'theme', value: theme });
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

  setAiSidebarOpen: (v) => {
    set({ aiSidebarOpen: v });
    db.settings.put({ key: 'aiSidebarOpen', value: v });
  },

  setContextWindowOpen: (v) => {
    set({ contextWindowOpen: v });
  },

  setContextWindowCollapsed: (v) => {
    set({ contextWindowCollapsed: v });
    db.settings.put({ key: 'contextWindowCollapsed', value: v });
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
    const pageModeSetting = await db.settings.get('pageMode');
    const pagePanelOpen = await db.settings.get('pagePanelOpen');
    const lastActiveTaskId = await db.settings.get('lastActiveTaskId');
    const taskListOpen = await db.settings.get('taskListOpen');
    const splitEditorWidth = await db.settings.get('splitEditorWidth');
    const panelsSwapped = await db.settings.get('panelsSwapped');
    const themeSetting = await db.settings.get('theme');
    const contextWindowCollapsed = await db.settings.get('contextWindowCollapsed');
    const crmModeSetting = await db.settings.get('crmMode');
    const formsModeSetting = await db.settings.get('formsMode');
    const activeCRMPageSetting = await db.settings.get('activeCRMPage');
    const activeFormsPageSetting = await db.settings.get('activeFormsPage');

    const lang = (language?.value === 'tr' ? 'tr' : 'en') as 'en' | 'tr';
    i18n.changeLanguage(lang);
    document.documentElement.lang = lang;

    const theme: Theme = isTheme(themeSetting?.value) ? themeSetting.value : DEFAULT_THEME;
    document.documentElement.setAttribute('data-theme', theme);

    const pageMode = pageModeSetting ? Boolean(pageModeSetting.value) : false;
    const crmModeStored = crmModeSetting ? Boolean(crmModeSetting.value) : false;
    const formsModeStored = formsModeSetting ? Boolean(formsModeSetting.value) : false;
    // Keep all four modes mutually exclusive on load. Existing precedence
    // (pageMode wins over taskMode) is preserved; crm/forms slot in between.
    const crmMode = !pageMode && crmModeStored;
    const formsMode = !pageMode && !crmMode && formsModeStored;
    const taskModeValue = !pageMode && !crmMode && !formsMode && (taskMode ? Boolean(taskMode.value) : false);

    const CRM_PAGES: CRMPage[] = ['dashboard', 'leads', 'contacts', 'companies', 'pipeline', 'activities', 'settings'];
    const FORMS_PAGES: FormsPage[] = ['dashboard', 'list', 'builder', 'submissions', 'templates', 'settings'];
    const activeCRMPage: CRMPage =
      activeCRMPageSetting && CRM_PAGES.includes(activeCRMPageSetting.value as CRMPage)
        ? (activeCRMPageSetting.value as CRMPage)
        : 'dashboard';
    const activeFormsPage: FormsPage =
      activeFormsPageSetting && FORMS_PAGES.includes(activeFormsPageSetting.value as FormsPage)
        ? (activeFormsPageSetting.value as FormsPage)
        : 'dashboard';

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
      taskMode: taskModeValue,
      pageMode,
      pagePanelOpen: pagePanelOpen ? Boolean(pagePanelOpen.value) : true,
      activeTaskId: lastActiveTaskId ? String(lastActiveTaskId.value) : null,
      taskListOpen: taskListOpen ? Boolean(taskListOpen.value) : true,
      splitEditorWidth: splitEditorWidth ? Number(splitEditorWidth.value) : 30,
      panelsSwapped: panelsSwapped ? Boolean(panelsSwapped.value) : false,
      theme,
      aiSidebarOpen: true,
      contextWindowOpen: false,
      contextWindowCollapsed: contextWindowCollapsed ? Boolean(contextWindowCollapsed.value) : true,
      crmMode,
      formsMode,
      activeCRMPage,
      activeFormsPage,
    });
  },
}));
