import { X } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { CharactersPanel } from '../sidebar/CharactersPanel';

export function WritersManagerModal() {
  const { activeModal, setActiveModal } = useUIStore();

  if (activeModal !== 'writersManager') return null;

  return (
    <div className="overlay" id="writers-manager-overlay">
      <div className="modal modal--sm flex-col overflow-h" id="writers-manager-modal" style={{ maxHeight: '80vh' }}>
        <div className="modal-head shrink-0" style={{ padding: '12px 20px', background: 'var(--c-background-3)', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
          <h2>Manage Writers</h2>
          <button
            id="writers-manager-close-btn"
            onClick={() => setActiveModal(null)}
            aria-label="Close"
            className="modal-close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-h flex-col" id="writers-manager-body">
          <CharactersPanel scope="writer" title="Writers" />
        </div>
      </div>
    </div>
  );
}
