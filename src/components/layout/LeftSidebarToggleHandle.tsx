import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

export function LeftSidebarToggleHandle() {
  const { fileExplorerOpen, setFileExplorerOpen } = useUIStore();
  const toggle = () => setFileExplorerOpen(!fileExplorerOpen);

  return (
    <div
      onClick={toggle}
      className="c-ptr"
      style={{
        position: 'fixed', top: 0, left: 0, height: '100%', width: 16,
        zIndex: 50, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#d9d9d9',
        transition: 'background-color 0.15s',
      }}
    >
      {fileExplorerOpen
        ? <ChevronLeft size={12} style={{ color: '#8b5cf6', width: 16, height: 20 }} />
        : <ChevronRight size={12} style={{ color: '#8b5cf6', width: 16, height: 20 }} />}
    </div>
  );
}
