import { useState, useRef, useEffect } from 'react';
import { Menu, Copy, FileText, FileDown, AlignLeft, Code, Hash, Settings, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDocumentStore } from '../../stores/documentStore';
import { useUIStore } from '../../stores/uiStore';
import { exportDocx, exportPdf, exportTxt, exportMd, exportHtml } from '../../services/export';

export function HamburgerMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { getActiveDocument, duplicateDocument, activeDocumentId } = useDocumentStore();
  const { setActiveModal } = useUIStore();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSaveAsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleAction = async (action: string) => {
    setOpen(false);
    setSaveAsOpen(false);
    const doc = getActiveDocument();
    if (!doc) return;

    switch (action) {
      case 'duplicate':
        if (activeDocumentId) await duplicateDocument(activeDocumentId);
        break;
      case 'docx':
        await exportDocx(doc);
        break;
      case 'pdf':
        await exportPdf(doc);
        break;
      case 'txt':
        exportTxt(doc);
        break;
      case 'md':
        exportMd(doc);
        break;
      case 'html':
        exportHtml(doc);
        break;
      case 'settings':
        setActiveModal('settings');
        break;
    }
  };

  const saveAsFormats = [
    { id: 'md', label: '.md', icon: Hash },
    { id: 'txt', label: '.txt', icon: AlignLeft },
    { id: 'docx', label: '.docx', icon: FileText },
    { id: 'pdf', label: '.pdf', icon: FileDown },
    { id: 'html', label: '.html', icon: Code },
  ];

  return (
    <div ref={ref} className="relative mx-1.5">
      <button
        onClick={() => { setOpen((v) => !v); setSaveAsOpen(false); }}
        className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-100 text-text-secondary transition-colors"
        title={t('menu.menu')}
      >
        <Menu size={18} />
      </button>

      {open && (
        <div className="dropdown-menu absolute left-0 top-full mt-1 w-52 bg-white border border-border rounded-lg shadow-lg z-50 py-1">
          <button
            onClick={() => handleAction('duplicate')}
            className="flex items-center gap-3 w-full px-4 py-2 text-sm text-text-primary hover:bg-gray-50 transition-colors"
          >
            <Copy size={15} className="text-text-secondary" />
            {t('menu.duplicate')}
          </button>

          <div className="relative">
            <button
              onClick={() => setSaveAsOpen((v) => !v)}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-text-primary hover:bg-gray-50 transition-colors"
            >
              <FileDown size={15} className="text-text-secondary" />
              <span className="flex-1 text-left">{t('menu.saveAs')}</span>
              <ChevronRight size={13} className="text-text-secondary" />
            </button>

            {saveAsOpen && (
              <div className="absolute left-full top-0 ml-1 w-40 bg-white border border-border rounded-lg shadow-lg z-50 py-1">
                {saveAsFormats.map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => handleAction(fmt.id)}
                    className="flex items-center gap-3 w-full px-4 py-2 text-sm text-text-primary hover:bg-gray-50 transition-colors"
                  >
                    <fmt.icon size={15} className="text-text-secondary" />
                    {fmt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border my-1" />

          <button
            onClick={() => handleAction('settings')}
            className="flex items-center gap-3 w-full px-4 py-2 text-sm text-text-primary hover:bg-gray-50 transition-colors"
          >
            <Settings size={15} className="text-text-secondary" />
            {t('menu.settings')}
          </button>
        </div>
      )}
    </div>
  );
}
