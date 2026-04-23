import { useTranslation } from 'react-i18next';

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  onSave?: () => void;
  confirmLabel?: string;
}

export function ConfirmDialog({ message, onConfirm, onCancel, onSave, confirmLabel }: ConfirmDialogProps) {
  const { t } = useTranslation();
  const resolvedConfirmLabel = confirmLabel ?? t('confirm.dontSave');
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl border border-border px-6 py-5 w-72 flex flex-col gap-4">
        <p className="text-sm text-text-primary">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs border border-border rounded-lg text-text-secondary hover:bg-gray-50 transition-colors"
          >
            {t('confirm.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3 py-1.5 text-xs bg-red-400 text-white rounded-lg hover:bg-red-500 transition-colors font-semibold"
          >
            {resolvedConfirmLabel}
          </button>
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              className="px-3 py-1.5 text-xs bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors font-semibold"
            >
              {t('confirm.save')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
