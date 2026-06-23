import { useEffect, useState, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { AppLayout } from './components/layout/AppLayout';
import { Header } from './components/header/Header';
import { SubtasksToggleBar } from './components/header/SubtasksToggleBar';
import { EditorWorkspace } from './components/editor/EditorWorkspace';
import { TaskDetailPanel } from './components/taskManager/TaskDetailPanel';
import { AISidebar } from './components/sidebar/AISidebar';
import { FileExplorerPanel } from './components/fileExplorer/FileExplorerPanel';
import { TaskListPanel } from './components/taskManager/TaskListPanel';
import { SettingsModal } from './components/modals/SettingsModal';
import { AgentEditor } from './components/modals/AgentEditor';
import { ModelManagementModal } from './components/modals/ModelManagementModal';
import { QuickPrompts } from './components/modals/QuickPrompts';
import { WritersManagerModal } from './components/modals/WritersManagerModal';
import { TaskProfilesManagerModal } from './components/modals/TaskProfilesManagerModal';
import { ActionsManagerModal } from './components/modals/ActionsManagerModal';
import { AgentsManagerModal } from './components/modals/AgentsManagerModal';
import { FontSettingsModal } from './components/modals/FontSettingsModal';
import { TrashModal } from './components/modals/TrashModal';
import { ModelSwitcher } from './components/ui/ModelSwitcher';
import { ToastContainer } from './components/ui/Toast';
import { PageTemplatePage } from './components/pageTemplate';
import { useDocumentStore } from './stores/documentStore';
import { useUIStore } from './stores/uiStore';
import { useAIStore } from './stores/aiStore';
import { useFileSystemStore } from './stores/fileSystemStore';
import { useTaskStore } from './stores/taskStore';
import { useProjectStore } from './stores/projectStore';
import { runStartupUpdateCheck } from './services/updater';

export default function App() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const { loadDocuments, activeDocumentId, isLoaded: docsLoaded, setActiveDocument } = useDocumentStore();
  const { loadUISettings, taskMode, pageMode, activeTaskId, setTaskMode } = useUIStore();
  const { loadAISettings } = useAIStore();
  const { loadFileSystemSettings } = useFileSystemStore();
  const { loadTasks, isLoaded: tasksLoaded, activeTaskId: storeActiveTaskId, setActiveTask, tasks } = useTaskStore();
  const { loadProjects, isLoaded: projectsLoaded } = useProjectStore();

  const isLoaded = docsLoaded && tasksLoaded && projectsLoaded;

  useEffect(() => {
    void Promise.all([
      loadDocuments(),
      loadUISettings(),
      loadAISettings(),
      loadFileSystemSettings(),
      loadTasks(),
      loadProjects(),
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
  const activeWorkspace = pageMode ? <PageTemplatePage /> : taskMode ? <TaskDetailPanel /> : <EditorWorkspace onEditorReady={handleEditorReady} />;

  return (
    <>
      {/* Shell — `app-shell` is the Agent 2 foundation (100dvh +
          grid, see src/styles/layout.css). The `#app-content` rule
          in index.css keeps `margin-top: 0` and a stable overflow
          anchor. The direct child `.app-shell-main` guarantees
          `min-height: 0; min-width: 0; overflow: hidden` so the
          workspace can shrink and internal panels can scroll. */}
      <div id="app-content" className="app-shell">
        <div className="app-shell-main">
          <AppLayout
            header={pageMode ? null : <Header />}
            subtasksBar={<SubtasksToggleBar />}
            editor={activeWorkspace}
            sidebar={
              pageMode ? null : (
                <AISidebar
                  documentId={taskMode ? '' : activeDocumentId}
                  taskId={taskMode ? effectiveTaskId ?? '' : ''}
                  editor={editor}
                />
              )
            }
            leftPanel={<FileExplorerPanel />}
            taskListPanel={<TaskListPanel />}
            modals={
              <>
                <SettingsModal />
                <AgentEditor />
                <QuickPrompts onSelectPrompt={handleQuickPromptSelect} />
                <ModelManagementModal />
                <WritersManagerModal />
                <TaskProfilesManagerModal />
                <ActionsManagerModal />
                <AgentsManagerModal />
                <FontSettingsModal />
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
