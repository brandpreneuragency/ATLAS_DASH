import { FolderTree } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

export function FileExplorerToggle() {
  const { fileExplorerOpen, setFileExplorerOpen } = useUIStore();

  return (
    <button
      type="button"
      onClick={() => setFileExplorerOpen(!fileExplorerOpen)}
      title={fileExplorerOpen ? 'Hide file explorer' : 'Show file explorer'}
      className={`
        flex items-center justify-center
        w-[36px] h-[36px] flex-shrink-0 rounded-[10px]
        border border-solid border-[#cfcfcf] transition-all duration-100
        ${fileExplorerOpen
          ? 'bg-[#EEF2FF] text-brand'
          : 'bg-white text-text-secondary hover:text-brand hover:bg-highlight/30'
        }
      `}
    >
      <FolderTree size={15} />
    </button>
  );
}
