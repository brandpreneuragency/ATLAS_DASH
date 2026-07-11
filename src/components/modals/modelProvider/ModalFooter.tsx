import { Check } from 'lucide-react';

interface ModalFooterProps {
  hasChanges: boolean;
  ready: boolean;
  saving: boolean;
  saved: boolean;
  onSave: () => void;
}

export function ModalFooter({ hasChanges, ready, saving, saved, onSave }: ModalFooterProps) {
  return (
    <div
      className="row"
      style={{
        padding: '12px 16px',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      <div style={{ minHeight: 20 }}>
        {hasChanges && (
          <span className="subtle" style={{ fontSize: 'var(--fs-xs)', fontStyle: 'italic' }}>
            Unsaved changes
          </span>
        )}
        {!hasChanges && saved && (
          <span className="row-xs" style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-accent-center-panel)' }}>
            <Check size={12} />
            Settings saved
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={!ready || saving}
        className="btn-brand"
        style={{ width: 'fit-content', opacity: ready && !saving ? 1 : 0.4 }}
      >
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  );
}
