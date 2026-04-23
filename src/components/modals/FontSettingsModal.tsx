import { X } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

export function FontSettingsModal() {
  const { activeModal, setActiveModal, editorFontFamily, editorTextProportions, setEditorFontFamily, setEditorTextProportions } = useUIStore();

  if (activeModal !== 'fontSettings') return null;

  const fontOptions = [
    { value: 'Inter', label: 'Inter' },
    { value: 'Arial', label: 'Arial' },
    { value: 'Times New Roman', label: 'Times New Roman' },
    { value: 'Georgia', label: 'Georgia' },
    { value: 'Courier New', label: 'Courier New' },
  ];

  const sizeOptions = [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'big', label: 'Big' },
  ];

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">Font Settings</h2>
          <button
            onClick={() => setActiveModal(null)}
            aria-label="Close font settings"
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Font Family</h3>
            <select
              value={editorFontFamily}
              onChange={(e) => setEditorFontFamily(e.target.value)}
              title="Select font family"
              className="w-full p-3 rounded-xl border border-border bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            >
              {fontOptions.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Font Size</h3>
            <div className="space-y-2">
              {sizeOptions.map((size) => (
                <button
                  key={size.value}
                  onClick={() => setEditorTextProportions(size.value as 'small' | 'medium' | 'big')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors text-sm text-text-primary ${
                    editorTextProportions === size.value
                      ? 'border-brand bg-brand/10'
                      : 'border-border hover:bg-gray-50'
                  }`}
                >
                  <span>{size.label}</span>
                  {editorTextProportions === size.value && (
                    <span className="text-brand text-xs">✓</span>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-3 text-xs text-text-secondary">
              <p>Small: Current font size</p>
              <p>Medium: +2px to font sizes</p>
              <p>Big: +4px to font sizes</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}