import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

export function LeftSidebarToggleHandle() {
  const { fileExplorerOpen, setFileExplorerOpen } = useUIStore();
  const toggle = () => setFileExplorerOpen(!fileExplorerOpen);

  return (
    <div
      onClick={toggle}
      className="fixed top-0 left-0 h-full w-4 z-[50] cursor-pointer flex items-center justify-center bg-[#d9d9d9] transition-colors"
    >
      {fileExplorerOpen
        ? <ChevronLeft size={12} className="text-[#8b5cf6] w-4 h-5" />
        : <ChevronRight size={12} className="text-[#8b5cf6] w-4 h-5" />}
    </div>
  );
}
