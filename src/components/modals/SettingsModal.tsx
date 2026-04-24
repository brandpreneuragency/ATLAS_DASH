import { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, Moon, Sun, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../stores/uiStore';
import { useAIStore } from '../../stores/aiStore';

const FONT_FAMILIES = ['Inter', 'Georgia', 'Arial', 'Verdana', 'Trebuchet MS'];

export function SettingsModal() {
  const { t } = useTranslation();
  const {
    activeModal, setActiveModal,
    editorFontFamily, setEditorFontFamily,
    editorFontSize, setEditorFontSize,
    isDarkMode, setIsDarkMode,
    language, setLanguage,
  } = useUIStore();
  const systemInstructions = useAIStore((s) => s.systemInstructions);
  const saveSystemInstructions = useAIStore((s) => s.saveSystemInstructions);

  const [fontOpen, setFontOpen] = useState(false);
  const fontRef = useRef<HTMLDivElement>(null);
  const [instructionsText, setInstructionsText] = useState('');
  const [instructionsSaved, setInstructionsSaved] = useState(false);

  useEffect(() => {
    setInstructionsText(systemInstructions);
  }, [systemInstructions]);

  const handleSaveInstructions = async () => {
    await saveSystemInstructions(instructionsText);
    setInstructionsSaved(true);
    setTimeout(() => setInstructionsSaved(false), 2000);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (fontRef.current && !fontRef.current.contains(e.target as Node)) setFontOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (activeModal !== 'settings') return null;

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">{t('settings.title')}</h2>
          <button
            onClick={() => setActiveModal(null)}
            aria-label={t('settings.close')}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* AI Models */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">{t('settings.aiModels')}</h3>
            <button
              onClick={() => setActiveModal('modelManagement')}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-border hover:bg-gray-50 transition-colors text-sm text-text-primary"
            >
              <span>{t('settings.manageProviders')}</span>
              <span className="text-text-secondary text-xs">→</span>
            </button>
          </div>

          {/* System Instructions */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-1">{t('settings.systemInstructions')}</h3>
            <p className="text-xs text-text-secondary mb-3">{t('settings.systemInstructionsHint')}</p>
            <textarea
              value={instructionsText}
              onChange={(e) => setInstructionsText(e.target.value)}
              placeholder={t('settings.systemInstructionsPlaceholder')}
              rows={4}
              className="w-full text-xs border border-border rounded-xl px-3 py-2.5 outline-none focus:border-brand resize-y font-mono text-text-primary placeholder-text-secondary bg-white"
            />
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={handleSaveInstructions}
                className="flex items-center gap-1.5 text-xs font-semibold bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-brand/90 transition-colors"
              >
                {instructionsSaved ? <Check size={12} /> : null}
                {instructionsSaved ? t('settings.saved') : t('settings.save')}
              </button>
            </div>
          </div>

          {/* Appearance */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">{t('settings.appearance')}</h3>
            {/* 2-column row: Dark Mode + Text Size */}
            <div className="grid grid-cols-2 gap-x-6 mb-3">
              {/* Dark Mode */}
              <div className="flex items-center justify-between py-0.5">
                <label className="text-xs text-text-secondary">{t('settings.darkMode')}</label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isDarkMode}
                  title={isDarkMode ? t('settings.disableDark') : t('settings.enableDark')}
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
                    isDarkMode ? 'bg-brand' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`toggle-knob absolute top-[2px] left-0 w-5 h-5 rounded-full shadow-sm transition-transform duration-200 flex items-center justify-center ${
                      isDarkMode ? 'translate-x-[26px]' : 'translate-x-[2px]'
                    }`}
                  >
                    {isDarkMode
                      ? <Moon size={11} className="text-brand" />
                      : <Sun  size={11} className="text-gray-400" />}
                  </span>
                </button>
              </div>

              {/* Text Size */}
              <div className="flex items-center justify-between py-0.5">
                <label className="text-xs text-text-secondary">{t('settings.textSize')}</label>
                <div className="flex items-center gap-0.5 border border-border rounded-full px-1 py-0.5">
                  <button
                    type="button"
                    disabled={editorFontSize <= 12}
                    onClick={() => setEditorFontSize((editorFontSize - 2) as 12 | 14 | 16)}
                    className="w-5 h-5 flex items-center justify-center rounded-full text-text-secondary hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-sm leading-none"
                  >
                    −
                  </button>
                  <span className="text-xs text-text-primary w-8 text-center">{editorFontSize}px</span>
                  <button
                    type="button"
                    disabled={editorFontSize >= 16}
                    onClick={() => setEditorFontSize((editorFontSize + 2) as 12 | 14 | 16)}
                    className="w-5 h-5 flex items-center justify-center rounded-full text-text-secondary hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-sm leading-none"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Font Family — full width */}
            <div className="mb-3">
              <label className="text-xs text-text-secondary mb-1.5 block">{t('settings.fontFamily')}</label>
              <div ref={fontRef} className="relative">
                <button
                  type="button"
                  onClick={() => setFontOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-border bg-white hover:bg-gray-50 transition-colors text-sm text-text-primary"
                >
                  <span style={{ fontFamily: editorFontFamily }}>{editorFontFamily}</span>
                  <ChevronDown size={14} className={`text-text-secondary transition-transform ${fontOpen ? 'rotate-180' : ''}`} />
                </button>
                {fontOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-border rounded-xl shadow-lg z-10 py-1 overflow-hidden">
                    {FONT_FAMILIES.map((font) => (
                      <button
                        type="button"
                        key={font}
                        onClick={() => { setEditorFontFamily(font); setFontOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                          editorFontFamily === font ? 'bg-highlight text-brand' : 'text-text-primary hover:bg-gray-50'
                        }`}
                        style={{ fontFamily: font }}
                      >
                        {font}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Language */}
            <div className="flex items-center justify-between py-0.5">
              <label className="text-xs text-text-secondary">{t('settings.language')}</label>
              <div className="flex items-center gap-1 border border-border rounded-full px-1 py-0.5">
                {(['en', 'tr'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLanguage(lang)}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                      language === lang
                        ? 'bg-brand text-white'
                        : 'text-text-secondary hover:bg-gray-100'
                    }`}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
