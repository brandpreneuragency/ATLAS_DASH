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
    <div id="confirm-dialog-overlay" className="confirm-overlay">
      <div id="confirm-dialog" className="confirm-box col" style={{ gap: 16 }}>
        <p id="confirm-dialog-msg" className="med" style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-text-1)' }}>{message}</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button
            id="confirm-cancel-btn"
            type="button"
            onClick={onCancel}
            className="btn-xs"
            style={{ background: 'transparent', border: '1px solid var(--c-border-1)', color: 'var(--c-text-2)' }}
          >
            {t('confirm.cancel')}
          </button>
          <button
            id="confirm-delete-btn"
            type="button"
            onClick={onConfirm}
            className="btn-xs semibold"
            style={{ background: 'var(--c-background-3)', color: 'var(--c-text-1)', border: 'none' }}
          >
            {resolvedConfirmLabel}
          </button>
          {onSave && (
            <button
              id="confirm-save-btn"
              type="button"
              onClick={onSave}
              className="btn-brand semibold"
            >
              {t('confirm.save')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
