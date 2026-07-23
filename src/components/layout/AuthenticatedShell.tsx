import { useEffect, useState, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { AppTitlebar } from '../header/AppTitlebar';
import { Header } from '../header/Header';
import { SubtasksToggleBar } from '../header/SubtasksToggleBar';
import { EditorWorkspace } from '../editor/EditorWorkspace';
import { TaskDetailPanel } from '../taskManager/TaskDetailPanel';
import { TaskProjectsKanban } from '../taskManager/TaskProjectsKanban';
import { AISidebar } from '../sidebar/AISidebar';
import { FileExplorerPanel } from '../fileExplorer/FileExplorerPanel';
import { TaskListPanel } from '../taskManager/TaskListPanel';
import { AgentEditor } from '../modals/AgentEditor';
import { QuickPrompts } from '../modals/QuickPrompts';
import { TrashModal } from '../modals/TrashModal';
import { ModelSwitcher } from '../ui/ModelSwitcher';
import { ToastContainer } from '../ui/Toast';
import { CRMWorkspace } from './CRMWorkspace';
import { SessionListColumn } from '../chatMode/SessionListColumn';
import { CRMListPanel } from '../crm/CRMListPanel';
import { FormsListPanel } from '../forms/FormsListPanel';
import { CRMAISidebar } from '../sidebar/CRMAISidebar';
import { FilesAreaPlaceholder } from './areas/FilesAreaPlaceholder';
import { AgentSubTabs } from '../agent/AgentSubTabs';
import { AGENT_SUBVIEW_REGISTRY } from '../agent/agentSubviewRegistry';
import { TodayApprovals } from '../today/TodayApprovals';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useUIStore } from '../../stores/uiStore';
import type { CRMPage, FormsPage } from '../../stores/uiStore';
import { useAIStore } from '../../stores/aiStore';
import { useTaskStore } from '../../stores/taskStore';
import { useProjectStore } from '../../stores/projectStore';
import { useCrmStore } from '../../stores/crmStore';
import { useFormsStore } from '../../stores/formsStore';
import { useThemeStore } from '../../stores/themeStore';
import { useAgentAreaStore } from '../../stores/agentAreaStore';
import { runStartupUpdateCheck } from '../../services/updater';
import { loadReasoningOverlay } from '../../services/ai/reasoning';
import { areaFromPathname, isArea } from '../../types/areas';
import { useAreaRouteSync } from '../../router/useAreaRouteSync';

/**
 * The authenticated product shell: header, layout, sidebar, overlays, and
 * the six-area content switch. Mounted once by `AppRouter` behind
 * `RequireAuth`; the active area is derived from the URL on every render
 * (`areaFromPathname`) rather than from a per-area route match, so
 * navigating between areas never remounts the shell or re-fires the
 * startup data loads below.
 */
