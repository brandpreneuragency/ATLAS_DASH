import { X } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

const sizeMap = { small: 12, medium: 14, big: 16 } as const;
const reverseMap: Record<number, 'small' | 'medium' | 'big'> = { 12: 'small', 14: 'medium', 16: 'big' };

export function FontSettingsModal() {
  const { activeModal, setActiveModal, editorFontFamily, editorFontSize, setEditorFontFamily, setEditorFontSize } = useUIStore();

  if (activeModal !== 'fontSettings') return null;

  const currentProportion = reverseMap[editorFontSize] ?? 'small';

  const fontOptions = [
    { value: 'Inter', label: 'Inter' },
    { value: 'Arial', label: 'Arial' },
    { value: 'Times New Roman', label: 'Times New Roman' },
    { value: 'Georgia', label: 'Georgia' },
    { value: 'Courier New', label: 'Courier New' },
  ];

  const sizeOptions: Array<{ value: 'small' | 'medium' | 'big'; label: string }> = [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'big', label: 'Big' },
  ];

  return (
    <div className="overlay" id="font-settings-overlay">
      <div className="modal modal--sm" id="font-settings-modal">
        <div className="modal-head">
          <h2>Font Settings</h2>
          <button
            id="font-settings-close-btn"
            onClick={() => setActiveModal(null)}
            aria-label="Close font settings"
            className="modal-close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div>
            <h3 className="semibold" style={{ fontSize: 'var(--fs-sm)', marginBottom: 12 }}>Font Family</h3>
            <select
              id="font-family-select"
              value={editorFontFamily}
              onChange={(e) => setEditorFontFamily(e.target.value)}
              title="Select font family"
              className="ctrl--lg w-full c-ptr"
            >
              {fontOptions.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <h3 className="semibold" style={{ fontSize: 'var(--fs-sm)', marginBottom: 12 }}>Font Size</h3>
            <div className="col gap-1" id="font-size-options">
              {sizeOptions.map((size) => (
                <button
                  key={size.value}
                  onClick={() => setEditorFontSize(sizeMap[size.value])}
                  className="btn w-full"
                  style={{
                    fontSize: 'var(--fs-sm)',
                    padding: 12,
                    borderRadius: 12,
                    justifyContent: 'space-between',
                    borderColor: currentProportion === size.value ? 'var(--c-accent-center-panel)' : 'var(--c-border-1)',
                    background: currentProportion === size.value ? 'rgba(34,197,94,0.1)' : undefined,
                  }}
                >
                  <span>{size.label}</span>
                  {currentProportion === size.value && (
                    <span style={{ color: 'var(--c-accent-center-panel)', fontSize: 'var(--fs-xs)' }}>✓</span>
                  )}
                </button>
              ))}
            </div>
            <div className="subtle" style={{ fontSize: 'var(--fs-xs)', marginTop: 12 }}>
              <p>Small: 12px</p>
              <p>Medium: 14px</p>
              <p>Big: 16px</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
