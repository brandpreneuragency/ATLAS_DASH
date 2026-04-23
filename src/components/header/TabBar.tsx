import { Plus } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentStore } from '../../stores/documentStore';
import { Tab } from './Tab';

const COMPACT_THRESHOLD = 6;

export function TabBar() {
  const { t } = useTranslation();
  const { documents, activeDocumentId, setActiveDocument, deleteDocument, createDocument, updateDocument } =
    useDocumentStore();

  const compactMode = documents.length > COMPACT_THRESHOLD;
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleWheel = (e: React.WheelEvent) => {
    if (!scrollRef.current) return;
    e.preventDefault();
    scrollRef.current.scrollLeft += e.deltaY;
  };

  return (
    <div ref={scrollRef} onWheel={handleWheel} className="flex items-end gap-0 overflow-x-auto overflow-y-hidden flex-1 min-w-0 border-b-0">
      {documents.map((doc) => (
        <Tab
          key={doc.id}
          doc={doc}
          isActive={doc.id === activeDocumentId}
          compressed={compactMode && doc.id !== activeDocumentId}
          onSelect={() => setActiveDocument(doc.id)}
          onClose={() => deleteDocument(doc.id)}
          onRename={(newTitle) => updateDocument(doc.id, { title: newTitle })}
        />
      ))}
      <button
        type="button"
        onClick={() => createDocument(t('tabs.untitled'))}
        className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-gray-100 text-text-secondary transition-colors flex-shrink-0 mb-[10px] ml-[5px]"
        title={t('tabs.newTab')}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
