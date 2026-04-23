import { useEffect, useState, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { AppLayout } from './components/layout/AppLayout';
import { Header } from './components/header/Header';
import { EditorWorkspace } from './components/editor/EditorWorkspace';
import { AISidebar } from './components/sidebar/AISidebar';
import { FileExplorerPanel } from './components/fileExplorer/FileExplorerPanel';
import { SettingsModal } from './components/modals/SettingsModal';
import { AgentEditor } from './components/modals/AgentEditor';
import { ModelManagementModal } from './components/modals/ModelManagementModal';
import { QuickPrompts } from './components/modals/QuickPrompts';
import { WritersManagerModal } from './components/modals/WritersManagerModal';
import { ActionsManagerModal } from './components/modals/ActionsManagerModal';
import { ModelSwitcher } from './components/ui/ModelSwitcher';
import { ToastContainer } from './components/ui/Toast';
import { useDocumentStore } from './stores/documentStore';
import { useUIStore } from './stores/uiStore';
import { useAIStore } from './stores/aiStore';
import { useFileSystemStore } from './stores/fileSystemStore';

export default function App() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const { loadDocuments, activeDocumentId, isLoaded } = useDocumentStore();
  const { loadUISettings } = useUIStore();
  const { loadAISettings } = useAIStore();
  const { loadFileSystemSettings } = useFileSystemStore();

  useEffect(() => {
    Promise.all([loadDocuments(), loadUISettings(), loadAISettings(), loadFileSystemSettings()]);
  }, [loadDocuments, loadUISettings, loadAISettings, loadFileSystemSettings]);

  const handleEditorReady = useCallback((e: Editor) => {
    setEditor(e);
  }, []);

  const handleQuickPromptSelect = useCallback((prompt: string) => {
    // This will be handled by ChatInput via a shared state or event
    // For now, we store it in sessionStorage for ChatInput to pick up
    sessionStorage.setItem('pendingPrompt', prompt);
    window.dispatchEvent(new CustomEvent('quickPromptSelected', { detail: prompt }));
  }, []);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-text-secondary">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <AppLayout
        header={<Header />}
        editor={<EditorWorkspace onEditorReady={handleEditorReady} />}
        sidebar={<AISidebar documentId={activeDocumentId} editor={editor} />}
        leftPanel={<FileExplorerPanel />}
        modals={
          <>
            <SettingsModal />
            <AgentEditor />
            <QuickPrompts onSelectPrompt={handleQuickPromptSelect} />
            <ModelManagementModal />
            <WritersManagerModal />
            <ActionsManagerModal />
            <ModelSwitcher />
          </>
        }
      />
      <ToastContainer />
    </>
  );
}
