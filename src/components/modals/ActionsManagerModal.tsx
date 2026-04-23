import { X } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { ActionsPanel } from '../sidebar/ActionsPanel';

export function ActionsManagerModal() {
  const { activeModal, setActiveModal } = useUIStore();

  if (activeModal !== 'actionsManager') return null;

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-[#f0f0f0] rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-white rounded-t-2xl flex-shrink-0">
          <h2 className="text-sm font-semibold text-text-primary">Manage Actions</h2>
          <button
            onClick={() => setActiveModal(null)}
            aria-label="Close"
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">
          <ActionsPanel />
        </div>
      </div>
    </div>
  );
}
