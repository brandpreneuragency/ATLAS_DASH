import { useMemo } from 'react';
import { useFormsStore } from '../../../stores/formsStore';
import { useUIStore } from '../../../stores/uiStore';
import { LayoutPanelTop, Plus, FileText } from 'lucide-react';
import '../forms.css';

function dateLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export function TemplatesList() {
  const templates = useFormsStore((s) => s.templates);
  const createFormFromTemplate = useFormsStore((s) => s.createFormFromTemplate);
  const setActiveFormsPage = useUIStore((s) => s.setActiveFormsPage);
  const showToast = useUIStore((s) => s.showToast);

  const sorted = useMemo(
    () => [...templates].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [templates],
  );

  const handleUse = async (templateId: string, name: string) => {
    const form = await createFormFromTemplate(templateId, `${name}`);
    if (form) {
      setActiveFormsPage('builder');
      showToast(`Created form “${form.name}” from template.`, 'info');
    }
  };

  return (
    <>
      <div className="forms-list-section-label">Saved templates</div>
      {sorted.length === 0 ? (
        <div className="forms-list-empty-inline">
          No saved templates yet. Open a form and choose “Save as template”.
        </div>
      ) : (
        sorted.map((t) => {
          const fieldCount = t.schema.fields.filter((f) => f.type !== 'submit').length;
          return (
            <div key={t.id} className="forms-list-item" style={{ cursor: 'default' }}>
              <span className="forms-list-item-title">
                <LayoutPanelTop size={12} className="forms-muted" />
                <span className="trunc forms-grow">{t.name}</span>
                <button
                  type="button"
                  className="forms-action-btn forms-action-btn--ghost"
                  style={{ height: 22, padding: '0 8px', fontSize: 'var(--fs-xs)' }}
                  onClick={() => void handleUse(t.id, t.name)}
                  title="Create form from template"
                >
                  <Plus size={12} /> Use
                </button>
              </span>
              <span className="forms-list-item-meta">
                <FileText size={11} />
                <span>{fieldCount} fields</span>
                <span>·</span>
                <span>{dateLabel(t.createdAt)}</span>
              </span>
            </div>
          );
        })
      )}
    </>
  );
}
