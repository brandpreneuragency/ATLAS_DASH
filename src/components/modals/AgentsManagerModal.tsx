import { X } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { CharactersPanel } from '../sidebar/CharactersPanel';

export function AgentsManagerModal() {
  const { activeModal, setActiveModal } = useUIStore();

  if (activeModal !== 'agentsManager') return null;

  return (
    <div className="overlay" id="agents-manager-overlay">
      <div className="modal modal--sm flex-col overflow-h" id="agents-manager-modal" style={{ maxHeight: 'var(--modal-max-height)' }}>
        <div className="modal-head shrink-0" style={{ padding: '12px 20px', background: 'var(--c-background-3)', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
          <h2>Manage Agents</h2>
          <button
            id="agents-manager-close-btn"
            onClick={() => setActiveModal(null)}
            aria-label="Close"
            className="modal-close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-h flex-col" id="agents-manager-body">
          <CharactersPanel scopes={['writer', 'task']} />
        </div>
      </div>
    </div>
  );
}