import { X } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

export function ToastContainer() {
  const { toasts, dismissToast } = useUIStore();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`
            flex items-start gap-2 px-4 py-3 rounded-xl shadow-lg text-sm pointer-events-auto
            max-w-sm border
            ${t.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-white border-border text-text-primary'}
          `}
        >
          <span className="flex-1">{t.message}</span>
          <button
            type="button"
            onClick={() => dismissToast(t.id)}
            className="flex-shrink-0 mt-0.5 opacity-50 hover:opacity-100 transition-opacity"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
