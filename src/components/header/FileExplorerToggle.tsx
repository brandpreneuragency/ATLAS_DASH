import { FolderTree } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

export function FileExplorerToggle() {
  const { fileExplorerOpen, setFileExplorerOpen } = useUIStore();

  return (
    <button
      type="button"
      onClick={() => setFileExplorerOpen(!fileExplorerOpen)}
      title={fileExplorerOpen ? 'Hide file explorer' : 'Show file explorer'}
      className={`header-toggle${fileExplorerOpen ? ' header-toggle--on' : ''}`}
    >
      <FolderTree size={15} />
    </button>
  );
}
