import { useEffect, useState, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { AppLayout } from './components/layout/AppLayout';
import { AppTitlebar } from './components/header/AppTitlebar';
import { Header } from './components/header/Header';
import { SubtasksToggleBar } from './components/header/SubtasksToggleBar';
import { EditorWorkspace } from './components/editor/EditorWorkspace';
import { TaskDetailPanel } from './components/taskManager/TaskDetailPanel';
import { AISidebar } from './components/sidebar/AISidebar';
import { FileExplorerPanel } from './components/fileExplorer/FileExplorerPanel';
import { TaskListPanel } from './components/taskManager/TaskListPanel';
import { AgentEditor } from './components/modals/AgentEditor';
import { QuickPrompts } from './components/modals/QuickPrompts';
import { TrashModal } from './components/modals/TrashModal';
import { ModelSwitcher } from './components/ui/ModelSwitcher';
import { ToastContainer } from './components/ui/Toast';
import { PageTemplatePage } from './components/pageTemplate';
import { SettingsDocument } from './components/settings/SettingsDocument';
import { CRMWorkspace } from './components/layout/CRMWorkspace';
import { FormsWorkspace } from './components/layout/FormsWorkspace';
import { CRMListPanel } from './components/crm/CRMListPanel';
import { FormsListPanel } from './components/forms/FormsListPanel';
import { CRMAISidebar } from './components/sidebar/CRMAISidebar';
import { useDocumentStore } from './stores/documentStore';
import { useUIStore } from './stores/uiStore';
import type { CRMPage, FormsPage } from './stores/uiStore';
import { useAIStore } from './stores/aiStore';
import { useFileSystemStore } from './stores/fileSystemStore';
import { useTaskStore } from './stores/taskStore';
import { useProjectStore } from './stores/projectStore';
import { useCrmStore } from './stores/crmStore';
import { useFormsStore } from './stores/formsStore';
import { useThemeStore } from './stores/themeStore';
import { runStartupUpdateCheck } from './services/updater';

export default function App() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const { loadDocuments, activeDocumentId, isLoaded: docsLoaded, setActiveDocument } = useDocumentStore();
  const {
    loadUISettings,
    taskMode,
    pageMode,
    activeTaskId,
    setTaskMode,
    crmMode,
    formsMode,
    activeCRMPage,
    activeFormsPage,
    activeView,
  } = useUIStore();
  const { loadAISettings } = useAIStore();
  const { loadFileSystemSettings } = useFileSystemStore();
  const { loadThemeTokens } = useThemeStore();
  const { loadTasks, isLoaded: tasksLoaded, activeTaskId: storeActiveTaskId, setActiveTask, tasks } = useTaskStore();
  const { loadProjects, isLoaded: projectsLoaded } = useProjectStore();

  // CRM/Forms active selections drive the Panel 3 CRM AI sidebar context.
  const activeLeadId = useCrmStore((s) => s.activeLeadId);
  const activeContactId = useCrmStore((s) => s.activeContactId);
  const activeCompanyId = useCrmStore((s) => s.activeCompanyId);
  const activePipelineView = useCrmStore((s) => s.activePipelineView);
  const activeFormId = useFormsStore((s) => s.activeFormId);
  const activeSubmissionId = useFormsStore((s) => s.activeSubmissionId);
  const activeFormStatus = useFormsStore((s) => s.forms.find((f) => f.id === s.activeFormId)?.status ?? null);

  const isLoaded = docsLoaded && tasksLoaded && projectsLoaded;

  useEffect(() => {
    void Promise.all([
      loadDocuments(),
      loadUISettings(),
      loadAISettings(),
      loadFileSystemSettings(),
      loadTasks(),
      loadProjects(),
      useCrmStore.getState().loadCrm(),
      useFormsStore.getState().loadForms(),
      loadThemeTokens(),
    ]);
    // Check for app updates in the background (no-op in the browser).
    void runStartupUpdateCheck();
  }, [
    loadDocuments,
    loadUISettings,
    loadAISettings,
    loadFileSystemSettings,
    loadTasks,
    loadProjects,
    loadThemeTokens,
  ]);

  // Listen for "open with TABS" / argv file events from the Tauri shell.
  // This is a no-op in the browser — the dynamic import silently fails.
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    void (async () => {
      try {
        // Only attempt to subscribe if Tauri runtime is actually present.
        if (!('__TAURI_INTERNALS__' in window)) return;
        const mod = await import('@tauri-apps/api/event');
        unlisten = await mod.listen<string>('tabs://open-file', (e) => {
          const payload = typeof e.payload === 'string' ? e.payload : '';
          if (!payload) return;
          void useDocumentStore.getState().openFileByPath(payload);
        });
      } catch {
        // Not running in Tauri — ignore.
      }
    })();
    return () => { if (unlisten) unlisten(); };
  }, []);

  // Keyboard shortcut: Ctrl/Cmd + Shift + T toggles task mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        const newMode = !taskMode;
        setTaskMode(newMode);
        if (newMode) {
          const lastTaskId = tasks[0]?.id ?? null;
          if (lastTaskId) setActiveTask(lastTaskId);
        } else {
          if (activeDocumentId) setActiveDocument(activeDocumentId);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [taskMode, setTaskMode, tasks, activeDocumentId, setActiveTask, setActiveDocument]);

  const handleEditorReady = useCallback((e: Editor) => {
    setEditor(e);
  }, []);

  const handleQuickPromptSelect = useCallback((prompt: string) => {
    sessionStorage.setItem('pendingPrompt', prompt);
    window.dispatchEvent(new CustomEvent('quickPromptSelected', { detail: prompt }));
  }, []);

  if (!isLoaded) {
    return (
      <div className="h-dvh" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
        <div className="flex-col gap-3" style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{
            width: 32, height: 32,
            border: '2px solid var(--c-accent-center-panel)', borderTopColor: 'transparent',
            borderRadius: '50%',
          }} />
          <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>Loading...</span>
        </div>
      </div>
    );
  }

  const effectiveTaskId = activeTaskId ?? storeActiveTaskId;

  // The Settings doc only lives in doc mode (not task/page/crm/forms).
  const settingsActive = !taskMode && !pageMode && !crmMode && !formsMode && activeView === 'settings';

  // Panel 2 (editor) — CRM/Forms take precedence over doc/task/page.
  const activeWorkspace = crmMode
    ? <CRMWorkspace />
    : formsMode
    ? <FormsWorkspace />
    : pageMode
    ? <PageTemplatePage />
    : taskMode
    ? <TaskDetailPanel />
    : settingsActive
    ? <SettingsDocument />
    : <EditorWorkspace onEditorReady={handleEditorReady} />;

  // Panel 1 (leftPanel) — CRM/Forms list panels vs the file explorer.
  // Settings doc owns its own internal left panel, so hide the outer one.
  const leftPanel = crmMode
    ? <CRMListPanel />
    : formsMode
    ? <FormsListPanel />
    : settingsActive
    ? null
    : <FileExplorerPanel />;

  // Panel 3 (sidebar) — CRM AI sidebar for CRM/Forms; existing AISidebar for doc/task.
  // CRM AI sidebar context — only pass the selection relevant to the active page
  // so the sidebar shows the right assistant (lead vs contact vs pipeline vs form vs submission).
  const crmContext = {
    module: (crmMode ? 'crm' : 'forms') as 'crm' | 'forms',
    page: (crmMode ? activeCRMPage : activeFormsPage) as CRMPage | FormsPage,
    leadId: crmMode && activeCRMPage === 'leads' ? activeLeadId : null,
    contactId: crmMode && activeCRMPage === 'contacts' ? activeContactId : null,
    companyId: crmMode && activeCRMPage === 'companies' ? activeCompanyId : null,
    pipelineView: crmMode && activeCRMPage === 'pipeline' ? (activePipelineView as string) : null,
    formId: formsMode && (activeFormsPage === 'builder' || activeFormsPage === 'list') ? activeFormId : null,
    submissionId: formsMode && activeFormsPage === 'submissions' ? activeSubmissionId : null,
    embedState: formsMode && (activeFormsPage === 'builder' || activeFormsPage === 'list') ? activeFormStatus : null,
  };

  const sidebar = crmMode || formsMode
    ? <CRMAISidebar crmContext={crmContext} />
    : pageMode
    ? null
    : settingsActive
    ? null
    : (
      <AISidebar
        documentId={taskMode ? '' : activeDocumentId}
        taskId={taskMode ? effectiveTaskId ?? '' : ''}
        editor={editor}
      />
    );

  return (
    <>
      {/* Shell — `app-shell` is the Agent 2 foundation (100dvh +
          grid, see src/styles/layout.css). The `#app-content` rule
          in index.css keeps `margin-top: 0` and a stable overflow
          anchor. The direct child `.app-shell-main` guarantees
          `min-height: 0; min-width: 0; overflow: hidden` so the
          workspace can shrink and internal panels can scroll. */}
      <div id="app-content" className="app-shell">
        <AppTitlebar>
          <Header />
        </AppTitlebar>
        <div className="app-shell-main">
          <AppLayout
            subtasksBar={<SubtasksToggleBar />}
            editor={activeWorkspace}
            sidebar={sidebar}
            leftPanel={leftPanel}
            taskListPanel={<TaskListPanel />}
            modals={
              <>
                <AgentEditor />
                <QuickPrompts onSelectPrompt={handleQuickPromptSelect} />
                {trashOpen && <TrashModal onClose={() => setTrashOpen(false)} />}
                <ModelSwitcher />
              </>
            }
          />
        </div>
      </div>
      <ToastContainer />
    </>
  );
}
