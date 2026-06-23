import { Check } from 'lucide-react';

interface ModalFooterProps {
  hasChanges: boolean;
  saving: boolean;
  saved: boolean;
  onSave: () => void;
}

export function ModalFooter({ hasChanges, saving, saved, onSave }: ModalFooterProps) {
  return (
    <div
      className="row"
      style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--c-border-1)',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      <div style={{ minHeight: 20 }}>
        {hasChanges && !saved && (
          <span className="subtle" style={{ fontSize: 'var(--fs-xs)', fontStyle: 'italic' }}>
            Unsaved changes
          </span>
        )}
        {saved && (
          <span className="row-xs" style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-accent-center-panel)' }}>
            <Check size={12} />
            Saved
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={!hasChanges || saving}
        className="btn-brand"
        style={{ width: 'fit-content', opacity: hasChanges && !saving ? 1 : 0.4 }}
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}
