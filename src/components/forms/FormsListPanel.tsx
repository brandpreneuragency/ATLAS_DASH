import { useEffect } from 'react';
import './formsLayout.css';
import './forms.css';
import {
  LayoutDashboard,
  FileText,
  PencilRuler,
  Inbox,
  LayoutPanelTop,
  Settings,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { useUIStore, type FormsPage } from '../../stores/uiStore';
import { useFormsStore } from '../../stores/formsStore';
import { FormsNavList } from './lists/FormsNavList';
import { FormList } from './lists/FormList';
import { SubmissionList } from './lists/SubmissionList';
import { TemplatesList } from './lists/TemplatesList';
import { SettingsNav } from './lists/SettingsNav';

interface FormsNavItem {
  key: FormsPage;
  label: string;
  icon: LucideIcon;
}

const FORMS_NAV_ITEMS: FormsNavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'list', label: 'Forms', icon: FileText },
  { key: 'builder', label: 'Builder', icon: PencilRuler },
  { key: 'submissions', label: 'Submissions', icon: Inbox },
  { key: 'templates', label: 'Templates', icon: LayoutPanelTop },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const FORMS_LIST_TITLE: Record<FormsPage, string> = {
  dashboard: 'Recent Forms',
  list: 'Forms',
  builder: 'Forms',
  submissions: 'Submissions',
  templates: 'Templates',
  settings: 'Sections',
};

function renderPanel1List(page: FormsPage) {
  switch (page) {
    case 'dashboard':
      return <FormsNavList />;
    case 'list':
      return <FormList />;
    case 'builder':
      return <FormList compact />;
    case 'submissions':
      return <SubmissionList />;
    case 'templates':
      return <TemplatesList />;
    case 'settings':
      return <SettingsNav />;
  }
}

export function FormsListPanel() {
  const { activeFormsPage, setActiveFormsPage } = useUIStore();
  const isLoaded = useFormsStore((s) => s.isLoaded);
  const loadForms = useFormsStore((s) => s.loadForms);
  const createForm = useFormsStore((s) => s.createForm);
  const showToast = useUIStore((s) => s.showToast);

  useEffect(() => {
    if (!isLoaded) void loadForms();
  }, [isLoaded, loadForms]);

  const handleNewForm = async () => {
    const form = await createForm('Untitled Form');
    if (form) {
      setActiveFormsPage('builder');
      showToast('New form created. Opening builder.', 'info');
    }
  };

  const showAddButton = activeFormsPage === 'list' || activeFormsPage === 'builder';

  return (
    <div
      id="forms-list-panel"
      className="panel flex-col h-full overflow-hidden"
      style={{ marginLeft: '0px', marginRight: '0px' }}
    >
      <nav className="forms-list-nav" aria-label="Forms navigation">
        {FORMS_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === activeFormsPage;
          return (
            <button
              key={item.key}
              type="button"
              title={item.label}
              onClick={() => setActiveFormsPage(item.key)}
              className={`forms-list-nav-item${isActive ? ' forms-list-nav-item--on' : ''}`}
            >
              <Icon size={14} className="forms-list-nav-item-icon" />
              <span className="forms-list-nav-item-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div
        className="forms-list-content ai-scroll flex-1 overflow-y-a h-full"
        style={{ display: 'flex', flexDirection: 'column', paddingLeft: '18px', paddingRight: '12px', paddingTop: '12px' }}
      >
        <div className="forms-list-header">
          <span className="forms-list-header-title">{FORMS_LIST_TITLE[activeFormsPage]}</span>
        </div>
        {renderPanel1List(activeFormsPage)}
      </div>

      <div className="panel-footer forms-list-footer">
        {showAddButton ? (
          <button type="button" className="forms-list-add-btn" title="New form" onClick={handleNewForm}>
            <Plus size={14} />
            <span>New form</span>
          </button>
        ) : (
          <span className="forms-list-footer-hint subtle">{FORMS_LIST_TITLE[activeFormsPage]}</span>
        )}
      </div>
    </div>
  );
}
