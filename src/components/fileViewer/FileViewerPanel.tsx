import { useEffect } from 'react';
import './fileViewer.css';
import { useUIStore } from '../../stores/uiStore';
import { FileViewerHeader } from './FileViewerHeader';
import { FileViewerContent } from './FileViewerContent';

export function FileViewerPanel() {
  const fileViewerOpen = useUIStore((s) => s.fileViewerOpen);
  const fileViewerFile = useUIStore((s) => s.fileViewerFile);
  const closeFileViewer = useUIStore((s) => s.closeFileViewer);

  // Close on Escape key
  useEffect(() => {
    if (!fileViewerOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeFileViewer();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [fileViewerOpen, closeFileViewer]);

  if (!fileViewerOpen || !fileViewerFile) return null;

  return (
    <div className="file-viewer-panel panel">
      <FileViewerHeader file={fileViewerFile} />
      <div className="file-viewer-content panel-body">
        <FileViewerContent file={fileViewerFile} />
      </div>
    </div>
  );
}
