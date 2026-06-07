import { useState, useRef, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../stores/uiStore';
import { ImportSection } from './ImportSection';

const FONT_FAMILIES = ['Inter', 'Georgia', 'Arial', 'Verdana', 'Trebuchet MS'];

export function SettingsModal() {
  const { t } = useTranslation();
  const {
    activeModal, setActiveModal,
    editorFontFamily, setEditorFontFamily,
    editorFontSize, setEditorFontSize,
    language, setLanguage,
  } = useUIStore();

  const [fontOpen, setFontOpen] = useState(false);
  const fontRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (fontRef.current && !fontRef.current.contains(e.target as Node)) setFontOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (activeModal !== 'settings') return null;

  return (
    <div className="overlay" id="settings-overlay">
      <div className="modal modal--md" id="settings-modal">
        <div className="modal-head">
          <h2>{t('settings.title')}</h2>
          <button
            onClick={() => setActiveModal(null)}
            aria-label={t('settings.close')}
            className="modal-close"
            id="settings-close-btn"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" id="settings-body">
          {/* AI Models */}
          <div>
            <h3 className="semibold" style={{ fontSize: 'var(--fs-sm)', marginBottom: 12 }}>{t('settings.aiModels')}</h3>
            <button
              onClick={() => setActiveModal('modelManagement')}
              className="btn w-full"
              style={{ padding: 12, borderRadius: 12, fontSize: 'var(--fs-sm)', justifyContent: 'space-between' }}
            >
              <span>{t('settings.manageProviders')}</span>
              <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>→</span>
            </button>
          </div>

          <div>
            <h3 className="semibold" style={{ fontSize: 'var(--fs-sm)', marginBottom: 12 }}>{t('settings.appearance')}</h3>
            <div style={{ marginBottom: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
                <label className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>{t('settings.textSize')}</label>
                <div className="row-xs" style={{ border: '1px solid var(--c-border-1)', borderRadius: 9999, padding: '2px 4px' }}>
                  <button
                    type="button"
                    disabled={editorFontSize <= 12}
                    onClick={() => setEditorFontSize((editorFontSize - 2) as 12 | 14 | 16)}
                    className="btn-icon"
                    style={{ width: 20, height: 20, borderRadius: 9999, fontSize: 'var(--fs-sm)', lineHeight: 1, opacity: editorFontSize <= 12 ? 0.3 : 1, cursor: editorFontSize <= 12 ? 'not-allowed' : 'pointer' }}
                  >
                    −
                  </button>
                  <span className="nowrap" style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-1)', width: 32, textAlign: 'center' }}>{editorFontSize}px</span>
                  <button
                    type="button"
                    disabled={editorFontSize >= 16}
                    onClick={() => setEditorFontSize((editorFontSize + 2) as 12 | 14 | 16)}
                    className="btn-icon"
                    style={{ width: 20, height: 20, borderRadius: 9999, fontSize: 'var(--fs-sm)', lineHeight: 1, opacity: editorFontSize >= 16 ? 0.3 : 1, cursor: editorFontSize >= 16 ? 'not-allowed' : 'pointer' }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Font Family — full width */}
            <div style={{ marginBottom: 12 }}>
              <label className="subtle" style={{ fontSize: 'var(--fs-xs)', display: 'block', marginBottom: 6 }}>{t('settings.fontFamily')}</label>
              <div ref={fontRef} className="relative">
                <button
                  type="button"
                  onClick={() => setFontOpen((v) => !v)}
                  className="btn w-full"
                  style={{ padding: 10, borderRadius: 12, fontSize: 'var(--fs-sm)', justifyContent: 'space-between' }}
                >
                  <span style={{ fontFamily: editorFontFamily }}>{editorFontFamily}</span>
                  <ChevronDown size={14} className="subtle" style={{ transform: fontOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }} />
                </button>
                {fontOpen && (
                  <div className="drop" style={{ left: 0, right: 0, borderRadius: 12 }}>
                    {FONT_FAMILIES.map((font) => (
                      <button
                        type="button"
                        key={font}
                        onClick={() => { setEditorFontFamily(font); setFontOpen(false); }}
                        className="drop-item"
                        style={{
                          fontFamily: font,
                          fontSize: 'var(--fs-sm)',
                          background: editorFontFamily === font ? 'var(--c-background-4)' : undefined,
                          color: editorFontFamily === font ? 'var(--c-accent-center-panel)' : undefined,
                        }}
                      >
                        {font}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Language */}
            <div className="row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
              <label className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>{t('settings.language')}</label>
              <div className="row-xs" style={{ border: '1px solid var(--c-border-1)', borderRadius: 9999, padding: '2px 4px' }}>
                {(['en', 'tr'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLanguage(lang)}
                    className="semibold"
                    style={{
                      padding: '2px 10px',
                      borderRadius: 9999,
                      fontSize: 'var(--fs-xs)',
                      border: 'none',
                      cursor: 'pointer',
                      background: language === lang ? 'var(--c-accent-center-panel)' : 'transparent',
                      color: language === lang ? '#fff' : 'var(--c-text-2)',
                      transition: 'background-color 0.15s, color 0.15s',
                    }}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Local data — Dexie import + clear */}
          <div>
            <ImportSection />
          </div>


        </div>
      </div>
    </div>
  );
}
