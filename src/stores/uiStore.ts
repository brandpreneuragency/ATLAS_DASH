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

/** Active sub-page within the CRM module (owned by uiStore so the shell can switch panels).
 *  'forms' hosts the merged Forms sub-module (list/builder/submissions/templates/settings),
 *  whose exact page is tracked by `activeFormsPage`. */
export type CRMPage = 'dashboard' | 'leads' | 'contacts' | 'companies' | 'pipeline' | 'activities' | 'forms' | 'settings';
/** Active sub-page within the Forms module (owned by uiStore so the shell can switch panels). */
export type FormsPage = 'dashboard' | 'list' | 'builder' | 'submissions' | 'templates' | 'settings';
/** Active view within the Task module list panel (owned by uiStore so the shell header can switch views). */
export type TaskPage = 'list' | 'calendar' | 'projects';

/** Sub-tabs rendered inside the Settings document. Fixed and non-closable. */
export type SettingsSubTab = 'models' | 'actions' | 'appearance' | 'agents' | 'tools';
/** Which doc-mode tab is active: a normal document or the special Settings doc. */
export type DocActiveView = 'document' | 'settings';

interface UIStore {
  sidebarOpen: boolean;
  sidebarWidth: number; // vw 15-75
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
  activeTaskId: string | null;
  taskListOpen: boolean;
  subtasksOpen: boolean;

  /** CRM module active — mutually exclusive with task mode. Hosts the merged Forms sub-module via `activeCRMPage === 'forms'`. */
  crmMode: boolean;
  /** Active sub-page within the CRM module. */
  activeCRMPage: CRMPage;
  /** Active sub-page within the Forms module. */
  activeFormsPage: FormsPage;
  /** Active view within the Task module list panel. */
  activeTaskPage: TaskPage;

  /** Which doc-mode tab is active (normal document vs the special Settings doc). */
  activeView: DocActiveView;
  /** Active sub-tab inside the Settings document. */
  activeSettingsSubTab: SettingsSubTab;

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
  /** When panels are swapped, the center panel sits on the right; this controls its visibility. */
  centerPanelOpen: boolean;
  contextWindowOpen: boolean;
  contextWindowCollapsed: boolean;

  /** Terminal panel (bottom, VS Code-style) visibility + height. */
  terminalPanelOpen: boolean;
  terminalPanelHeight: number;

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
  setCrmMode: (v: boolean) => void;
  setActiveCRMPage: (p: CRMPage) => void;
  setActiveFormsPage: (p: FormsPage) => void;
  setActiveTaskPage: (p: TaskPage) => void;
  setActiveView: (v: DocActiveView) => void;
  setActiveSettingsSubTab: (tab: SettingsSubTab) => void;
  /** Switch to the Settings document tab, optionally targeting a sub-tab. */
  openSettings: (subTab?: SettingsSubTab) => void;
  setActiveTaskId: (id: string | null) => void;
  setTaskListOpen: (v: boolean) => void;
  setSubtasksOpen: (v: boolean) => void;
  setPanelsSwapped: (v: boolean) => void;
  setTheme: (theme: Theme) => void;
  openFileViewer: (file: FileViewerItem) => void;
  closeFileViewer: () => void;
  setFileViewerFile: (file: FileViewerItem | null) => void;
  setAiSidebarOpen: (v: boolean) => void;
  setCenterPanelOpen: (v: boolean) => void;
  /** Toggle whatever panel(s) are on the right side of the main row (detail or center when swapped). */
  toggleRightPanel: () => void;
  setContextWindowOpen: (v: boolean) => void;
  setContextWindowCollapsed: (v: boolean) => void;
  setTerminalPanelOpen: (v: boolean) => void;
  setTerminalPanelHeight: (h: number) => void;
  loadUISettings: () => Promise<void>;
}

function isMainRowSwapped(state: Pick<UIStore, 'panelsSwapped' | 'aiSidebarOpen' | 'fileViewerOpen' | 'crmMode' | 'taskMode' | 'activeView'>): boolean {
  if (state.taskMode || state.crmMode) return false;

  const settingsActive = state.activeView === 'settings';
  const showSidebarPanel = !settingsActive && (state.aiSidebarOpen || state.fileViewerOpen);
  return state.panelsSwapped && showSidebarPanel;
}

/** Panel swap (AI on left, editor on right) is doc-mode only. */
export function selectCanSwapPanels(state: Pick<UIStore, 'crmMode' | 'taskMode'>): boolean {
  return !state.taskMode && !state.crmMode;
}

export { isMainRowSwapped as selectIsMainRowSwapped };