export function AuthenticatedShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const area = areaFromPathname(location.pathname);

  // Canonicalize "/" and any unknown first segment to the default area.
  useEffect(() => {
    const seg = location.pathname.split('/')[1];
    if (!isArea(seg)) navigate('/work', { replace: true });
  }, [location.pathname, navigate]);

  useAreaRouteSync(area);

  const agentSubTab = useAgentAreaStore((s) => s.subTab);

  const [editor, setEditor] = useState<Editor | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const { loadWorkspaces, activeWorkspaceId, isLoaded: docsLoaded, setActiveWorkspace } = useWorkspaceStore();
  const {
    loadUISettings,
    taskMode,
    activeTaskId,
    activeTaskPage,
    setTaskMode,
    activeCRMPage,
    activeFormsPage,
    activeSettingsSubTab,
  } = useUIStore();
  const { loadAISettings } = useAIStore();
  const { loadThemeTokens } = useThemeStore();
  const { loadTasks, isLoaded: tasksLoaded, activeTaskId: storeActiveTaskId, setActiveTask, tasks } = useTaskStore();
  const { loadProjects, isLoaded: projectsLoaded } = useProjectStore();

  // CRM/Forms active selections drive the Panel 3 CRM AI sidebar context.
  const activeLeadId = useCrmStore((s) => s.activeLeadId);
  const activePipelineView = useCrmStore((s) => s.activePipelineView);
  const activeFormId = useFormsStore((s) => s.activeFormId);
  const activeSubmissionId = useFormsStore((s) => s.activeSubmissionId);
  const activeFormStatus = useFormsStore((s) => s.forms.find((f) => f.id === s.activeFormId)?.status ?? null);

  const isLoaded = docsLoaded && tasksLoaded && projectsLoaded;

  useEffect(() => {
    void Promise.all([
      loadWorkspaces(),
      loadUISettings(),
      loadAISettings(),
      loadTasks(),
      loadProjects(),
      useCrmStore.getState().loadCrm(),
      useFormsStore.getState().loadForms(),
      loadThemeTokens(),
    ]);
    // Check for app updates in the background (no-op in the browser).
    void runStartupUpdateCheck();
    // Load any runtime-refreshed reasoning catalog override from Dexie.
    void loadReasoningOverlay();
  }, [
    loadWorkspaces,
    loadUISettings,
    loadAISettings,
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
          void useWorkspaceStore.getState().openFileByPath(payload);
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
          if (activeWorkspaceId) setActiveWorkspace(activeWorkspaceId);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [taskMode, setTaskMode, tasks, activeWorkspaceId, setActiveWorkspace, setActiveTask]);

  // Keyboard shortcut: Ctrl/Cmd + J toggles the terminal panel.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'j') {
        e.preventDefault();
        useUIStore.getState().setTerminalPanelOpen(!useUIStore.getState().terminalPanelOpen);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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

  // Panel 2 (editor) — content is chosen from the URL-derived area first so
  // there is no one-frame flash while `useAreaRouteSync`'s effect catches up
  // the legacy chatMode/crmMode/activeView flags other components still read.
  // D-CHAT: `AGENT_SUBVIEW_REGISTRY` is the single source of truth mapping
  // each Agent sub-tab to its presentation component — `chat` is the only
  // key allowed to map to `ChatWorkspace` (see the registry's own doc
  // comment and `agentSubviewRegistry.test.ts`).
  const AgentSubviewComponent = AGENT_SUBVIEW_REGISTRY[agentSubTab];
  const agentContent = <AgentSubviewComponent />;

  const activeWorkspace =
    area === 'agent' ? (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <AgentSubTabs />
        <div style={{ flex: 1, minHeight: 0 }}>
          {agentContent}
        </div>
      </div>
    ) : area === 'clients' ? (
      <CRMWorkspace />
    ) : area === 'today' ? (
      <TodayApprovals />
    ) : area === 'files' ? (
      <FilesAreaPlaceholder />
    ) : area === 'settings' ? (
      // Settings' primary content is owned by AppLayout (SettingsDocument →
      // section slots), driven by activeView via selectActiveWorkspaceMode.
      null
    ) : taskMode ? (
      activeTaskPage === 'projects' ? <TaskProjectsKanban /> : <TaskDetailPanel />
    ) : (
      <EditorWorkspace onEditorReady={handleEditorReady} />
    );

  // Panel 1 (leftPanel) — session list / CRM / Forms / file explorer. Only
  // the Chat sub-tab wants the Hermes session list; Runs/Workflows/
  // Schedules/Overview manage their own list+detail layout internally.
  const formsPageActive = area === 'clients' && activeCRMPage === 'forms';
  const leftPanel =
    area === 'agent' ? (
      agentSubTab === 'chat' ? <SessionListColumn /> : null
    ) : area === 'clients' ? (
      formsPageActive ? <FormsListPanel /> : <CRMListPanel />
    ) : area === 'today' || area === 'files' || area === 'settings' ? (
      null
    ) : (
      <FileExplorerPanel />
    );

  // Assistant content — CRM AI, Settings AI (scoped by sub-tab), or doc/task AI.
  const crmContext = {
    module: (formsPageActive ? 'forms' : 'crm') as 'crm' | 'forms',
    page: (formsPageActive ? activeFormsPage : activeCRMPage) as CRMPage | FormsPage,
    leadId: area === 'clients' && activeCRMPage === 'leads' ? activeLeadId : null,
    contactId: null,
    companyId: null,
    pipelineView: area === 'clients' && activeCRMPage === 'pipeline' ? (activePipelineView as string) : null,
    formId: formsPageActive && (activeFormsPage === 'builder' || activeFormsPage === 'list') ? activeFormId : null,
    submissionId: formsPageActive && activeFormsPage === 'submissions' ? activeSubmissionId : null,
    embedState: formsPageActive && (activeFormsPage === 'builder' || activeFormsPage === 'list') ? activeFormStatus : null,
  };

  const sidebar =
    area === 'agent' ? (
      <AISidebar workspaceId={null} taskId={null} editor={null} />
    ) : area === 'clients' ? (
      <CRMAISidebar crmContext={crmContext} />
    ) : area === 'today' || area === 'files' ? (
      <AISidebar workspaceId={null} taskId={null} editor={null} />
    ) : area === 'settings' ? (
      <AISidebar workspaceId={null} taskId={null} settingsTab={activeSettingsSubTab} editor={null} />
    ) : (
      <AISidebar
        workspaceId={taskMode ? '' : activeWorkspaceId}
        taskId={taskMode ? effectiveTaskId ?? '' : ''}
        editor={editor}
      />
    );

  return (
    <>
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
