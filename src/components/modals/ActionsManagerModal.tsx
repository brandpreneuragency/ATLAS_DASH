import { X } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { ActionsPanel } from '../sidebar/ActionsPanel';

export function ActionsManagerModal() {
  const { activeModal, setActiveModal, actionsManagerScope } = useUIStore();

  if (activeModal !== 'actionsManager') return null;

  return (
    <div className="overlay" id="actions-manager-overlay">
      <div className="modal modal--sm flex-col overflow-h" id="actions-manager-modal" style={{ maxHeight: 'var(--modal-max-height)' }}>
        <div className="modal-head shrink-0" style={{ padding: '12px 20px', background: 'var(--c-background-3)', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
          <h2>{actionsManagerScope === 'task' ? 'Manage Task Actions' : 'Manage Actions'}</h2>
          <button
            id="actions-manager-close-btn"
            onClick={() => setActiveModal(null)}
            aria-label="Close"
            className="modal-close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-h flex-col" id="actions-manager-body">
          <ActionsPanel scope={actionsManagerScope} />
        </div>
      </div>
    </div>
  );
}
