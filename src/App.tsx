import { useEffect, useState, useCallback, useRef } from 'react';
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
import { ModelSwitcher } from './components/ui/ModelSwitcher';
import { ToastContainer } from './components/ui/Toast';
import { AuthGate } from './components/auth/AuthGate';
import { useDocumentStore } from './stores/documentStore';
import { useUIStore } from './stores/uiStore';
import { useAIStore } from './stores/aiStore';
import { useFileSystemStore } from './stores/fileSystemStore';
import { useTaskStore } from './stores/taskStore';
import { useProjectStore } from './stores/projectStore';
import { useAuthStore } from './stores/authStore';
import { detectTauri } from './utils/tauri';
import { importRepository, previewHasData } from './repositories/importRepository';

export default function App() {
  // ── All hooks first. No early returns until every hook has run. ────────
  const [editor, setEditor] = useState<Editor | null>(null);
  const authPhase = useAuthStore((s) => s.phase);
  const authUser = useAuthStore((s) => s.user);
  const { loadDocuments, activeDocumentId, isLoaded: docsLoaded, setActiveDocument } = useDocumentStore();
  const { loadUISettings, taskMode, activeTaskId, setTaskMode } = useUIStore();
  const { loadAISettings } = useAIStore();
  const { loadFileSystemSettings } = useFileSystemStore();
  const { loadTasks, isLoaded: tasksLoaded, activeTaskId: storeActiveTaskId, setActiveTask, tasks } = useTaskStore();
  const { loadProjects, isLoaded: projectsLoaded } = useProjectStore();

  const isAuthenticated = authPhase === 'authenticated' && !!authUser;
  const isLoaded = docsLoaded && tasksLoaded && projectsLoaded;

  useEffect(() => {
    if (!isAuthenticated) return;
    void Promise.all([
      loadDocuments(),
      loadUISettings(),
      loadAISettings(),
      loadFileSystemSettings(),
      loadTasks(),
      loadProjects(),
    ]);
  }, [
    isAuthenticated,
    loadDocuments,
    loadUISettings,
    loadAISettings,
    loadFileSystemSettings,
    loadTasks,
    loadProjects,
  ]);

  // Listen for "open with TABS" / argv file events from the Rust shell.
  // The Tauri `listen` call is only safe in the desktop runtime. We guard
  // the call site with `detectTauri()` AND use a dynamic `import()` so the
  // static module graph never references `@tauri-apps/api/event` in the
  // web bundle. The bundler tree-shakes the dynamic-import target out
  // entirely in browser builds.
  useEffect(() => {
    if (!detectTauri()) return;
    let unlisten: (() => void) | null = null;
    void (async () => {
      try {
        const mod = await import('@tauri-apps/api/event');
        unlisten = await mod.listen<string>('tabs://open-file', (e) => {
          const payload = typeof e.payload === 'string' ? e.payload : '';
          if (!payload) return;
          void useDocumentStore.getState().openFileByPath(payload);
        });
      } catch (err) {
        console.warn('[App] failed to subscribe to tabs://open-file', err);
      }
    })();
    return () => { if (unlisten) unlisten(); };
  }, []);

  // Auto-prompt: when the user is freshly authenticated and the local Dexie
  // store has rows, surface a one-time toast actioning the import. The
  // setting `importPromptDismissed` is session-only so a fresh login shows
  // the prompt again (matches the plan: "Optional first-login prompt if
  // Dexie contains local records.").
  const importPromptShown = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || !isLoaded) return;
    if (importPromptShown.current) return;
    importPromptShown.current = true;
    void (async () => {
      try {
        const preview = await importRepository.getLocalPreview();
        if (!previewHasData(preview)) return;
        const { showToastWithAction, setActiveModal } = useUIStore.getState();
        const total =
          preview.projects + preview.tasks + preview.comments + preview.documents +
          preview.chatMessages + preview.chatThreads + preview.agents +
          preview.providerConfigs + preview.quickPrompts + preview.settings +
          preview.taskAIChangeBatches;
        showToastWithAction(
          `Local data found (${total} item${total === 1 ? '' : 's'}). Import to your account?`,
          'Open Settings',
          () => {
            setActiveModal('settings');
          },
          'info',
        );
      } catch (err) {
        // Dexie may not be available in some edge cases; the user can still
        // open the import section manually from Settings → Local data.
        // eslint-disable-next-line no-console
        console.warn('[App] import auto-prompt failed:', err);
      }
    })();
  }, [isAuthenticated, isLoaded]);

  // Keyboard shortcut: Ctrl/Cmd + Shift + T toggles task mode
  useEffect(() => {
    if (!isAuthenticated) return;
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
  }, [isAuthenticated, taskMode, setTaskMode, tasks, activeDocumentId, setActiveTask, setActiveDocument]);

  const handleEditorReady = useCallback((e: Editor) => {
    setEditor(e);
  }, []);

  const handleQuickPromptSelect = useCallback((prompt: string) => {
    sessionStorage.setItem('pendingPrompt', prompt);
    window.dispatchEvent(new CustomEvent('quickPromptSelected', { detail: prompt }));
  }, []);

  // ── Now the conditional renders. ───────────────────────────────────────
  if (!isAuthenticated) {
    return <AuthGate />;
  }

  if (!isLoaded) {
    return (
      <div className="h-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
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

  return (
    <>
      <AppLayout
        header={<Header />}
        subtasksBar={<SubtasksToggleBar />}
        editor={taskMode ? <TaskDetailPanel /> : <EditorWorkspace onEditorReady={handleEditorReady} />}
        sidebar={
          <AISidebar
            documentId={taskMode ? '' : activeDocumentId}
            taskId={taskMode ? effectiveTaskId ?? '' : ''}
            editor={editor}
          />
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
            <ModelSwitcher />
          </>
        }
      />
      <ToastContainer />
    </>
  );
}