/** True when the panel occupying the right side of #main-row is visible. */
export function selectIsRightPanelOpen(state: Pick<UIStore, 'panelsSwapped' | 'aiSidebarOpen' | 'fileViewerOpen' | 'centerPanelOpen' | 'crmMode' | 'taskMode' | 'activeView'>): boolean {
  const crmOrForms = state.crmMode;
  const settingsActive = !crmOrForms && !state.taskMode && state.activeView === 'settings';
  if (settingsActive) return false;

  if (isMainRowSwapped(state)) {
    return state.centerPanelOpen;
  }
  return state.aiSidebarOpen || state.fileViewerOpen;
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
  crmMode: false,
  activeCRMPage: 'leads',
  activeFormsPage: 'list',
  activeTaskPage: 'list',
  activeView: 'document',
  activeSettingsSubTab: 'models',

  panelsSwapped: false,

  theme: DEFAULT_THEME,

  fileViewerOpen: false,
  fileViewerFile: null,
  fileViewerPreviousSidebarOpen: true,
  fileViewerPreviousSidebarWidth: 33,

  aiSidebarOpen: true,
  centerPanelOpen: true,
  contextWindowOpen: false,
  contextWindowCollapsed: true,

  terminalPanelOpen: false,
  terminalPanelHeight: 240,

  setSidebarOpen: (v) => {
    set({ sidebarOpen: v });
    db.settings.put({ key: 'sidebarOpen', value: v });
  },

  setSidebarWidth: (w) => {
    const clamped = Math.min(75, Math.max(15, w));
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
    set({ taskMode: v, crmMode: false, activeView: 'document' });
    db.settings.put({ key: 'taskMode', value: v });
    db.settings.put({ key: 'crmMode', value: false });
  },

  setCrmMode: (v) => {
    set({ crmMode: v, taskMode: false, activeView: 'document' });
    db.settings.put({ key: 'crmMode', value: v });
    db.settings.put({ key: 'taskMode', value: false });
  },

  setActiveCRMPage: (p) => {
    const legacyPages = new Set<CRMPage>(['contacts', 'companies', 'activities']);
    const resolved: CRMPage = legacyPages.has(p) ? 'leads' : p;
    void import('./crmStore').then(({ useCrmStore }) => {
      useCrmStore.getState().setLeadsCenterView('lead');
    });
    set({ activeCRMPage: resolved });
    db.settings.put({ key: 'activeCRMPage', value: resolved });
  },

  setActiveFormsPage: (p) => {
    const resolved = p === 'templates' ? 'list' : p;
    set({ activeFormsPage: resolved });
    db.settings.put({ key: 'activeFormsPage', value: resolved });
  },

  setActiveTaskPage: (p) => {
    set({ activeTaskPage: p });
    db.settings.put({ key: 'activeTaskPage', value: p });
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

  setPanelsSwapped: (v: boolean) => {
    if (!selectCanSwapPanels(get())) return;
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

  setCenterPanelOpen: (v) => {
    set({ centerPanelOpen: v });
    db.settings.put({ key: 'centerPanelOpen', value: v });
  },

  toggleRightPanel: () => {
    const state = get();
    const open = selectIsRightPanelOpen(state);
    const swapped = isMainRowSwapped(state);

    if (open) {
      if (swapped) {
        set({ centerPanelOpen: false });
        db.settings.put({ key: 'centerPanelOpen', value: false });
      } else {
        if (state.fileViewerOpen) {
          get().closeFileViewer();
        }
        set({ aiSidebarOpen: false });
        db.settings.put({ key: 'aiSidebarOpen', value: false });
      }
    } else if (swapped) {
      set({ centerPanelOpen: true });
      db.settings.put({ key: 'centerPanelOpen', value: true });
    } else {
      set({ aiSidebarOpen: true });
      db.settings.put({ key: 'aiSidebarOpen', value: true });
    }
  },

  setContextWindowOpen: (v) => {
    set({ contextWindowOpen: v });
  },

  setContextWindowCollapsed: (v) => {
    set({ contextWindowCollapsed: v });
    db.settings.put({ key: 'contextWindowCollapsed', value: v });
  },

  setTerminalPanelOpen: (v) => {
    set({ terminalPanelOpen: v });
    db.settings.put({ key: 'terminalPanelOpen', value: v });
  },
  setTerminalPanelHeight: (h) => {
    const clamped = Math.min(window.innerHeight * 0.7, Math.max(120, h));
    set({ terminalPanelHeight: clamped });
    db.settings.put({ key: 'terminalPanelHeight', value: clamped });
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
    const panelsSwapped = await db.settings.get('panelsSwapped');
    const aiSidebarOpen = await db.settings.get('aiSidebarOpen');
    const centerPanelOpen = await db.settings.get('centerPanelOpen');
    const themeSetting = await db.settings.get('theme');
    const contextWindowCollapsed = await db.settings.get('contextWindowCollapsed');
    const terminalPanelOpen = await db.settings.get('terminalPanelOpen');
    const terminalPanelHeight = await db.settings.get('terminalPanelHeight');
    const crmModeSetting = await db.settings.get('crmMode');
    const formsModeSetting = await db.settings.get('formsMode');
    const activeCRMPageSetting = await db.settings.get('activeCRMPage');
    const activeFormsPageSetting = await db.settings.get('activeFormsPage');
    const activeTaskPageSetting = await db.settings.get('activeTaskPage');

    const lang = (language?.value === 'tr' ? 'tr' : 'en') as 'en' | 'tr';
    i18n.changeLanguage(lang);
    document.documentElement.lang = lang;

    const theme: Theme = isTheme(themeSetting?.value) ? themeSetting.value : DEFAULT_THEME;
    document.documentElement.setAttribute('data-theme', theme);

    const crmModeStored = crmModeSetting ? Boolean(crmModeSetting.value) : false;
    const formsModeStored = formsModeSetting ? Boolean(formsModeSetting.value) : false;
    // Forms module was merged into CRM. Migrate a persisted standalone formsMode
    // into CRM mode (activeCRMPage falls back to 'forms' below when migrated).
    const crmMode = crmModeStored || formsModeStored;
    const taskModeValue = !crmMode && (taskMode ? Boolean(taskMode.value) : false);

    const CRM_PAGES: CRMPage[] = ['dashboard', 'leads', 'contacts', 'companies', 'pipeline', 'activities', 'forms', 'settings'];
    const FORMS_PAGES: FormsPage[] = ['dashboard', 'list', 'builder', 'submissions', 'templates', 'settings'];
    const storedCRMPage = activeCRMPageSetting?.value as CRMPage | undefined;
    const migratedFromForms = formsModeStored && !crmModeStored;
    const rawCRMPage: CRMPage = migratedFromForms
      ? 'forms'
      : storedCRMPage && CRM_PAGES.includes(storedCRMPage) && storedCRMPage !== 'dashboard'
        ? storedCRMPage
        : 'leads';
    const legacyCRMPage = new Set<CRMPage>(['contacts', 'companies', 'activities']);
    const activeCRMPage: CRMPage = legacyCRMPage.has(rawCRMPage) ? 'leads' : rawCRMPage;
    if (legacyCRMPage.has(rawCRMPage)) {
      void import('./crmStore').then(({ useCrmStore }) => {
        useCrmStore.getState().setLeadsCenterView('lead');
      });
    }
    const storedFormsPage = activeFormsPageSetting?.value as FormsPage | undefined;
    const migratedFormsPage =
      storedFormsPage === 'templates' ? 'list' : storedFormsPage;
    const activeFormsPage: FormsPage =
      migratedFormsPage && FORMS_PAGES.includes(migratedFormsPage) && migratedFormsPage !== 'dashboard'
        ? migratedFormsPage
        : 'list';

    const TASK_PAGES: TaskPage[] = ['list', 'calendar', 'projects'];
    const storedTaskPage = activeTaskPageSetting?.value as TaskPage | undefined;
    const activeTaskPage: TaskPage =
      storedTaskPage && TASK_PAGES.includes(storedTaskPage) ? storedTaskPage : 'list';

    set({
      sidebarOpen: sidebarOpen ? Boolean(sidebarOpen.value) : true,
      sidebarWidth: Math.min(75, Math.max(15, sidebarWidth ? Number(sidebarWidth.value) : 25)),
      sidebarTab: (sidebarTab ? String(sidebarTab.value) : 'chat') as SidebarTab,
      fileExplorerOpen: fileExplorerOpen ? Boolean(fileExplorerOpen.value) : false,
      fileExplorerWidth: Math.min(40, Math.max(15, fileExplorerWidth ? Number(fileExplorerWidth.value) : 20)),
      expandedPaths: fileExplorerExpandedPaths ? JSON.parse(String(fileExplorerExpandedPaths.value)) : [],
      editorFontFamily: editorFontFamily ? String(editorFontFamily.value) : 'Inter',
      editorFontSize: editorFontSize ? (Number(editorFontSize.value) as 12 | 14 | 16) : 12,
      language: lang,
      taskMode: taskModeValue,
      activeTaskId: lastActiveTaskId ? String(lastActiveTaskId.value) : null,
      taskListOpen: taskListOpen ? Boolean(taskListOpen.value) : true,
      panelsSwapped: panelsSwapped ? Boolean(panelsSwapped.value) : false,
      theme,
      aiSidebarOpen: aiSidebarOpen ? Boolean(aiSidebarOpen.value) : true,
      centerPanelOpen: centerPanelOpen ? Boolean(centerPanelOpen.value) : true,
      contextWindowOpen: false,
      contextWindowCollapsed: contextWindowCollapsed ? Boolean(contextWindowCollapsed.value) : true,
      terminalPanelOpen: terminalPanelOpen ? Boolean(terminalPanelOpen.value) : false,
      terminalPanelHeight: terminalPanelHeight ? Number(terminalPanelHeight.value) : 240,
      crmMode,
      activeCRMPage,
      activeFormsPage,
      activeTaskPage,
    });
  },
}));
